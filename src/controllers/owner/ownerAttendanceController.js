/**
 * @file controllers/owner/ownerAttendanceController.js
 * @description Owner attendance analytics, trends, and tracking controller.
 */

'use strict';

const mongoose = require('mongoose');
const Attendance = require('../../models/Attendance');
const StudentLocation = require('../../models/StudentLocation');
const GateEvent = require('../../models/GateEvent');
const User = require('../../models/User');
const Hostel = require('../../models/Hostel');
const { assertOwnsHostel, getOwnerHostelIds, getScopedHostelIds } = require('./ownerHelper');
const { validateLocation, calculateDistance } = require('../../utils/locationValidation');
const AttendanceAnalyticsService = require('../../services/attendanceAnalyticsService');
const AttendanceRepository = require('../../repositories/attendanceRepository');

exports.getAttendanceTrends = async (req, res) => {
  try {
    const { hostelId, startDate, endDate } = req.query;
    const scopedHostelIds = await getScopedHostelIds(req, hostelId);
    if (scopedHostelIds.length === 0) {
      return res.status(200).json({ success: true, data: { total: 0, inside: 0, outside: 0, pending: 0 } });
    }
    const trends = await AttendanceAnalyticsService.calculateHostelAttendanceTrends(scopedHostelIds, { startDate, endDate });
    res.status(200).json({ success: true, data: trends });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.triggerAttendanceCheck = async (req, res) => {
  try {
    const { hostelId } = req.body;
    await assertOwnsHostel(req, hostelId);

    const hostel = await Hostel.findById(hostelId);
    if (!hostel) {
      return res.status(404).json({ success: false, message: 'Hostel not found' });
    }

    const students = await User.find({
      hostelId: hostelId,
      role: 'student',
      status: 'active',
    }).select('name email studentId locationPermissionStatus currentLocation lastLocationUpdate pushToken');

    const studentIds = students.map((s) => s._id);
    const locationMap = await AttendanceRepository.getLatestStudentLocations(studentIds);

    const studentStatuses = students.map((student) => {
      const sid = student._id.toString();
      const latestLocation = locationMap.get(sid);

      const hasValidCurrentLocation = Boolean(
        student.currentLocation &&
        typeof student.currentLocation.latitude === 'number' &&
        typeof student.currentLocation.longitude === 'number'
      );

      let presenceStatus = 'unknown';
      let distanceFromHostel = null;
      let lastUpdate = student.lastLocationUpdate || latestLocation?.timestamp;

      if (student.locationPermissionStatus === 'denied') {
        presenceStatus = 'permission_denied';
      } else if (student.locationPermissionStatus === 'not_requested') {
        presenceStatus = 'permission_not_requested';
      } else if (!latestLocation && !hasValidCurrentLocation) {
        presenceStatus = 'no_data';
      } else {
        const location = hasValidCurrentLocation ? student.currentLocation : latestLocation?.location;
        const hostelLocation = hostel.address?.coordinates?.latitude && hostel.address?.coordinates?.longitude
          ? {
              latitude: hostel.address.coordinates.latitude,
              longitude: hostel.address.coordinates.longitude,
            }
          : (hostel.location || hostel.boundary);

        if (location && hostelLocation && hostelLocation.latitude && hostelLocation.longitude) {
          const validation = validateLocation(location, hostelLocation, 500);
          distanceFromHostel = validation.distance;
          presenceStatus = validation.isValid ? 'inside' : 'outside';
        }
      }

      return {
        studentId: student._id,
        name: student.name,
        email: student.email,
        studentNumber: student.studentId,
        presenceStatus,
        distanceFromHostel,
        lastUpdate,
        locationPermissionStatus: student.locationPermissionStatus,
        accuracy: latestLocation?.accuracy || student.currentLocation?.accuracy,
      };
    });

    const summary = {
      total: studentStatuses.length,
      inside: studentStatuses.filter((s) => s.presenceStatus === 'inside').length,
      outside: studentStatuses.filter((s) => s.presenceStatus === 'outside').length,
      permissionDenied: studentStatuses.filter((s) => s.presenceStatus === 'permission_denied').length,
      permissionNotRequested: studentStatuses.filter((s) => s.presenceStatus === 'permission_not_requested').length,
      noData: studentStatuses.filter((s) => s.presenceStatus === 'no_data').length,
    };

    res.status(200).json({
      success: true,
      data: {
        hostel: {
          id: hostel._id,
          name: hostel.name,
          coordinates: hostel.address?.coordinates,
        },
        summary,
        students: studentStatuses,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getStudentLocations = async (req, res) => {
  try {
    const { hostelId, status } = req.query;
    // Security: scope to owner's hostels only
    const scopedHostelIds = await getScopedHostelIds(req, hostelId);
    if (scopedHostelIds.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }
    const query = { role: 'student', hostelId: { $in: scopedHostelIds } };
    if (status) query.status = status;

    const students = await User.find(query)
      .populate('roomId', 'roomNumber')
      .populate('hostelId', 'name address location')
      .select('name email phone studentId currentLocation lastLocationUpdate locationPermissionStatus roomId hostelId')
      .lean();

    const results = students.map((s) => {
      const coord = s.currentLocation?.latitude != null && s.currentLocation?.longitude != null
        ? { latitude: s.currentLocation.latitude, longitude: s.currentLocation.longitude }
        : null;

      const hostelCoord = s.hostelId?.address?.coordinates?.latitude != null && s.hostelId?.address?.coordinates?.longitude != null
        ? { latitude: s.hostelId.address.coordinates.latitude, longitude: s.hostelId.address.coordinates.longitude }
        : (s.hostelId?.location?.coordinates ? { latitude: s.hostelId.location.coordinates[1], longitude: s.hostelId.location.coordinates[0] } : null);

      let distanceFromHostel = null;
      let isInside = true;

      if (coord && hostelCoord) {
        distanceFromHostel = Math.round(calculateDistance(coord, hostelCoord));
        isInside = distanceFromHostel <= 500;
      }

      return {
        _id: s._id,
        id: s._id,
        name: s.name,
        email: s.email,
        phone: s.phone,
        studentId: s.studentId,
        roomNumber: s.roomId?.roomNumber || '—',
        hostelName: s.hostelId?.name,
        currentLocation: s.currentLocation,
        lastLocationUpdate: s.lastLocationUpdate || s.currentLocation?.timestamp,
        locationPermissionStatus: s.locationPermissionStatus || 'granted',
        isInside,
        distanceFromHostel,
      };
    });

    res.status(200).json({ success: true, data: results });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.simulateStudentLocation = async (req, res) => {
  try {
    const { studentId, latitude, longitude, isInside, accuracy = 10, source = 'simulation' } = req.body;
    if (!studentId || latitude == null || longitude == null) {
      return res.status(400).json({ success: false, message: 'studentId, latitude, and longitude are required' });
    }

    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Security: check owner owns student's hostel
    if (student.hostelId) {
      await assertOwnsHostel(req, student.hostelId);
    }

    const now = new Date();
    const hostel = student.hostelId ? await Hostel.findById(student.hostelId).select('name address location').lean() : null;
    const hostelCoord = hostel?.address?.coordinates?.latitude != null && hostel?.address?.coordinates?.longitude != null
      ? { latitude: hostel.address.coordinates.latitude, longitude: hostel.address.coordinates.longitude }
      : (hostel?.location?.coordinates ? { latitude: hostel.location.coordinates[1], longitude: hostel.location.coordinates[0] } : null);

    let computedDistance = null;
    if (hostelCoord) {
      computedDistance = Math.round(calculateDistance({ latitude: Number(latitude), longitude: Number(longitude) }, hostelCoord));
    }

    const effectiveIsInside = isInside !== undefined
      ? Boolean(isInside)
      : (computedDistance != null ? computedDistance <= 500 : true);

    student.currentLocation = {
      latitude: Number(latitude),
      longitude: Number(longitude),
      accuracy: Number(accuracy),
      timestamp: now,
    };
    student.lastLocationUpdate = now;
    student.locationPermissionStatus = 'granted';
    await student.save();

    if (student.hostelId) {
      await StudentLocation.create({
        studentId: student._id,
        hostelId: student.hostelId,
        location: { latitude: Number(latitude), longitude: Number(longitude) },
        isInsideHostel: effectiveIsInside,
        distanceFromHostel: computedDistance,
        accuracy: Number(accuracy),
        source,
      }).catch((err) => console.warn('StudentLocation simulation log error:', err?.message));

      await GateEvent.create({
        studentId: student._id,
        hostelId: student.hostelId,
        eventType: effectiveIsInside ? 'check_in' : 'check_out',
        method: 'geofence',
        timestamp: now,
        location: { latitude: Number(latitude), longitude: Number(longitude) },
        metadata: { simulated: true, distanceFromHostel: computedDistance },
      }).catch((err) => console.warn('GateEvent create error:', err?.message));

      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);

      let attendance = await Attendance.findOne({
        studentId: student._id,
        date: startOfDay,
      }).sort({ createdAt: -1 });

      if (!attendance) {
        await Attendance.create({
          studentId: student._id,
          hostelId: student.hostelId,
          date: startOfDay,
          status: effectiveIsInside ? 'inside' : 'outside',
          checkInTime: effectiveIsInside ? now : null,
          checkOutTime: !effectiveIsInside ? now : null,
        });
      } else {
        attendance.status = effectiveIsInside ? 'inside' : 'outside';
        if (effectiveIsInside) {
          attendance.checkInTime = attendance.checkInTime || now;
        } else {
          attendance.checkOutTime = now;
        }
        await attendance.save();
      }
    }

    res.status(200).json({
      success: true,
      message: `Simulated student location: ${effectiveIsInside ? 'Inside' : 'Outside'} hostel (${computedDistance != null ? computedDistance + 'm away' : 'GPS fix'})`,
      data: {
        studentId: student._id,
        name: student.name,
        currentLocation: student.currentLocation,
        isInside: effectiveIsInside,
        distanceFromHostel: computedDistance,
      },
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// List students with their current check-in/check-out status (from latest Attendance)

exports.getStudentsWithAttendance = async (req, res) => {
  try {
    const { hostelId } = req.query;
    let scopedHostelIds = [];
    try {
      scopedHostelIds = await getScopedHostelIds(req, hostelId);
    } catch (_) {
      // If hostel not found or not owned, return empty array gracefully
      return res.status(200).json({ success: true, data: [] });
    }
    if (!scopedHostelIds || scopedHostelIds.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }
    const query = { role: 'student', hostelId: { $in: scopedHostelIds } };

    const students = await User.find(query)
      .populate('hostelId', 'name')
      .populate('roomId', 'roomNumber')
      .populate('planId', 'name amount durationMonths')
      .select('name email phone studentId status hostelId roomId pushToken planId')
      .lean();

    const studentIds = students.map(s => s._id);
    const latestAttendance = await Attendance.aggregate([
      { $match: { studentId: { $in: studentIds } } },
      { $sort: { date: -1, createdAt: -1 } },
      { $group: { _id: '$studentId', doc: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$doc' } },
    ]);

    const attendanceByStudent = {};
    latestAttendance.forEach(a => {
      attendanceByStudent[a.studentId.toString()] = a;
    });

    const list = students.map(s => {
      const { pushToken, ...rest } = s;
      const att = attendanceByStudent[s._id.toString()];
      const presenceStatus = !att ? 'unknown' : (att.status === 'inside' ? 'inside' : att.status === 'outside' ? 'outside' : 'unknown');
      return {
        ...rest,
        presenceStatus,
        lastCheckIn: att?.checkInTime || null,
        lastCheckOut: att?.checkOutTime || null,
        hasPushToken: !!(pushToken && String(pushToken).trim()),
      };
    });

    res.status(200).json({ success: true, data: list });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Day-wise attendance: all students of hostel with total time inside per day (0 if no record)

exports.getDailyAttendance = async (req, res) => {
  try {
    const { hostelId, from, to } = req.query;
    const scopedHostelIds = await getScopedHostelIds(req, hostelId);
    if (scopedHostelIds.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }
    const effectiveHostelId = hostelId || (scopedHostelIds.length === 1 ? scopedHostelIds[0] : null);
    if (!effectiveHostelId) {
      return res.status(200).json({ success: true, data: [] });
    }

    const fromDate = from ? new Date(from) : new Date();
    fromDate.setHours(0, 0, 0, 0);
    const toDate = to ? new Date(to) : new Date(fromDate);
    if (to) toDate.setHours(23, 59, 59, 999);
    else toDate.setHours(23, 59, 59, 999);

    const students = await User.find({ hostelId: effectiveHostelId, role: 'student' })
      .select('name email studentId')
      .sort({ name: 1 })
      .lean();

    const records = await Attendance.find({
      hostelId: effectiveHostelId,
      date: { $gte: fromDate, $lte: toDate },
    })
      .populate('studentId', 'name email studentId')
      .lean();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const now = new Date();

    const byDay = {};
    const dayKeys = new Set();
    for (let d = new Date(fromDate); d <= toDate; d.setDate(d.getDate() + 1)) {
      const dayKey = d.toISOString().slice(0, 10);
      dayKeys.add(dayKey);
      byDay[dayKey] = students.map((s) => ({
        studentId: s._id,
        name: s.name ?? '—',
        email: s.email ?? '',
        studentNumber: s.studentId ?? '',
        totalMinutesInside: 0,
        totalTimeFormatted: '0m',
      }));
    }

    // Group by (dayKey, studentId): use MAX(totalMinutesInside) + current session if inside (same as mobile getStatus)
    const dayStudentMinutes = {};
    const dayStudentCurrentSession = {};
    for (const r of records) {
      const d = new Date(r.date);
      d.setHours(0, 0, 0, 0);
      const dayKey = d.toISOString().slice(0, 10);
      const sid = (r.studentId && (r.studentId._id || r.studentId)).toString();
      const key = `${dayKey}:${sid}`;
      const base = Number(r.totalMinutesInside) || 0;
      if (base > (dayStudentMinutes[key] || 0)) dayStudentMinutes[key] = base;
      if (d.getTime() === todayStart.getTime() && r.status === 'inside' && r.checkInTime) {
        const currentSession = (now.getTime() - new Date(r.checkInTime).getTime()) / 60000;
        dayStudentCurrentSession[key] = Math.max(0, dayStudentCurrentSession[key] || 0, currentSession);
      }
    }
    for (const dayKey of dayKeys) {
      const rows = byDay[dayKey];
      if (!rows) continue;
      for (const row of rows) {
        const sid = (row.studentId && (row.studentId._id || row.studentId)).toString();
        const key = `${dayKey}:${sid}`;
        let minutes = dayStudentMinutes[key] || 0;
        minutes += dayStudentCurrentSession[key] || 0;
        row.totalMinutesInside = Math.round(minutes * 10) / 10;
        row.totalTimeFormatted = formatMinutesToTime(minutes);
      }
    }

    const sortedDays = Array.from(dayKeys).sort();
    const data = sortedDays.map((date) => ({
      date,
      students: byDay[date],
    }));

    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

function formatMinutesToTime(minutes) {
  const m = Math.round(Number(minutes) || 0);
  if (m <= 0) return '0m';
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h > 0 && min > 0) return `${h}h ${min}m`;
  if (h > 0) return `${h}h`;
  return `${min}m`;
}

// Gate logs: time-sorted check-in/check-out events from GateEvent (one document per in/out)

exports.getGateLogs = async (req, res) => {
  try {
    const { hostelId, from, to, studentId: studentIdParam } = req.query;
    const scopedHostelIds = await getScopedHostelIds(req, hostelId);
    if (scopedHostelIds.length === 0) {
      return res.status(200).json({ success: true, data: { events: [] } });
    }
    const effectiveHostelId = hostelId || (scopedHostelIds.length === 1 ? scopedHostelIds[0] : null);
    if (!effectiveHostelId) {
      return res.status(200).json({ success: true, data: { events: [] } });
    }

    const fromDate = from ? new Date(from) : new Date();
    fromDate.setHours(0, 0, 0, 0);
    const toDate = to ? new Date(to) : new Date(fromDate);
    toDate.setHours(23, 59, 59, 999);
    if (!to) toDate.setHours(23, 59, 59, 999);

    const query = { hostelId: effectiveHostelId, time: { $gte: fromDate, $lte: toDate } };
    if (studentIdParam) query.studentId = studentIdParam;

    const records = await GateEvent.find(query)
      .populate('studentId', 'name email studentId')
      .sort({ time: 1 })
      .lean();

    const rawEvents = records.map((r) => ({
      time: r.time,
      type: r.type,
      studentId: r.studentId?._id || r.studentId,
      studentName: r.studentId?.name ?? '—',
      studentEmail: r.studentId?.email ?? '',
      studentNumber: r.studentId?.studentId ?? '',
    }));

    // Dedupe: same student + same type within 60s → keep only the first (removes duplicate IN/IN or OUT/OUT)
    const DEDUPE_MS = 60 * 1000;
    const events = [];
    for (const ev of rawEvents) {
      const sid = String(ev.studentId);
      const t = new Date(ev.time).getTime();
      const isDup = events.some(
        (e) => String(e.studentId) === sid && e.type === ev.type && Math.abs(new Date(e.time).getTime() - t) <= DEDUPE_MS
      );
      if (!isDup) events.push(ev);
    }

    res.status(200).json({ success: true, data: { events } });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// List students by location permission status

exports.getLocationPermissionStatus = async (req, res) => {
  try {
    const { hostelId } = req.query;
    // Security: scope to owner's hostels only
    const scopedHostelIds = await getScopedHostelIds(req, hostelId);
    if (scopedHostelIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: { granted: [], denied: [], not_requested: [] },
      });
    }
    const query = { role: 'student', hostelId: { $in: scopedHostelIds } };

    const students = await User.find(query).select('name studentId locationPermissionStatus');

    // Group by status
    const grouped = {
      granted: students.filter(s => s.locationPermissionStatus === 'granted'),
      denied: students.filter(s => s.locationPermissionStatus === 'denied'),
      not_requested: students.filter(s => s.locationPermissionStatus === 'not_requested'),
    };

    res.status(200).json({ success: true, data: grouped });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Send Notification to All Students (Expo when available for receipts, else FCM)