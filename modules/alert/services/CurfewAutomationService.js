/**
 * @file CurfewAutomationService.js
 * @description Detects curfew violations by scanning hostel attendance records
 * every day at the hostel's configured curfew time.
 *
 * DETECTION LOGIC:
 * 1. Find all active student IDs for the hostel
 * 2. Find today's attendance records where status = 'outside'
 * 3. Cross-reference with approved, active leave permissions
 * 4. Students outside WITHOUT valid leave = curfew violation
 * 5. Create CurfewViolation records (deduplicated)
 * 6. Fire alerts to wardens, owners, superadmins via HostelAlertService
 * 7. Emit real-time socket events
 *
 * WHY NOT HARDCODE 9 PM:
 * Different hostels have different curfew times. The time is read from
 * hostel.rules.curfewTime (HH:mm). This makes the system truly configurable.
 *
 * DEDUPLICATION:
 * Before creating a CurfewViolation, we check if one already exists
 * for this student on today's date. Prevents duplicate records on retries.
 */

'use strict';

const Hostel = require('../../../models/Hostel');
const User = require('../../../models/User');
const Attendance = require('../../../models/Attendance');
const Permission = require('../../../models/Permission');
const CurfewViolation = require('../models/CurfewViolation');
const HostelAlertService = require('./HostelAlertService');
const { emitCurfewViolation } = require('../socket/alertSocket');
const {
  ALERT_TYPES,
  THRESHOLDS,
  HOSTEL_MANAGER_ROLES,
} = require('../utils/constants');
const {
  buildCurfewMessage,
  formatTime,
  minutesSince,
  formatDuration,
} = require('../utils/alertHelpers');

class CurfewAutomationService {
  /**
   * Run the daily curfew check for ALL active hostels.
   * Called by the cron scheduler and by the BullMQ worker.
   *
   * @returns {Promise<{ checked: number, violations: number, errors: number }>}
   */
  static async runGlobalDailyCheck() {
    console.log('[CurfewAutomation] Starting global daily curfew check...');

    const hostels = await Hostel.find({ status: 'active' })
      .select('_id name rules.curfewTime rules.weekendCurfewTime')
      .lean();

    const results = { checked: 0, violations: 0, errors: 0 };

    for (const hostel of hostels) {
      try {
        const hostelResult = await this.runCurfewCheckForHostel(String(hostel._id), hostel);
        results.checked++;
        results.violations += hostelResult.violations;
      } catch (err) {
        results.errors++;
        console.error(`[CurfewAutomation] Error for hostel ${hostel._id}:`, err.message);
      }
    }

    console.log(`[CurfewAutomation] Global check done:`, results);
    return results;
  }

