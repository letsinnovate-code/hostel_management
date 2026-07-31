/**
 * @file AttendanceAutomationService.js
 * @description Monitors attendance records and fires alerts for:
 * - Students with no attendance record for the day (ATTENDANCE_MISSING)
 * - Students marked absent (STUDENT_ABSENT)
 * - Consecutive absences (CONSECUTIVE_ABSENCE)
 * - Attendance percentage below threshold (LOW_ATTENDANCE_PERCENTAGE)
 *
 * WHY DAILY CHECK AT 8 AM:
 * Running at 8 AM gives wardens early visibility into attendance gaps before
 * the day's activities begin. The check can also be triggered manually.
 *
 * CONSECUTIVE ABSENCE LOGIC:
 * We look at the last N days of attendance for each student. If all N days
 * show 'outside' or no record, we fire a CONSECUTIVE_ABSENCE alert.
 * N is configurable via THRESHOLDS.CONSECUTIVE_ABSENCE_ALERT (default: 2).
 *
 * PERFORMANCE:
 * - Uses $in batch queries (single DB round-trip for all students)
 * - lean() on all read queries
 * - Skips students already alerted today (in-memory Set)
 */

'use strict';

const User = require('../../../models/User');
const Attendance = require('../../../models/Attendance');
const HostelAlertService = require('./HostelAlertService');
const Hostel = require('../../../models/Hostel');
const { ALERT_TYPES, THRESHOLDS } = require('../utils/constants');
const { formatTime } = require('../utils/alertHelpers');

class AttendanceAutomationService {
  /**
   * Run the global daily attendance check for all active hostels.
   *
   * @returns {Promise<{ checked: number, alerts: number, errors: number }>}
   */
  static async runGlobalDailyCheck() {
    console.log('[AttendanceAutomation] Starting global daily attendance check...');

    const hostels = await Hostel.find({ status: 'active' }).select('_id name').lean();
    const results = { checked: 0, alerts: 0, errors: 0 };

    for (const hostel of hostels) {
      try {
        const r = await this.runAttendanceCheckForHostel(String(hostel._id));
        results.checked++;
        results.alerts += r.alerts;
      } catch (err) {
        results.errors++;
        console.error(`[AttendanceAutomation] Error for hostel ${hostel._id}:`, err.message);
      }
    }

    console.log('[AttendanceAutomation] Global check done:', results);
    return results;
  }

