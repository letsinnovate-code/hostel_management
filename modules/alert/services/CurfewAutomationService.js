/**
 * @file CurfewAutomationService.js
 * @description Multi-stage automated Curfew & Presence Verification Engine.
 *
 * 3-STAGE PRD COMPLIANT VERIFICATION WORKFLOW:
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ Stage 0: Silent Presence Check (T+0 min - Curfew Time)                      │
 * │  - Runs silently against Attendance + StudentLocation GPS + GeoFence       │
 * │  - Respects User.locationPermissionStatus ('granted' vs 'denied')          │
 * │  - Exempts approved active leave / out-pass permissions                    │
 * │  - If student is outside without leave:                                     │
 * │      * Creates CurfewViolation in 'pending_recheck' status                  │
 * │      * Starts 10-minute Grace Period (graceExpiresAt = now + 10m)          │
 * │      * Sends private student reminder push/notification                     │
 * │      * NO premature warden/owner alert (avoids false-positive panics)       │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │ Stage 1: Grace Period Recheck (T+10 min)                                    │
 * │  - Re-evaluates presence via gate check-in and GPS position                │
 * │  - If student returned:                                                     │
 * │      * Auto-resolves violation ('resolved', 'Returned within grace period') │
 * │      * NO penalty or warden violation logged                                │
 * │  - If student is STILL outside:                                             │
 * │      * Confirms CurfewViolation ('open')                                    │
 * │      * Alerts Warden & Owner via HostelAlertService + Socket.IO             │
 * │      * Warns student of confirmed violation                                 │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │ Stage 2: Escalation & Parent Notification (T+15 min)                        │
 * │  - If open violation remains unresolved past 15 minutes:                    │
 * │      * Escalates to Level 1 (escalationLevel = 1)                           │
 * │      * Sends emergency email to student's parent/guardian via SMTP          │
 * │      * Alerts Owner/Admin with urgent priority                              │
 * └─────────────────────────────────────────────────────────────────────────────┘
 */

'use strict';

const Hostel = require('../../../models/Hostel');
const User = require('../../../models/User');
const Attendance = require('../../../models/Attendance');
const Permission = require('../../../models/Permission');
const Notification = require('../../../models/Notification');
const StudentLocation = require('../../../models/StudentLocation');
const GeoFence = require('../../../models/GeoFence');
const CurfewViolation = require('../models/CurfewViolation');
const CurfewSession = require('../models/CurfewSession');
const HostelAlertService = require('./HostelAlertService');
const { emitCurfewViolation, emitToUser, emitToRole } = require('../socket/alertSocket');
const { validateLocation, validateLocationWithGeoFence } = require('../../../utils/locationValidation');
const { sendParentEmergencyEmail } = require('../../../utils/emailService');
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
  timeStrToDate,
  parseTimeStr,
} = require('../utils/alertHelpers');
const { getBusinessDate, getBusinessDayRange, getBusinessDateString } = require('../../../services/timezoneService');

const CURFEW_LOCATION_MAX_AGE_MINUTES = parseInt(process.env.CURFEW_LOCATION_MAX_AGE_MINUTES, 10) || 30;
const CURFEW_LOCATION_MAX_ACCURACY_METERS = parseInt(process.env.LOCATION_MAX_ACCURACY_METERS, 10) || 100;

/**
 * Check if a location fix is sufficiently fresh and accurate for curfew presence evaluation.
 * Rejects stale coordinates (> 30 min), future timestamps (> 5 min skew), and inaccurate fixes (> 100m).
 * @returns {{ valid: boolean, reason?: string, ageMinutes?: number, accuracy?: number }}
 */
function isLocationFreshAndAccurate(loc, maxAgeMinutes = CURFEW_LOCATION_MAX_AGE_MINUTES, maxAccuracyMeters = CURFEW_LOCATION_MAX_ACCURACY_METERS) {
  if (!loc || loc.latitude == null || loc.longitude == null || typeof loc.latitude !== 'number' || typeof loc.longitude !== 'number' || isNaN(loc.latitude) || isNaN(loc.longitude)) {
    return { valid: false, reason: 'INVALID_COORDINATES' };
  }
  const rawTimestamp = loc.timestamp || loc.capturedAt || loc.lastLocationUpdate;
  if (!rawTimestamp) {
    return { valid: false, reason: 'NO_TIMESTAMP' };
  }
  const fixTime = new Date(rawTimestamp).getTime();
  if (isNaN(fixTime)) {
    return { valid: false, reason: 'INVALID_TIMESTAMP' };
  }
  const ageMinutes = (Date.now() - fixTime) / (60 * 1000);
  if (ageMinutes < -5) {
    return { valid: false, reason: 'FUTURE_TIMESTAMP', ageMinutes };
  }
  if (ageMinutes > maxAgeMinutes) {
    return { valid: false, reason: 'LOCATION_STALE', ageMinutes };
  }
  if (loc.accuracy != null && (isNaN(loc.accuracy) || loc.accuracy <= 0 || loc.accuracy > maxAccuracyMeters)) {
    return { valid: false, reason: 'INACCURATE', accuracy: loc.accuracy };
  }
  return { valid: true, ageMinutes };
}

class CurfewAutomationService {
  /**
   * Static exposure of location freshness validator for testability and external checks (Issue 4, 27)
   */
  static isLocationFreshAndAccurate(loc, maxAgeMinutes = CURFEW_LOCATION_MAX_AGE_MINUTES, maxAccuracyMeters = CURFEW_LOCATION_MAX_ACCURACY_METERS) {
    return isLocationFreshAndAccurate(loc, maxAgeMinutes, maxAccuracyMeters);
  }
  /**
   * Helper: Check if current time is within hostel curfew hours.
   * Curfew hours run from curfewTime (e.g. 21:00 or 22:00) until morning 06:00.
   *
   * @param {string} curfewTimeStr - e.g. "21:00"
   * @param {Date} [now=new Date()]
   * @param {string} curfewTimeStr - e.g. "21:00"
   * @param {Date} [now=new Date()]
   * @param {string} [curfewEndTimeStr="06:00"]
   * @param {boolean} [isManualActive=false]
   * @returns {boolean}
   */
  static isCurfewActive(
    curfewTimeStr,
    now = new Date(),
    curfewEndTimeStr = '06:00',
    isManualActive = false,
    manualCurfewEndedAt = null,
    manualCurfewStartedAt = null
  ) {
    if (isManualActive) return true;

    const { hour: curfewHour, minute: curfewMinute } = parseTimeStr(curfewTimeStr);
    const { hour: endHour, minute: endMinute } = parseTimeStr(curfewEndTimeStr || '06:00');

    const startMins = curfewHour * 60 + curfewMinute;
    const endMins = endHour * 60 + endMinute;
    const nowMins = now.getHours() * 60 + now.getMinutes();

    // Check if current wall-clock time falls in scheduled curfew window
    const isInScheduledWindow = startMins > endMins
      ? (nowMins >= startMins || nowMins < endMins)
      : (nowMins >= startMins && nowMins < endMins);

    if (!isInScheduledWindow) {
      return false;
    }

    // Determine current scheduled session start time
    const sessionDate = this.getCurfewSessionDate(curfewTimeStr, now, curfewEndTimeStr);
    const sessionStart = new Date(sessionDate);
    sessionStart.setHours(curfewHour, curfewMinute, 0, 0);

    const endedAtDate = manualCurfewEndedAt ? new Date(manualCurfewEndedAt) : null;
    const startedAtDate = manualCurfewStartedAt ? new Date(manualCurfewStartedAt) : null;

    // If warden manually started curfew after the last end time, it is active
    if (startedAtDate && (!endedAtDate || startedAtDate > endedAtDate)) {
      return true;
    }

    // If warden manually ended the curfew for this session (endedAt >= sessionStart):
    // and hasn't started it again, then this session is ended
    if (endedAtDate && endedAtDate >= sessionStart && (!startedAtDate || endedAtDate >= startedAtDate)) {
      return false;
    }

    return true;
  }

  /**
   * Helper: Determine the canonical "Curfew Session Date" (normalized to midnight 00:00:00).
   * For an overnight curfew (e.g. 21:00 to 06:00), the hours from 00:00 to 05:59
   * belong to the curfew session that began the previous evening.
   *
   * @param {string} curfewTimeStr - e.g. "21:00"
   * @param {Date} [now=new Date()]
   * @param {string} [curfewEndTimeStr="06:00"]
   * @returns {Date} Normalized date representing the curfew start date
   */
  static getCurfewSessionDate(curfewTimeStr, now = new Date(), curfewEndTimeStr = '06:00') {
    const { hour: curfewHour, minute: curfewMinute } = parseTimeStr(curfewTimeStr);
    const { hour: endHour, minute: endMinute } = parseTimeStr(curfewEndTimeStr || '06:00');

    const startMins = curfewHour * 60 + curfewMinute;
    const endMins = endHour * 60 + endMinute;
    const nowMins = now.getHours() * 60 + now.getMinutes();

    const sessionDate = new Date(now);
    sessionDate.setHours(0, 0, 0, 0);

    // If overnight curfew and current time is post-midnight (before morning end time),
    // this belongs to yesterday evening's session.
    if (startMins > endMins && nowMins < endMins) {
      sessionDate.setDate(sessionDate.getDate() - 1);
    }

    return sessionDate;
  }

