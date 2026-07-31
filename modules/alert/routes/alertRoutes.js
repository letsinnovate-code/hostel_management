/**
 * @file alertRoutes.js
 * @description Express router for the Hostel Alert & Automation Module.
 *
 * ALL ROUTES require authentication (protect middleware).
 * Role-based access is enforced per endpoint.
 *
 * ROLE ACCESS SUMMARY:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ Endpoint                           │ Student │ Warden │ Owner │ SuperA │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ GET  /notifications                │   ✅    │   ✅   │  ✅  │   ✅  │
 * │ GET  /notifications/unread-count   │   ✅    │   ✅   │  ✅  │   ✅  │
 * │ PUT  /notifications/:id/read       │   ✅    │   ✅   │  ✅  │   ✅  │
 * │ PUT  /notifications/read-all       │   ✅    │   ✅   │  ✅  │   ✅  │
 * │ PUT  /:id/resolve                  │   ❌    │   ✅   │  ✅  │   ✅  │
 * │ GET  /curfew                       │   ❌    │   ✅   │  ✅  │   ✅  │
 * │ PUT  /curfew/:id/resolve           │   ❌    │   ✅   │  ✅  │   ✅  │
 * │ POST /curfew/trigger               │   ❌    │   ✅   │  ✅  │   ✅  │
 * │ GET  /attendance                   │   ❌    │   ✅   │  ✅  │   ✅  │
 * │ GET  /leave-violations             │   ❌    │   ✅   │  ✅  │   ✅  │
 * │ GET  /occupancy                    │   ❌    │   ✅   │  ✅  │   ✅  │
 * │ GET  /dashboard-stats              │   ❌    │   ✅   │  ✅  │   ✅  │
 * │ POST /emergency/broadcast          │   ❌    │   ❌   │  ✅  │   ✅  │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * MOUNTING:
 * In server.js:
 * app.use('/api/alerts', require('./modules/alert/routes/alertRoutes'));
 */

'use strict';

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../../middleware/auth');
const ctrl = require('../controllers/alertController');
const {
  handleValidationErrors,
  validateGetNotifications,
  validateGetCurfewViolations,
  validateGetLeaveViolations,
  validateResolveAlert,
  validateEmergencyBroadcast,
  validateResolveCurfewViolation,
  validateObjectIdParam,
} = require('../validation/alertValidation');

// All alert routes require authentication
router.use(protect);

// ─────────────────────────────────────────────
// NOTIFICATIONS (all roles)
// ─────────────────────────────────────────────

/**
 * GET /api/alerts/notifications
 * Get paginated notifications for the current user.
 * Students see their own; staff see hostel-wide alerts.
 *
 * Query params: page, limit, category, priority, status, startDate, endDate, search, sortBy, sortOrder, hostelId
 */
router.get(
  '/notifications',
  validateGetNotifications,
  handleValidationErrors,
  ctrl.getMyNotifications
);

/**
 * GET /api/alerts/notifications/unread-count
 * Get count of unread notifications for badge display.
 */
router.get(
  '/notifications/unread-count',
  ctrl.getUnreadCount
);

/**
 * PUT /api/alerts/notifications/read-all
 * Mark all user's notifications as read.
 * NOTE: This must be declared BEFORE /:id/read to prevent Express matching 'read-all' as an :id
 */
router.put(
  '/notifications/read-all',
  ctrl.markAllRead
);

/**
 * PUT /api/alerts/notifications/:id/read
 * Mark a single notification as read.
 */
router.put(
  '/notifications/:id/read',
  validateObjectIdParam('id'),
  handleValidationErrors,
  ctrl.markAsRead
);

// ─────────────────────────────────────────────
// ALERT RESOLUTION (warden/owner/superadmin)
// ─────────────────────────────────────────────

/**
 * PUT /api/alerts/:id/resolve
 * Resolve/close an alert. Staff only.
 *
 * Body: { resolutionNote?: string }
 */
router.put(
  '/:id/resolve',
  authorize('warden', 'owner', 'superadmin'),
  validateResolveAlert,
  handleValidationErrors,
  ctrl.resolveAlert
);

// ─────────────────────────────────────────────
// CURFEW MONITORING (warden/owner/superadmin)
// ─────────────────────────────────────────────

/**
 * GET /api/alerts/curfew
 * Get curfew violation records with pagination and filters.
 *
 * Query: hostelId, status, date, studentId, page, limit, sortOrder
 */
