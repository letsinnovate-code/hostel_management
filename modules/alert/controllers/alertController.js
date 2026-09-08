
'use strict';

const HostelAlert = require('../models/HostelAlert');
const CurfewViolation = require('../models/CurfewViolation');
const LeaveViolation = require('../models/LeaveViolation');
const HostelEvent = require('../models/HostelEvent');
const Hostel = require('../../../models/Hostel');
const User = require('../../../models/User');
const Notification = require('../../../models/Notification');
const HostelAlertService = require('../services/HostelAlertService');
const EmergencyAlertService = require('../services/EmergencyAlertService');
const OccupancyService = require('../services/OccupancyService');
const CurfewAutomationService = require('../services/CurfewAutomationService');
const { ALERT_STATUS, ROLES } = require('../utils/constants');
const { parsePagination, buildPaginatedResponse } = require('../utils/alertHelpers');


/**
 * Resolves authorized hostel access for the requesting user.
 * Strictly prevents any cross-hostel or cross-owner data leakage.
 *
 * @param {Object} req - Express request
 * @returns {Promise<{ isSuperadmin: boolean, isOwner: boolean, isWarden: boolean, isStudent: boolean, hostelFilter: Object, singleHostelId: string|null, ownedHostelIds: string[] }>}
 */
async function getAuthorizedHostelScope(req) {
  const roleRaw = req.user.role;
  const isSuperadmin = roleRaw === ROLES.SUPERADMIN || (Array.isArray(roleRaw) && roleRaw.includes(ROLES.SUPERADMIN));
  const isOwner = roleRaw === 'owner' || (Array.isArray(roleRaw) && roleRaw.includes('owner'));
  const isWarden = roleRaw === 'warden' || (Array.isArray(roleRaw) && roleRaw.includes('warden'));
  const isStudent = roleRaw === 'student' || (Array.isArray(roleRaw) && roleRaw.includes('student'));
  const userId = String(req.user._id || req.user.id);
  const requestedHostelId = req.query?.hostelId || req.body?.hostelId || null;

  if (isSuperadmin) {
    return {
      isSuperadmin: true,
      isOwner: false,
      isWarden: false,
      isStudent: false,
      hostelFilter: requestedHostelId ? { hostelId: String(requestedHostelId) } : {},
      singleHostelId: requestedHostelId ? String(requestedHostelId) : null,
      ownedHostelIds: [],
    };
  }

  if (isOwner) {
    const ownedHostels = await Hostel.find({ ownerId: userId }).select('_id').lean();
    const ownedHostelIds = ownedHostels.map((h) => String(h._id));

    if (requestedHostelId) {
      const qHostelId = String(requestedHostelId);
      if (!ownedHostelIds.includes(qHostelId)) {
        const err = new Error('Access denied: You do not own or have authorization for this hostel');
        err.statusCode = 403;
        throw err;
      }
      return {
        isSuperadmin: false,
        isOwner: true,
        isWarden: false,
        isStudent: false,
        hostelFilter: { hostelId: qHostelId },
        singleHostelId: qHostelId,
        ownedHostelIds,
      };
    }

    return {
      isSuperadmin: false,
      isOwner: true,
      isWarden: false,
      isStudent: false,
      hostelFilter: { hostelId: { $in: ownedHostelIds } },
      singleHostelId: ownedHostelIds.length === 1 ? ownedHostelIds[0] : null,
      ownedHostelIds,
    };
  }

  if (isWarden) {
    let wardenHostelId = String(req.user.hostelId || '');
    if (!wardenHostelId && userId) {
      try {
        const uDoc = await User.findById(userId).select('hostelId').lean();
        if (uDoc?.hostelId) wardenHostelId = String(uDoc.hostelId);
      } catch (_) {}
    }

    if (wardenHostelId && requestedHostelId && String(requestedHostelId) !== wardenHostelId) {
      const err = new Error('Access denied: Wardens can only access data for their assigned hostel');
      err.statusCode = 403;
      throw err;
    }

    const effectiveHostelId = wardenHostelId || (requestedHostelId ? String(requestedHostelId) : '');
    return {
      isSuperadmin: false,
      isOwner: false,
      isWarden: true,
      isStudent: false,
      hostelFilter: effectiveHostelId ? { hostelId: effectiveHostelId } : {},
      singleHostelId: effectiveHostelId || null,
      ownedHostelIds: [],
    };
  }

  // Student or other roles
  const studentHostelId = String(req.user.hostelId || '');
  return {
    isSuperadmin: false,
    isOwner: false,
    isWarden: false,
    isStudent: true,
    hostelFilter: studentHostelId ? { hostelId: studentHostelId } : {},
    singleHostelId: studentHostelId || null,
    ownedHostelIds: [],
  };
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

    const scope = await getAuthorizedHostelScope(req);
    const userId = String(req.user.id || req.user._id);

    // ── Build query filter with strict tenant isolation ─────────────
    const filter = {};

    if (scope.isStudent) {
      // Students only see alerts explicitly addressed to them
      filter.recipientIds = userId;
    } else if (scope.isOwner) {
      if (req.query.hostelId) {
        // Scoped to the specific verified owned hostel
        filter.hostelId = scope.singleHostelId;
        filter.$or = [
          { recipientIds: userId },
          { recipientRole: { $in: ['owner', 'all', 'admin'] } },
        ];
      } else {
        // Scoped to all verified hostels owned by this owner
        filter.$or = [
          {
            hostelId: { $in: scope.ownedHostelIds },
            $or: [
              { recipientIds: userId },
              { recipientRole: { $in: ['owner', 'all', 'admin'] } },
            ],
          },
          { recipientIds: userId },
        ];
      }
    } else if (scope.isWarden) {
      filter.hostelId = scope.singleHostelId;
    } else if (scope.isSuperadmin) {
      if (scope.singleHostelId) filter.hostelId = scope.singleHostelId;
    } else if (scope.singleHostelId) {
      filter.hostelId = scope.singleHostelId;
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
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { message: { $regex: search, $options: 'i' } },
        ],
      });
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
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/alerts/notifications/unread-count
// ─────────────────────────────────────────────
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = String(req.user._id || req.user.id);
    const scope = await getAuthorizedHostelScope(req);

    let filter = {};
    if (scope.isStudent) {
      filter = {
        recipientIds: userId,
        'isRead.userId': { $ne: userId },
        status: { $ne: ALERT_STATUS.DISMISSED },
      };
    } else if (scope.isOwner) {
      if (req.query.hostelId) {
        filter = {
          hostelId: scope.singleHostelId,
          $or: [
            { recipientIds: userId },
            { recipientRole: { $in: ['owner', 'all', 'admin'] } },
          ],
          'isRead.userId': { $ne: userId },
          status: { $ne: ALERT_STATUS.DISMISSED },
        };
      } else {
        filter = {
          $or: [
            {
              hostelId: { $in: scope.ownedHostelIds },
              $or: [
                { recipientIds: userId },
                { recipientRole: { $in: ['owner', 'all', 'admin'] } },
              ],
            },
            { recipientIds: userId },
          ],
          'isRead.userId': { $ne: userId },
          status: { $ne: ALERT_STATUS.DISMISSED },
        };
      }
    } else if (scope.isWarden) {
      filter = {
        hostelId: scope.singleHostelId,
        'isRead.userId': { $ne: userId },
        status: { $ne: ALERT_STATUS.DISMISSED },
      };
    } else {
      filter = {
        ...(scope.singleHostelId && { hostelId: scope.singleHostelId }),
        status: ALERT_STATUS.UNREAD,
      };
    }

    const count = await HostelAlert.countDocuments(filter);

    res.status(200).json({ success: true, data: { unreadCount: count } });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// PUT /api/alerts/notifications/:id/read