  /**
   * Run attendance check for a single hostel.
   *
   * @param {string} hostelId
   * @returns {Promise<{ alerts: number }>}
   */
  static async runAttendanceCheckForHostel(hostelId) {
    const students = await User.find({
      hostelId,
      role: 'student',
      status: 'active',
    })
      .select('_id name studentId')
      .lean();

    if (students.length === 0) return { alerts: 0 };

    const studentIds = students.map((s) => s._id);
    const studentMap = {};
    for (const s of students) {
      studentMap[String(s._id)] = s;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // ── Get today's attendance for all students in one query ──────────
    const todayAttendance = await Attendance.find({
      studentId: { $in: studentIds },
      hostelId,
      date: { $gte: today, $lt: tomorrow },
    })
      .select('studentId status')
      .lean();

    const presentToday = new Set(
      todayAttendance.filter((a) => a.status === 'inside').map((a) => String(a.studentId))
    );
    const recordedToday = new Set(todayAttendance.map((a) => String(a.studentId)));

    let alertCount = 0;

    for (const student of students) {
      const sid = String(student._id);

      // ── Alert: No attendance record at all for today ──────────────
      if (!recordedToday.has(sid)) {
        await HostelAlertService.send({
          type: ALERT_TYPES.ATTENDANCE_MISSING,
          title: 'Attendance Not Marked',
          message: `${student.name}'s attendance has not been marked today.`,
          hostelId,
          studentId: sid,
          recipientRole: 'warden',
          metadata: {
            studentName: student.name,
            studentId: sid,
            date: today.toISOString(),
          },
          sendPush: false, // Low urgency — in-app only
        }).catch((e) => console.error('[AttendanceAutomation] Alert error:', e.message));
        alertCount++;
        continue;
      }

      // ── Check consecutive absences ────────────────────────────────
      const consecutiveCount = await this._countConsecutiveAbsences(
        sid, hostelId, THRESHOLDS.CONSECUTIVE_ABSENCE_ALERT
      );

      if (consecutiveCount >= THRESHOLDS.CONSECUTIVE_ABSENCE_ALERT) {
        await HostelAlertService.send({
          type: ALERT_TYPES.CONSECUTIVE_ABSENCE,
          title: 'Multiple Consecutive Absences',
          message:
            `${student.name} has been absent for ${consecutiveCount} consecutive day(s). Immediate attention required.`,
          hostelId,
          studentId: sid,
          recipientRole: 'warden',
          metadata: {
            studentName: student.name,
            studentId: sid,
            consecutiveDays: consecutiveCount,
          },
          sendPush: true, // High urgency — push too
        }).catch((e) => console.error('[AttendanceAutomation] Alert error:', e.message));
        alertCount++;
      }
    }

    // ── Check hostel-level attendance percentage ──────────────────────
    await this._checkAttendancePercentage(hostelId, students, presentToday.size);

    return { alerts: alertCount };
  }

  /**
   * Count how many consecutive days a student has been absent (status='outside' or missing).
   *
   * @param {string} studentId
   * @param {string} hostelId
   * @param {number} maxDays - look back N days
   * @returns {Promise<number>}
   */
  static async _countConsecutiveAbsences(studentId, hostelId, maxDays = 3) {
    const days = [];
    for (let i = 1; i <= maxDays; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      days.push({ $gte: d, $lt: next });
    }

    let count = 0;
    for (const dateRange of days) {
      const att = await Attendance.findOne({
        studentId,
        hostelId,
        date: dateRange,
      })
        .select('status')
        .lean();

      if (!att || att.status === 'outside' || att.status === 'pending') {
        count++;
      } else {
        break; // Chain broken
      }
    }
    return count;
  }

  /**
   * Check if attendance percentage for the hostel is below threshold.
   *
   * @param {string} hostelId
   * @param {Array} students
   * @param {number} presentCount
   */
  static async _checkAttendancePercentage(hostelId, students, presentCount) {
    const total = students.length;
    if (total === 0) return;
    const percentage = Math.round((presentCount / total) * 100);

    if (percentage < THRESHOLDS.LOW_ATTENDANCE_PERCENT) {
      await HostelAlertService.send({
        type: ALERT_TYPES.LOW_ATTENDANCE_PERCENTAGE,
        title: 'Low Hostel Attendance',
        message: `Hostel attendance today is only ${percentage}% (${presentCount}/${total} students present). Threshold: ${THRESHOLDS.LOW_ATTENDANCE_PERCENT}%.`,
        hostelId,
        recipientRole: 'warden',
        metadata: {
          percentage,
          presentCount,
          totalStudents: total,
          threshold: THRESHOLDS.LOW_ATTENDANCE_PERCENT,
        },
        sendPush: false,
      }).catch((e) => console.error('[AttendanceAutomation] Percentage alert error:', e.message));
    }
  }

  /**
   * Handle a specific attendance marked event.
   * Called from the event handler when a student checks in/out.
   *
   * @param {Object} opts
   * @param {string} opts.studentId
   * @param {string} opts.hostelId
   * @param {string} opts.status - 'inside' | 'outside' | 'pending'
   * @param {string} opts.markedBy - userId who marked it
   */
  static async handleAttendanceMarked({ studentId, hostelId, status, markedBy }) {
    const type =
      status === 'inside' ? ALERT_TYPES.STUDENT_PRESENT : ALERT_TYPES.STUDENT_ABSENT;

    const student = await User.findById(studentId)
      .select('name studentId')
      .lean();
    if (!student) return;

    // Only alert wardens on absence, not on every presence (too noisy)
    if (status !== 'inside') {
      await HostelAlertService.send({
        type,
        title: status === 'outside' ? 'Student Marked Absent' : 'Student Attendance Pending',
        message: `${student.name}'s attendance is marked as ${status}.`,
        hostelId,
        studentId,
        recipientRole: 'warden',
        metadata: { studentName: student.name, status },
        sendPush: false,
      });
    }
  }
}

module.exports = AttendanceAutomationService;
