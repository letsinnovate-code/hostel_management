const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Permission = require('../models/Permission');
const Violation = require('../models/Violation');
const Complaint = require('../models/Complaint');
const Emergency = require('../models/Emergency');
const Notification = require('../models/Notification');
const Visitor = require('../models/Visitor');
const Hostel = require('../models/Hostel');
const GeoFence = require('../models/GeoFence');
const StudentLocation = require('../models/StudentLocation');
const MessSchedule = require('../models/MessSchedule');
const FeeStructure = require('../models/FeeStructure');
const Payment = require('../models/Payment');
const Plan = require('../models/Plan');
const SupportTicket = require('../models/SupportTicket');
const { validateLocation, validateLocationWithGeoFence } = require('../utils/locationValidation');
const { createOrder, verifyPaymentSignature } = require('../utils/razorpay');
const { setPeriodFromPlan } = require('../utils/paymentPeriod');
const { sendViolationPushToStudent, sendCheckInPushToStudent } = require('../utils/notificationService');
const { logGateEvent } = require('../utils/gateEventService');
// Alert & Automation Module — event-driven integration
const { hostelEventEmitter } = require('../modules/alert');
const { ALERT_TYPES } = require('../modules/alert/utils/constants');

const CHECKOUT_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes: no check-in / no "left without checkout" violation
const NOTIFICATION_DEDUPE_WINDOW_MS = 30 * 60 * 1000; // 30 minutes: at most one auto check-in + one violation notification per window per student

// ============ PROFILE MANAGEMENT ============