  /**
   * Warden or Admin sets or updates the scheduled curfew time for a hostel.
   *
   * @param {string} hostelId
   * @param {string} curfewTimeStr - "HH:mm" (e.g. "21:30" or "22:00")
   * @param {Object} [options]
   * @param {string} [options.weekendCurfewTime]
   * @param {string} [options.curfewEndTime]
   * @param {number} [options.gracePeriodMinutes]
   * @param {string} [options.updatedBy]
   * @returns {Promise<Object>}
   */
  static async setCurfewSchedule(hostelId, curfewTimeStr, options = {}) {
    if (!curfewTimeStr || typeof curfewTimeStr !== 'string') {
      throw new Error('Valid curfewTime (HH:mm format) is required');
    }

    const { hour, minute } = parseTimeStr(curfewTimeStr);
    const formattedTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

    const updateFields = {
      'rules.curfewTime': formattedTime,
    };

    if (options.weekendCurfewTime) {
      const { hour: wh, minute: wm } = parseTimeStr(options.weekendCurfewTime);
      updateFields['rules.weekendCurfewTime'] = `${String(wh).padStart(2, '0')}:${String(wm).padStart(2, '0')}`;
    } else {
      updateFields['rules.weekendCurfewTime'] = formattedTime;
    }

    if (options.curfewEndTime) {
      const { hour: eh, minute: em } = parseTimeStr(options.curfewEndTime);
      updateFields['rules.curfewEndTime'] = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
    }

    if (options.gracePeriodMinutes != null) {
      updateFields['rules.gracePeriodMinutes'] = Number(options.gracePeriodMinutes);
    }

    const hostel = await Hostel.findByIdAndUpdate(
      hostelId,
      { $set: updateFields },
      { new: true }
    ).lean();

    if (!hostel) throw new Error(`Hostel ${hostelId} not found`);

    // Broadcast schedule update to warden, owner, and students
    emitToRole('warden', hostelId, 'curfew:schedule_updated', {
      hostelId,
      curfewTime: formattedTime,
      weekendCurfewTime: hostel.rules?.weekendCurfewTime,
      curfewEndTime: hostel.rules?.curfewEndTime || '06:00',
      gracePeriodMinutes: hostel.rules?.gracePeriodMinutes || 15,
      updatedBy: options.updatedBy || null,
      updatedAt: new Date(),
    });

    emitToRole('owner', hostelId, 'curfew:schedule_updated', {
      hostelId,
      curfewTime: formattedTime,
      weekendCurfewTime: hostel.rules?.weekendCurfewTime,
      curfewEndTime: hostel.rules?.curfewEndTime || '06:00',
      gracePeriodMinutes: hostel.rules?.gracePeriodMinutes || 15,
      updatedAt: new Date(),
    });

    console.log(`[CurfewAutomation] Curfew schedule updated for hostel ${hostel.name || hostelId}: ${formattedTime}`);

    return {
      hostelId,
      curfewTime: formattedTime,
      weekendCurfewTime: hostel.rules?.weekendCurfewTime,
      curfewEndTime: hostel.rules?.curfewEndTime || '06:00',
      gracePeriodMinutes: hostel.rules?.gracePeriodMinutes || 15,
      rules: hostel.rules,
    };
  }

  /**
   * Run the global periodic curfew check across ALL active hostels.
   * Evaluates active curfew hours, initiates Stage 0 silent check,
   * processes Stage 1 10-minute rechecks and 15-minute grace expirations,
   * and triggers Stage 2 parent escalations.
   *
   * @returns {Promise<{ checked: number, initiated: number, rechecked10m: number, rechecked: number, escalated: number, errors: number }>}
   */
  static async runGlobalCurfewEvaluation() {
    console.log('[CurfewAutomation] 🔄 Running global curfew evaluation cycle...');

    const hostels = await Hostel.find({ status: 'active' })
      .select('_id name rules.curfewTime rules.weekendCurfewTime rules.curfewEndTime rules.gracePeriodMinutes rules.lastCurfewSweepDate rules.isManualCurfewActive rules.manualCurfewEndedAt rules.manualCurfewStartedAt rules.curfewAlertConfig ownerId contactPhone')
      .lean();

    const results = { checked: 0, initiated: 0, rechecked10m: 0, rechecked: 0, escalated: 0, errors: 0 };
    const now = new Date();
    const isWeekend = [0, 6].includes(now.getDay());

    for (const hostel of hostels) {
      try {
        const hostelId = String(hostel._id);
        const curfewTimeStr =
          (isWeekend && hostel.rules?.weekendCurfewTime) ||
          hostel.rules?.curfewTime ||
          '21:00';
        const curfewEndTimeStr = hostel.rules?.curfewEndTime || '06:00';
        const isManualActive = Boolean(hostel.rules?.isManualCurfewActive);

        results.checked++;

        const isCurfewNow = this.isCurfewActive(
          curfewTimeStr,
          now,
          curfewEndTimeStr,
          isManualActive,
          hostel.rules?.manualCurfewEndedAt,
          hostel.rules?.manualCurfewStartedAt
        );

        // 1. If currently in curfew hours (scheduled or manual), perform silent presence check / initiate grace
        if (isCurfewNow) {
          const activeSessionDate = this.getCurfewSessionDate(curfewTimeStr, now, curfewEndTimeStr);
          const lastSweep = hostel.rules?.lastCurfewSweepDate ? new Date(hostel.rules.lastCurfewSweepDate) : null;
          const lastSweepSessionDate = lastSweep ? this.getCurfewSessionDate(curfewTimeStr, lastSweep, curfewEndTimeStr) : null;

          const isSessionSweepDone =
            lastSweepSessionDate &&
            lastSweepSessionDate.getTime() === activeSessionDate.getTime();

          if (!isSessionSweepDone) {
            console.log(`[CurfewAutomation] ⏰ Curfew start reached (${curfewTimeStr}) for hostel ${hostel.name || hostelId}. Auto-triggering silent presence check & 15m grace timers.`);
            const checkRes = await this.runCurfewCheckForHostel(hostelId, hostel, false);
            results.initiated += checkRes.initiated || 0;

            await Hostel.findByIdAndUpdate(hostelId, {
              $set: { 'rules.lastCurfewSweepDate': now },
            });

            // Maintain CurfewSession record
            await CurfewSession.findOneAndUpdate(
              { hostelId, sessionDate: activeSessionDate, status: 'active' },
              {
                $setOnInsert: {
                  hostelId,
                  sessionDate: activeSessionDate,
                  sessionType: isManualActive ? 'manual' : 'scheduled',
                  curfewStartTime: curfewTimeStr,
                  curfewEndTime: curfewEndTimeStr,
                  startTime: now,
                  status: 'active',
                  summary: {
                    totalStudents: (checkRes.present || 0) + (checkRes.onLeave || 0) + (checkRes.initiated || 0),
                    presentCount: checkRes.present || 0,
                    onLeaveCount: checkRes.onLeave || 0,
                    violationsCount: checkRes.initiated || 0,
                    resolvedCount: 0,
                  },
                },
              },
              { upsert: true }
            ).catch(() => {});
          }
        } else {
          // If curfew window has passed and no manual curfew is active, auto-conclude any active session
          const activeSession = await CurfewSession.findOne({
            hostelId,
            status: 'active',
          }).sort({ startTime: -1 });

          if (activeSession) {
            console.log(`[CurfewAutomation] 🌅 Curfew morning end (${curfewEndTimeStr}) reached for hostel ${hostelId}. Concluding session.`);
            activeSession.endTime = now;
            activeSession.status = 'completed';
            await activeSession.save();

            emitToRole('warden', hostelId, 'curfew:ended', {
              hostelId,
              timestamp: now,
              sessionId: activeSession._id,
              status: 'completed',
              reason: 'morning_end_reached',
            });
            emitToRole('owner', hostelId, 'curfew:ended', {
              hostelId,
              timestamp: now,
              sessionId: activeSession._id,
              status: 'completed',
              reason: 'morning_end_reached',
            });
          }
        }

        // 2. Process Stage 1: 10-Minute Recheck (presence verification + 5-min remaining grace reminder)
        const tenMinRes = await this.processTenMinuteRecheck(hostelId);
        results.rechecked10m += tenMinRes.checked || 0;

        // 3. Process Stage 1: 15-Minute Grace Period Expiry (Escalate to Warden, Student, and Owner)
        const recheckRes = await this.processGracePeriodRechecks(hostelId);
        results.rechecked += recheckRes.confirmed || 0;

        // 4. Process Stage 2: 30-Minute Overdue Escalations (Parent Emergency Notification)
        const escalationRes = await this.processEscalations(hostelId, hostel);
        results.escalated += escalationRes.escalated || 0;
      } catch (err) {
        results.errors++;
        console.error(`[CurfewAutomation] Error in evaluation for hostel ${hostel._id}:`, err.message);
      }
    }

    console.log('[CurfewAutomation] ✅ Evaluation cycle completed:', results);
    return results;
  }

  /**
   * Run the global daily check (maintained for backward compatibility with 21:00 cron & BullMQ).
   */
  static async runGlobalDailyCheck() {
    return this.runGlobalCurfewEvaluation();
  }

