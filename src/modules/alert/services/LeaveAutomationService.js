/**
 * @file LeaveAutomationService.js
 * @description Monitors leave (Permission) records and fires alerts when:
 * - A student's leave has expired but they haven't returned (LEAVE_OVERDUE)
 * - A student left without an approved leave (LEFT_WITHOUT_LEAVE)
 * - Leave status changes (LEAVE_REQUESTED / LEAVE_APPROVED / LEAVE_REJECTED / LEAVE_CANCELLED)
 *
 * SCHEDULING:
 * checkExpiredLeaves() runs every 30 minutes via cron/BullMQ.
 * Why 30 min? Frequent enough to catch overdue returns quickly, but not so
 * frequent as to hammer the DB on every minute.
 *
 * DEDUPLICATION:
 * LeaveViolation has a unique index on permissionId. Upsert prevents duplicates.
 * escalationLog tracks the escalation history so we don't re-send same-level alerts.
 */

'use strict';

const Permission = require('../../../models/Permission');
const User = require('../../../models/User');
const Attendance = require('../../../models/Attendance');
const LeaveViolation = require('../models/LeaveViolation');
const HostelAlertService = require('./HostelAlertService');
const { ALERT_TYPES, THRESHOLDS } = require('../utils/constants');
const {
  buildLeaveOverdueMessage,
  formatDateTime,
  minutesSince,
} = require('../utils/alertHelpers');

class LeaveAutomationService {
  /**
   * Check all expired leave permissions and alert on violations.
   * Designed to be called every 30 minutes by the scheduler.
   *
   * @returns {Promise<{ checked: number, violations: number, escalated: number }>}
   */
  static async checkExpiredLeaves() {
    console.log('[LeaveAutomation] Checking expired leaves...');

    const now = new Date();

    // Find all approved leave permissions that have expired (returnDate is in the past)
    // Include 'leave', 'overnight', 'multi-day' but not 'late-entry'
    const expiredLeaves = await Permission.find({
      status: 'approved',
      permissionType: { $in: ['leave', 'overnight', 'multi-day'] },
      returnDate: { $lt: now },
    })
      .select('studentId returnDate permissionType reason requestedDate')
      .lean();

    if (expiredLeaves.length === 0) {
      console.log('[LeaveAutomation] No expired leaves found.');
      return { checked: 0, violations: 0, escalated: 0 };
    }

    const stats = { checked: expiredLeaves.length, violations: 0, escalated: 0 };

    for (const leave of expiredLeaves) {
      try {
        await this._processExpiredLeave(leave, now);
        stats.violations++;
      } catch (err) {
        console.error(`[LeaveAutomation] Error for permission ${leave._id}:`, err.message);
      }
    }

    console.log('[LeaveAutomation] Expired leave check done:', stats);
    return stats;
  }

  /**
   * Process a single expired leave record.
   * Checks if the student is back, creates/updates LeaveViolation, escalates if needed.
   *
   * @param {Object} leave - Permission document (lean)
   * @param {Date} now
   */
  static async _processExpiredLeave(leave, now) {
    const student = await User.findById(leave.studentId)
      .select('_id name hostelId roomId')
      .lean();
    if (!student || !student.hostelId) return;

    const hostelId = String(student.hostelId);

    // Check if student is already back inside
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const latestAttendance = await Attendance.findOne({
      studentId: leave.studentId,
      hostelId,
      date: { $gte: today },
    })
      .sort({ date: -1 })
      .select('status checkInTime')
      .lean();

    const isBack = latestAttendance && latestAttendance.status === 'inside';

    // Find or create a LeaveViolation for this permission
    let violation = await LeaveViolation.findOne({ permissionId: leave._id });

    if (isBack) {
      // Student has returned — resolve any open violation
      if (violation && violation.status === 'open') {
        violation.status = 'returned';
        violation.actualReturnTime = latestAttendance.checkInTime || now;
        await violation.save();
      }
      return; // No alert needed
    }

    // Student is NOT back — calculate hours overdue
    const hoursOverdue = (now - new Date(leave.returnDate)) / 3600000;

    if (hoursOverdue < THRESHOLDS.LEAVE_OVERDUE_THRESHOLD_HOURS) {
      // Within grace period — no alert yet
      return;
    }

    if (!violation) {
      // Create new LeaveViolation
      violation = new LeaveViolation({
        studentId: leave.studentId,
        hostelId,
        permissionId: leave._id,
        roomNumber: student.roomId ? 'See Profile' : 'N/A',
        leaveEndTime: leave.returnDate,
        detectedAt: now,
        hoursOverdue,
        status: 'open',
        escalationLevel: 0,
      });
    }

    // Determine if we need to send a new alert (avoid repeat notifications)
    const lastAlert = violation.alertsSent && violation.alertsSent.length > 0
      ? violation.alertsSent[violation.alertsSent.length - 1]
      : null;
    const hoursSinceLastAlert = lastAlert
      ? (now - new Date(lastAlert.sentAt)) / 3600000
      : Infinity;

    // Send new alert if: no previous alert, or last alert was >2 hours ago
    if (hoursSinceLastAlert > 2) {
      const message = buildLeaveOverdueMessage({
        studentName: student.name,
        roomNumber: violation.roomNumber,
        leaveEndTime: leave.returnDate,
        hoursOverdue,
      });

      const alertDoc = await HostelAlertService.send({
        type: ALERT_TYPES.LEAVE_OVERDUE,
        title: 'Student Has Not Returned from Leave',
        message,
        hostelId,
        studentId: String(leave.studentId),
        recipientRole: 'warden',
        metadata: {
          permissionId: String(leave._id),
          leaveType: leave.permissionType,
          leaveEndTime: leave.returnDate,
          hoursOverdue: Math.round(hoursOverdue * 10) / 10,
          studentName: student.name,
        },
        sendPush: true,
      });

      violation.alertsSent = violation.alertsSent || [];
      violation.alertsSent.push({
        alertId: alertDoc._id,
        sentAt: now,
        alertType: ALERT_TYPES.LEAVE_OVERDUE,
      });

      // Escalate if overdue > 12 hours and not yet escalated to admin
      if (hoursOverdue > 12 && violation.escalationLevel < 1) {
        await this._escalateToAdmin(violation, student, leave, hostelId, hoursOverdue, message);
      }
    }

    await violation.save();
  }