// Mark a single notification as read
// ─────────────────────────────────────────────
exports.markAsRead = async (req, res) => {
  try {
    const userId = String(req.user._id || req.user.id);
    const { id } = req.params;

    const alert = await HostelAlert.findById(id);
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }

    const scope = await getAuthorizedHostelScope(req);
    if (scope.isStudent) {
      const isRecipient = alert.recipientIds.some((rid) => String(rid) === userId);
      if (!isRecipient) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
      }
    } else if (scope.isOwner) {
      const isRecipient = alert.recipientIds.some((rid) => String(rid) === userId);
      const isOwnedHostel = alert.hostelId && scope.ownedHostelIds.includes(String(alert.hostelId));
      if (!isRecipient && !isOwnedHostel) {
        return res.status(403).json({ success: false, message: 'Not authorized for this hostel alert' });
      }
    } else if (scope.isWarden) {
      if (alert.hostelId && String(alert.hostelId) !== String(scope.singleHostelId)) {
        return res.status(403).json({ success: false, message: 'Not authorized for this hostel alert' });
      }
    }

    // Idempotent: only add if not already marked
    const alreadyRead = alert.isRead.some((r) => String(r.userId) === userId);
    if (!alreadyRead) {
      alert.isRead.push({ userId, readAt: new Date() });
      if (alert.status === ALERT_STATUS.UNREAD) {
        alert.status = ALERT_STATUS.READ;
      }
      await alert.save();
    }

    res.status(200).json({ success: true, message: 'Marked as read' });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// PUT /api/alerts/notifications/read-all