  /**
   * Stage 0: Silent Presence Check & Grace Period Initiation.
   * Evaluates student presence silently. If outside without leave, enters 10-min Grace Period.
   *
   * @param {string} hostelId
   * @param {Object} [hostelDoc] - Pre-fetched hostel document
   * @returns {Promise<{ initiated: number, violations: number, students: Array }>}
   */
  /**
   * Stage 0: Silent Presence Check & Grace Period Initiation.
   * Evaluates student presence silently.
   * - Inside geofence -> Marked Present (Attendance: 'inside')
   * - Approved leave -> Marked On Leave (Attendance: 'on-leave')
   * - Outside without leave -> Marked Outside, immediate warning sent (0 min), 15-min grace period started
   *
   * @param {string} hostelId
   * @param {Object} [hostelDoc] - Pre-fetched hostel document
   * @param {boolean} [isManualCurfew=false] - If triggered manually by warden
   * @returns {Promise<{ initiated: number, present: number, onLeave: number, violations: number, students: Array, results: Object }>}
   */
  static async runCurfewCheckForHostel(hostelId, hostelDoc = null, isManualCurfew = false) {
    const hostel = hostelDoc || await Hostel.findById(hostelId)
      .select('_id name rules.curfewTime rules.weekendCurfewTime rules.gracePeriodMinutes ownerId contactPhone address')
      .lean();

    if (!hostel) throw new Error(`Hostel ${hostelId} not found`);

    const now = new Date();
    const isWeekend = [0, 6].includes(now.getDay());
    const curfewTimeStr =
      (isWeekend && hostel.rules?.weekendCurfewTime) ||
      hostel.rules?.curfewTime ||
      '21:00';

    // PRD & User requirement: 15-minute grace period
    const graceMinutes = Number(hostel.rules?.gracePeriodMinutes) || 15;

    // ── 1. Get all active students of this hostel ──────────────────────
    const students = await User.find({
      hostelId,
      role: 'student',
      status: 'active',
    })
      .select('_id name studentId roomId locationPermissionStatus parentContact emergencyContact phone pushToken expoPushToken currentLocation')
      .lean();

    if (students.length === 0) return { initiated: 0, present: 0, onLeave: 0, violations: 0, students: [], results: {} };
    const studentIds = students.map((s) => s._id);

    // ── 2. Get today's attendance records using hostel business date ───
    const hostelTimezone = hostel.timezone || 'Asia/Kolkata';
    const businessDate = getBusinessDate(now, hostelTimezone);
    const dayRange = getBusinessDayRange(now, hostelTimezone);
    const today = dayRange.start;
    const tomorrow = new Date(dayRange.end.getTime() + 1);

    const attendances = await Attendance.find({
      studentId: { $in: studentIds },
      hostelId,
      $or: [
        { date: businessDate },
        { date: { $gte: today, $lt: tomorrow } },
      ],
    })
      .sort({ createdAt: -1 })
      .select('studentId status checkInTime checkOutTime')
      .lean();

    const attendanceMap = {};
    for (const att of attendances) {
      if (!attendanceMap[String(att.studentId)]) {
        attendanceMap[String(att.studentId)] = att;
      }
    }

    // ── 3. Find students with valid (approved + active) leave ──────────
    const activeLeaves = await Permission.find({
      studentId: { $in: studentIds },
      status: 'approved',
      permissionType: { $in: ['leave', 'overnight', 'multi-day', 'late-entry'] },
      requestedDate: { $lte: now },
      returnDate: { $gte: now },
    })
      .select('studentId requestedDate returnDate reason permissionType')
      .lean();

    const studentsWithActiveLeave = new Set(
      activeLeaves.map((l) => String(l.studentId))
    );

    // ── 4. Fetch geofence & recent GPS locations for silent check ───────
    const [geoFence, recentLocations] = await Promise.all([
      GeoFence.findOne({ hostelId, isActive: true })
        .sort({ createdAt: -1 })
        .select('type polygon bounds center radius')
        .lean(),
      StudentLocation.find({
        studentId: { $in: studentIds },
        hostelId,
        timestamp: { $gte: new Date(now.getTime() - 60 * 60 * 1000) }, // Last 60 minutes
      })
        .sort({ timestamp: -1 })
        .lean(),
    ]);

    const latestLocationMap = {};
    for (const loc of recentLocations) {
      if (!latestLocationMap[String(loc.studentId)]) {
        latestLocationMap[String(loc.studentId)] = loc;
      }
    }

    // Anchor coordinates: Geofence center takes priority, then hostel address coordinates
    const hostelCoordinates = (geoFence?.center?.latitude != null && geoFence?.center?.longitude != null)
      ? { latitude: geoFence.center.latitude, longitude: geoFence.center.longitude }
      : (hostel.address?.coordinates?.latitude != null && hostel.address?.coordinates?.longitude != null)
        ? { latitude: hostel.address.coordinates.latitude, longitude: hostel.address.coordinates.longitude }
        : null;

    const initiatedList = [];
    const presentList = [];
    const onLeaveList = [];

    // ── 5. Evaluate each student with event-based presence rules ───────
    for (const student of students) {
      const sid = String(student._id);

      // RULE 1: If student is on approved leave -> mark as 'ON LEAVE'
      if (studentsWithActiveLeave.has(sid)) {
        await Attendance.findOneAndUpdate(
          { studentId: sid, date: { $gte: today, $lt: tomorrow } },
          {
            $set: {
              status: 'on-leave',
              verificationMethod: 'manual_curfew',
            },
            $setOnInsert: {
              studentId: sid,
              hostelId,
              date: now,
            },
          },
          { upsert: true, new: true }
        );

        // Auto-resolve any pending curfew violation since student is authorized
        await CurfewViolation.updateMany(
          { studentId: sid, status: { $in: ['pending_recheck', 'open'] } },
          {
            $set: {
              status: 'resolved',
              resolvedAt: now,
              resolutionNote: 'Exempted from curfew: Authorized approved leave pass active.',
            },
          }
        );

        onLeaveList.push({
          studentId: sid,
          name: student.name,
          status: 'on-leave',
          reason: activeLeaves.find((l) => String(l.studentId) === sid)?.reason || 'Approved Leave',
        });
        continue;
      }

      const att = attendanceMap[sid];
      const recentLoc = latestLocationMap[sid];
      
      // Strict freshness check for curfew candidate location (Issue 4, Issue 27)
      let candidateLocation = null;
      let locationFresh = false;

      if (recentLoc?.location && isLocationFreshAndAccurate({
        latitude: recentLoc.location.latitude,
        longitude: recentLoc.location.longitude,
        timestamp: recentLoc.timestamp,
        accuracy: recentLoc.accuracy,
      }).valid) {
        candidateLocation = recentLoc.location;
        locationFresh = true;
      } else if (student.currentLocation?.latitude != null && isLocationFreshAndAccurate({
        latitude: student.currentLocation.latitude,
        longitude: student.currentLocation.longitude,
        timestamp: student.currentLocation.timestamp || student.lastLocationUpdate,
        accuracy: student.currentLocation.accuracy,
      }).valid) {
        candidateLocation = {
          latitude: student.currentLocation.latitude,
          longitude: student.currentLocation.longitude,
        };
        locationFresh = true;
      }

      // A. Check gate attendance status
      const isAttInside = att && att.status === 'inside';

      // B. Check geofence presence via GPS coordinates ONLY IF FRESH
      let isGpsInside = false;
      let locationMethod = isAttInside ? 'attendance' : 'none';
      let distanceFromHostel = 0;

      if (candidateLocation && hostelCoordinates && locationFresh) {
        locationMethod = 'gps';
        if (recentLoc?.isInsideHostel === true && locationFresh) {
          isGpsInside = true;
          distanceFromHostel = recentLoc.distanceFromHostel || 0;
        } else if (geoFence && geoFence.type === 'polygon' && geoFence.polygon?.length >= 3) {
          const val = validateLocationWithGeoFence(candidateLocation, hostelCoordinates, { polygon: geoFence.polygon });
          isGpsInside = val.isValid;
          distanceFromHostel = val.distance || 0;
        } else if (geoFence && geoFence.type === 'rectangle' && geoFence.bounds) {
          const val = validateLocationWithGeoFence(candidateLocation, hostelCoordinates, { bounds: geoFence.bounds });
          isGpsInside = val.isValid;
          distanceFromHostel = val.distance || 0;
        } else {
          const radius = geoFence?.type === 'circle' && geoFence?.radius != null ? geoFence.radius : 500;
          const val = validateLocation(candidateLocation, hostelCoordinates, radius);
          isGpsInside = val.isValid;
          distanceFromHostel = val.distance || 0;
        }
      }

      // RULE 2: If student is inside the hostel geofence -> mark as 'PRESENT'
      if (isAttInside || isGpsInside) {
        await Attendance.findOneAndUpdate(
          { studentId: sid, date: businessDate },
          {
            $set: {
              status: 'inside',
              verificationMethod: 'curfew_geofence',
              verificationStatus: locationFresh ? 'verified' : (isAttInside ? 'verified' : 'stale_location'),
              checkInTime: att?.checkInTime || now,
              location: candidateLocation || undefined,
              businessDate: getBusinessDateString(now, hostelTimezone),
            },
            $setOnInsert: {
              studentId: sid,
              hostelId,
              date: businessDate,
            },
          },
          { upsert: true, new: true }
        );

        // Auto-resolve any previous pending/open curfew violation
        await CurfewViolation.updateMany(
          { studentId: sid, status: { $in: ['pending_recheck', 'open'] } },
          {
            $set: {
              status: 'resolved',
              resolvedAt: now,
              studentReturnedAt: now,
              resolutionNote: 'Verified present inside hostel geofence by warden curfew sweep.',
            },
          }
        );

        presentList.push({
          studentId: sid,
          name: student.name,
          status: 'present',
          locationMethod,
          distanceFromHostel: Math.round(distanceFromHostel),
        });
        continue;
      }

      // RULE 3: Student is NOT on leave AND NOT inside geofence:
      // Update attendance status to outside
      await Attendance.findOneAndUpdate(
        { studentId: sid, date: businessDate },
        {
          $set: {
            status: 'outside',
            verificationMethod: 'curfew_geofence',
            verificationStatus: locationFresh ? 'verified' : 'stale_location',
            location: candidateLocation || undefined,
            businessDate: getBusinessDateString(now, hostelTimezone),
          },
          $setOnInsert: {
            studentId: sid,
            hostelId,
            date: businessDate,
          },
        },
        { upsert: true, new: true }
      );

      // Check if active violation record exists for today
      let violationDoc = await CurfewViolation.findOne({
        studentId: sid,
        violationDate: { $gte: today, $lt: tomorrow },
      });

      const checkOutTime = att?.checkOutTime || null;
      const mins = checkOutTime ? minutesSince(checkOutTime) : minutesSince(timeStrToDate(curfewTimeStr, now));
      const graceExpiresAt = new Date(now.getTime() + graceMinutes * 60 * 1000);

      let lastKnownActivity = '';
      if (candidateLocation) {
        lastKnownActivity = `GPS location reported ~${Math.round(distanceFromHostel)}m away from geofence at ${formatTime(now)}.`;
      } else if (checkOutTime) {
        lastKnownActivity = `Checked out of campus at ${formatTime(checkOutTime)}.`;
      } else {
        lastKnownActivity = `Not verified inside campus geofence. Curfew commenced at ${curfewTimeStr}.`;
      }

      if (!violationDoc) {
        // ── Stage 0 (0 Min): Initial Check - Send immediate warning to student ──
        violationDoc = await CurfewViolation.create({
          studentId: sid,
          hostelId,
          roomId: student.roomId || undefined,
          violationDate: now,
          curfewTime: curfewTimeStr,
          lastCheckOutTime: checkOutTime,
          attendanceStatus: 'outside',
          leaveStatus: 'no_leave',
          minutesMissing: Math.max(0, mins),
          lastKnownActivity,
          status: 'pending_recheck',
          stage: 0,
          graceExpiresAt,
          locationVerified: candidateLocation != null,
          locationMethod: candidateLocation ? 'gps' : 'attendance',
          escalationLevel: 0,
        });
      } else {
        // Only reset grace timer if warden triggered a manual sweep or violation was already resolved earlier today
        if (isManualCurfew || violationDoc.status === 'resolved') {
          violationDoc.status = 'pending_recheck';
          violationDoc.stage = 0;
          violationDoc.graceExpiresAt = graceExpiresAt;
          violationDoc.violationDate = now;
          violationDoc.lastKnownActivity = lastKnownActivity;
          await violationDoc.save();
        }
      }

      // Send IMMEDIATE WARNING (0 min) to the STUDENT
      const warningTitle = '⚠️ Curfew Grace Period Active (15 Min)';
      const warningMessage = `Campus curfew (${curfewTimeStr}) has commenced. You are outside the hostel geofence. You have a ${graceMinutes}-minute grace period (until ${formatTime(graceExpiresAt)}) to return to campus before alerts are escalated to the Warden and Owner.`;

      await Notification.create({
        title: warningTitle,
        message: warningMessage,
        type: 'alert',
        targetAudience: 'students',
        recipients: [student._id],
        createdBy: student._id,
        hostelId,
      }).catch((e) => console.warn('[CurfewAutomation] Student notification creation failed:', e.message));

      emitToUser(sid, 'curfew:grace_started', {
        violationId: String(violationDoc._id),
        graceExpiresAt,
        curfewTime: curfewTimeStr,
        graceMinutes,
        message: warningMessage,
      });

      initiatedList.push({
        studentId: sid,
        name: student.name,
        violationId: String(violationDoc._id),
        status: 'pending_recheck',
        distanceFromHostel: Math.round(distanceFromHostel),
        graceExpiresAt,
      });
    }

    console.log(`[CurfewAutomation] Hostel ${hostelId} Sweep Complete: ${presentList.length} Present, ${onLeaveList.length} On Leave, ${initiatedList.length} Outside in Grace Period.`);

    return {
      initiated: initiatedList.length,
      present: presentList.length,
      onLeave: onLeaveList.length,
      violations: initiatedList.length,
      students: initiatedList,
      results: {
        present: presentList,
        onLeave: onLeaveList,
        outside: initiatedList,
      },
    };
  }

