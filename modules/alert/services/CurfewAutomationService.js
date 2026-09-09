/**
 * @file CurfewAutomationService.js
 * @description Curfew Automation & Live Presence Monitoring Engine.
 * 
 * Implements:
 * - Flexible scheduling: Start Date, Start Time, End Date, End Time, Overnight spans, Recurrence.
 * - Authoritative Server-Side Timestamps & Duration calculations.
 * - Geofence Evaluation via centralized locationValidationService.
 * - Multi-Stage 15-Minute Timeline:
 *     T=0m:  Start curfew -> Check eligible students -> Outside: 15-min grace + Student Warning
 *     T<=15m: Return -> LATE COMER (record entry time & GPS, cancel escalation)
 *     T=15m: Still outside -> CURFEW RULE VIOLATION + 2nd 15-min countdown + Student Violation Alert
 *     T<=30m: Return -> VIOLATION RESOLVED (preserve violation, record entry & total time outside)
 *     T=30m: Still outside -> WARDEN & OWNER ALERT (detailed payload) + 3rd 15-min period
 *     T=45m: Still outside -> PARENT ALERT (absence notification)
 *     Continuous monitoring until configured Curfew End time -> Auto End.
 * - Idempotent alerts (SESSION-STUDENT-EVENTTYPE).
 * - Server restart state recovery.
 * - Multi-tenant isolation (strict hostel verification).
 */

'use strict';

const mongoose = require('mongoose');
const Hostel = require('../../../models/Hostel');
const User = require('../../../models/User');
const Room = require('../../../models/Room');
const Attendance = require('../../../models/Attendance');
const Permission = require('../../../models/Permission');
const Notification = require('../../../models/Notification');
const StudentLocation = require('../../../models/StudentLocation');
const GeoFence = require('../../../models/GeoFence');
const CurfewViolation = require('../models/CurfewViolation');
const CurfewSession = require('../models/CurfewSession');
const CurfewConfiguration = require('../models/CurfewConfiguration');
const CurfewStudentStatus = require('../models/CurfewStudentStatus');
const HostelAlertService = require('./HostelAlertService');
const { emitToUser, emitToRole } = require('../socket/alertSocket');
const locationValidationService = require('../../../services/locationValidationService');
const { validateLocationWithGeoFence } = require('../../../utils/locationValidation');
const { sendParentEmergencyEmail } = require('../../../utils/emailService');
const { getBusinessDate, getBusinessDayRange, getBusinessDateString } = require('../../../services/timezoneService');
const { parseTimeStr } = require('../utils/alertHelpers');

const CURFEW_LOCATION_MAX_AGE_MINUTES = parseInt(process.env.CURFEW_LOCATION_MAX_AGE_MINUTES, 10) || 30;
const CURFEW_LOCATION_MAX_ACCURACY_METERS = parseInt(process.env.LOCATION_MAX_ACCURACY_METERS, 10) || 100;

/**
 * Format duration into human-readable string.
 */