  /**
   * Escalate a leave violation to hostel admin level.
   *
   * @param {Object} violation - LeaveViolation mongoose doc
   * @param {Object} student
   * @param {Object} leave
   * @param {string} hostelId
   * @param {number} hoursOverdue
   * @param {string} message
   */
  static async _escalateToAdmin(violation, student, leave, hostelId, hoursOverdue, message) {
    await HostelAlertService.send({
      type: ALERT_TYPES.LEAVE_OVERDUE,
      title: 'ESCALATED: Student Missing After Leave',
      message: `[ESCALATED] ${message} This student has been missing for over ${Math.round(hoursOverdue)} hours.`,
      hostelId,
      studentId: String(student._id),
      recipientRole: 'owner',
      metadata: {
        permissionId: String(leave._id),
        hoursOverdue: Math.round(hoursOverdue * 10) / 10,
        escalationLevel: 1,
      },
      priority: 'urgent',
      sendPush: true,
    });

    violation.escalationLevel = 1;
    violation.status = 'escalated';
    violation.escalationLog = violation.escalationLog || [];
    violation.escalationLog.push({
      level: 1,
      escalatedTo: 'admin',
      escalatedAt: new Date(),
      note: `Overdue by ${Math.round(hoursOverdue)} hours`,
    });
  }

  /**
   * Handle leave lifecycle events (approved, rejected, etc.)
   * Called from the event handler when a warden approves/rejects leave.
   *
   * @param {Object} opts
   * @param {string} opts.type - ALERT_TYPES constant
   * @param {string} opts.studentId
   * @param {string} opts.hostelId
   * @param {string} opts.permissionId
   * @param {string} opts.reason
   * @param {Date} opts.returnDate
   */
  static async handleLeaveEvent({ type, studentId, hostelId, permissionId, reason, returnDate }) {
    const student = await User.findById(studentId).select('name').lean();
    if (!student) return;

    const titleMap = {
      [ALERT_TYPES.LEAVE_REQUESTED]: 'New Leave Request',
      [ALERT_TYPES.LEAVE_APPROVED]: 'Leave Request Approved',
      [ALERT_TYPES.LEAVE_REJECTED]: 'Leave Request Rejected',
      [ALERT_TYPES.LEAVE_CANCELLED]: 'Leave Cancelled',
    };

    const messageMap = {
      [ALERT_TYPES.LEAVE_REQUESTED]: `${student.name} has requested leave until ${formatDateTime(returnDate)}.`,
      [ALERT_TYPES.LEAVE_APPROVED]: `Your leave request has been approved. Return by ${formatDateTime(returnDate)}.`,
      [ALERT_TYPES.LEAVE_REJECTED]: `Your leave request has been rejected. Reason: ${reason || 'Not specified'}.`,
      [ALERT_TYPES.LEAVE_CANCELLED]: `Your leave request has been cancelled.`,
    };

    const isStudentNotif = [ALERT_TYPES.LEAVE_APPROVED, ALERT_TYPES.LEAVE_REJECTED].includes(type);

    // Notify wardens of new requests, notify students of decisions
    if (isStudentNotif) {
      await HostelAlertService.sendToUser({
        userId: studentId,
        type,
        title: titleMap[type] || 'Leave Update',
        message: messageMap[type] || `Leave status changed.`,
        hostelId,
        studentId,
        metadata: { permissionId, reason, returnDate },
        sendPush: true,
      });
    } else {
      await HostelAlertService.send({
        type,
        title: titleMap[type] || 'Leave Update',
        message: messageMap[type] || `${student.name} leave status changed.`,
        hostelId,
        studentId,
        recipientRole: 'warden',
        metadata: { permissionId, reason, returnDate, studentName: student.name },
        sendPush: false,
      });
    }
  }
}

module.exports = LeaveAutomationService;