  /**
   * Warden-initiated immediate curfew & event-based presence verification.
   *
   * @param {string} hostelId
   * @param {string} wardenId
   * @returns {Promise<Object>}
   */
  static async startImmediateWardenCurfew(hostelId, wardenId) {
    const now = new Date();
    console.log(`[CurfewAutomation] 🚨 Warden ${wardenId} initiated immediate curfew sweep for hostel ${hostelId}`);
    const checkRes = await this.runCurfewCheckForHostel(hostelId, null, true);

    const hostel = await Hostel.findByIdAndUpdate(
      hostelId,
      {
        $set: {
          'rules.lastCurfewSweepDate': now,
          'rules.isManualCurfewActive': true,
          'rules.manualCurfewStartedAt': now,
          'rules.manualCurfewEndedAt': null,
        },
      },
      { new: true }
    ).lean();

    const curfewTimeStr = hostel?.rules?.curfewTime || '21:00';
    const curfewEndTimeStr = hostel?.rules?.curfewEndTime || '06:00';
    const sessionDate = this.getCurfewSessionDate(curfewTimeStr, now, curfewEndTimeStr);

    let session = await CurfewSession.findOne({
      hostelId,
      status: 'active',
    });

    if (!session) {
      session = await CurfewSession.create({
        hostelId,
        sessionDate,
        sessionType: 'manual',
        curfewStartTime: curfewTimeStr,
        curfewEndTime: curfewEndTimeStr,
        startTime: now,
        status: 'active',
        startedBy: wardenId,
        summary: {
          totalStudents: (checkRes.present || 0) + (checkRes.onLeave || 0) + (checkRes.initiated || 0),
          presentCount: checkRes.present || 0,
          onLeaveCount: checkRes.onLeave || 0,
          violationsCount: checkRes.initiated || 0,
          resolvedCount: 0,
        },
        notes: 'Curfew initiated immediately by Warden',
      });
    } else {
      session.summary = {
        totalStudents: (checkRes.present || 0) + (checkRes.onLeave || 0) + (checkRes.initiated || 0),
        presentCount: checkRes.present || 0,
        onLeaveCount: checkRes.onLeave || 0,
        violationsCount: checkRes.initiated || 0,
        resolvedCount: session.summary?.resolvedCount || 0,
      };
      await session.save();
    }

    // Notify warden and owner that curfew sweep is active
    emitToRole('warden', hostelId, 'curfew:sweep_completed', {
      hostelId,
      wardenId,
      timestamp: now,
      isCurfewActive: true,
      sessionId: session._id,
      summary: {
        present: checkRes.present,
        onLeave: checkRes.onLeave,
        outside: checkRes.initiated,
      },
    });

    emitToRole('owner', hostelId, 'curfew:sweep_completed', {
      hostelId,
      timestamp: now,
      isCurfewActive: true,
      sessionId: session._id,
      summary: {
        present: checkRes.present,
        onLeave: checkRes.onLeave,
        outside: checkRes.initiated,
      },
    });

    return { ...checkRes, sessionId: session._id };
  }