function formatDurationFromMinutes(mins) {
  if (!mins || mins <= 0) return '0 minutes';
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  if (hours === 0) return `${remainingMins} minute${remainingMins > 1 ? 's' : ''}`;
  if (remainingMins === 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
  return `${hours} hr ${remainingMins} min`;
}

class CurfewAutomationService {
  /**
   * Static exposure of location freshness validator for testability and external checks
   */
  static isLocationFreshAndAccurate(loc, maxAgeMinutes = CURFEW_LOCATION_MAX_AGE_MINUTES, maxAccuracyMeters = CURFEW_LOCATION_MAX_ACCURACY_METERS) {
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

  /**
   * Calculate duration in minutes and format string from Start & End Date/Time.
   */
  static calculateDuration(startDate, startTime, endDate, endTime, timezone = 'Asia/Kolkata') {
    if (!startDate || !startTime || !endDate || !endTime) {
      throw new Error('Start date, start time, end date, and end time are all required');
    }

    // Combine strings to ISO-compatible timestamp
    const startIso = `${startDate}T${startTime.length === 5 ? startTime : startTime.padStart(5, '0')}:00`;
    const endIso = `${endDate}T${endTime.length === 5 ? endTime : endTime.padStart(5, '0')}:00`;

    const startMs = new Date(startIso).getTime();
    const endMs = new Date(endIso).getTime();

    if (isNaN(startMs) || isNaN(endMs)) {
      throw new Error('Invalid date or time format provided');
    }

    if (endMs <= startMs) {
      throw new Error('Curfew end time must be after start time. For overnight curfews, select the next day for End Date.');
    }

    const durationMinutes = Math.round((endMs - startMs) / (60 * 1000));
    const durationDisplay = formatDurationFromMinutes(durationMinutes);

    return {
      startMs,
      endMs,
      startIso,
      endIso,
      durationMinutes,
      durationDisplay,
      isOvernight: endDate !== startDate,
    };
  }

  /**
   * Save / Set Curfew Configuration for a hostel.
   * Cancels any prior scheduled configuration and schedules the upcoming session.
   */
  static async setCurfewSchedule(hostelId, configData, user) {
    const {
      startDate,
      startTime,
      endDate,
      endTime,
      recurrence = { type: 'one_time', selectedDays: [] },
      gracePeriodMinutes = 15,
      escalationPeriodMinutes = 15,
    } = configData;

    const hostel = await Hostel.findById(hostelId).select('_id name timezone address').lean();
    if (!hostel) throw new Error(`Hostel ${hostelId} not found`);

    const tz = hostel.timezone || 'Asia/Kolkata';
    const duration = this.calculateDuration(startDate, startTime, endDate, endTime, tz);

    const startAt = new Date(duration.startIso);
    const endAt = new Date(duration.endIso);
    const userId = user?.id || user?._id;

    // 1. Deactivate old active/scheduled configurations for this hostel
    const previousConfigs = await CurfewConfiguration.find({ hostelId, isActive: true }).lean();
    await CurfewConfiguration.updateMany(
      { hostelId, isActive: true },
      {
        $set: {
          isActive: false,
          status: 'inactive',
        },
        $push: {
          history: {
            action: 'SUPERSEDED',
            actionBy: userId,
            timestamp: new Date(),
            note: 'Superseded by new configuration',
          },
        },
      }
    );

    // 2. Create new CurfewConfiguration
    const newConfig = await CurfewConfiguration.create({
      hostelId,
      startDate,
      startTime,
      endDate,
      endTime,
      durationMinutes: duration.durationMinutes,
      durationDisplay: duration.durationDisplay,
      recurrence: {
        type: recurrence.type || 'one_time',
        selectedDays: recurrence.selectedDays || [],
      },
      gracePeriodMinutes: Number(gracePeriodMinutes) || 15,
      escalationPeriodMinutes: Number(escalationPeriodMinutes) || 15,
      timezone: tz,
      isActive: true,
      status: startAt <= new Date() && endAt > new Date() ? 'active' : 'scheduled',
      configuredBy: userId,
      history: [
        {
          action: 'CREATED',
          actionBy: userId,
          timestamp: new Date(),
          previousConfig: previousConfigs[0] || null,
          note: `Configured curfew from ${startDate} ${startTime} to ${endDate} ${endTime}`,
        },
      ],
    });

    // 3. Cancel any pending future scheduled sessions
    await CurfewSession.updateMany(
      {
        hostelId,
        status: 'SCHEDULED',
      },
      {
        $set: {
          status: 'CANCELLED',
          notes: 'Cancelled due to curfew reconfiguration',
          endedBy: userId,
        },
      }
    );

    // 4. Create the next scheduled CurfewSession
    const newSession = await CurfewSession.create({
      hostelId,
      configurationId: newConfig._id,
      sessionDate: startAt,
      scheduledStartAt: startAt,
      scheduledEndAt: endAt,
      curfewStartTime: startTime,
      curfewEndTime: endTime,
      status: 'SCHEDULED',
      triggerType: 'SCHEDULED',
      timezone: tz,
      startedBy: userId,
      summary: {
        totalStudents: 0,
        presentCount: 0,
        outsideCount: 0,
        lateComersCount: 0,
        violationsCount: 0,
        resolvedCount: 0,
        parentAlertsCount: 0,
      },
      notes: `Scheduled session for ${startDate} ${startTime} to ${endDate} ${endTime}`,
    });

    // 5. Broadcast real-time schedule update
    const broadcastPayload = {
      hostelId,
      configuration: newConfig,
      session: newSession,
      scheduledStartAt: startAt,
      scheduledEndAt: endAt,
      durationDisplay: duration.durationDisplay,
      updatedAt: new Date(),
    };
    emitToRole('warden', hostelId, 'curfew:schedule_updated', broadcastPayload);
    emitToRole('owner', hostelId, 'curfew:schedule_updated', broadcastPayload);

    return {
      success: true,
      message: 'Curfew schedule configured successfully',
      configuration: newConfig,
      session: newSession,
      duration: duration.durationDisplay,
    };
  }

  /**
   * Reset Curfew:
   * Deactivates future configuration and cancels future scheduled sessions.
   * Preserves all historical sessions, violations, attendance, and notification logs.
   */
  static async resetCurfew(hostelId, user) {
    const userId = user?.id || user?._id;

    // 1. Deactivate configuration
    await CurfewConfiguration.updateMany(
      { hostelId, isActive: true },
      {
        $set: {
          isActive: false,
          status: 'cancelled',
        },
        $push: {
          history: {
            action: 'RESET',
            actionBy: userId,
            timestamp: new Date(),
            note: 'Configuration reset by warden/staff. Historical records preserved.',
          },
        },
      }
    );

    // 2. Cancel future scheduled sessions (keep ACTIVE or completed sessions untouched)
    await CurfewSession.updateMany(
      { hostelId, status: 'SCHEDULED' },
      {
        $set: {
          status: 'CANCELLED',
          notes: 'Cancelled due to curfew reset',
          endedBy: userId,
        },
      }
    );

    // 3. Broadcast real-time reset
    emitToRole('warden', hostelId, 'curfew:reset', {
      hostelId,
      resetBy: userId,
      timestamp: new Date(),
    });
    emitToRole('owner', hostelId, 'curfew:reset', {
      hostelId,
      resetBy: userId,
      timestamp: new Date(),
    });

    return {
      success: true,
      message: 'Curfew configuration reset successfully. Historical records preserved.',
    };
  }

  /**
   * Fetch eligible students for curfew monitoring.
   * Criteria:
   * - Active student assigned to this hostel
   * - Excludes inactive or non-students
   * - Resolves active room and approved permissions (leave / out-pass)
   */
  static async getEligibleStudents(hostelId, curfewStartAt = new Date()) {
    const students = await User.find({
      hostelId,
      role: 'student',
      status: 'active',
    })
      .select('_id name studentId roomId locationPermissionStatus parentContact emergencyContact phone pushToken expoPushToken currentLocation lastLocationUpdate')
      .lean();

    if (students.length === 0) return [];

    const studentIds = students.map((s) => s._id);

    // Parallel fetch: active leaves + room details
    const [activeLeaves, rooms] = await Promise.all([
      Permission.find({
        studentId: { $in: studentIds },
        status: 'approved',
        permissionType: { $in: ['leave', 'overnight', 'multi-day', 'late-entry'] },
        requestedDate: { $lte: curfewStartAt },
        returnDate: { $gte: curfewStartAt },
      })
        .select('studentId permissionType reason requestedDate returnDate')
        .lean(),
      Room.find({ hostelId }).select('_id roomNumber block').lean(),
    ]);

    const leaveMap = new Map();
    for (const l of activeLeaves) {
      leaveMap.set(String(l.studentId), l);
    }

    const roomMap = new Map();
    for (const r of rooms) {
      roomMap.set(String(r._id), r);
    }

    return students.map((s) => {
      const sid = String(s._id);
      const leave = leaveMap.get(sid);
      const room = s.roomId ? roomMap.get(String(s.roomId)) : null;

      return {
        ...s,
        hasApprovedLeave: Boolean(leave),
        leaveDetails: leave || null,
        roomNumber: room?.roomNumber || 'N/A',
        block: room?.block || '',
      };
    });
  }

  /**
   * Start Curfew Now (Manual or Automatic Trigger).
   */
  static async startCurfew(hostelId, { triggerType = 'AUTOMATIC', user = null, configurationId = null } = {}) {
    const now = new Date();
    const userId = user?.id || user?._id || null;

    const hostel = await Hostel.findById(hostelId)
      .select('_id name timezone address')
      .lean();
    if (!hostel) throw new Error(`Hostel ${hostelId} not found`);

    const tz = hostel.timezone || 'Asia/Kolkata';

    // Check if an active session is already running
    let session = await CurfewSession.findOne({
      hostelId,
      status: 'ACTIVE',
    });

    if (session) {
      console.log(`[CurfewEngine] Active curfew already running for hostel ${hostel.name}`);
      return session;
    }

    // Check active configuration for duration calculation
    let config = configurationId ? await CurfewConfiguration.findById(configurationId).lean() : null;
    if (!config) {
      config = await CurfewConfiguration.findOne({ hostelId, isActive: true }).sort({ createdAt: -1 }).lean();
    }

    const durationMins = config?.durationMinutes || 60; // Default 1 hour
    const scheduledEndAt = new Date(now.getTime() + durationMins * 60 * 1000);

    // Look for an existing SCHEDULED session to promote, or create a new one
    session = await CurfewSession.findOne({
      hostelId,
      status: 'SCHEDULED',
      scheduledStartAt: { $lte: new Date(now.getTime() + 10 * 60 * 1000) }, // within 10 mins
    });

    if (session) {
      session.status = 'ACTIVE';
      session.actualStartAt = now;
      session.triggerType = triggerType;
      session.startedBy = userId || session.startedBy;
      if (!session.scheduledEndAt) session.scheduledEndAt = scheduledEndAt;
      await session.save();
    } else {
      session = await CurfewSession.create({
        hostelId,
        configurationId: config?._id || null,
        sessionDate: now,
        scheduledStartAt: now,
        actualStartAt: now,
        scheduledEndAt: scheduledEndAt,
        curfewStartTime: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
        curfewEndTime: `${String(scheduledEndAt.getHours()).padStart(2, '0')}:${String(scheduledEndAt.getMinutes()).padStart(2, '0')}`,
        status: 'ACTIVE',
        triggerType,
        timezone: tz,
        startedBy: userId,
        summary: {
          totalStudents: 0,
          presentCount: 0,
          outsideCount: 0,
          lateComersCount: 0,
          violationsCount: 0,
          resolvedCount: 0,
          parentAlertsCount: 0,
        },
        notes: `${triggerType} curfew started at ${now.toISOString()}`,
      });
    }

    // ── Location Monitoring & Presence Evaluation ──
    const [eligibleStudents, geoFence, recentLocations] = await Promise.all([
      this.getEligibleStudents(hostelId, now),
      GeoFence.findOne({ hostelId, isActive: true }).sort({ createdAt: -1 }).lean(),
      StudentLocation.find({
        hostelId,
        timestamp: { $gte: new Date(now.getTime() - 60 * 60 * 1000) },
      }).sort({ timestamp: -1 }).lean(),
    ]);

    const recentLocationMap = new Map();
    for (const loc of recentLocations) {
      const sid = String(loc.studentId);
      if (!recentLocationMap.has(sid)) {
        recentLocationMap.set(sid, loc);
      }
    }

    let presentCount = 0;
    let outsideCount = 0;
    let onLeaveCount = 0;
    const studentStatusDocs = [];

    const graceDeadline = new Date(now.getTime() + 15 * 60 * 1000);
    const secondCountdownDeadline = new Date(now.getTime() + 30 * 60 * 1000);
    const thirdCountdownDeadline = new Date(now.getTime() + 45 * 60 * 1000);

    for (const student of eligibleStudents) {
      const sid = String(student._id);

      if (student.hasApprovedLeave) {
        onLeaveCount++;
        studentStatusDocs.push({
          curfewSessionId: session._id,
          studentId: student._id,
          hostelId,
          roomId: student.roomId || null,
          roomNumber: student.roomNumber,
          block: student.block,
          status: 'ON_LEAVE',
          resolutionStatus: 'NONE',
          resolutionNote: `On approved leave: ${student.leaveDetails?.permissionType || 'Leave'}`,
        });
        continue;
      }

      // Check location
      const latestFix = recentLocationMap.get(sid) || (student.currentLocation?.latitude ? {
        location: { latitude: student.currentLocation.latitude, longitude: student.currentLocation.longitude },
        accuracy: student.currentLocation.accuracy,
        timestamp: student.currentLocation.timestamp,
        source: 'user_cached',
      } : null);

      let initialStatus = 'INSIDE';
      let distanceMeters = 0;
      let evaluatedLocation = null;
      let accuracy = latestFix?.accuracy ?? undefined;
      let locationSource = latestFix?.source || 'none';

      if (!latestFix || !latestFix.location?.latitude) {
        if (student.locationPermissionStatus === 'denied') {
          initialStatus = 'LOCATION_PERMISSION_DENIED';
        } else {
          initialStatus = 'LOCATION_UNAVAILABLE';
        }
      } else {
        evaluatedLocation = {
          latitude: latestFix.location.latitude,
          longitude: latestFix.location.longitude,
          accuracy: latestFix.accuracy,
          timestamp: latestFix.timestamp || now,
        };

        const freshness = this.isLocationFreshAndAccurate({
          latitude: latestFix.location.latitude,
          longitude: latestFix.location.longitude,
          accuracy: latestFix.accuracy,
          timestamp: latestFix.timestamp,
        });

        if (!freshness.valid) {
          if (freshness.reason === 'LOCATION_STALE') initialStatus = 'LOCATION_STALE';
          else if (freshness.reason === 'INACCURATE') initialStatus = 'LOW_ACCURACY';
          else initialStatus = 'LOCATION_UNAVAILABLE';

          const geofenceEval = locationValidationService.evaluateGeofence({
            location: evaluatedLocation,
            hostel,
            geoFence,
            isCheckOut: false,
          });
          distanceMeters = geofenceEval.distance || 0;
        } else {
          // Authoritative server-side geofence calculation
          const geofenceEval = locationValidationService.evaluateGeofence({
            location: evaluatedLocation,
            hostel,
            geoFence,
            isCheckOut: false,
          });

          distanceMeters = geofenceEval.distance || 0;

          if (geofenceEval.isInside) {
            initialStatus = 'INSIDE';
            presentCount++;
          } else {
            initialStatus = 'OUTSIDE_GRACE';
            outsideCount++;
          }
        }
      }

      const statusDoc = {
        curfewSessionId: session._id,
        studentId: student._id,
        hostelId,
        roomId: student.roomId || null,
        roomNumber: student.roomNumber,
        block: student.block,
        status: initialStatus,
        initialLocation: evaluatedLocation,
        currentLocation: evaluatedLocation,
        currentAccuracy: accuracy,
        lastLocationAt: evaluatedLocation?.timestamp || now,
        distanceFromHostel: distanceMeters,
        locationSource,
        outsideSince: initialStatus === 'OUTSIDE_GRACE' ? now : null,
        graceDeadline: initialStatus === 'OUTSIDE_GRACE' ? graceDeadline : null,
        secondCountdownDeadline: initialStatus === 'OUTSIDE_GRACE' ? secondCountdownDeadline : null,
        thirdCountdownDeadline: initialStatus === 'OUTSIDE_GRACE' ? thirdCountdownDeadline : null,
        studentAlertSentAt: initialStatus === 'OUTSIDE_GRACE' ? now : null,
        idempotentKeys: initialStatus === 'OUTSIDE_GRACE' ? [`${session._id}-${sid}-GRACE`] : [],
      };

      studentStatusDocs.push(statusDoc);

      // Send 15-minute grace warning to student if outside
      if (initialStatus === 'OUTSIDE_GRACE') {
        const warningMsg = `⚠️ CURFEW ALERT: You are currently outside the hostel. Curfew started at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Please return to the hostel within the 15-minute grace period (deadline: ${graceDeadline.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}).`;
        emitToUser(sid, 'curfew:student_warning', {
          curfewSessionId: String(session._id),
          status: 'OUTSIDE_GRACE',
          message: warningMsg,
          graceDeadline,
          startedAt: now,
        });

        Notification.create({
          userId: student._id,
          hostelId,
          title: '⚠️ Curfew Grace Period Active',
          message: warningMsg,
          type: 'ALERT',
          category: 'curfew',
          priority: 'high',
        }).catch(() => {});
      }
    }

    // Bulk upsert student statuses
    await CurfewStudentStatus.deleteMany({ curfewSessionId: session._id });
    if (studentStatusDocs.length > 0) {
      await CurfewStudentStatus.insertMany(studentStatusDocs);
    }

    // Update session summary
    session.summary = {
      totalStudents: eligibleStudents.length,
      presentCount,
      outsideCount,
      lateComersCount: 0,
      onLeaveCount,
      violationsCount: 0,
      resolvedCount: 0,
      parentAlertsCount: 0,
    };
    await session.save();

    // Broadcast session started to wardens & owners
    const socketData = {
      hostelId,
      session,
      startedAt: now,
      scheduledEndAt,
      triggerType,
      summary: session.summary,
    };
    emitToRole('warden', hostelId, 'curfew:started', socketData);
    emitToRole('owner', hostelId, 'curfew:started', socketData);

    console.log(`[CurfewEngine] Curfew session ${session._id} started for hostel ${hostel.name} (${triggerType}). Monitored: ${eligibleStudents.length}, Outside: ${outsideCount}`);

    return session;
  }

  /**
   * End Curfew manually or automatically.
   */
  static async endCurfew(hostelId, { user = null, reason = 'manual_ended' } = {}) {
    const now = new Date();
    const userId = user?.id || user?._id || null;

    const session = await CurfewSession.findOne({
      hostelId,
      status: 'ACTIVE',
    }).sort({ actualStartAt: -1 });

    if (!session) {
      return { success: false, message: 'No active curfew session running' };
    }

    session.status = 'ENDED';
    session.actualEndAt = now;
    session.endedBy = userId;
    session.notes = `${session.notes} | Ended at ${now.toISOString()} (${reason})`;
    await session.save();

    // Clear active deadlines for students to stop further timers
    await CurfewStudentStatus.updateMany(
      { curfewSessionId: session._id, status: 'OUTSIDE_GRACE' },
      { $set: { resolutionNote: 'Curfew ended before grace expiration' } }
    );

    // Broadcast curfew ended
    const broadcastData = {
      hostelId,
      sessionId: session._id,
      actualEndAt: now,
      reason,
      summary: session.summary,
    };
    emitToRole('warden', hostelId, 'curfew:ended', broadcastData);
    emitToRole('owner', hostelId, 'curfew:ended', broadcastData);

    console.log(`[CurfewEngine] Curfew session ${session._id} ended (${reason})`);

    return {
      success: true,
      message: 'Curfew ended successfully. Historical records preserved.',
      session,
    };
  }

  /**
   * Handle student return into hostel geofence:
   * - During Grace: marked LATE COMER (record entry time, GPS, delay minutes; stops escalation)
   * - After Violation: marked VIOLATION RESOLVED BY RETURN (preserves violation, records return time & total outside duration)
   */
  static async handleStudentReturn(studentId, locationOrTime = {}, returnTime = new Date()) {
    let locationData = {};
    let actualReturnTime = returnTime;

    if (locationOrTime instanceof Date || (typeof locationOrTime === 'string' && !isNaN(new Date(locationOrTime).getTime()))) {
      actualReturnTime = new Date(locationOrTime);
      locationData = {};
    } else if (locationOrTime && typeof locationOrTime === 'object') {
      locationData = locationOrTime;
      if (returnTime instanceof Date) {
        actualReturnTime = returnTime;
      }
    }

    const sid = String(studentId);

    // Find student's active curfew status
    const studentStatus = await CurfewStudentStatus.findOne({
      studentId: sid,
      status: { $in: ['OUTSIDE_GRACE', 'VIOLATION'] },
    }).populate('curfewSessionId').populate('studentId', 'name studentId roomId');

    if (!studentStatus) return false;

    const session = studentStatus.curfewSessionId;
    if (!session || session.status !== 'ACTIVE') return false;

    const hostelId = String(studentStatus.hostelId);
    const studentName = studentStatus.studentId?.name || 'Student';
    const startAt = new Date(session.actualStartAt || session.scheduledStartAt || returnTime);
    const delayMinutes = Math.max(1, Math.round((returnTime.getTime() - startAt.getTime()) / (60 * 1000)));

    const entryCoords = {
      latitude: locationData.latitude || studentStatus.currentLocation?.latitude,
      longitude: locationData.longitude || studentStatus.currentLocation?.longitude,
      accuracy: locationData.accuracy || studentStatus.currentAccuracy,
      distance: locationData.distance || 0,
    };

    if (studentStatus.status === 'OUTSIDE_GRACE') {
      // ── RETURNED DURING GRACE: LATE COMER ──
      studentStatus.status = 'LATE_COMER';
      studentStatus.resolutionStatus = 'RETURNED_GRACE';
      studentStatus.returnedAt = returnTime;
      studentStatus.entryTime = returnTime;
      studentStatus.entryLocation = entryCoords;
      studentStatus.delayMinutes = delayMinutes;
      studentStatus.totalTimeOutsideMinutes = delayMinutes;
      studentStatus.resolutionNote = `Returned during grace period after ${delayMinutes} minutes. Marked Late Comer.`;
      studentStatus.graceDeadline = null;
      studentStatus.secondCountdownDeadline = null;
      studentStatus.thirdCountdownDeadline = null;
      await studentStatus.save();

      // Update Attendance to inside
      await Attendance.findOneAndUpdate(
        { studentId: sid, hostelId },
        {
          $set: {
            status: 'inside',
            checkInTime: returnTime,
            verificationMethod: 'curfew_return',
          },
        },
        { sort: { createdAt: -1 } }
      );

      // Increment late comers count in session summary
      await CurfewSession.findByIdAndUpdate(session._id, {
        $inc: {
          'summary.outsideCount': -1,
          'summary.lateComersCount': 1,
          'summary.presentCount': 1,
        },
      });

      emitToUser(sid, 'curfew:status_update', {
        status: 'LATE_COMER',
        message: `Welcome back! Entry recorded at ${returnTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Late: ${delayMinutes} mins.`,
      });

      emitToRole('warden', hostelId, 'curfew:student_status_update', {
        studentId: sid,
        studentName,
        status: 'LATE_COMER',
        delayMinutes,
        entryTime: returnTime,
      });

      console.log(`[CurfewEngine] Student ${studentName} (${sid}) returned during grace -> LATE COMER (${delayMinutes}m late)`);
      return true;
    } else if (studentStatus.status === 'VIOLATION') {
      // ── RETURNED AFTER VIOLATION: VIOLATION RESOLVED BY RETURN ──
      studentStatus.status = 'VIOLATION_RESOLVED';
      studentStatus.resolutionStatus = 'RETURNED_AFTER_VIOLATION';
      studentStatus.returnedAt = returnTime;
      studentStatus.entryTime = returnTime;
      studentStatus.entryLocation = entryCoords;
      studentStatus.totalTimeOutsideMinutes = delayMinutes;
      studentStatus.resolutionNote = `Returned after violation. Total time outside: ${delayMinutes} minutes. Violation resolved.`;
      studentStatus.secondCountdownDeadline = null;
      studentStatus.thirdCountdownDeadline = null;
      await studentStatus.save();

      // Mark CurfewViolation record as resolved
      await CurfewViolation.findOneAndUpdate(
        { studentId: sid, hostelId, status: { $in: ['open', 'acknowledged', 'pending_recheck'] } },
        {
          $set: {
            status: 'resolved',
            studentReturnedAt: returnTime,
            resolvedAt: returnTime,
            resolutionNote: `Violation resolved by student return inside geofence after ${delayMinutes} mins outside.`,
          },
        },
        { sort: { createdAt: -1 } }
      );

      // Update Attendance to inside
      await Attendance.findOneAndUpdate(
        { studentId: sid, hostelId },
        {
          $set: {
            status: 'inside',
            checkInTime: returnTime,
            verificationMethod: 'curfew_return',
          },
        },
        { sort: { createdAt: -1 } }
      );

      await CurfewSession.findByIdAndUpdate(session._id, {
        $inc: {
          'summary.outsideCount': -1,
          'summary.resolvedCount': 1,
          'summary.presentCount': 1,
        },
      });

      emitToUser(sid, 'curfew:status_update', {
        status: 'VIOLATION_RESOLVED',
        message: `Welcome back! Entry recorded at ${returnTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Curfew violation resolved.`,
      });

      emitToRole('warden', hostelId, 'curfew:student_status_update', {
        studentId: sid,
        studentName,
        status: 'VIOLATION_RESOLVED',
        totalTimeOutsideMinutes: delayMinutes,
        entryTime: returnTime,
      });

      console.log(`[CurfewEngine] Student ${studentName} (${sid}) returned after violation -> VIOLATION RESOLVED`);
      return true;
    }

    return false;
  }

  /**
   * Evaluates active sessions & outside students:
   * Handles 15m Grace Expiry -> Violation,
   * 30m Escalation -> Warden + Owner Alert,
   * 45m Escalation -> Parent Alert,
   * and Scheduled Curfew End.
   */
  static async runGlobalCurfewEvaluation() {
    const now = new Date();
    const results = { started: 0, violations: 0, wardenAlerts: 0, parentAlerts: 0, ended: 0 };

    // ── 1. Check for scheduled curfews to start automatically ──
    const dueScheduledSessions = await CurfewSession.find({
      status: 'SCHEDULED',
      scheduledStartAt: { $lte: now },
    }).lean();

    for (const s of dueScheduledSessions) {
      try {
        await this.startCurfew(String(s.hostelId), {
          triggerType: 'AUTOMATIC',
          configurationId: s.configurationId,
        });
        results.started++;
      } catch (err) {
        console.error(`[CurfewEngine] Failed to auto-start session ${s._id}:`, err.message);
      }
    }

    // ── 2. Evaluate active sessions ──
    const activeSessions = await CurfewSession.find({ status: 'ACTIVE' }).lean();

    for (const session of activeSessions) {
      const sessionId = session._id;
      const hostelId = String(session.hostelId);

      // Check if scheduled end time has arrived
      if (session.scheduledEndAt && now >= new Date(session.scheduledEndAt)) {
        await this.endCurfew(hostelId, { reason: 'scheduled_end_reached' });
        results.ended++;
        continue;
      }

      // Fetch hostel info for alert messaging
      const hostel = await Hostel.findById(hostelId).select('_id name ownerId contactPhone').lean();

      // Fetch outside students
      const outsideStudents = await CurfewStudentStatus.find({
        curfewSessionId: sessionId,
        status: { $in: ['OUTSIDE_GRACE', 'VIOLATION'] },
      }).populate('studentId', 'name studentId roomId parentContact emergencyContact email');

      for (const st of outsideStudents) {
        const rawSid = (st.studentId && st.studentId._id) ? st.studentId._id : st.studentId;
        if (!rawSid || rawSid === 'null' || !mongoose.Types.ObjectId.isValid(rawSid)) continue;
        const sid = String(rawSid);
        const studentName = st.studentId?.name || 'Student';
        const roomStr = st.roomNumber || 'N/A';
        const blockStr = st.block || '';

        // ── STAGE 1: 15-MINUTE GRACE EXPIRED -> RULE VIOLATION ──
        if (st.status === 'OUTSIDE_GRACE' && st.graceDeadline && now >= new Date(st.graceDeadline)) {
          const violationKey = `${sessionId}-${sid}-VIOLATION`;

          if (!st.idempotentKeys.includes(violationKey)) {
            st.status = 'VIOLATION';
            st.violationAt = now;
            st.idempotentKeys.push(violationKey);
            await st.save();

            // Create persistent CurfewViolation record
            await CurfewViolation.create({
              studentId: st.studentId._id,
              hostelId,
              roomId: st.roomId,
              roomNumber: roomStr,
              violationDate: now,
              curfewTime: session.curfewStartTime || '21:00',
              attendanceStatus: 'outside',
              minutesMissing: 15,
              status: 'open',
              stage: 1,
            }).catch(() => {});

            // Increment session violations count
            await CurfewSession.findByIdAndUpdate(sessionId, {
              $inc: { 'summary.violationsCount': 1 },
            });

            // Send Second 15-minute countdown alert to student
            const violationMsg = `🚨 CURFEW VIOLATION: You have exceeded the 15-minute permitted grace period. You are still outside the hostel. Please return immediately. Second 15-minute escalation countdown is active.`;
            emitToUser(sid, 'curfew:student_violation', {
              curfewSessionId: String(sessionId),
              status: 'VIOLATION',
              message: violationMsg,
              secondCountdownDeadline: st.secondCountdownDeadline,
            });

            Notification.create({
              userId: st.studentId._id,
              hostelId,
              title: '🚨 Curfew Violation Recorded',
              message: violationMsg,
              type: 'VIOLATION',
              category: 'curfew',
              priority: 'urgent',
            }).catch(() => {});

            emitToRole('warden', hostelId, 'curfew:student_status_update', {
              studentId: sid,
              studentName,
              status: 'VIOLATION',
              violationAt: now,
            });

            results.violations++;
          }
        }

        // ── STAGE 2: SECOND 15-MINUTE EXPIRED (T+30m) -> WARDEN & OWNER ALERT ──
        if (st.status === 'VIOLATION' && st.secondCountdownDeadline && now >= new Date(st.secondCountdownDeadline)) {
          const wardenOwnerKey = `${sessionId}-${sid}-WARDEN-OWNER`;

          if (!st.idempotentKeys.includes(wardenOwnerKey)) {
            st.wardenAlertAt = now;
            st.ownerAlertAt = now;
            st.idempotentKeys.push(wardenOwnerKey);
            await st.save();

            const durationOutsideMins = Math.round((now.getTime() - new Date(session.actualStartAt || session.scheduledStartAt).getTime()) / 60000);
            const alertTitle = `🚨 Curfew Escalation: ${studentName} Outside (30+ mins)`;
            const alertMsg = `Student ${studentName} (ID: ${st.studentId?.studentId || 'N/A'}, Room: ${roomStr}${blockStr ? ' Block: ' + blockStr : ''}) has exceeded grace and second countdown. Status: VIOLATION. Distance: ${Math.round(st.distanceFromHostel || 0)}m. Outside since: ${st.outsideSince ? new Date(st.outsideSince).toLocaleTimeString() : 'curfew start'}. Duration: ${durationOutsideMins} mins.`;

            // Dispatch to Warden & Owner
            await HostelAlertService.send({
              type: 'CURFEW_VIOLATION',
              hostelId,
              title: alertTitle,
              message: alertMsg,
              priority: 'urgent',
              recipientRole: 'warden',
              studentId: sid,
              metadata: {
                studentId: sid,
                studentName,
                roomNumber: roomStr,
                distanceFromHostel: st.distanceFromHostel,
                lastLocationAt: st.lastLocationAt,
                durationOutsideMins,
              },
            }).catch(() => {});

            emitToRole('warden', hostelId, 'curfew:escalation_alert', {
              studentId: sid,
              studentName,
              roomNumber: roomStr,
              message: alertMsg,
              stage: 'WARDEN_OWNER',
            });

            emitToRole('owner', hostelId, 'curfew:escalation_alert', {
              studentId: sid,
              studentName,
              roomNumber: roomStr,
              message: alertMsg,
              stage: 'WARDEN_OWNER',
            });

            results.wardenAlerts++;
          }
        }

        // ── STAGE 3: THIRD 15-MINUTE EXPIRED (T+45m) -> PARENT ALERT ──
        if (st.status === 'VIOLATION' && st.thirdCountdownDeadline && now >= new Date(st.thirdCountdownDeadline)) {
          const parentKey = `${sessionId}-${sid}-PARENT`;

          if (!st.idempotentKeys.includes(parentKey)) {
            st.parentAlertAt = now;
            st.idempotentKeys.push(parentKey);
            await st.save();

            const parentEmail = st.studentId?.parentContact?.email || st.studentId?.emergencyContact?.email;
            const parentPhone = st.studentId?.parentContact?.phone || st.studentId?.emergencyContact?.phone || '';
            const parentName = st.studentId?.parentContact?.name || 'Parent / Guardian';

            // Send parent emergency email if email is present
            if (parentEmail) {
              await sendParentEmergencyEmail({
                parentEmail,
                parentName,
                studentName,
                hostelName: hostel?.name || 'Hostel',
                emergencyType: 'curfew_absence',
                description: `Student ${studentName} (Room ${roomStr}) has not returned to the hostel during active curfew. Curfew started at ${session.curfewStartTime}. Last known location distance: ${Math.round(st.distanceFromHostel || 0)}m. Please contact hostel administration.`,
                timestamp: now,
                contactNumber: hostel?.contactPhone || '',
              }).catch((e) => console.warn('[CurfewEngine] Parent email error:', e.message));
            }

            // Update violation parentNotified flag
            await CurfewViolation.findOneAndUpdate(
              { studentId: sid, hostelId, status: 'open' },
              { $set: { parentNotified: true, parentNotifiedAt: now, parentEmail } },
              { sort: { createdAt: -1 } }
            );

            await CurfewSession.findByIdAndUpdate(sessionId, {
              $inc: { 'summary.parentAlertsCount': 1 },
            });

            emitToRole('warden', hostelId, 'curfew:parent_notified', {
              studentId: sid,
              studentName,
              parentEmail,
              parentPhone,
              notifiedAt: now,
            });

            results.parentAlerts++;
          }
        }
      }
    }

    return results;
  }

  /**
   * Get Active Session and Status for a Hostel.
   */
  static async getActiveSessionData(hostelId) {
    const hostel = await Hostel.findById(hostelId).select('_id name timezone address rules').lean();
    if (!hostel) throw new Error(`Hostel ${hostelId} not found`);

    const tz = hostel.timezone || 'Asia/Kolkata';
    const activeSession = await CurfewSession.findOne({
      hostelId,
      status: 'ACTIVE',
    }).sort({ actualStartAt: -1 }).lean();

    const scheduledSession = !activeSession ? await CurfewSession.findOne({
      hostelId,
      status: 'SCHEDULED',
    }).sort({ scheduledStartAt: 1 }).lean() : null;

    const configuration = await CurfewConfiguration.findOne({
      hostelId,
      isActive: true,
    }).sort({ createdAt: -1 }).lean();

    const currentSession = activeSession || scheduledSession;

    let students = [];
    if (activeSession) {
      students = await CurfewStudentStatus.find({
        curfewSessionId: activeSession._id,
      })
        .populate('studentId', 'name studentId roomId email phone')
        .sort({ status: 1, studentId: 1 })
        .lean();
    }

    const now = new Date();
    let remainingSeconds = 0;
    if (activeSession?.scheduledEndAt) {
      remainingSeconds = Math.max(0, Math.floor((new Date(activeSession.scheduledEndAt).getTime() - now.getTime()) / 1000));
    }

    return {
      hostelId,
      hostelName: hostel.name,
      hostelAddress: hostel.address,
      timezone: tz,
      status: activeSession ? 'ACTIVE' : scheduledSession ? 'SCHEDULED' : 'INACTIVE',
      session: currentSession,
      configuration,
      remainingSeconds,
      summary: activeSession?.summary || {
        totalStudents: 0,
        presentCount: 0,
        outsideCount: 0,
        lateComersCount: 0,
        violationsCount: 0,
        resolvedCount: 0,
        parentAlertsCount: 0,
      },
      students,
    };
  }

  /**
   * Get Student Monitoring Table Data with Filters.
   */
  static async getCurfewStudents(hostelId, query = {}) {
    const {
      status,
      room,
      block,
      search,
      page = 1,
      limit = 50,
    } = query;

    const activeSession = await CurfewSession.findOne({
      hostelId,
      status: 'ACTIVE',
    }).sort({ actualStartAt: -1 }).lean();

    if (!activeSession) {
      return { total: 0, students: [], sessionStatus: 'INACTIVE' };
    }

    const filter = { curfewSessionId: activeSession._id };

    if (status && status !== 'all') {
      if (status === 'inside') filter.status = 'INSIDE';
      else if (status === 'outside') filter.status = { $in: ['OUTSIDE_GRACE', 'VIOLATION'] };
      else if (status === 'grace') filter.status = 'OUTSIDE_GRACE';
      else if (status === 'late') filter.status = 'LATE_COMER';
      else if (status === 'violation') filter.status = 'VIOLATION';
      else if (status === 'resolved') filter.status = 'VIOLATION_RESOLVED';
      else if (status === 'unavailable') filter.status = { $in: ['LOCATION_UNAVAILABLE', 'LOCATION_PERMISSION_DENIED', 'LOCATION_STALE', 'LOW_ACCURACY'] };
      else filter.status = status;
    }

    if (room) filter.roomNumber = new RegExp(room, 'i');
    if (block) filter.block = new RegExp(block, 'i');

    let studentStatuses = await CurfewStudentStatus.find(filter)
      .populate('studentId', 'name studentId roomId email phone')
      .sort({ status: 1, distanceFromHostel: -1 })
      .lean();

    if (search) {
      const sLower = search.toLowerCase();
      studentStatuses = studentStatuses.filter((s) => {
        const name = s.studentId?.name?.toLowerCase() || '';
        const id = s.studentId?.studentId?.toLowerCase() || '';
        const roomNum = s.roomNumber?.toLowerCase() || '';
        return name.includes(sLower) || id.includes(sLower) || roomNum.includes(sLower);
      });
    }

    const total = studentStatuses.length;
    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
    const paginated = studentStatuses.slice(skip, skip + Number(limit));

    const now = new Date();
    const formatted = paginated.map((st) => {
      let graceSecondsLeft = 0;
      if (st.status === 'OUTSIDE_GRACE' && st.graceDeadline) {
        graceSecondsLeft = Math.max(0, Math.floor((new Date(st.graceDeadline).getTime() - now.getTime()) / 1000));
      }

      let secondSecondsLeft = 0;
      if (st.status === 'VIOLATION' && st.secondCountdownDeadline) {
        secondSecondsLeft = Math.max(0, Math.floor((new Date(st.secondCountdownDeadline).getTime() - now.getTime()) / 1000));
      }

      return {
        ...st,
        studentName: st.studentId?.name || 'Student',
        studentRegId: st.studentId?.studentId || 'N/A',
        studentPhone: st.studentId?.phone || '',
        graceSecondsLeft,
        secondSecondsLeft,
      };
    });

    return {
      total,
      page: Number(page),
      limit: Number(limit),
      students: formatted,
      sessionStatus: 'ACTIVE',
      sessionId: activeSession._id,
    };
  }

  /**
   * Get Curfew History.
   */
  static async getCurfewHistory(hostelId, query = {}) {
    const { page = 1, limit = 20 } = query;
    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);

    const [total, sessions] = await Promise.all([
      CurfewSession.countDocuments({ hostelId }),
      CurfewSession.find({ hostelId })
        .populate('startedBy', 'name email role')
        .populate('endedBy', 'name email role')
        .populate('configurationId')
        .sort({ actualStartAt: -1, sessionDate: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
    ]);

    const formattedSessions = sessions.map((s) => {
      const start = s.actualStartAt || s.scheduledStartAt || s.sessionDate;
      const end = s.actualEndAt || s.scheduledEndAt;
      let durationStr = 'N/A';
      if (start && end) {
        const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / (60 * 1000));
        durationStr = formatDurationFromMinutes(mins);
      }

      return {
        ...s,
        formattedDuration: durationStr,
        startedByName: s.startedBy?.name || (s.triggerType === 'AUTOMATIC' ? 'System Scheduler' : 'Staff'),
        endedByName: s.endedBy?.name || (s.status === 'ENDED' ? 'System / Staff' : '—'),
      };
    });

    return {
      total,
      page: Number(page),
      limit: Number(limit),
      sessions: formattedSessions,
    };
  }

  /**
   * Evaluates whether curfew is active based on time strings or manual state.
   * Synchronous helper for wardenController.getDashboard and other callers.
   */
  static isCurfewActive(
    curfewTimeStr = '21:00',
    now = new Date(),
    curfewEndTimeStr = '06:00',
    isManualActive = false,
    manualCurfewEndedAt = null,
    manualCurfewStartedAt = null
  ) {
    if (isManualActive) {
      if (manualCurfewEndedAt && manualCurfewStartedAt && new Date(manualCurfewEndedAt) > new Date(manualCurfewStartedAt)) {
        return false;
      }
      return true;
    }

    if (!curfewTimeStr || !curfewEndTimeStr) return false;

    const [startH, startM] = String(curfewTimeStr).split(':').map(Number);
    const [endH, endM] = String(curfewEndTimeStr).split(':').map(Number);
    if (isNaN(startH) || isNaN(endH)) return false;

    const currentMins = now.getHours() * 60 + now.getMinutes();
    const startMins = startH * 60 + (startM || 0);
    const endMins = endH * 60 + (endM || 0);

    if (startMins < endMins) {
      // Same-day curfew
      return currentMins >= startMins && currentMins < endMins;
    } else {
      // Overnight curfew (e.g. 21:00 -> 06:00)
      return currentMins >= startMins || currentMins < endMins;
    }
  }

  /**
   * Run curfew checks for a specific hostel.
   * Backward compatibility for cron/alert routes.
   */
  static async runCurfewCheckForHostel(hostelId) {
    return await this.runGlobalCurfewEvaluation();
  }

  /**
   * Global daily check alias.
   * Backward compatibility for cron.
   */
  static async runGlobalDailyCheck() {
    return await this.runGlobalCurfewEvaluation();
  }

  /**
   * Start immediate curfew by warden.
   * Backward compatibility for legacy warden action route.
   */
  static async startImmediateWardenCurfew(hostelId, wardenId) {
    const session = await this.startCurfew(hostelId, { triggerType: 'MANUAL', user: { id: wardenId } });
    return {
      session,
      present: session.summary?.presentCount || 0,
      onLeave: 0,
      initiated: session.summary?.outsideCount || 0,
    };
  }

  /**
   * Advance curfew simulation stage.
   * Backward compatibility for test/simulation endpoint.
   */
  static async advanceCurfewSimulation(hostelId, stage = '10min') {
    const evalResult = await this.runGlobalCurfewEvaluation();
    return { stage, executed: true, evalResult };
  }

  /**
   * Get active curfew timers.
   * Backward compatibility for legacy alert route.
   */
  static async getActiveCurfewTimers(hostelId) {
    return await this.getActiveSessionData(hostelId);
  }
}

module.exports = CurfewAutomationService;
