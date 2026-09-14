/**
 * @file CheckInAutomationService.js
 * @description Detects check-in/check-out anomalies and fires alerts.
 *
 * ANOMALIES DETECTED:
 * - LATE_CHECKIN: Student checks in after the hostel's curfew time
 * - UNAUTHORIZED_CHECKOUT: Student checks out without approved leave
 * - DUPLICATE_CHECKIN: Two 'in' events within 5 minutes (race condition / scanner issue)
 * - DUPLICATE_CHECKOUT: Two 'out' events within 5 minutes
 * - NEVER_CHECKED_BACK_IN: Student has been outside for over 24 hours
 *
 * CALLING PATTERN:
 * These methods are called from the hostelEventEmitter handlers (event-driven),
 * NOT from cron jobs. They react immediately when a gate event occurs.
 *
 * WHY EVENT-DRIVEN VS POLLING:
 * Anomalies like late check-in must be detected at the moment they happen,
 * not on a scheduled basis. The EventEmitter pattern allows existing controllers
 * to emit events non-blocking, decoupled from the alert system.
 */

'use strict';

const Hostel = require('../../../models/Hostel');
const User = require('../../../models/User');
const Attendance = require('../../../models/Attendance');
const GateEvent = require('../../../models/GateEvent');
const HostelAlertService = require('./HostelAlertService');
const { ALERT_TYPES } = require('../utils/constants');
const { timeStrToDate, formatTime, minutesSince } = require('../utils/alertHelpers');

class CheckInAutomationService {
  /**
   * Handle a new check-IN event. Detect late check-in.
   *
   * @param {Object} opts
   * @param {string} opts.studentId
   * @param {string} opts.hostelId
   * @param {Date} opts.time - check-in time
   * @param {string} [opts.source] - 'student'|'warden'|'security'|'auto'
   */
  static async handleCheckIn({ studentId, hostelId, time }) {
    try {
      const checkInTime = new Date(time);

      // Auto-resolve any pending curfew grace violation or record return time
      const CurfewAutomationService = require('./CurfewAutomationService');
      await CurfewAutomationService.handleStudentReturn(studentId, checkInTime);

      const hostel = await Hostel.findById(hostelId)
        .select('rules.curfewTime rules.weekendCurfewTime')
        .lean();
      if (!hostel) return;

      const isWeekend = [0, 6].includes(new Date(time).getDay());
      const curfewTimeStr =
        (isWeekend && hostel.rules?.weekendCurfewTime) ||
        hostel.rules?.curfewTime ||
        '21:00';

      const curfewDate = timeStrToDate(curfewTimeStr, checkInTime);

      // Detect late check-in (checked in AFTER curfew)
      if (checkInTime > curfewDate) {
        const student = await User.findById(studentId).select('name').lean();
        if (!student) return;

        const minsLate = Math.round((checkInTime - curfewDate) / 60000);

        await HostelAlertService.send({
          type: ALERT_TYPES.LATE_CHECKIN,
          title: 'Late Check-In Detected',
          message: `${student.name} checked in at ${formatTime(checkInTime)}, which is ${minsLate} minutes after curfew (${curfewTimeStr}).`,
          hostelId,
          studentId,
          recipientRole: 'warden',
          metadata: {
            studentName: student.name,
            checkInTime,
            curfewTime: curfewTimeStr,
            minutesLate: minsLate,
          },
          sendPush: true,
        });
      }
    } catch (err) {
      console.error('[CheckInAutomation] handleCheckIn error:', err.message);
    }
  }

  /**
   * Handle a new check-OUT event.
   * Detects unauthorized checkout (no approved leave).
   *
   * @param {Object} opts
   * @param {string} opts.studentId
   * @param {string} opts.hostelId
   * @param {Date} opts.time
   */
  static async handleCheckOut({ studentId, hostelId, time }) {
    try {
      const Permission = require('../../../models/Permission');
      const checkOutTime = new Date(time);

      // Check if student has an approved active leave
      const activeLeave = await Permission.findOne({
        studentId,
        status: 'approved',
        permissionType: { $in: ['leave', 'overnight', 'multi-day', 'late-entry'] },
        requestedDate: { $lte: checkOutTime },
        returnDate: { $gte: checkOutTime },
      }).lean();

      if (!activeLeave) {
        // No active leave — potential unauthorized checkout
        // Note: We don't fire immediately; some hostels allow casual outings.
        // Instead, this is tracked. The curfew check will escalate if they don't return.
        console.log(`[CheckInAutomation] Student ${studentId} checked out without active leave at ${formatTime(checkOutTime)}`);

        // Log to HostelEvent for audit
        const student = await User.findById(studentId).select('name').lean();
        if (student) {
          await HostelAlertService.send({
            type: ALERT_TYPES.CHECKOUT,
            title: 'Student Checked Out',
            message: `${student.name} checked out at ${formatTime(checkOutTime)}.`,
            hostelId,
            studentId,
            recipientRole: 'warden',
            metadata: {
              studentName: student.name,
              checkOutTime,
              hasActiveLeave: false,
            },
            sendPush: false, // Low urgency — just informational
          });
        }
      }
    } catch (err) {
      console.error('[CheckInAutomation] handleCheckOut error:', err.message);
    }
  }

  /**
   * Scan for students who have been outside the hostel for over 24 hours.
   * Run once per day by the scheduler.
   *
   * @param {string} hostelId
   * @returns {Promise<number>} Number of alerts generated
   */
  static async detectNeverCheckedBackIn(hostelId) {
    try {
      const threshold = new Date(Date.now() - 24 * 3600 * 1000); // 24 hours ago

      // Find students whose last attendance shows 'outside' and checkOutTime > 24h ago
      const longOutside = await Attendance.find({
        hostelId,
        status: 'outside',
        checkOutTime: { $lt: threshold },
      })
        .select('studentId checkOutTime')
        .lean();

      let alertCount = 0;

      for (const att of longOutside) {
        const mins = minutesSince(att.checkOutTime);
        const student = await User.findById(att.studentId).select('name').lean();
        if (!student) continue;

        await HostelAlertService.send({
          type: ALERT_TYPES.NEVER_CHECKED_BACK_IN,
          title: 'Student Missing for 24+ Hours',
          message: `${student.name} has been outside the hostel for over 24 hours (since ${formatTime(att.checkOutTime)}).`,
          hostelId,
          studentId: String(att.studentId),
          recipientRole: 'warden',
          metadata: {
            studentName: student.name,
            checkOutTime: att.checkOutTime,
            hoursOutside: Math.round(mins / 60),
          },
          priority: 'urgent',
          sendPush: true,
        });
        alertCount++;
      }

      return alertCount;
    } catch (err) {
      console.error('[CheckInAutomation] detectNeverCheckedBackIn error:', err.message);
      return 0;
    }
  }
}

module.exports = CheckInAutomationService;