  /**
   * Conclude / Terminate active curfew session manually by Warden or Admin.
   * Solves the issue where curfew started and would not end.
   *
   * @param {string} hostelId
   * @param {string} [endedByUserId]
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  static async endCurfewSession(hostelId, endedByUserId = null, options = {}) {
    const now = new Date();
    console.log(`[CurfewAutomation] 🛑 Ending curfew session for hostel ${hostelId} by user ${endedByUserId || 'system'}`);

    await Hostel.findByIdAndUpdate(hostelId, {
      $set: {
        'rules.isManualCurfewActive': false,
        'rules.manualCurfewEndedAt': now,
      },
    });

    let session = await CurfewSession.findOne({
      hostelId,
      status: 'active',
    }).sort({ startTime: -1 });

    const activeWindowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const violationsCount = await CurfewViolation.countDocuments({
      hostelId,
      violationDate: { $gte: activeWindowStart },
    });
    const resolvedCount = await CurfewViolation.countDocuments({
      hostelId,
      status: { $in: ['resolved', 'false_positive'] },
      violationDate: { $gte: activeWindowStart },
    });

    if (session) {
      session.endTime = now;
      session.status = endedByUserId ? 'ended_by_warden' : 'completed';
      session.endedBy = endedByUserId || null;
      session.summary.violationsCount = violationsCount;
      session.summary.resolvedCount = resolvedCount;
      if (options.note) {
        session.notes = (session.notes ? session.notes + ' • ' : '') + options.note;
      }
      await session.save();
    } else {
      session = await CurfewSession.create({
        hostelId,
        sessionDate: now,
        sessionType: endedByUserId ? 'manual' : 'scheduled',
        startTime: new Date(now.getTime() - 60 * 60 * 1000),
        endTime: now,
        status: endedByUserId ? 'ended_by_warden' : 'completed',
        startedBy: endedByUserId || null,
        endedBy: endedByUserId || null,
        summary: {
          totalStudents: 0,
          presentCount: 0,
          onLeaveCount: 0,
          violationsCount,
          resolvedCount,
        },
        notes: options.note || 'Curfew manually ended by Warden',
      });
    }

    emitToRole('warden', hostelId, 'curfew:ended', {
      hostelId,
      endedBy: endedByUserId,
      timestamp: now,
      sessionId: session._id,
      status: session.status,
      isCurfewActive: false,
      manualCurfewEndedAt: now,
    });

    emitToRole('owner', hostelId, 'curfew:ended', {
      hostelId,
      endedBy: endedByUserId,
      timestamp: now,
      sessionId: session._id,
      status: session.status,
      isCurfewActive: false,
      manualCurfewEndedAt: now,
    });

    return {
      success: true,
      message: 'Curfew ended successfully. Active session archived.',
      session,
      isCurfewActive: false,
      manualCurfewEndedAt: now,
    };
  }

  /**
   * Set complete curfew configuration (Schedule, Alert Targets, Alert Timings).
   *
   * @param {string} hostelId
   * @param {Object} config
   * @returns {Promise<Object>}
   */
  static async setCurfewFullConfig(hostelId, config = {}) {
    const updateFields = {};

    if (config.curfewTime) {
      const { hour, minute } = parseTimeStr(config.curfewTime);
      updateFields['rules.curfewTime'] = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }

    if (config.curfewEndTime) {
      const { hour, minute } = parseTimeStr(config.curfewEndTime);
      updateFields['rules.curfewEndTime'] = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }

    if (config.weekendCurfewTime) {
      const { hour, minute } = parseTimeStr(config.weekendCurfewTime);
      updateFields['rules.weekendCurfewTime'] = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }

    if (config.gracePeriodMinutes != null) {
      updateFields['rules.gracePeriodMinutes'] = Math.max(1, Number(config.gracePeriodMinutes));
    }

    if (config.curfewAlertConfig) {
      if (config.curfewAlertConfig.recipients) {
        updateFields['rules.curfewAlertConfig.recipients'] = {
          students: Boolean(config.curfewAlertConfig.recipients.students),
          warden: Boolean(config.curfewAlertConfig.recipients.warden),
          owner: Boolean(config.curfewAlertConfig.recipients.owner),
          parents: Boolean(config.curfewAlertConfig.recipients.parents),
          guards: Boolean(config.curfewAlertConfig.recipients.guards),
        };
      }
      if (config.curfewAlertConfig.timing) {
        updateFields['rules.curfewAlertConfig.timing'] = {
          preCurfewReminder: Boolean(config.curfewAlertConfig.timing.preCurfewReminder),
          preCurfewReminderMinutes: Number(config.curfewAlertConfig.timing.preCurfewReminderMinutes) || 15,
          onCurfewStart: Boolean(config.curfewAlertConfig.timing.onCurfewStart),
          onTenMinuteWarning: Boolean(config.curfewAlertConfig.timing.onTenMinuteWarning),
          onGraceExpiry: Boolean(config.curfewAlertConfig.timing.onGraceExpiry),
          onParentEscalation: Boolean(config.curfewAlertConfig.timing.onParentEscalation),
          parentEscalationMinutes: Number(config.curfewAlertConfig.timing.parentEscalationMinutes) || 30,
        };
      }
    }

    const hostel = await Hostel.findByIdAndUpdate(
      hostelId,
      { $set: updateFields },
      { new: true }
    ).lean();

    if (!hostel) throw new Error(`Hostel ${hostelId} not found`);

    emitToRole('warden', hostelId, 'curfew:schedule_updated', {
      hostelId,
      rules: hostel.rules,
      updatedAt: new Date(),
    });

    emitToRole('owner', hostelId, 'curfew:schedule_updated', {
      hostelId,
      rules: hostel.rules,
      updatedAt: new Date(),
    });

    return {
      success: true,
      message: 'Curfew and alert configuration saved successfully.',
      rules: hostel.rules,
    };
  }

  /**
   * Get full curfew schedule and alert configuration.
   *
   * @param {string} hostelId
   * @returns {Promise<Object>}
   */
  static async getCurfewConfig(hostelId) {
    const hostel = await Hostel.findById(hostelId).select('name rules').lean();
    if (!hostel) throw new Error(`Hostel ${hostelId} not found`);

    const now = new Date();
    const isWeekend = [0, 6].includes(now.getDay());
    const curfewTimeStr =
      (isWeekend && hostel.rules?.weekendCurfewTime) ||
      hostel.rules?.curfewTime ||
      '21:00';
    const curfewEndTimeStr = hostel.rules?.curfewEndTime || '06:00';
    const isManualActive = Boolean(hostel.rules?.isManualCurfewActive);
    const isCurfewActive = this.isCurfewActive(
      curfewTimeStr,
      now,
      curfewEndTimeStr,
      isManualActive,
      hostel.rules?.manualCurfewEndedAt,
      hostel.rules?.manualCurfewStartedAt
    );

    const defaultConfig = {
      recipients: {
        students: true,
        warden: true,
        owner: true,
        parents: true,
        guards: false,
      },
      timing: {
        preCurfewReminder: true,
        preCurfewReminderMinutes: 15,
        onCurfewStart: true,
        onTenMinuteWarning: true,
        onGraceExpiry: true,
        onParentEscalation: true,
        parentEscalationMinutes: 30,
      },
    };

    return {
      hostelId,
      hostelName: hostel.name,
      curfewTime: hostel.rules?.curfewTime || '21:00',
      curfewEndTime: hostel.rules?.curfewEndTime || '06:00',
      weekendCurfewTime: hostel.rules?.weekendCurfewTime || '',
      gracePeriodMinutes: hostel.rules?.gracePeriodMinutes || 15,
      isCurfewActive,
      isManualCurfewActive: isManualActive,
      manualCurfewEndedAt: hostel.rules?.manualCurfewEndedAt || null,
      manualCurfewStartedAt: hostel.rules?.manualCurfewStartedAt || null,
      lastCurfewSweepDate: hostel.rules?.lastCurfewSweepDate || null,
      curfewAlertConfig: hostel.rules?.curfewAlertConfig || defaultConfig,
    };
  }