// Mark ALL of the user's notifications as read
// ─────────────────────────────────────────────
exports.markAllRead = async (req, res) => {
  try {
    const userId = String(req.user._id || req.user.id);
    const scope = await getAuthorizedHostelScope(req);

    let filter = {};
    if (scope.isStudent) {
      filter = { recipientIds: userId, status: ALERT_STATUS.UNREAD };
    } else if (scope.isOwner) {
      if (req.query.hostelId) {
        filter = {
          hostelId: scope.singleHostelId,
          $or: [
            { recipientIds: userId },
            { recipientRole: { $in: ['owner', 'all', 'admin'] } },
          ],
          status: ALERT_STATUS.UNREAD,
        };
      } else {
        filter = {
          $or: [
            {
              hostelId: { $in: scope.ownedHostelIds },
              $or: [
                { recipientIds: userId },
                { recipientRole: { $in: ['owner', 'all', 'admin'] } },
              ],
            },
            { recipientIds: userId },
          ],
          status: ALERT_STATUS.UNREAD,
        };
      }
    } else if (scope.isWarden) {
      filter = {
        hostelId: scope.singleHostelId,
        status: ALERT_STATUS.UNREAD,
      };
    } else {
      filter = {
        ...(scope.singleHostelId && { hostelId: scope.singleHostelId }),
        status: ALERT_STATUS.UNREAD,
      };
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
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
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

    const scope = await getAuthorizedHostelScope(req);
    if (scope.isOwner) {
      const isOwnedHostel = alert.hostelId && scope.ownedHostelIds.includes(String(alert.hostelId));
      if (!isOwnedHostel) {
        return res.status(403).json({ success: false, message: 'Not authorized for this hostel' });
      }
    } else if (scope.isWarden) {
      if (scope.singleHostelId && alert.hostelId && String(alert.hostelId) !== String(scope.singleHostelId)) {
        return res.status(403).json({ success: false, message: 'Not authorized for this hostel' });
      }
    }

    alert.status = ALERT_STATUS.RESOLVED;
    alert.resolvedBy = userId;
    alert.resolvedAt = new Date();
    if (resolutionNote) alert.resolutionNote = resolutionNote;

    await alert.save();

    res.status(200).json({ success: true, message: 'Alert resolved', data: { alertId: id } });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/alerts/curfew
// Get curfew violations (warden/admin)
// ─────────────────────────────────────────────
exports.getCurfewViolations = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const scope = await getAuthorizedHostelScope(req);
    const { status, date, studentId, sortOrder = 'desc' } = req.query;

    const filter = { ...scope.hostelFilter };
    if (status && status !== 'all') filter.status = status;
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
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
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

    const scope = await getAuthorizedHostelScope(req);
    if (scope.isOwner) {
      if (!scope.ownedHostelIds.includes(String(violation.hostelId))) {
        return res.status(403).json({ success: false, message: 'Not authorized for this hostel' });
      }
    } else if (scope.isWarden) {
      if (scope.singleHostelId && String(violation.hostelId) !== String(scope.singleHostelId)) {
        return res.status(403).json({ success: false, message: 'Not authorized for this hostel' });
      }
    }

    violation.status = status;
    violation.resolvedBy = userId;
    violation.resolvedAt = new Date();
    if (resolutionNote) violation.resolutionNote = resolutionNote;

    await violation.save();

    res.status(200).json({ success: true, message: 'Curfew violation resolved' });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/alerts/leave-violations
// ─────────────────────────────────────────────
exports.getLeaveViolations = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const scope = await getAuthorizedHostelScope(req);
    const { status, sortOrder = 'desc' } = req.query;

    const filter = { ...scope.hostelFilter };
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
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/alerts/attendance
// Attendance alerts for a hostel
// ─────────────────────────────────────────────
exports.getAttendanceAlerts = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const scope = await getAuthorizedHostelScope(req);

    const filter = {
      category: 'attendance',
      ...scope.hostelFilter,
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
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/alerts/occupancy
// Real-time occupancy status
// ─────────────────────────────────────────────
exports.getOccupancyStatus = async (req, res) => {
  try {
    const scope = await getAuthorizedHostelScope(req);
    const hostelId = scope.singleHostelId || (scope.isOwner && scope.ownedHostelIds[0]);
    if (!hostelId) {
      return res.status(400).json({ success: false, message: 'hostelId is required and must be authorized' });
    }

    const forceRefresh = req.query.refresh === 'true';
    const data = await OccupancyService.getOccupancy(hostelId, forceRefresh);

    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/alerts/dashboard-stats
// Aggregate stats for the warden/admin dashboard
// ─────────────────────────────────────────────
exports.getDashboardStats = async (req, res) => {
  try {
    const scope = await getAuthorizedHostelScope(req);
    const baseFilter = { ...scope.hostelFilter };
    const hostelId = scope.singleHostelId;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

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
        ...baseFilter,
        violationDate: { $gte: today },
      }),
      LeaveViolation.countDocuments({
        ...baseFilter,
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
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
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

    if (!hostelId) {
      return res.status(400).json({ success: false, message: 'hostelId is required' });
    }

    const authScope = await getAuthorizedHostelScope(req);
    if (authScope.isOwner && !authScope.ownedHostelIds.includes(String(hostelId))) {
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
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// POST /api/alerts/curfew/trigger
// Manually trigger curfew check (warden/owner)
// ─────────────────────────────────────────────
exports.triggerManualCurfewCheck = async (req, res) => {
  try {
    const scope = await getAuthorizedHostelScope(req);
    const hostelId = scope.singleHostelId || (scope.isOwner && scope.ownedHostelIds[0]);

    if (!hostelId) {
      return res.status(400).json({ success: false, message: 'hostelId is required and must be authorized' });
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
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// POST /api/alerts/curfew/start-immediate
// Warden initiates immediate event-based curfew sweep & presence verification
// ─────────────────────────────────────────────
exports.startImmediateWardenCurfew = async (req, res) => {
  try {
    const scope = await getAuthorizedHostelScope(req);
    const hostelId = scope.singleHostelId || (scope.isOwner && scope.ownedHostelIds[0]);
    const wardenId = req.user?._id || req.user?.id;

    if (!hostelId) {
      return res.status(400).json({ success: false, message: 'hostelId is required and must be authorized' });
    }

    const result = await CurfewAutomationService.startImmediateWardenCurfew(hostelId, wardenId);

    res.status(200).json({
      success: true,
      message: `Night Curfew initiated immediately by Warden. Presence verification sweep completed: ${result.present} Present, ${result.onLeave} On Leave, ${result.initiated} in Grace Period.`,
      data: result,
    });
  } catch (err) {
    console.error('[Alert API] Error starting immediate warden curfew:', err);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// POST /api/alerts/curfew/simulate-timeline
// Fast-forward or test curfew stages (10min, 15min, 30min)
// ─────────────────────────────────────────────
exports.simulateCurfewTimeline = async (req, res) => {
  try {
    const scope = await getAuthorizedHostelScope(req);
    const hostelId = scope.singleHostelId || (scope.isOwner && scope.ownedHostelIds[0]);
    const { stage = '10min' } = req.body;

    if (!hostelId) {
      return res.status(400).json({ success: false, message: 'hostelId is required and must be authorized' });
    }

    const result = await CurfewAutomationService.advanceCurfewSimulation(hostelId, stage);

    res.status(200).json({
      success: true,
      message: `Simulated curfew stage '${stage}' executed successfully.`,
      data: result,
    });
  } catch (err) {
    console.error('[Alert API] Error simulating curfew timeline:', err);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// POST /api/alerts/curfew/set-time
// Warden or Owner sets or updates hostel curfew schedule
// ─────────────────────────────────────────────
exports.setCurfewTime = async (req, res) => {
  try {
    const scope = await getAuthorizedHostelScope(req);
    const hostelId = scope.singleHostelId || (scope.isOwner && scope.ownedHostelIds[0]);
    const { curfewTime, weekendCurfewTime, gracePeriodMinutes } = req.body;

    if (!hostelId) {
      return res.status(400).json({ success: false, message: 'hostelId is required and must be authorized' });
    }
    if (!curfewTime) {
      return res.status(400).json({ success: false, message: 'curfewTime (HH:mm format) is required' });
    }

    const updatedSchedule = await CurfewAutomationService.setCurfewSchedule(hostelId, curfewTime, {
      weekendCurfewTime,
      gracePeriodMinutes,
      updatedBy: req.user?._id || req.user?.id,
    });

    res.status(200).json({
      success: true,
      message: `Curfew time set to ${curfewTime} successfully. Background automation will monitor and trigger presence checks automatically.`,
      data: updatedSchedule,
    });
  } catch (err) {
    console.error('[Alert API] Error setting curfew time:', err);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/alerts/curfew/active-timers
// Fetch active grace and parent countdown timers for hostel
// ─────────────────────────────────────────────
exports.getActiveCurfewTimers = async (req, res) => {
  try {
    const scope = await getAuthorizedHostelScope(req);
    const hostelId = scope.singleHostelId || (scope.isOwner && scope.ownedHostelIds[0]);

    if (!hostelId) {
      return res.status(400).json({ success: false, message: 'hostelId is required and must be authorized' });
    }

    const timerData = await CurfewAutomationService.getActiveCurfewTimers(hostelId);

    res.status(200).json({
      success: true,
      data: timerData,
    });
  } catch (err) {
    console.error('[Alert API] Error getting active curfew timers:', err);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// POST /api/alerts/send-to-all
// Broadcast a custom alert to owner + warden + student simultaneously
// Accessible by: warden, owner, superadmin
// ─────────────────────────────────────────────
exports.sendToAllRoles = async (req, res) => {
  try {
    const { title, message, type = 'ANNOUNCEMENT', priority = 'medium', targetRoles, hostelId: bodyHostelId } = req.body || {};

    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'title and message are required' });
    }

    if (req.body) req.body.hostelId = bodyHostelId;
    const scope = await getAuthorizedHostelScope(req);
    const hostelId = scope.singleHostelId || (scope.isOwner && scope.ownedHostelIds[0]);

    if (!hostelId) {
      return res.status(400).json({ success: false, message: 'hostelId is required and must be authorized' });
    }

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
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// POST /api/alerts/curfew/:id/escalate
// Warden or Staff manually escalates a curfew violation to Owner & Student
// ─────────────────────────────────────────────
exports.escalateCurfewViolation = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = 'Warden manual escalation' } = req.body;
    const wardenId = String(req.user._id || req.user.id);

    const violation = await CurfewViolation.findById(id)
      .populate('studentId', 'name studentId phone')
      .populate('hostelId', 'name ownerId');

    if (!violation) {
      return res.status(404).json({ success: false, message: 'Curfew violation not found' });
    }

    const scope = await getAuthorizedHostelScope(req);
    const vHostelId = String(violation.hostelId?._id || violation.hostelId || '');
    if (scope.isWarden && scope.singleHostelId && vHostelId !== String(scope.singleHostelId)) {
      return res.status(403).json({ success: false, message: 'Not authorized for this hostel violation' });
    }
    if (scope.isOwner && !scope.ownedHostelIds.includes(vHostelId)) {
      return res.status(403).json({ success: false, message: 'Not authorized for this hostel violation' });
    }

    const student = violation.studentId;
    const hostel = violation.hostelId;
    const sid = String(student?._id || student || '');
    const hId = vHostelId;
    const studentName = student?.name || 'Student';

    // Resolve owner of this hostel
    let ownerId = String(hostel?.ownerId?._id || hostel?.ownerId || '');
    if (!ownerId && hId) {
      const hDoc = await Hostel.findById(hId).select('ownerId').lean();
      ownerId = String(hDoc?.ownerId || '');
    }

    // 1. Dispatch alert to OWNER of this hostel ONLY
    const alertDoc = await HostelAlertService.send({
      type: 'CURFEW_VIOLATION',
      title: '🚨 Curfew Violation Escalated to Owner (Warden Escalation)',
      message: `Warden Escalation: ${studentName} is outside during curfew (${violation.curfewTime}). Reason: ${reason}`,
      hostelId: hId,
      studentId: sid,
      recipientRole: 'owner',
      recipientIds: ownerId ? [ownerId] : undefined,
      priority: 'high',
      triggeredByUserId: wardenId,
      metadata: {
        violationId: String(violation._id),
        studentName,
        curfewTime: violation.curfewTime,
        escalatedByWarden: true,
        wardenId,
        reason,
      },
      sendPush: true,
    });

    // 2. Dispatch alert to STUDENT
    await HostelAlertService.send({
      type: 'CURFEW_VIOLATION',
      title: '🚨 Curfew Violation Escalated to Hostel Owner',
      message: `Your curfew breach (${violation.curfewTime}) has been manually escalated to the Hostel Owner by the warden.`,
      hostelId: hId,
      studentId: sid,
      recipientRole: 'student',
      recipientIds: [sid],
      priority: 'high',
      triggeredByUserId: wardenId,
      sendPush: true,
    });

    // Update violation doc
    violation.status = 'open';
    violation.stage = 1;
    violation.escalationLevel = 1;
    violation.escalatedAt = violation.escalatedAt || [];
    violation.escalatedAt.push(new Date());
    violation.alertId = alertDoc?._id || violation.alertId;
    await violation.save();

    res.status(200).json({
      success: true,
      message: `Curfew violation for ${studentName} escalated to Owner successfully.`,
      data: violation,
    });
  } catch (err) {
    console.error('[Alert API] Error escalating curfew violation:', err);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// POST /api/alerts/curfew/end
// Warden or Owner explicitly concludes / stops active curfew
// ─────────────────────────────────────────────
exports.endCurfew = async (req, res) => {
  try {
    const scope = await getAuthorizedHostelScope(req);
    const hostelId = req.body?.hostelId || scope.singleHostelId || (scope.isOwner && scope.ownedHostelIds?.[0]);
    const userId = req.user?._id || req.user?.id;
    const { note } = req.body;

    if (!hostelId) {
      return res.status(400).json({ success: false, message: 'hostelId is required and must be authorized' });
    }

    const result = await CurfewAutomationService.endCurfewSession(hostelId, userId, { note });

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.session,
      isCurfewActive: false,
      manualCurfewEndedAt: result.manualCurfewEndedAt,
    });
  } catch (err) {
    console.error('[Alert API] Error ending curfew session:', err);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/alerts/curfew/config
// Fetch complete curfew and alert configuration
// ─────────────────────────────────────────────
exports.getCurfewConfig = async (req, res) => {
  try {
    const scope = await getAuthorizedHostelScope(req);
    const hostelId = scope.singleHostelId || (scope.isOwner && scope.ownedHostelIds[0]);

    if (!hostelId) {
      return res.status(400).json({ success: false, message: 'hostelId is required and must be authorized' });
    }

    const config = await CurfewAutomationService.getCurfewConfig(hostelId);

    res.status(200).json({
      success: true,
      data: config,
    });
  } catch (err) {
    console.error('[Alert API] Error fetching curfew config:', err);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// POST /api/alerts/curfew/config
// Update complete curfew schedule & alert rules
// ─────────────────────────────────────────────
exports.updateCurfewConfig = async (req, res) => {
  try {
    const scope = await getAuthorizedHostelScope(req);
    const hostelId = scope.singleHostelId || (scope.isOwner && scope.ownedHostelIds[0]);

    if (!hostelId) {
      return res.status(400).json({ success: false, message: 'hostelId is required and must be authorized' });
    }

    const result = await CurfewAutomationService.setCurfewFullConfig(hostelId, req.body);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.rules,
    });
  } catch (err) {
    console.error('[Alert API] Error updating curfew config:', err);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/alerts/curfew/history
// Fetch curfew session history & student violation audit records
// ─────────────────────────────────────────────
exports.getCurfewHistory = async (req, res) => {
  try {
    const scope = await getAuthorizedHostelScope(req);
    const hostelId = scope.singleHostelId || (scope.isOwner && scope.ownedHostelIds[0]);

    if (!hostelId) {
      return res.status(400).json({ success: false, message: 'hostelId is required and must be authorized' });
    }

    const historyData = await CurfewAutomationService.getCurfewHistory(hostelId, req.query);

    res.status(200).json({
      success: true,
      data: historyData,
    });
  } catch (err) {
    console.error('[Alert API] Error fetching curfew history:', err);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// DELETE /api/alerts/curfew/:id
// Delete a curfew violation record
// ─────────────────────────────────────────────
exports.deleteCurfewViolation = async (req, res) => {
  try {
    const { id } = req.params;
    const scope = await getAuthorizedHostelScope(req);
    const hostelId = scope.singleHostelId || (scope.isOwner && scope.ownedHostelIds[0]);

    const CurfewViolation = require('../models/CurfewViolation');
    const record = await CurfewViolation.findById(id);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Curfew violation not found' });
    }

    if (hostelId && String(record.hostelId) !== String(hostelId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete records for this hostel' });
    }

    await CurfewViolation.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: 'Curfew violation deleted successfully' });
  } catch (err) {
    console.error('[Alert API] Error deleting curfew violation:', err);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