// Get Profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('hostelId')
      .populate('blockId')
      .populate('roomId')
      .select('-password');

    const hostel = await Hostel.findById(user.hostelId);
    const rules = await require('../models/Rule').find({
      hostelId: user.hostelId,
      isActive: true,
    });

    res.status(200).json({
      success: true,
      data: {
        profile: user,
        hostelRules: rules,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Profile
exports.updateProfile = async (req, res) => {
  try {
    const allowedUpdates = ['name', 'phone', 'parentContact', 'profileImage'];
    const updates = Object.keys(req.body);
    const isValidOperation = updates.every(update => allowedUpdates.includes(update));

    if (!isValidOperation) {
      return res.status(400).json({ success: false, message: 'Invalid updates' });
    }

    const user = await User.findByIdAndUpdate(req.user.id, req.body, {
      new: true,
      runValidators: true,
    }).select('-password');

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ PRESENCE VERIFICATION ============

// Get Current Status
exports.getStatus = async (req, res) => {
  try {
    const studentId = req.user?.id ?? req.user?._id;
    if (!studentId) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    // Use same date boundaries and dayKey logic as owner getDailyAttendance so mobile shows same total as owner dashboard
    const now = new Date();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setHours(23, 59, 59, 999);
    // Day key for "today" (same as owner: local midnight then ISO date string for grouping)
    const todayDayKey = todayStart.toISOString().slice(0, 10);

    // Get user with populated room and hostel
    const user = await User.findById(studentId)
      .populate({
        path: 'roomId',
        select: 'roomNumber',
      })
      .populate({
        path: 'hostelId',
        select: 'name',
      })
      .select('roomId hostelId');

    // Fetch “current” record for status/checkIn/checkOut; fetch recent attendance to compute today’s total (same dayKey as owner)
    const twoDaysAgo = new Date(todayStart);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const [attendance, recentRecords] = await Promise.all([
      Attendance.findOne({
        studentId,
        date: { $gte: todayStart, $lte: todayEnd },
      }).sort({ createdAt: -1 }),
      Attendance.find({
        studentId,
        date: { $gte: twoDaysAgo },
      }).lean(),
    ]);

    // Restrict to “today” using same dayKey as owner getDailyAttendance so mobile total matches owner (2h 2m)
    const todayRecords = recentRecords.filter((r) => {
      const d = new Date(r.date);
      d.setHours(0, 0, 0, 0);
      return d.toISOString().slice(0, 10) === todayDayKey;
    });

    // Get last check-in from attendance history
    const lastCheckIn = await Attendance.findOne({
      studentId,
      checkInTime: { $exists: true },
    }).sort({ checkInTime: -1 });

    // Extract room number and hostel name for display (populated roomId has roomNumber, hostelId has name)
    const roomNumber = user?.roomId ? (user.roomId.roomNumber ?? (user.roomId._id ? String(user.roomId._id) : null)) : null;
    const hostelName = user?.hostelId ? (user.hostelId.name ?? (user.hostelId._id ? String(user.hostelId._id) : null)) : null;

    // Status: 'inside' | 'outside' | 'unknown' so mobile StatusCard can show "Inside Hostel" / "Outside Hostel" / "Position Unknown"
    const presenceStatus = attendance == null ? 'unknown' : (attendance.status === 'inside' ? 'inside' : attendance.status === 'outside' ? 'outside' : 'unknown');
    const lastUpdate = attendance?.updatedAt || attendance?.checkInTime || attendance?.checkOutTime || null;

    // Server-side 2-min cooldown: when status is outside and we have checkOutTime, cooldown ends at checkOutTime + 2 min
    let cooldownEndsAt = null;
    if (attendance?.status === 'outside' && attendance?.checkOutTime) {
      const endsAt = new Date(attendance.checkOutTime).getTime() + CHECKOUT_COOLDOWN_MS;
      if (endsAt > Date.now()) cooldownEndsAt = endsAt;
    }

    // Total minutes for today: match owner getDailyAttendance — one value per student (owner overwrites so “last” wins).
    // Use the same single-record value: pick the record that has the highest totalMinutesInside for today, then add
    // current session if student is inside (so mobile matches owner 2h 2m).
    // Return only stored minutes; mobile TimeInHostelCard adds live elapsed for current session (avoids double-count).
    let totalMinutesInside = 0;
    for (const r of todayRecords) {
      const base = Number(r.totalMinutesInside) || 0;
      if (base > totalMinutesInside) totalMinutesInside = base;
    }
    totalMinutesInside = Math.round(totalMinutesInside * 10) / 10;
    res.status(200).json({
      success: true,
      data: {
        status: presenceStatus,
        checkInTime: attendance?.checkInTime,
        checkOutTime: attendance?.checkOutTime,
        room: roomNumber,
        hostel: hostelName,
        lastUpdate,
        lastCheckIn: lastCheckIn?.checkInTime || attendance?.checkInTime || null,
        cooldownEndsAt,
        totalMinutesInside,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Check In – location-based: only when inside geo-fence; reject if within 2 min of checkout (server-side cooldown)
// Optimized: single parallel read batch, then one findOneAndUpdate (no find+save).
exports.checkIn = async (req, res) => {
  try {
    const { location, autoCheckIn } = req.body;
    const studentId = req.user?.id ?? req.user?._id;

    if (!location || !location.latitude || !location.longitude) {
      return res.status(400).json({
        success: false,
        message: 'Location coordinates (latitude, longitude) are required'
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Single parallel batch: cooldown, hostel (minimal fields), geo-fence (minimal), and today's attendance
    const [lastCheckout, hostel, geoFence] = await Promise.all([
      Attendance.findOne(
        { studentId, checkOutTime: { $exists: true, $ne: null } }
      ).sort({ checkOutTime: -1 }).select('checkOutTime').lean(),
      Hostel.findById(req.user.hostelId).select('address').lean(),
      GeoFence.findOne({ hostelId: req.user.hostelId, isActive: true })
        .sort({ createdAt: -1 })
        .select('type polygon bounds center radius')
        .lean(),
    ]);

    if (lastCheckout?.checkOutTime) {
      const cooldownEndsAt = new Date(lastCheckout.checkOutTime).getTime() + CHECKOUT_COOLDOWN_MS;
      if (Date.now() < cooldownEndsAt) {
        return res.status(400).json({
          success: false,
          message: 'You can check in again 2 minutes after checkout. Please wait.',
          cooldownEndsAt,
        });
      }
    }

    if (!hostel) {
      return res.status(404).json({ success: false, message: 'Hostel not found' });
    }

    const hostelLocation = hostel.address?.coordinates?.latitude != null && hostel.address?.coordinates?.longitude != null
      ? { latitude: hostel.address.coordinates.latitude, longitude: hostel.address.coordinates.longitude }
      : null;

    let isInsideHostel = false;
    if (geoFence && geoFence.type === 'polygon' && geoFence.polygon && geoFence.polygon.length >= 3) {
      const validation = validateLocationWithGeoFence(location, hostelLocation, { polygon: geoFence.polygon });
      isInsideHostel = validation.isValid;
    } else if (geoFence && geoFence.type === 'rectangle' && geoFence.bounds) {
      const validation = validateLocationWithGeoFence(location, hostelLocation, { bounds: geoFence.bounds });
      isInsideHostel = validation.isValid;
    } else if (hostelLocation) {
      const radius = geoFence?.type === 'circle' && geoFence?.radius != null ? geoFence.radius : 500;
      const validation = geoFence?.center?.latitude != null
        ? validateLocation(location, { latitude: geoFence.center.latitude, longitude: geoFence.center.longitude }, radius)
        : validateLocation(location, hostelLocation, radius);
      isInsideHostel = validation.isValid;
    }

    if (!isInsideHostel) {
      return res.status(400).json({
        success: false,
        message: 'You must be inside the hostel boundary to check in.',
      });
    }

    const now = new Date();
    const attendance = await Attendance.findOneAndUpdate(
      { studentId, date: { $gte: today } },
      {
        $set: {
          status: 'inside',
          checkInTime: now,
          location,
          verificationMethod: 'manual',
        },
        $setOnInsert: {
          studentId,
          hostelId: req.user.hostelId,
          date: now,
        },
      },
      { sort: { createdAt: -1 }, new: true, upsert: true }
    );

    await logGateEvent({
      studentId,
      hostelId: req.user.hostelId,
      type: 'in',
      time: now,
      location,
      verificationMethod: 'manual',
      attendanceId: attendance._id,
      source: 'student',
    }).catch((err) => console.warn('GateEvent log check-in:', err?.message));

    const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    const checkInTitle = autoCheckIn ? 'Auto check-in' : 'Check-in';
    const recentSame = await Notification.findOne({
      title: checkInTitle,
      recipients: studentId,
      hostelId: req.user.hostelId,
      createdAt: { $gte: new Date(Date.now() - NOTIFICATION_DEDUPE_WINDOW_MS) },
    }).lean();
    if (!recentSame) {
      await Notification.create({
        title: checkInTitle,
        message: autoCheckIn
          ? `You were automatically checked in at ${timeStr}.`
          : `You were checked in at ${timeStr}.`,
        type: 'alert',
        targetAudience: 'staff',
        recipients: [studentId],
        createdBy: studentId,
        hostelId: req.user.hostelId,
      }).catch((err) => console.warn('Check-in notification create:', err?.message));
    }

    setImmediate(() => {
      User.findById(studentId).select('pushToken expoPushToken').lean()
        .then((student) => {
          if (!student) return;
          sendCheckInPushToStudent({
            pushToken: student.pushToken,
            expoPushToken: student.expoPushToken,
            autoCheckIn: !!autoCheckIn,
            timeStr,
          });
        })
        .catch((err) => console.warn('Check-in push: could not load student tokens', err?.message));
    });

    res.status(200).json({ success: true, data: attendance });

    // ✅ Alert Module: emit check-in event for automation (late check-in detection, occupancy update)
    // Non-blocking — runs after response is sent. Never affects API latency.
    hostelEventEmitter.emit(hostelEventEmitter.EVENTS.CHECKIN, {
      studentId: String(studentId),
      hostelId: String(req.user.hostelId),
      time: now,
      source: 'student',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Check Out – only when inside hostel; fast path: parallel minimal reads, single findOneAndUpdate (no find+save).
exports.checkOut = async (req, res) => {
  try {
    const { location } = req.body;
    const studentId = req.user?.id ?? req.user?._id;

    if (!location || !location.latitude || !location.longitude) {
      return res.status(400).json({
        success: false,
        message: 'Location coordinates (latitude, longitude) are required'
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Parallel fetch: only fields needed for validation (lean + select)
    const [hostel, geoFence] = await Promise.all([
      Hostel.findById(req.user.hostelId).select('address').lean(),
      GeoFence.findOne({ hostelId: req.user.hostelId, isActive: true })
        .sort({ createdAt: -1 })
        .select('type polygon bounds center radius')
        .lean(),
    ]);

    if (!hostel) {
      return res.status(404).json({ success: false, message: 'Hostel not found' });
    }

    const hostelLocation = hostel.address?.coordinates?.latitude != null && hostel.address?.coordinates?.longitude != null
      ? { latitude: hostel.address.coordinates.latitude, longitude: hostel.address.coordinates.longitude }
      : null;

    let isInsideHostel = false;
    if (geoFence && geoFence.type === 'polygon' && geoFence.polygon && geoFence.polygon.length >= 3) {
      const validation = validateLocationWithGeoFence(location, hostelLocation, { polygon: geoFence.polygon });
      isInsideHostel = validation.isValid;
    } else if (geoFence && geoFence.type === 'rectangle' && geoFence.bounds) {
      const validation = validateLocationWithGeoFence(location, hostelLocation, { bounds: geoFence.bounds });
      isInsideHostel = validation.isValid;
    } else if (hostelLocation) {
      const radius = geoFence?.type === 'circle' && geoFence?.radius != null ? geoFence.radius : 500;
      const validation = geoFence?.center?.latitude != null
        ? validateLocation(location, { latitude: geoFence.center.latitude, longitude: geoFence.center.longitude }, radius)
        : validateLocation(location, hostelLocation, radius);
      isInsideHostel = validation.isValid;
    }

    if (!isInsideHostel) {
      return res.status(400).json({
        success: false,
        message: 'You must be inside the hostel boundary to check out.',
      });
    }

    const checkOutTime = new Date();
    const attendanceDoc = await Attendance.findOne({ studentId, date: { $gte: today }, status: 'inside' })
      .sort({ createdAt: -1 });
    if (!attendanceDoc) {
      return res.status(404).json({ success: false, message: 'No active attendance record' });
    }
    const sessionMinutes = attendanceDoc.checkInTime
      ? (checkOutTime.getTime() - new Date(attendanceDoc.checkInTime).getTime()) / 60000
      : 0;
    const attendance = await Attendance.findByIdAndUpdate(
      attendanceDoc._id,
      {
        $set: { status: 'outside', checkOutTime, location },
        $inc: { totalMinutesInside: Math.max(0, sessionMinutes) },
      },
      { new: true }
    );

    await logGateEvent({
      studentId,
      hostelId: req.user.hostelId,
      type: 'out',
      time: checkOutTime,
      location,
      verificationMethod: 'manual',
      attendanceId: attendanceDoc._id,
      source: 'student',
    }).catch((err) => console.warn('GateEvent log check-out:', err?.message));

    const cooldownEndsAt = checkOutTime.getTime() + CHECKOUT_COOLDOWN_MS;

    res.status(200).json({
      success: true,
      data: {
        ...(attendance.toObject ? attendance.toObject() : attendance),
        cooldownEndsAt,
      },
    });

    // ✅ Alert Module: emit check-out event for automation (unauthorized checkout detection, occupancy update)
    hostelEventEmitter.emit(hostelEventEmitter.EVENTS.CHECKOUT, {
      studentId: String(studentId),
      hostelId: String(req.user.hostelId),
      time: checkOutTime,
      source: 'student',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Attendance Analytics
exports.getAttendanceAnalytics = async (req, res) => {
  try {
    const { period = 'week' } = req.query; // daily, week, month, or year
    const now = new Date();
    let startDate = new Date();

    switch (period) {
      case 'daily':
        startDate.setDate(now.getDate() - 30); // Last 30 days for daily view
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 7);
        break;
    }

    const attendanceRecords = await Attendance.find({
      studentId: req.user.id,
      date: { $gte: startDate },
      checkInTime: { $exists: true },
    })
      .sort({ checkInTime: -1 })
      .select('checkInTime checkOutTime date status')
      .lean();

    // Calculate statistics
    const totalCheckIns = attendanceRecords.length;
    const totalCheckOuts = attendanceRecords.filter(a => a.checkOutTime).length;

    // Calculate average check-in time (hour of day)
    const checkInHours = attendanceRecords
      .map(a => a.checkInTime ? new Date(a.checkInTime).getHours() : null)
      .filter(h => h !== null);
    const avgCheckInHour = checkInHours.length > 0
      ? checkInHours.reduce((sum, h) => sum + h, 0) / checkInHours.length
      : null;

    // Calculate average duration (time between check-in and check-out)
    const durations = attendanceRecords
      .filter(a => a.checkInTime && a.checkOutTime)
      .map(a => {
        const checkIn = new Date(a.checkInTime);
        const checkOut = new Date(a.checkOutTime);
        return (checkOut - checkIn) / (1000 * 60 * 60); // hours
      });
    const avgDuration = durations.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : null;

    // Generate period-specific data
    let periodData = [];

    if (period === 'daily') {
      // Last 30 days, grouped by day
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const dayRecords = attendanceRecords.filter(a => {
          const recordDate = new Date(a.date);
          recordDate.setHours(0, 0, 0, 0);
          return recordDate >= date && recordDate < nextDate;
        });

        periodData.push({
          date: date.toISOString().split('T')[0],
          checkIns: dayRecords.length,
          checkOuts: dayRecords.filter(a => a.checkOutTime).length,
        });
      }
    } else if (period === 'week') {
      // Last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const dayRecords = attendanceRecords.filter(a => {
          const recordDate = new Date(a.date);
          recordDate.setHours(0, 0, 0, 0);
          return recordDate >= date && recordDate < nextDate;
        });

        periodData.push({
          date: date.toISOString().split('T')[0],
          checkIns: dayRecords.length,
          checkOuts: dayRecords.filter(a => a.checkOutTime).length,
        });
      }
    } else if (period === 'month') {
      // Last 30 days grouped by week
      const weeks = [];
      for (let i = 28; i >= 0; i -= 7) {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - i);
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);

        const weekRecords = attendanceRecords.filter(a => {
          const recordDate = new Date(a.date);
          recordDate.setHours(0, 0, 0, 0);
          return recordDate >= weekStart && recordDate < weekEnd;
        });

        weeks.push({
          date: weekStart.toISOString().split('T')[0],
          checkIns: weekRecords.length,
          checkOuts: weekRecords.filter(a => a.checkOutTime).length,
        });
      }
      periodData = weeks;
    } else if (period === 'year') {
      // Last 12 months
      for (let i = 11; i >= 0; i--) {
        const monthStart = new Date();
        monthStart.setMonth(monthStart.getMonth() - i);
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const monthEnd = new Date(monthStart);
        monthEnd.setMonth(monthEnd.getMonth() + 1);

        const monthRecords = attendanceRecords.filter(a => {
          const recordDate = new Date(a.date);
          recordDate.setHours(0, 0, 0, 0);
          return recordDate >= monthStart && recordDate < monthEnd;
        });

        periodData.push({
          date: monthStart.toISOString().split('T')[0],
          checkIns: monthRecords.length,
          checkOuts: monthRecords.filter(a => a.checkOutTime).length,
        });
      }
    }

    // Current status
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayRecord = await Attendance.findOne({
      studentId: req.user.id,
      date: { $gte: today },
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        totalCheckIns,
        totalCheckOuts,
        avgCheckInHour: avgCheckInHour ? Math.round(avgCheckInHour * 10) / 10 : null,
        avgDurationHours: avgDuration ? Math.round(avgDuration * 10) / 10 : null,
        periodData,
        currentStatus: todayRecord?.status || 'outside',
        recentCheckIns: attendanceRecords.slice(0, 10).map(a => ({
          date: a.date,
          checkInTime: a.checkInTime,
          checkOutTime: a.checkOutTime,
          status: a.status,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ PERMISSION REQUESTS ============

// Create Permission Request
exports.createPermissionRequest = async (req, res) => {
  try {
    const { permissionType, reason, requestedDate, returnDate } = req.body;
    const permission = await Permission.create({
      studentId: req.user.id,
      permissionType,
      reason,
      requestedDate,
      returnDate,
    });

    res.status(201).json({ success: true, data: permission });

    // ✅ Alert Module: notify wardens of new leave request
    hostelEventEmitter.emit(ALERT_TYPES.LEAVE_REQUESTED, {
      studentId: String(req.user.id),
      hostelId: String(req.user.hostelId),
      permissionId: String(permission._id),
      returnDate: permission.returnDate,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Permission Requests
exports.getPermissionRequests = async (req, res) => {
  try {
    const permissions = await Permission.find({ studentId: req.user.id })
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: permissions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Cancel Permission Request
exports.cancelPermissionRequest = async (req, res) => {
  try {
    const permission = await Permission.findById(req.params.id);
    if (!permission) {
      return res.status(404).json({ success: false, message: 'Permission not found' });
    }
    if (permission.studentId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    permission.status = 'cancelled';
    await permission.save();

    // ✅ Alert Module: notify wardens that leave was cancelled
    hostelEventEmitter.emit(ALERT_TYPES.LEAVE_CANCELLED, {
      studentId: String(req.user.id),
      hostelId: String(req.user.hostelId),
      permissionId: String(permission._id),
    });

    res.status(200).json({ success: true, data: permission });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ VIOLATION HISTORY ============

// Get Violation History
exports.getViolationHistory = async (req, res) => {
  try {
    const violations = await Violation.find({ studentId: req.user.id })
      .populate('reportedBy', 'name')
      .populate('ruleId')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: violations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// ============ CLEANING REQUESTS ============

// Create Specialized Cleaning Request
exports.createCleaningRequest = async (req, res) => {
  try {
    const { title, description, images, preferredTime } = req.body;

    // Auto-populate location details from user profile
    const user = await User.findById(req.user.id).populate('roomId');

    if (!user.hostelId || !user.blockId) {
      return res.status(400).json({
        success: false,
        message: 'You must be assigned to a hostel and block to request cleaning.'
      });
    }

    const complaint = await Complaint.create({
      raisedBy: req.user.id,
      complaintType: 'cleaning',
      title: title || 'Room Cleaning Request',
      description: description || `Cleaning requested for room ${user.roomId?.roomNumber || 'Unknown'}. Preferred time: ${preferredTime || 'Anytime'}`,
      hostelId: user.hostelId, // Ensure Complaint model has this or we filter by user's hostel in cleaner controller
      blockId: user.blockId,   // Critical for cleaner filtering
      roomId: user.roomId?._id,
      images: images || [],
      status: 'open',
      priority: 'medium'
    });

    res.status(201).json({ success: true, data: complaint });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ COMPLAINT RAISE ============

// Create Complaint (including maintenance with images)
exports.createComplaint = async (req, res) => {
  try {
    const complaint = await Complaint.create({
      ...req.body,
      raisedBy: req.user.id,
      roomId: req.user.roomId || req.body.roomId,
      hostelId: req.user.hostelId || req.body.hostelId,
      blockId: req.user.blockId || req.body.blockId,
    });
    res.status(201).json({ success: true, data: complaint });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Complaints
exports.getComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find({ raisedBy: req.user.id })
      .populate('assignedTo', 'name')
      .populate('roomId', 'roomNumber')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: complaints });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ EMERGENCY SOS ============

// Create Emergency
exports.createEmergency = async (req, res) => {
  try {
    const { emergencyType, location, description } = req.body;
    const emergency = await Emergency.create({
      raisedBy: req.user.id,
      emergencyType: emergencyType || 'sos',
      location,
      description,
    });

    // Auto-notify parent if configured
    if (req.user.parentContact?.phone) {
      // In production, integrate with SMS/email service
      emergency.parentNotified = true;
      await emergency.save();
    }

    res.status(201).json({ success: true, data: emergency });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Emergency History
exports.getEmergencyHistory = async (req, res) => {
  try {
    const emergencies = await Emergency.find({ raisedBy: req.user.id })
      .populate('acknowledgedBy', 'name')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: emergencies });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ NOTICE BOARD ============

// Get Notifications (exclude dismissed by this user)
exports.getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
      $and: [
        {
          $or: [
            { targetAudience: 'all' },
            { targetAudience: 'students' },
            { recipients: req.user.id },
          ],
        },
        {
          $or: [
            { expiresAt: { $exists: false } },
            { expiresAt: null },
            { expiresAt: { $gt: new Date() } },
          ],
        },
        { dismissedBy: { $ne: req.user.id } },
      ],
      hostelId: req.user.hostelId,
    })
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({ success: true, data: notifications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Mark Notification as Read
exports.markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    const isAlreadyRead = notification.isRead.some(
      read => read.userId.toString() === req.user.id
    );

    if (!isAlreadyRead) {
      notification.isRead.push({
        userId: req.user.id,
        readAt: new Date(),
      });
      await notification.save();
    }

    res.status(200).json({ success: true, data: notification });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Dismiss (remove from list) – add current user to dismissedBy so getNotifications excludes it
exports.dismissNotification = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    const userId = req.user?.id ?? req.user?._id;
    const userIdStr = userId != null ? String(userId) : '';
    if (!userIdStr) {
      return res.status(401).json({ success: false, message: 'User not identified' });
    }
    const isRecipient = notification.recipients?.some(r => r != null && String(r) === userIdStr);
    const isAudience = notification.targetAudience === 'all' || notification.targetAudience === 'students';
    if (!isRecipient && !isAudience) {
      return res.status(403).json({ success: false, message: 'Not authorized to dismiss this notification' });
    }
    if (!notification.dismissedBy) notification.dismissedBy = [];
    if (!notification.dismissedBy.some(id => id != null && String(id) === userIdStr)) {
      notification.dismissedBy.push(userId);
      await notification.save();
    }
    res.status(200).json({ success: true, data: notification });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ VISITOR REQUEST ============

// Create Visitor Request
exports.createVisitorRequest = async (req, res) => {
  try {
    const visitor = await Visitor.create({
      ...req.body,
      visitingStudentId: req.user.id,
    });
    res.status(201).json({ success: true, data: visitor });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Visitor Requests
exports.getVisitorRequests = async (req, res) => {
  try {
    const visitors = await Visitor.find({ visitingStudentId: req.user.id })
      .populate('approvedBy', 'name')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: visitors });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ MESS ============

// Get Mess Schedule (for student's hostel)
exports.getMessSchedule = async (req, res) => {
  try {
    const hostelId = req.user.hostelId;
    if (!hostelId) {
      return res.status(404).json({ success: false, message: 'You are not assigned to a hostel' });
    }
    const schedules = await MessSchedule.find({ hostelId, active: true })
      .sort({ order: 1, mealType: 1 })
      .lean();
    res.status(200).json({ success: true, data: schedules });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Submit Mess Feedback
exports.submitMessFeedback = async (req, res) => {
  try {
    const studentId = req.user.id || req.user._id;
    const hostelId = req.user.hostelId;
    const rating = req.body.rating != null ? parseInt(req.body.rating, 10) : null;
    const mealType = req.body.mealType ? String(req.body.mealType).trim() : null;
    const description = req.body.feedback || req.body.description || req.body.comments || '';
    const title = mealType ? `Mess Feedback (${mealType})` : 'Mess Feedback';

    const feedback = await Complaint.create({
      raisedBy: studentId,
      complaintType: 'food',
      title,
      description: description || 'No comment',
      hostelId: hostelId || undefined,
      rating: rating >= 1 && rating <= 5 ? rating : undefined,
      mealType: mealType || undefined,
    });

    res.status(201).json({ success: true, data: feedback });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ FEE & PAYMENTS (Student) ============
exports.getMyFeeStructure = async (req, res) => {
  try {
    const hostelId = req.user.hostelId;
    if (!hostelId) return res.status(404).json({ success: false, message: 'Not assigned to a hostel' });
    const fees = await FeeStructure.find({ hostelId, isActive: true }).lean();
    res.status(200).json({ success: true, data: fees });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMyPayments = async (req, res) => {
  try {
    let payments = await Payment.find({ studentId: req.user.id || req.user._id })
      .populate('planId', 'name durationMonths amount')
      .sort({ createdAt: -1 })
      .lean();
    // Backfill period for paid payments that have plan but no period
    for (const p of payments) {
      if (p.status === 'paid' && p.planId && (!p.periodStart || !p.periodEnd) && p.planId.durationMonths) {
        const start = p.paidDate ? new Date(p.paidDate) : new Date(p.updatedAt || p.createdAt);
        setPeriodFromPlan(p, start, p.planId.durationMonths);
        await Payment.updateOne({ _id: p._id }, { $set: { periodStart: p.periodStart, periodEnd: p.periodEnd } });
      }
    }
    res.status(200).json({ success: true, data: payments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createRazorpayOrder = async (req, res) => {
  try {
    const { amount, type, feeStructureId } = req.body;
    const studentId = req.user.id || req.user._id;
    const hostelId = req.user.hostelId;
    if (!hostelId) return res.status(400).json({ success: false, message: 'Not assigned to a hostel' });
    const amountNum = Number(amount);
    if (!amountNum || amountNum < 1) return res.status(400).json({ success: false, message: 'Invalid amount' });
    const payment = await Payment.create({
      studentId,
      hostelId,
      type: type || 'hostel_rent',
      amount: amountNum,
      status: 'pending',
      metadata: { feeStructureId },
    });
    const orderData = await createOrder(amountNum, payment._id.toString(), { paymentId: payment._id.toString() });
    if (!orderData) {
      await Payment.findByIdAndDelete(payment._id);
      return res.status(503).json({ success: false, message: 'Payment gateway not configured' });
    }
    payment.razorpayOrderId = orderData.orderId;
    await payment.save();
    res.status(200).json({
      success: true,
      data: {
        paymentId: payment._id,
        orderId: orderData.orderId,
        amount: orderData.amount,
        currency: orderData.currency,
        keyId: orderData.keyId,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/** Create Razorpay order for an existing pending payment (e.g. created by owner). */
exports.createOrderForExistingPayment = async (req, res) => {
  try {
    const studentId = req.user.id || req.user._id;
    const payment = await Payment.findOne({
      _id: req.params.paymentId,
      studentId,
      status: 'pending',
    });
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found or already paid' });
    }
    const amountNum = Number(payment.amount);
    if (!amountNum || amountNum < 1) {
      return res.status(400).json({ success: false, message: 'Invalid payment amount' });
    }
    const orderData = await createOrder(amountNum, payment._id.toString(), { paymentId: payment._id.toString() });
    if (!orderData) {
      return res.status(503).json({ success: false, message: 'Payment gateway not configured' });
    }
    payment.razorpayOrderId = orderData.orderId;
    await payment.save();
    res.status(200).json({
      success: true,
      data: {
        paymentId: payment._id,
        orderId: orderData.orderId,
        amount: orderData.amount,
        currency: orderData.currency,
        keyId: orderData.keyId,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.verifyRazorpayPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Missing payment details' });
    }
    const valid = verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!valid) return res.status(400).json({ success: false, message: 'Invalid signature' });
    const payment = await Payment.findOne({
      razorpayOrderId: razorpay_order_id,
      studentId: req.user.id || req.user._id,
    });
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
    if (payment.status === 'paid') return res.status(200).json({ success: true, data: payment });
    payment.status = 'paid';
    payment.transactionId = razorpay_payment_id;
    payment.paymentMethod = 'upi';
    payment.paidDate = new Date();
    if (payment.planId) {
      const plan = await Plan.findById(payment.planId).select('durationMonths').lean();
      if (plan && plan.durationMonths) setPeriodFromPlan(payment, payment.paidDate, plan.durationMonths);
    }
    await payment.save();
    res.status(200).json({ success: true, data: payment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ LOCATION & ATTENDANCE ============

// Update Student Location
exports.updateLocation = async (req, res) => {
  try {
    const { location, accuracy } = req.body;

    // Validate location is provided
    if (!location || !location.latitude || !location.longitude) {
      return res.status(400).json({
        success: false,
        message: 'Location coordinates (latitude, longitude) are required'
      });
    }

    const hostelId = req.user.hostelId;

    // Parallel fetch: hostel + geo-fence (both only need hostelId)
    const [hostel, geoFence] = await Promise.all([
      Hostel.findById(hostelId).select('address').lean(),
      GeoFence.findOne({ hostelId, isActive: true }).sort({ createdAt: -1 }).lean(),
    ]);

    if (!hostel) {
      return res.status(404).json({ success: false, message: 'Hostel not found' });
    }

    let isInsideHostel = false;
    let distanceFromHostel = null;
    const hostelLocation = hostel.address?.coordinates?.latitude != null && hostel.address?.coordinates?.longitude != null
      ? { latitude: hostel.address.coordinates.latitude, longitude: hostel.address.coordinates.longitude }
      : null;
    if (geoFence && geoFence.type === 'polygon' && geoFence.polygon && geoFence.polygon.length >= 3) {
      const validation = validateLocationWithGeoFence(location, hostelLocation, { polygon: geoFence.polygon });
      isInsideHostel = validation.isValid;
      distanceFromHostel = validation.distance;
    } else if (geoFence && geoFence.type === 'rectangle' && geoFence.bounds && [geoFence.bounds.north, geoFence.bounds.south, geoFence.bounds.east, geoFence.bounds.west].every((v) => v != null)) {
      const validation = validateLocationWithGeoFence(location, hostelLocation, { bounds: geoFence.bounds });
      isInsideHostel = validation.isValid;
      distanceFromHostel = validation.distance;
    } else if (hostelLocation) {
      const radius = geoFence?.type === 'circle' && geoFence?.radius != null ? geoFence.radius : 500;
      const validation = geoFence?.center?.latitude != null
        ? validateLocation(location, { latitude: geoFence.center.latitude, longitude: geoFence.center.longitude }, radius)
        : validateLocation(location, hostelLocation, radius);
      isInsideHostel = validation.isValid;
      distanceFromHostel = validation.distance;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Parallel: User update + Attendance find (both independent)
    let [, attendance] = await Promise.all([
      User.findByIdAndUpdate(req.user.id, {
        currentLocation: {
          latitude: location.latitude,
          longitude: location.longitude,
          timestamp: new Date(),
          accuracy,
        },
        lastLocationUpdate: new Date(),
      }, { new: false }),
      Attendance.findOne({
        studentId: req.user.id,
        date: { $gte: today },
      }).sort({ createdAt: -1 }),
    ]);

    if (!attendance) {
      const now = new Date();
      attendance = await Attendance.create({
        studentId: req.user.id,
        hostelId: req.user.hostelId,
        status: isInsideHostel ? 'inside' : 'outside',
        checkInTime: isInsideHostel ? now : null,
        checkOutTime: !isInsideHostel ? now : null,
        location,
        verificationMethod: 'auto',
        date: new Date(),
      });
      await logGateEvent({
        studentId: req.user.id,
        hostelId: req.user.hostelId,
        type: isInsideHostel ? 'in' : 'out',
        time: now,
        location,
        verificationMethod: 'auto',
        attendanceId: attendance._id,
        source: 'auto',
      }).catch((err) => console.warn('GateEvent log (create):', err?.message));
    } else {
      // Update status based on location
      const previousStatus = attendance.status;
      attendance.status = isInsideHostel ? 'inside' : 'outside';
      attendance.location = location;

      // Track check-in/check-out times based on status changes
      if (previousStatus === 'outside' && isInsideHostel) {
        // Respect 2-min cooldown after checkout (same as manual check-in)
        const lastCheckout = await Attendance.findOne({
          studentId: req.user.id,
          checkOutTime: { $exists: true, $ne: null },
        })
          .sort({ checkOutTime: -1 })
          .select('checkOutTime')
          .lean();
        const withinCooldown =
          lastCheckout?.checkOutTime &&
          Date.now() < new Date(lastCheckout.checkOutTime).getTime() + CHECKOUT_COOLDOWN_MS;

        if (withinCooldown) {
          attendance.status = 'outside';
          attendance.location = location;
          await attendance.save();
        } else {
          const checkInTime = new Date();
          attendance.checkInTime = checkInTime;
          await attendance.save();
          await logGateEvent({
            studentId: req.user.id,
            hostelId: req.user.hostelId,
            type: 'in',
            time: checkInTime,
            location,
            verificationMethod: 'auto',
            attendanceId: attendance._id,
            source: 'auto',
          }).catch((err) => console.warn('GateEvent log check-in (auto):', err?.message));

          const timeStr = checkInTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
          const recentAutoCheckIn = await Notification.findOne({
            title: 'Auto check-in',
            recipients: req.user.id,
            hostelId: req.user.hostelId,
            createdAt: { $gte: new Date(Date.now() - NOTIFICATION_DEDUPE_WINDOW_MS) },
          }).lean();
          if (!recentAutoCheckIn) {
            await Notification.create({
              title: 'Auto check-in',
              message: `You were automatically checked in at ${timeStr}.`,
              type: 'alert',
              targetAudience: 'staff',
              recipients: [req.user.id],
              createdBy: req.user.id,
              hostelId: req.user.hostelId,
            }).catch((err) => console.warn('Auto check-in notification create:', err?.message));
            setImmediate(() => {
              User.findById(req.user.id)
                .select('pushToken expoPushToken')
                .lean()
                .then((student) => {
                  if (!student) return;
                  sendCheckInPushToStudent({
                    pushToken: student.pushToken,
                    expoPushToken: student.expoPushToken,
                    autoCheckIn: true,
                    timeStr,
                  });
                })
                .catch((err) => console.warn('Auto check-in push: could not load student tokens', err?.message));
            });
          }
        }
      } else if ((previousStatus === 'inside' || previousStatus === 'unknown') && !isInsideHostel) {
        const checkOutTime = new Date();
        attendance.checkOutTime = checkOutTime;
        // Add this session's duration to total minutes inside today
        if (attendance.checkInTime) {
          const sessionMinutes = (checkOutTime.getTime() - new Date(attendance.checkInTime).getTime()) / 60000;
          attendance.totalMinutesInside = (Number(attendance.totalMinutesInside) || 0) + Math.max(0, sessionMinutes);
        }
        // Left without checking out: report violation only if not within 2-min grace period after manual checkout
        const recentCheckout = await Attendance.findOne({
          studentId: req.user.id,
          checkOutTime: { $gte: new Date(Date.now() - CHECKOUT_COOLDOWN_MS) },
        }).sort({ checkOutTime: -1 }).select('checkOutTime').lean();
        if (!recentCheckout) {
          const detectedAt = new Date();
          const violation = await Violation.create({
            studentId: req.user.id,
            violationType: 'improper-checkout',
            description: `Left without checking out. Detected at ${detectedAt.toISOString()} (${detectedAt.toLocaleString()}).`,
            reportedBy: req.user.id,
          });
          const timeStr = detectedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
          const recentViolationNotif = await Notification.findOne({
            title: 'Violation detected',
            recipients: req.user.id,
            hostelId: req.user.hostelId,
            createdAt: { $gte: new Date(Date.now() - NOTIFICATION_DEDUPE_WINDOW_MS) },
          }).lean();
          if (!recentViolationNotif) {
            await Notification.create({
              title: 'Violation detected',
              message: `Left without checking out. Detected at ${timeStr}. Please check in/out properly next time.`,
              type: 'alert',
              targetAudience: 'staff',
              recipients: [req.user.id],
              createdBy: req.user.id,
              hostelId: req.user.hostelId,
            }).catch((err) => console.warn('Violation notification create:', err?.message));
            setImmediate(() => {
              User.findById(req.user.id).select('pushToken expoPushToken').lean()
                .then((student) => {
                  if (!student) return;
                  sendViolationPushToStudent({
                    pushToken: student.pushToken,
                    expoPushToken: student.expoPushToken,
                    violationType: 'improper-checkout',
                    detectedAt,
                    violationId: violation._id.toString(),
                  });
                })
                .catch((err) => console.warn('Violation push: could not load student tokens', err.message));
            });
          }
        }
        await attendance.save();
        await logGateEvent({
          studentId: req.user.id,
          hostelId: req.user.hostelId,
          type: 'out',
          time: checkOutTime,
          location,
          verificationMethod: 'auto',
          attendanceId: attendance._id,
          source: 'auto',
        }).catch((err) => console.warn('GateEvent log check-out (auto):', err?.message));
      } else {
        await attendance.save();
      }
    }

    // Defer StudentLocation create (analytics only) - respond fast, write in background
    const locationPayload = {
      studentId: req.user.id,
      hostelId,
      location,
      isInsideHostel,
      distanceFromHostel,
      accuracy,
      source: 'background',
      timestamp: new Date(),
    };
    setImmediate(() => {
      StudentLocation.create(locationPayload).catch((err) =>
        console.error('StudentLocation create (deferred):', err?.message)
      );
    });

    // Minimal response - client only needs success + status
    res.status(200).json({
      success: true,
      data: { isInsideHostel },
    });
  } catch (error) {
    console.error('Error in updateLocation:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Location Permission Status
exports.updateLocationPermission = async (req, res) => {
  try {
    const { status } = req.body;
    const User = require('../models/User');

    if (!['granted', 'denied', 'not_requested'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid permission status' });
    }

    await User.findByIdAndUpdate(req.user.id, {
      locationPermissionStatus: status,
    });

    res.status(200).json({ success: true, message: 'Location permission status updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Register Push Token for Notifications
exports.registerPushToken = async (req, res) => {
  try {
    const { pushToken } = req.body;
    const User = require('../models/User');

    if (!pushToken) {
      return res.status(400).json({ success: false, message: 'Push token is required' });
    }

    await User.findByIdAndUpdate(req.user.id, {
      pushToken: pushToken,
    });

    res.status(200).json({ success: true, message: 'Push token registered successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Clear Push Token (disable notifications)
exports.clearPushToken = async (req, res) => {
  try {
    const User = require('../models/User');
    await User.findByIdAndUpdate(req.user.id, { pushToken: null });
    res.status(200).json({ success: true, message: 'Push notifications disabled' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Register Expo Push Token (for receipt-based status: ok | DeviceNotRegistered | MessageTooBig)
exports.registerExpoPushToken = async (req, res) => {
  try {
    const { expoPushToken } = req.body;
    const User = require('../models/User');
    if (!expoPushToken || typeof expoPushToken !== 'string') {
      return res.status(400).json({ success: false, message: 'expoPushToken is required' });
    }
    await User.findByIdAndUpdate(req.user.id, { expoPushToken: expoPushToken.trim() });
    res.status(200).json({ success: true, message: 'Expo push token registered' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get hostel location and geo-fence boundary for map (student's hostel)
exports.getHostelBoundary = async (req, res) => {
  try {
    const hostelId = req.user?.hostelId ?? req.user?.hostel;
    if (!hostelId) {
      return res.status(404).json({ success: false, message: 'You are not assigned to a hostel' });
    }
    const hostel = await Hostel.findById(hostelId).select('name address');
    if (!hostel) {
      return res.status(404).json({ success: false, message: 'Hostel not found' });
    }
    const geoFence = await GeoFence.findOne({ hostelId, isActive: true }).sort({ createdAt: -1 });
    const hostelLocation = hostel.address?.coordinates?.latitude != null && hostel.address?.coordinates?.longitude != null
      ? { latitude: hostel.address.coordinates.latitude, longitude: hostel.address.coordinates.longitude }
      : null;
    res.status(200).json({
      success: true,
      data: {
        hostel: {
          id: hostel._id,
          name: hostel.name,
          latitude: hostel.address?.coordinates?.latitude ?? null,
          longitude: hostel.address?.coordinates?.longitude ?? null,
        },
        geoFence: geoFence ? {
          type: geoFence.type,
          bounds: geoFence.bounds && geoFence.type === 'rectangle' ? geoFence.bounds : null,
          polygon: geoFence.polygon && geoFence.type === 'polygon' ? geoFence.polygon : null,
          center: geoFence.center && geoFence.type === 'circle' ? geoFence.center : null,
          radius: geoFence.type === 'circle' ? geoFence.radius : null,
        } : null,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Support tickets (student raises; view own tickets)
exports.getSupportTickets = async (req, res) => {
  try {
    const tickets = await SupportTicket.find({ raisedBy: req.user.id })
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: tickets });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createSupportTicket = async (req, res) => {
  try {
    const ticketNumber = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const ticket = await SupportTicket.create({
      ...req.body,
      ticketNumber,
      raisedBy: req.user.id,
      hostelId: req.user.hostelId || undefined,
    });
    res.status(201).json({ success: true, data: ticket });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