  /**
   * Get historical curfew sessions and student violation audit logs.
   *
   * @param {string} hostelId
   * @param {Object} [query]
   * @returns {Promise<Object>}
   */
  static async getCurfewHistory(hostelId, query = {}) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 15));
    const skip = (page - 1) * limit;

    const sessionFilter = { hostelId };
    if (query.status && query.status !== 'all') {
      sessionFilter.status = query.status;
    }
    if (query.date) {
      const d = new Date(query.date);
      d.setHours(0, 0, 0, 0);
      const nextDay = new Date(d);
      nextDay.setDate(nextDay.getDate() + 1);
      sessionFilter.sessionDate = { $gte: d, $lt: nextDay };
    }

    const [sessions, totalSessions] = await Promise.all([
      CurfewSession.find(sessionFilter)
        .populate('startedBy', 'name role')
        .populate('endedBy', 'name role')
        .sort({ sessionDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CurfewSession.countDocuments(sessionFilter),
    ]);

    const violationFilter = { hostelId };
    if (query.search) {
      const matchedUsers = await User.find({
        hostelId,
        name: { $regex: query.search, $options: 'i' },
      }).select('_id');
      violationFilter.studentId = { $in: matchedUsers.map((u) => u._id) };
    }

    const [violations, totalViolations] = await Promise.all([
      CurfewViolation.find(violationFilter)
        .populate('studentId', 'name studentId roomId phone')
        .populate('acknowledgedBy', 'name')
        .populate('resolvedBy', 'name')
        .sort({ violationDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CurfewViolation.countDocuments(violationFilter),
    ]);

    return {
      sessions,
      totalSessions,
      violations,
      totalViolations,
      page,
      limit,
    };
  }

  /**
   * Stage 1: 10-Minute Recheck.
   * Runs at 10 minutes past curfew start for violations with status = 'pending_recheck'.
   * Rechecks GPS location and gate attendance:
   * - If returned: Auto-resolves as Present without penalty.
   * - If still outside: Warns student that 5 minutes remain in grace period.
   *
   * @param {string} [hostelId]
   * @returns {Promise<{ checked: number, resolved: number, stillOutside: number, students: Array }>}
   */
  static async processTenMinuteRecheck(hostelId = null) {
    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

    const query = {
      status: 'pending_recheck',
      tenMinRechecked: { $ne: true },
      $or: [
        { violationDate: { $lte: tenMinutesAgo } },
        { createdAt: { $lte: tenMinutesAgo } },
        { graceExpiresAt: { $lte: new Date(now.getTime() + 5 * 60 * 1000) } },
      ],
    };
    if (hostelId) query.hostelId = hostelId;

    const pendingViolations = await CurfewViolation.find(query)
      .populate('studentId', 'name studentId roomId locationPermissionStatus currentLocation')
      .populate('hostelId', 'address rules name')
      .lean();

    if (pendingViolations.length === 0) {
      return { checked: 0, resolved: 0, stillOutside: 0, students: [] };
    }

    let resolvedCount = 0;
    let stillOutsideCount = 0;
    const recheckDetails = [];

    for (const v of pendingViolations) {
      const student = v.studentId;
      const hostel = v.hostelId;
      if (!student) continue;

      const sid = String(student._id || student);
      const hId = String(v.hostelId?._id || v.hostelId);

      // Recheck student's current attendance and recent location
      const [latestAttendance, recentLoc, geoFence] = await Promise.all([
        Attendance.findOne({
          studentId: sid,
          hostelId: hId,
          date: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
        }).sort({ createdAt: -1 }).lean(),
        StudentLocation.findOne({
          studentId: sid,
          hostelId: hId,
          timestamp: { $gte: new Date(now.getTime() - 30 * 60 * 1000) },
        }).sort({ timestamp: -1 }).lean(),
        GeoFence.findOne({ hostelId: hId, isActive: true }).sort({ createdAt: -1 }).lean(),
      ]);

      let candidateLocation = null;
      let locationFresh = false;
      if (recentLoc?.location && isLocationFreshAndAccurate({
        latitude: recentLoc.location.latitude,
        longitude: recentLoc.location.longitude,
        timestamp: recentLoc.timestamp,
        accuracy: recentLoc.accuracy,
      }).valid) {
        candidateLocation = recentLoc.location;
        locationFresh = true;
      } else if (student?.currentLocation?.latitude != null && isLocationFreshAndAccurate({
        latitude: student.currentLocation.latitude,
        longitude: student.currentLocation.longitude,
        timestamp: student.currentLocation.timestamp || student.lastLocationUpdate,
        accuracy: student.currentLocation.accuracy,
      }).valid) {
        candidateLocation = {
          latitude: student.currentLocation.latitude,
          longitude: student.currentLocation.longitude,
        };
        locationFresh = true;
      }

      const hostelCoordinates = (geoFence?.center?.latitude != null && geoFence?.center?.longitude != null)
        ? { latitude: geoFence.center.latitude, longitude: geoFence.center.longitude }
        : (hostel?.address?.coordinates?.latitude != null && hostel?.address?.coordinates?.longitude != null)
          ? { latitude: hostel.address.coordinates.latitude, longitude: hostel.address.coordinates.longitude }
          : null;

      let isGpsInside = false;
      if (candidateLocation && hostelCoordinates && locationFresh) {
        const radius = geoFence?.type === 'circle' && geoFence?.radius != null ? geoFence.radius : 500;
        const val = validateLocation(candidateLocation, hostelCoordinates, radius);
        isGpsInside = val.isValid;
      }

      const isInside =
        (latestAttendance && latestAttendance.status === 'inside') ||
        (recentLoc && recentLoc.isInsideHostel === true) ||
        isGpsInside;

      if (isInside) {
        // Auto-resolve: student returned during 10-minute recheck
        await this.handleStudentReturn(sid, latestAttendance?.checkInTime || now);
        resolvedCount++;
        recheckDetails.push({ studentId: sid, name: student.name, status: 'resolved' });
        console.log(`[CurfewAutomation] 10m Recheck: Student ${student.name} returned inside geofence - resolved!`);
      } else {
        // Still outside: Mark 10-min recheck as completed and send 5-min final grace reminder to student
        stillOutsideCount++;

        await CurfewViolation.findByIdAndUpdate(v._id, {
          $set: {
            tenMinRechecked: true,
            tenMinRecheckedAt: now,
          },
        });

        const reminderMsg = `Curfew 10-Minute Recheck: You are still outside the hostel geofence. 5 minutes remain in your grace period before alerts are escalated to the Warden and Owner.`;

        await Notification.create({
          title: '⚠️ Curfew Recheck: 5 Minutes Remaining',
          message: reminderMsg,
          type: 'alert',
          targetAudience: 'students',
          recipients: [sid],
          createdBy: sid,
          hostelId: hId,
        }).catch((e) => console.warn('[CurfewAutomation] 10m reminder notification failed:', e.message));

        emitToUser(sid, 'curfew:recheck_warning', {
          violationId: String(v._id),
          message: reminderMsg,
          minutesLeft: 5,
        });

        recheckDetails.push({ studentId: sid, name: student.name, status: 'still_outside' });
        console.log(`[CurfewAutomation] 10m Recheck: Student ${student.name} still outside - sent 5m warning.`);
      }
    }

    return {
      checked: pendingViolations.length,
      resolved: resolvedCount,
      stillOutside: stillOutsideCount,
      students: recheckDetails,
    };
  }

  /**
   * Stage 2: 15-Minute Escalation to Warden, Student, and Owner.
   * Runs for violations with status = 'pending_recheck' whose graceExpiresAt <= now.
   * If student returned: auto-resolves with NO penalty.
   * If student still outside: confirms violation ('open') and alerts:
   *   1. Warden
   *   2. Student
   *   3. Owner of Hostel
   *
   * @param {string} [hostelId]
   * @returns {Promise<{ resolved: number, confirmed: number, students: Array }>}
   */
  static async processGracePeriodRechecks(hostelId = null) {
    const now = new Date();
    const query = {
      status: 'pending_recheck',
      graceExpiresAt: { $lte: now },
    };
    if (hostelId) query.hostelId = hostelId;

    const pendingViolations = await CurfewViolation.find(query)
      .populate('studentId', 'name studentId roomId locationPermissionStatus currentLocation phone')
      .populate('hostelId', 'name contactPhone rules ownerId address')
      .lean();

    if (pendingViolations.length === 0) return { resolved: 0, confirmed: 0, students: [] };

    let resolvedCount = 0;
    let confirmedCount = 0;
    const processedStudents = [];

    for (const v of pendingViolations) {
      const sid = String(v.studentId?._id || v.studentId);
      const hId = String(v.hostelId?._id || v.hostelId);
      const student = v.studentId;
      const hostel = v.hostelId;

      // Recheck presence one last time before escalating
      const [latestAttendance, recentLoc] = await Promise.all([
        Attendance.findOne({
          studentId: sid,
          hostelId: hId,
          date: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
        }).sort({ createdAt: -1 }).lean(),
        StudentLocation.findOne({
          studentId: sid,
          hostelId: hId,
          timestamp: { $gte: new Date(now.getTime() - CURFEW_LOCATION_MAX_AGE_MINUTES * 60 * 1000) },
        }).sort({ timestamp: -1 }).lean(),
      ]);

      const isInside =
        (latestAttendance && latestAttendance.status === 'inside') ||
        (recentLoc && recentLoc.isInsideHostel === true && isLocationFreshAndAccurate({
          latitude: recentLoc.location?.latitude,
          longitude: recentLoc.location?.longitude,
          timestamp: recentLoc.timestamp,
          accuracy: recentLoc.accuracy,
        }).valid);

      if (isInside) {
        // ── Student returned during grace! Auto-resolve and terminate timer ──
        await this.handleStudentReturn(sid, latestAttendance?.checkInTime || now);
        resolvedCount++;
        processedStudents.push({ studentId: sid, name: student?.name, status: 'resolved_returned_inside' });
        console.log(`[CurfewAutomation] Student ${sid} returned inside geofence before 15m escalation - timer terminated!`);
      } else {
        // ── Student did NOT return during grace! Confirm violation (Stage 1 / 15 Min) ──
        const mins = minutesSince(v.lastCheckOutTime || v.violationDate);
        const studentName = student?.name || 'Student';

        const message = buildCurfewMessage({
          studentName,
          roomNumber: v.roomNumber || 'N/A',
          lastCheckOutTime: v.lastCheckOutTime,
          curfewTime: v.curfewTime,
          minutesMissing: mins,
        });

        // 1. Alert WARDEN
        const alertDoc = await HostelAlertService.send({
          type: ALERT_TYPES.CURFEW_VIOLATION,
          title: '🚨 Curfew Violation (15m Grace Expired)',
          message: `${studentName} did not return within the 15-minute curfew grace period. ${message}`,
          hostelId: hId,
          studentId: sid,
          recipientRole: 'warden',
          priority: 'high',
          metadata: {
            violationId: String(v._id),
            studentName,
            studentId: sid,
            hostelId: hId,
            curfewTime: v.curfewTime,
            minutesMissing: mins,
            timeSinceMissing: formatDuration(mins),
            stage: 1,
          },
          sendPush: true,
        });

        // Resolve owner ID directly from populated hostel or DB lookup
        const resolvedOwnerId = String(hostel?.ownerId?._id || hostel?.ownerId || '');

        // 2. Alert OWNER of Hostel
        await HostelAlertService.send({
          type: ALERT_TYPES.CURFEW_VIOLATION,
          title: '🚨 Curfew Violation Escalated to Owner',
          message: `Owner Alert: ${studentName} is outside hostel grounds past curfew (${v.curfewTime}) and the 15-minute grace period has expired.`,
          hostelId: hId,
          studentId: sid,
          recipientRole: 'owner',
          recipientIds: resolvedOwnerId ? [resolvedOwnerId] : undefined,
          priority: 'high',
          metadata: alertDoc?.metadata || {},
          sendPush: true,
        });

        if (resolvedOwnerId) {
          emitToUser(resolvedOwnerId, 'curfew:escalated', {
            violationId: String(v._id),
            studentName,
            curfewTime: v.curfewTime,
            message: `Curfew violation escalated: ${studentName} did not return within 15-minute grace period.`,
          });
        }

        // 3. Alert STUDENT of confirmed breach
        await HostelAlertService.send({
          type: ALERT_TYPES.CURFEW_VIOLATION,
          title: '🚨 Curfew Violation Escalated',
          message: `Your 15-minute grace period has expired. A formal curfew breach has been escalated to the Warden and Owner.`,
          hostelId: hId,
          studentId: sid,
          recipientRole: 'student',
          recipientIds: [sid],
          priority: 'high',
          metadata: alertDoc?.metadata || {},
          sendPush: true,
        });

        emitToUser(sid, 'curfew:violation_confirmed', {
          violationId: String(v._id),
          message: '15-minute grace period expired. Violation escalated to Warden and Owner.',
        });

        // 4. Update violation record to 'open', stage 1
        const updatedDoc = await CurfewViolation.findByIdAndUpdate(
          v._id,
          {
            status: 'open',
            stage: 1,
            escalationLevel: 0,
            alertId: alertDoc?._id,
            $push: { escalatedAt: now },
          },
          { new: true }
        ).lean();

        // 5. Emit real-time socket event to warden & owner rooms
        emitCurfewViolation(hId, updatedDoc || v);

        confirmedCount++;
        processedStudents.push({ studentId: sid, name: studentName, status: 'escalated_to_warden_and_owner' });
        console.log(`[CurfewAutomation] Confirmed curfew violation for ${studentName} after 15m grace - alerted Warden, Owner, and Student!`);
      }
    }

    return { resolved: resolvedCount, confirmed: confirmedCount, students: processedStudents };
  }

  /**
   * Stage 3: Escalation & Parent Notification (T+30 min).
   * Runs for open violations that have remained unresolved past 30 minutes from start.
   * Escalates to Level 1 and dispatches emergency alert/email to student's parent/guardian.
   *
   * @param {string} [hostelId]
   * @param {Object} [hostelDoc]
   * @returns {Promise<{ escalated: number, students: Array }>}
   */
  static async processEscalations(hostelId = null, hostelDoc = null) {
    const now = new Date();
    // User requirement: after 30 minutes, send an alert to parents
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);

    const query = {
      status: 'open',
      $or: [
        { violationDate: { $lte: thirtyMinAgo } },
        { createdAt: { $lte: thirtyMinAgo } },
      ],
      parentNotified: { $ne: true },
    };
    if (hostelId) query.hostelId = hostelId;

    const overdueViolations = await CurfewViolation.find(query)
      .populate('studentId', 'name studentId roomId parentContact emergencyContact phone')
      .populate('hostelId', 'name contactPhone rules ownerId')
      .lean();

    if (overdueViolations.length === 0) return { escalated: 0, students: [] };

    let escalatedCount = 0;
    const escalatedStudents = [];

    for (const v of overdueViolations) {
      const student = v.studentId;
      const hostel = v.hostelId || hostelDoc;
      if (!student || !hostel) continue;

      const sid = String(student._id);
      const hId = String(hostel._id);
      const studentName = student.name || 'Student';

      // Re-verify student presence before sending parent emergency alert
      const [latestAttendance, recentLoc] = await Promise.all([
        Attendance.findOne({
          studentId: sid,
          hostelId: hId,
          date: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        }).sort({ createdAt: -1 }).lean(),
        StudentLocation.findOne({
          studentId: sid,
          hostelId: hId,
          timestamp: { $gte: new Date(now.getTime() - 15 * 60 * 1000) },
        }).sort({ timestamp: -1 }).lean(),
      ]);

      const isInside =
        (latestAttendance && latestAttendance.status === 'inside') ||
        (recentLoc && recentLoc.isInsideHostel === true);

      if (isInside) {
        // Student returned before parent alert executed! Terminate timer and auto-resolve
        await this.handleStudentReturn(sid, latestAttendance?.checkInTime || now);
        console.log(`[CurfewAutomation] Student ${studentName} (${sid}) returned before parent alert executed - parent timer terminated!`);
        continue;
      }

      // Parent details
      const parentEmail = student.parentContact?.email || student.emergencyContact?.email;
      const parentPhone = student.parentContact?.phone || student.emergencyContact?.phone;
      const parentName = student.parentContact?.name || student.emergencyContact?.name || 'Parent/Guardian';
      const hostelName = hostel.name || 'Hostel';
      const contactNumber = hostel.contactPhone || hostel.rules?.emergencyPhone || '';

      // 1. Send Parent Emergency Email
      let emailSuccess = false;
      if (parentEmail) {
        const emailResult = await sendParentEmergencyEmail({
          parentEmail,
          parentName,
          studentName,
          hostelName,
          emergencyType: 'curfew',
          description: `Curfew Breach Escalation (30+ Minutes Missing): ${studentName} was detected outside the hostel during curfew (${v.curfewTime}) and did not return within the 15-minute grace period. The student has now been missing for over 30 minutes. Please contact the hostel warden or administration immediately.`,
          timestamp: now,
          contactNumber,
        }).catch((err) => {
          console.warn('[CurfewAutomation] Parent email dispatch error:', err.message);
          return { success: false };
        });
        emailSuccess = emailResult?.success ?? false;
      } else {
        console.warn(`[CurfewAutomation] No parent email available for student ${studentName} (${sid})`);
      }

      // 2. Alert Owner & SuperAdmin with Urgent Priority
      const resolvedOwnerId = String(hostel?.ownerId?._id || hostel?.ownerId || '');
      await HostelAlertService.send({
        type: ALERT_TYPES.CURFEW_VIOLATION,
        title: '🚨 Critical Curfew Alert: Parent Notification Dispatched',
        message: `${studentName} has been missing for 30+ minutes past curfew. Emergency alert dispatched to Parent (${parentName} - ${parentEmail || parentPhone || 'No contact on file'}).`,
        hostelId: hId,
        studentId: sid,
        recipientRole: 'owner',
        recipientIds: resolvedOwnerId ? [resolvedOwnerId] : undefined,
        priority: 'urgent',
        metadata: {
          violationId: String(v._id),
          studentName,
          curfewTime: v.curfewTime,
          escalationLevel: 1,
          parentNotified: true,
          parentEmail: parentEmail || null,
          parentPhone: parentPhone || null,
        },
        sendPush: true,
      });

      // 3. Update violation record with escalation level 1 and parent notification flag
      await CurfewViolation.findByIdAndUpdate(v._id, {
        escalationLevel: 1,
        stage: 2,
        parentNotified: true,
        parentNotifiedAt: now,
        parentEmail: parentEmail || undefined,
        $push: { escalatedAt: now },
      });

      // 4. Emit real-time notification to warden & owner rooms
      emitToRole('warden', hId, 'curfew:escalated', {
        violationId: String(v._id),
        studentName,
        parentNotified: true,
        parentEmail,
        parentPhone,
        escalationLevel: 1,
        message: `Emergency parent notification dispatched for ${studentName}.`,
      });

      emitToRole('owner', hId, 'curfew:escalated', {
        violationId: String(v._id),
        studentName,
        parentNotified: true,
        parentEmail,
        escalationLevel: 1,
      });

      escalatedCount++;
      escalatedStudents.push({
        studentId: sid,
        name: studentName,
        parentEmail,
        parentName,
        status: 'parent_notified',
      });

      console.log(`[CurfewAutomation] Escalated curfew breach to PARENTS for ${studentName} (30+ min overdue)`);
    }

    return { escalated: escalatedCount, students: escalatedStudents };
  }

  /**
   * Simulation Utility: Advance Curfew Timeline.
   * Allows warden / demo operator to test each stage instantly:
   * - '10min': Recheck stage
   * - '15min': Escalation to Warden, Student, and Owner
   * - '30min': Escalation to Parents
   * - 'all': Sequential progression
   *
   * @param {string} hostelId
   * @param {'10min'|'15min'|'30min'|'all'} stage
   * @returns {Promise<Object>}
   */
  static async advanceCurfewSimulation(hostelId, stage = '10min') {
    console.log(`[CurfewAutomation] ⏩ Advancing simulation for hostel ${hostelId} to stage: ${stage}`);
    const results = {};

    if (stage === '10min' || stage === 'all') {
      // Step to 10 min: run 10-minute recheck
      results.stage10min = await this.processTenMinuteRecheck(hostelId);
    }

    if (stage === '15min' || stage === 'all') {
      // Fast-forward grace period expiration on all pending_recheck violations
      await CurfewViolation.updateMany(
        { hostelId, status: 'pending_recheck' },
        { $set: { graceExpiresAt: new Date(Date.now() - 1000) } }
      );
      results.stage15min = await this.processGracePeriodRechecks(hostelId);
    }

    if (stage === '30min' || stage === 'all') {
      // Fast-forward violation start date to 31 minutes ago on open violations
      await CurfewViolation.updateMany(
        { hostelId, status: 'open', parentNotified: { $ne: true } },
        { $set: { violationDate: new Date(Date.now() - 31 * 60 * 1000), createdAt: new Date(Date.now() - 31 * 60 * 1000) } }
      );
      results.stage30min = await this.processEscalations(hostelId);
    }

    return results;
  }

  /**
   * Auto-resolve pending grace period violation or open curfew breach when student returns or checks in.
   * Terminating the timer prevents any further alerts (e.g., 15m owner escalation or 30m parent notification).
   * Called by student checkIn, warden verifyPresence, GPS background sync, and pre-escalation rechecks.
   *
   * @param {string} studentId
   * @param {Date} [returnTime=new Date()]
   * @returns {Promise<boolean>}
   */
  static async handleStudentReturn(studentId, returnTime = new Date()) {
    try {
      const sid = String(studentId);
      // Look back 24 hours to safely capture overnight violations spanning midnight
      const activeWindowStart = new Date(returnTime.getTime() - 24 * 60 * 60 * 1000);

      const activeViolation = await CurfewViolation.findOne({
        studentId: sid,
        violationDate: { $gte: activeWindowStart },
        status: { $in: ['pending_recheck', 'open'] },
      }).sort({ violationDate: -1 }).populate('studentId', 'name').populate('hostelId', 'name');

      if (!activeViolation) return false;

      const hId = String(activeViolation.hostelId?._id || activeViolation.hostelId);
      const studentName = activeViolation.studentId?.name || 'Student';

      // Update Attendance record to 'inside'
      await Attendance.findOneAndUpdate(
        { studentId: sid, date: { $gte: activeWindowStart } },
        {
          $set: {
            status: 'inside',
            checkInTime: returnTime,
            verificationMethod: 'curfew_geofence',
          },
        },
        { sort: { date: -1 } }
      );

      if (activeViolation.status === 'pending_recheck') {
        // Returned within grace period: Clear completely without penalty!
        activeViolation.status = 'resolved';
        activeViolation.stage = 0;
        activeViolation.resolutionNote = 'Student returned inside hostel geofence. Grace period timer automatically terminated.';
        activeViolation.studentReturnedAt = returnTime;
        activeViolation.resolvedAt = returnTime;
        await activeViolation.save();

        emitToUser(sid, 'curfew:resolved', {
          violationId: String(activeViolation._id),
          message: 'Curfew check cleared: Returned inside hostel geofence. Grace period timer terminated.',
        });

        emitToRole('warden', hId, 'curfew:timer_terminated', {
          violationId: String(activeViolation._id),
          studentId: sid,
          studentName,
          stage: 0,
          reason: 'Student returned inside geofence within grace period. Timer terminated.',
          returnTime,
        });

        console.log(`[CurfewAutomation] Auto-resolved grace period violation for student ${sid} (${studentName}) - timer terminated.`);
        return true;
      } else if (activeViolation.status === 'open') {
        // Returned before parent alert executed! Terminate parent alert timer and auto-resolve
        activeViolation.status = 'resolved';
        activeViolation.stage = 0;
        activeViolation.resolutionNote = 'Student returned inside hostel geofence. Parent alert timer automatically terminated.';
        activeViolation.studentReturnedAt = returnTime;
        activeViolation.resolvedAt = returnTime;
        await activeViolation.save();

        emitToUser(sid, 'curfew:resolved', {
          violationId: String(activeViolation._id),
          message: 'Returned to hostel: Parent alert timer automatically terminated. Marked Present.',
        });

        emitToRole('warden', hId, 'curfew:timer_terminated', {
          violationId: String(activeViolation._id),
          studentId: sid,
          studentName,
          stage: 1,
          reason: 'Student returned inside geofence before parent alert executed. Parent timer terminated.',
          returnTime,
        });

        emitToRole('owner', hId, 'curfew:timer_terminated', {
          violationId: String(activeViolation._id),
          studentId: sid,
          studentName,
          stage: 1,
          reason: 'Student returned inside geofence before parent alert executed. Parent timer terminated.',
          returnTime,
        });

        console.log(`[CurfewAutomation] Student ${sid} (${studentName}) returned inside hostel - parent alert timer automatically terminated!`);
        return true;
      }

      return false;
    } catch (err) {
      console.error('[CurfewAutomation] Error in handleStudentReturn:', err.message);
      return false;
    }
  }

  /**
   * Get active curfew timers and countdown state for a hostel.
   * Returns current curfew schedule, whether curfew is active,
   * and live timers for all students with violations or grace periods today.
   *
   * @param {string} hostelId
   * @returns {Promise<Object>}
   */
  static async getActiveCurfewTimers(hostelId) {
    const hostel = await Hostel.findById(hostelId)
      .select('name rules address')
      .lean();

    if (!hostel) throw new Error(`Hostel ${hostelId} not found`);

    const now = new Date();
    const isWeekend = [0, 6].includes(now.getDay());
    const curfewTimeStr =
      (isWeekend && hostel.rules?.weekendCurfewTime) ||
      hostel.rules?.curfewTime ||
      '21:00';
    const curfewEndTimeStr = hostel.rules?.curfewEndTime || '06:00';
    const graceMinutes = Number(hostel.rules?.gracePeriodMinutes) || 15;
    const isManualActive = Boolean(hostel.rules?.isManualCurfewActive);
    const isCurfewActive = this.isCurfewActive(
      curfewTimeStr,
      now,
      curfewEndTimeStr,
      isManualActive,
      hostel.rules?.manualCurfewEndedAt,
      hostel.rules?.manualCurfewStartedAt
    );

    const activeWindowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const violations = await CurfewViolation.find({
      hostelId,
      violationDate: { $gte: activeWindowStart },
    })
      .populate('studentId', 'name studentId roomId phone')
      .sort({ createdAt: -1 })
      .lean();

    const studentTimers = violations.map((v) => {
      const studentName = v.studentId?.name || 'Student';
      const studentId = String(v.studentId?._id || v.studentId);
      const roomId = v.studentId?.roomId || v.roomId || 'N/A';

      // 15m Grace timer
      let graceSecondsLeft = 0;
      if (v.status === 'pending_recheck' && v.graceExpiresAt) {
        const diffMs = new Date(v.graceExpiresAt).getTime() - now.getTime();
        graceSecondsLeft = Math.max(0, Math.floor(diffMs / 1000));
      }

      // 30m Parent alert timer (starts from violationDate/createdAt)
      let parentAlertSecondsLeft = 0;
      const startTime = new Date(v.violationDate || v.createdAt || now);
      const parentDeadline = new Date(startTime.getTime() + 30 * 60 * 1000);
      if (v.status === 'open' && !v.parentNotified) {
        const diffMs = parentDeadline.getTime() - now.getTime();
        parentAlertSecondsLeft = Math.max(0, Math.floor(diffMs / 1000));
      }

      let timerStatus = 'in_grace';
      if (v.status === 'resolved') {
        timerStatus = 'terminated_returned';
      } else if (v.parentNotified) {
        timerStatus = 'parent_alert_executed';
      } else if (v.status === 'open') {
        timerStatus = 'parent_timer_running';
      } else if (v.status === 'pending_recheck') {
        timerStatus = 'grace_timer_running';
      }

      return {
        violationId: String(v._id),
        studentId,
        studentName,
        roomId,
        status: v.status,
        stage: v.stage,
        timerStatus,
        graceSecondsLeft,
        parentAlertSecondsLeft,
        graceExpiresAt: v.graceExpiresAt,
        parentAlertDeadline: parentDeadline,
        parentNotified: v.parentNotified || false,
        parentNotifiedAt: v.parentNotifiedAt,
        studentReturnedAt: v.studentReturnedAt,
        resolvedAt: v.resolvedAt,
        resolutionNote: v.resolutionNote,
      };
    });

    return {
      hostelId,
      hostelName: hostel.name,
      curfewTime: curfewTimeStr,
      curfewEndTime: curfewEndTimeStr,
      weekendCurfewTime: hostel.rules?.weekendCurfewTime || null,
      gracePeriodMinutes: graceMinutes,
      isCurfewActive,
      isManualCurfewActive: isManualActive,
      manualCurfewEndedAt: hostel.rules?.manualCurfewEndedAt || null,
      manualCurfewStartedAt: hostel.rules?.manualCurfewStartedAt || null,
      curfewAlertConfig: hostel.rules?.curfewAlertConfig || null,
      lastCurfewSweepDate: hostel.rules?.lastCurfewSweepDate || null,
      activeTimersCount: studentTimers.filter((t) => ['grace_timer_running', 'parent_timer_running'].includes(t.timerStatus)).length,
      terminatedCount: studentTimers.filter((t) => t.timerStatus === 'terminated_returned').length,
      timers: studentTimers,
    };
  }
}

module.exports = CurfewAutomationService;
