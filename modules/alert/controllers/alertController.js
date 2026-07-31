
'use strict';

const HostelAlert = require('../models/HostelAlert');
const CurfewViolation = require('../models/CurfewViolation');
const LeaveViolation = require('../models/LeaveViolation');
const HostelEvent = require('../models/HostelEvent');
const HostelAlertService = require('../services/HostelAlertService');
const EmergencyAlertService = require('../services/EmergencyAlertService');
const OccupancyService = require('../services/OccupancyService');
const CurfewAutomationService = require('../services/CurfewAutomationService');
const { ALERT_STATUS, ROLES } = require('../utils/constants');
const { parsePagination, buildPaginatedResponse } = require('../utils/alertHelpers');


function resolveHostelId(req) {
  const role = req.user.role;
  if (role === ROLES.SUPERADMIN) {
    return req.query.hostelId || req.body.hostelId || null;
  }
  // For everyone else, use their own hostelId (or query param if they passed one for owner
  return req.query.hostelId || String(req.user.hostelId || '');
}

// ─────────────────────────────────────────────
// GET /api/alerts/notifications
// Get alerts visible to the current user
// ─────────────────────────────────────────────
exports.getMyNotifications = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const {
      category, priority, status, startDate, endDate, search, sortBy = 'createdAt', sortOrder = 'desc',
    } = req.query;

    const role = req.user.role;
    const userId = String(req.user.id);
    const hostelId = resolveHostelId(req);

    // ── Build query filter ──────────────────────────────────────────
    const filter = {};

    if (role === ROLES.STUDENT) {
      // Students only see their own alerts
      filter.recipientIds = req.user._id || req.user.id;
    } else if (hostelId) {
      // Staff sees hostel-wide alerts
      filter.hostelId = hostelId;
    }

    if (category) filter.category = category;
    if (priority) filter.priority = priority;
    if (status) filter.status = status;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } },
      ];
    }

    const sortObj = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [data, total] = await Promise.all([
      HostelAlert.find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .populate('studentId', 'name studentId')
        .populate('resolvedBy', 'name')
        .lean(),
      HostelAlert.countDocuments(filter),
    ]);

    // Attach isReadByMe for the requesting user
    const enriched = data.map((a) => ({
      ...a,
      isReadByMe: a.isRead ? a.isRead.some((r) => String(r.userId) === userId) : false,
    }));

    res.status(200).json({
      success: true,
      ...buildPaginatedResponse({ data: enriched, total, page, limit }),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/alerts/notifications/unread-count
// ─────────────────────────────────────────────
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const role = req.user.role;
    const hostelId = resolveHostelId(req);

    let filter = {};
    if (role === ROLES.STUDENT) {
      filter = {
        recipientIds: userId,
        'isRead.userId': { $ne: userId },
        status: { $ne: ALERT_STATUS.DISMISSED },
      };
    } else {
      filter = {
        hostelId,
        status: ALERT_STATUS.UNREAD,
      };
    }

    const count = await HostelAlert.countDocuments(filter);

    res.status(200).json({ success: true, data: { unreadCount: count } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// PUT /api/alerts/notifications/:id/read
// Mark a single notification as read
// ─────────────────────────────────────────────
exports.markAsRead = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { id } = req.params;

    const alert = await HostelAlert.findById(id);
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }

    // Security: students can only mark their own alerts
    if (req.user.role === ROLES.STUDENT) {
      const isRecipient = alert.recipientIds.some(
        (rid) => String(rid) === String(userId)
      );
      if (!isRecipient) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
      }
    }

    // Idempotent: only add if not already marked
    const alreadyRead = alert.isRead.some((r) => String(r.userId) === String(userId));
    if (!alreadyRead) {
      alert.isRead.push({ userId, readAt: new Date() });
      if (alert.status === ALERT_STATUS.UNREAD) {
        alert.status = ALERT_STATUS.READ;
      }
      await alert.save();
    }

    res.status(200).json({ success: true, message: 'Marked as read' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// PUT /api/alerts/notifications/read-all
// Mark ALL of the user's notifications as read
// ─────────────────────────────────────────────
exports.markAllRead = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const role = req.user.role;
    const hostelId = resolveHostelId(req);

    let filter = {};
    if (role === ROLES.STUDENT) {
      filter = { recipientIds: userId, status: ALERT_STATUS.UNREAD };
    } else {
      filter = { hostelId, status: ALERT_STATUS.UNREAD };
    }

    // Batch update: push userId to isRead array and set status=read
    const result = await HostelAlert.updateMany(
      { ...filter, 'isRead.userId': { $ne: userId } },
      {
        $push: { isRead: { userId, readAt: new Date() } },
        $set: { status: ALERT_STATUS.READ },
      }
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} notification(s) marked as read`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// PUT /api/alerts/:id/resolve
// Resolve/close an alert (warden/admin only)
// ─────────────────────────────────────────────
exports.resolveAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolutionNote } = req.body;
    const userId = req.user._id || req.user.id;

    const alert = await HostelAlert.findById(id);
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }

    // Wardens can only resolve alerts for their hostel
    if (
      req.user.role === ROLES.WARDEN &&
      String(alert.hostelId) !== String(req.user.hostelId)
    ) {
      return res.status(403).json({ success: false, message: 'Not authorized for this hostel' });
    }

    alert.status = ALERT_STATUS.RESOLVED;
    alert.resolvedBy = userId;
    alert.resolvedAt = new Date();
    if (resolutionNote) alert.resolutionNote = resolutionNote;

    await alert.save();

    res.status(200).json({ success: true, message: 'Alert resolved', data: { alertId: id } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/alerts/curfew
// Get curfew violations (warden/admin)
// ─────────────────────────────────────────────
exports.getCurfewViolations = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const hostelId = resolveHostelId(req);
    const { status, date, studentId, sortOrder = 'desc' } = req.query;

    const filter = {};
    if (hostelId) filter.hostelId = hostelId;
    if (status) filter.status = status;
    if (studentId) filter.studentId = studentId;

    if (date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      const nextDay = new Date(d);
      nextDay.setDate(nextDay.getDate() + 1);
      filter.violationDate = { $gte: d, $lt: nextDay };
    }

    const [data, total] = await Promise.all([
      CurfewViolation.find(filter)
        .sort({ violationDate: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .populate('studentId', 'name studentId roomId')
        .populate('acknowledgedBy', 'name')
        .populate('resolvedBy', 'name')
        .lean(),
      CurfewViolation.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      ...buildPaginatedResponse({ data, total, page, limit }),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// PUT /api/alerts/curfew/:id/resolve
// Resolve a curfew violation
// ─────────────────────────────────────────────
exports.resolveCurfewViolation = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolutionNote } = req.body;
    const userId = req.user._id || req.user.id;

    const violation = await CurfewViolation.findById(id);
    if (!violation) {
      return res.status(404).json({ success: false, message: 'Violation not found' });
    }

    // Warden: can only update violations for their hostel
    if (
      req.user.role === ROLES.WARDEN &&
      String(violation.hostelId) !== String(req.user.hostelId)
    ) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    violation.status = status;
    violation.resolvedBy = userId;
    violation.resolvedAt = new Date();
    if (resolutionNote) violation.resolutionNote = resolutionNote;

    await violation.save();

    res.status(200).json({ success: true, message: 'Curfew violation resolved' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/alerts/leave-violations
// ─────────────────────────────────────────────
exports.getLeaveViolations = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const hostelId = resolveHostelId(req);
    const { status, sortOrder = 'desc' } = req.query;

    const filter = {};
    if (hostelId) filter.hostelId = hostelId;
    if (status) filter.status = status;

    const [data, total] = await Promise.all([
      LeaveViolation.find(filter)
        .sort({ createdAt: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .populate('studentId', 'name studentId')
        .populate('permissionId', 'permissionType requestedDate returnDate reason')
        .lean(),
      LeaveViolation.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      ...buildPaginatedResponse({ data, total, page, limit }),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/alerts/attendance
// Attendance alerts for a hostel
// ─────────────────────────────────────────────
exports.getAttendanceAlerts = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const hostelId = resolveHostelId(req);

    const filter = {
      category: 'attendance',
      ...(hostelId && { hostelId }),
    };

    const [data, total] = await Promise.all([
      HostelAlert.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('studentId', 'name studentId')
        .lean(),
      HostelAlert.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      ...buildPaginatedResponse({ data, total, page, limit }),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/alerts/occupancy
// Real-time occupancy status
// ─────────────────────────────────────────────
exports.getOccupancyStatus = async (req, res) => {
  try {
    const hostelId = resolveHostelId(req);
    if (!hostelId) {
      return res.status(400).json({ success: false, message: 'hostelId is required' });
    }

    const forceRefresh = req.query.refresh === 'true';
    const data = await OccupancyService.getOccupancy(hostelId, forceRefresh);

    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/alerts/dashboard-stats
// Aggregate stats for the warden/admin dashboard
// ─────────────────────────────────────────────
exports.getDashboardStats = async (req, res) => {
  try {
    const hostelId = resolveHostelId(req);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const baseFilter = hostelId ? { hostelId } : {};

    const [
      totalAlerts,
      unresolvedAlerts,
      criticalAlerts,
      todayCurfewViolations,
      openLeaveViolations,
      alertsByCategory,
      recentAlerts,
    ] = await Promise.all([
      HostelAlert.countDocuments(baseFilter),
      HostelAlert.countDocuments({ ...baseFilter, status: ALERT_STATUS.UNREAD }),
      HostelAlert.countDocuments({
        ...baseFilter,
        priority: { $in: ['urgent', 'critical'] },
        status: ALERT_STATUS.UNREAD,
      }),
      CurfewViolation.countDocuments({
        ...(hostelId && { hostelId }),
        violationDate: { $gte: today },
      }),
      LeaveViolation.countDocuments({
        ...(hostelId && { hostelId }),
        status: 'open',
      }),
      HostelAlert.aggregate([
        { $match: baseFilter },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      HostelAlert.find({ ...baseFilter, status: ALERT_STATUS.UNREAD })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('studentId', 'name')
        .lean(),
    ]);

    // Format category breakdown
    const categoryBreakdown = {};
    for (const item of alertsByCategory) {
      categoryBreakdown[item._id] = item.count;
    }

    // Get occupancy if hostelId provided
    let occupancy = null;
    if (hostelId) {
      occupancy = await OccupancyService.getOccupancy(hostelId);
    }

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalAlerts,
          unresolvedAlerts,
          criticalAlerts,
          todayCurfewViolations,
          openLeaveViolations,
        },
        categoryBreakdown,
        occupancy,
        recentAlerts,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// POST /api/alerts/emergency/broadcast
// Broadcast emergency alert (owner/superadmin only)
// ─────────────────────────────────────────────
exports.broadcastEmergency = async (req, res) => {
  try {
    const { emergencyType, title, message, hostelId, scope = 'hostel', floorNumber } = req.body;
    const triggeredByUserId = req.user._id || req.user.id;

    // Owner can only broadcast to their own hostel
    if (req.user.role === ROLES.OWNER && String(req.user.hostelId) !== hostelId) {
      return res.status(403).json({ success: false, message: 'Not authorized for this hostel' });
    }

    const result = await EmergencyAlertService.broadcast({
      hostelId,
      emergencyType,
      title,
      message,
      scope,
      floorNumber,
      triggeredByUserId,
    });

    res.status(200).json({
      success: true,
      message: `Emergency alert broadcast to ${result.recipientCount} recipient(s)`,
      data: result,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// POST /api/alerts/curfew/trigger
// Manually trigger curfew check (warden/owner)
// ─────────────────────────────────────────────
exports.triggerManualCurfewCheck = async (req, res) => {
  try {
    const hostelId = req.query.hostelId || req.body.hostelId || String(req.user.hostelId || '');

    if (!hostelId) {
      return res.status(400).json({ success: false, message: 'hostelId is required' });
    }

    // Run async, return immediately
    CurfewAutomationService.runCurfewCheckForHostel(hostelId).catch((err) =>
      console.error('[Alert API] Manual curfew check error:', err.message)
    );

    res.status(202).json({
      success: true,
      message: 'Curfew check started. Results will be delivered via notifications and alerts.',
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// POST /api/alerts/send-to-all
// Broadcast a custom alert to owner + warden + student simultaneously
// Accessible by: warden, owner, superadmin
// ─────────────────────────────────────────────
exports.sendToAllRoles = async (req, res) => {
  try {
    const { title, message, type = 'ANNOUNCEMENT', priority = 'medium', targetRoles, hostelId: bodyHostelId } = req.body;

    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'title and message are required' });
    }

    const hostelId = bodyHostelId || String(req.user.hostelId || '');
    if (!hostelId) {
      return res.status(400).json({ success: false, message: 'hostelId is required' });
    }

    // Default: all three roles. Can be overridden via body.targetRoles
    const roles = Array.isArray(targetRoles) && targetRoles.length > 0
      ? targetRoles
      : ['owner', 'warden', 'student'];

    const results = await HostelAlertService.broadcast({
      hostelId,
      type,
      title,
      message,
      priority,
      targetRoles: roles,
      metadata: {
        sentBy: String(req.user.id),
        sentByRole: req.user.role,
        sentAt: new Date().toISOString(),
      },
    });

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    res.status(200).json({
      success: true,
      message: `Alert sent to ${roles.join(', ')}. ${succeeded} role(s) notified${failed > 0 ? `, ${failed} failed` : ''}.`,
      data: {
        rolesTargeted: roles,
        succeeded,
        failed,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