  /**
   * Run curfew check for a single hostel.
   * Can be called directly for manual checks.
   *
   * @param {string} hostelId
   * @param {Object} [hostelDoc] - pre-fetched hostel (avoids DB call if already available)
   * @returns {Promise<{ violations: number, students: Array }>}
   */
  static async runCurfewCheckForHostel(hostelId, hostelDoc = null) {
    const hostel = hostelDoc || await Hostel.findById(hostelId)
      .select('_id name rules.curfewTime rules.weekendCurfewTime ownerId')
      .lean();

    if (!hostel) throw new Error(`Hostel ${hostelId} not found`);

    // Determine today's curfew time (weekends may have different time)
    const isWeekend = [0, 6].includes(new Date().getDay()); // 0=Sunday, 6=Saturday
    const curfewTimeStr =
      (isWeekend && hostel.rules?.weekendCurfewTime) ||
      hostel.rules?.curfewTime ||
      '21:00'; // Default 9 PM IST

    // ── 1. Get all active students of this hostel ──────────────────────
    const students = await User.find({
      hostelId,
      role: 'student',
      status: 'active',
    })
      .select('_id name studentId roomId')
      .lean();

    if (students.length === 0) return { violations: 0, students: [] };
    const studentIds = students.map((s) => s._id);

    // ── 2. Get today's attendance records (status = 'outside') ──────────
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const outsideAttendance = await Attendance.find({
      studentId: { $in: studentIds },
      hostelId,
      status: 'outside',
      date: { $gte: today, $lt: tomorrow },
    })
      .select('studentId checkOutTime')
      .lean();

    if (outsideAttendance.length === 0) return { violations: 0, students: [] };

    // ── 3. Find students with valid (approved + not expired) leave ──────
    const now = new Date();
    const activeLeaves = await Permission.find({
      studentId: { $in: studentIds },
      status: 'approved',
      permissionType: { $in: ['leave', 'overnight', 'multi-day'] },
      requestedDate: { $lte: now },
      // returnDate is after now — leave is still valid
      returnDate: { $gte: now },
    })
      .select('studentId requestedDate returnDate')
      .lean();

    const studentsWithActiveLeave = new Set(
      activeLeaves.map((l) => String(l.studentId))
    );

    // ── 4. Build a map of studentId → last checkout time ────────────────
    const outsideMap = {};
    for (const att of outsideAttendance) {
      outsideMap[String(att.studentId)] = att.checkOutTime;
    }

    // ── 5. Detect violations ────────────────────────────────────────────
    const studentMap = {};
    for (const s of students) {
      studentMap[String(s._id)] = s;
    }

    const violations = [];

    for (const [sid, checkOutTime] of Object.entries(outsideMap)) {
      // Skip students with valid leave
      if (studentsWithActiveLeave.has(sid)) continue;

      const student = studentMap[sid];
      if (!student) continue;

      // Skip if violation already recorded today
      const existingViolation = await CurfewViolation.findOne({
        studentId: sid,
        violationDate: { $gte: today, $lt: tomorrow },
      }).lean();
      if (existingViolation) continue;

      const mins = minutesSince(checkOutTime);
      const leaveDoc = activeLeaves.find((l) => String(l.studentId) === sid);

      const message = buildCurfewMessage({
        studentName: student.name,
        roomNumber: student.roomId ? 'See Profile' : 'N/A',
        lastCheckOutTime: checkOutTime,
        curfewTime: curfewTimeStr,
        minutesMissing: mins,
      });

      // Create CurfewViolation record
      const violationDoc = await CurfewViolation.create({
        studentId: sid,
        hostelId,
        roomId: student.roomId || undefined,
        violationDate: new Date(),
        curfewTime: curfewTimeStr,
        lastCheckOutTime: checkOutTime,
        attendanceStatus: 'outside',
        leaveStatus: leaveDoc ? 'expired_leave' : 'no_leave',
        permissionId: leaveDoc ? leaveDoc._id : undefined,
        minutesMissing: mins,
        lastKnownActivity: `Last checkout at ${formatTime(checkOutTime)}`,
        status: 'open',
      });

      // Send alert to wardens + owners
      const alertDoc = await HostelAlertService.send({
        type: ALERT_TYPES.CURFEW_VIOLATION,
        title: 'Curfew Violation Detected',
        message,
        hostelId,
        studentId: sid,
        recipientRole: 'warden',
        metadata: {
          violationId: String(violationDoc._id),
          studentName: student.name,
          studentId: sid,
          hostelId: String(hostelId),
          roomId: student.roomId ? String(student.roomId) : null,
          lastCheckOutTime: checkOutTime,
          curfewTime: curfewTimeStr,
          minutesMissing: mins,
          timeSinceMissing: formatDuration(mins),
          leaveStatus: leaveDoc ? 'expired_leave' : 'no_leave',
        },
        sendPush: true,
      });

      // Also send to owner role
      await HostelAlertService.send({
        type: ALERT_TYPES.CURFEW_VIOLATION,
        title: 'Curfew Violation Detected',
        message,
        hostelId,
        studentId: sid,
        recipientRole: 'owner',
        metadata: alertDoc.metadata,
        sendPush: false, // Avoid duplicate push
      });

      // Emit real-time socket event
      emitCurfewViolation(hostelId, violationDoc.toObject ? violationDoc.toObject() : violationDoc);

      // Update violation with alertId
      await CurfewViolation.findByIdAndUpdate(violationDoc._id, {
        alertId: alertDoc._id,
      });

      violations.push({ studentId: sid, violationId: String(violationDoc._id) });
    }

    console.log(`[CurfewAutomation] Hostel ${hostelId}: ${violations.length} violation(s) detected`);
    return { violations: violations.length, students: violations };
  }
}

module.exports = CurfewAutomationService;