router.get(
  '/curfew',
  authorize('warden', 'owner', 'superadmin'),
  validateGetCurfewViolations,
  handleValidationErrors,
  ctrl.getCurfewViolations
);

/**
 * PUT /api/alerts/curfew/:id/resolve
 * Mark a curfew violation as resolved/acknowledged/false_positive.
 *
 * Body: { status: 'acknowledged'|'resolved'|'false_positive', resolutionNote?: string }
 */
router.put(
  '/curfew/:id/resolve',
  authorize('warden', 'owner', 'superadmin'),
  validateResolveCurfewViolation,
  handleValidationErrors,
  ctrl.resolveCurfewViolation
);

/**
 * POST /api/alerts/curfew/trigger
 * Manually trigger curfew check for a hostel. Returns 202 immediately.
 *
 * Query/Body: hostelId
 */
router.post(
  '/curfew/trigger',
  authorize('warden', 'owner', 'superadmin'),
  ctrl.triggerManualCurfewCheck
);

// ─────────────────────────────────────────────
// ATTENDANCE ALERTS (warden/owner/superadmin)
// ─────────────────────────────────────────────

/**
 * GET /api/alerts/attendance
 * Get attendance-category alerts for a hostel.
 *
 * Query: hostelId, page, limit
 */
router.get(
  '/attendance',
  authorize('warden', 'owner', 'superadmin'),
  ctrl.getAttendanceAlerts
);

// ─────────────────────────────────────────────
// LEAVE VIOLATIONS (warden/owner/superadmin)
// ─────────────────────────────────────────────

/**
 * GET /api/alerts/leave-violations
 * Get leave violation records.
 *
 * Query: hostelId, status, page, limit, sortOrder
 */
router.get(
  '/leave-violations',
  authorize('warden', 'owner', 'superadmin'),
  validateGetLeaveViolations,
  handleValidationErrors,
  ctrl.getLeaveViolations
);

// ─────────────────────────────────────────────
// OCCUPANCY (warden/owner/superadmin)
// ─────────────────────────────────────────────

/**
 * GET /api/alerts/occupancy
 * Get real-time occupancy status for a hostel.
 *
 * Query: hostelId, refresh=true (bypass cache)
 */
router.get(
  '/occupancy',
  authorize('warden', 'owner', 'superadmin'),
  ctrl.getOccupancyStatus
);

// ─────────────────────────────────────────────
// DASHBOARD STATS (warden/owner/superadmin)
// ─────────────────────────────────────────────

/**
 * GET /api/alerts/dashboard-stats
 * Aggregated stats: totals, unresolved, critical, today's violations, category breakdown.
 *
 * Query: hostelId
 */
router.get(
  '/dashboard-stats',
  authorize('warden', 'owner', 'superadmin'),
  ctrl.getDashboardStats
);

// ─────────────────────────────────────────────
// EMERGENCY BROADCAST (owner/superadmin only)
// ─────────────────────────────────────────────

/**
 * POST /api/alerts/emergency/broadcast
 * Broadcast an emergency alert to all users in scope.
 *
 * Body: {
 *   emergencyType: 'fire'|'medical'|'security'|'natural_disaster'|'evacuation'|'other',
 *   title: string,
 *   message: string,
 *   hostelId: string,
 *   scope?: 'hostel'|'staff'|'students'|'floor',
 *   floorNumber?: number
 * }
 */
router.post(
  '/emergency/broadcast',
  authorize('owner', 'superadmin'),
  validateEmergencyBroadcast,
  handleValidationErrors,
  ctrl.broadcastEmergency
);

// ─────────────────────────────────────────────
// SEND TO ALL ROLES (warden/owner/superadmin)
// ─────────────────────────────────────────────

/**
 * POST /api/alerts/send-to-all
 * Send a custom alert simultaneously to owner, warden, and student roles.
 * Used to test and demonstrate multi-role delivery.
 *
 * Body: {
 *   title: string,
 *   message: string,
 *   hostelId?: string,         (optional if user has hostelId)
 *   type?: string,             (default: 'ANNOUNCEMENT')
 *   priority?: 'low'|'medium'|'high'|'urgent',
 *   targetRoles?: string[]     (default: ['owner','warden','student'])
 * }
 */
router.post(
  '/send-to-all',
  authorize('warden', 'owner', 'superadmin'),
  ctrl.sendToAllRoles
);

module.exports = router;

