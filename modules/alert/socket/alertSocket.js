/**
 * @file alertSocket.js
 * @description Reusable helper functions for emitting Socket.IO alert events.
 *
 * WHY SEPARATE FROM socketManager.js:
 * socketManager handles connection lifecycle (auth, rooms, disconnect).
 * alertSocket handles WHAT to emit and WHEN. Keeping them separate
 * follows single-responsibility and makes services easy to test
 * (mock alertSocket without touching socketManager).
 *
 * ALL FUNCTIONS ARE FIRE-AND-FORGET (no await needed from callers).
 * They silently swallow errors — socket delivery failure must NEVER
 * crash the main request/response cycle.
 */

'use strict';

const { getIOSafe } = require('./socketManager');
const { SOCKET_EVENTS } = require('../utils/constants');

/**
 * Emit an event to a specific user's private room.
 * Use for: "Your leave was approved", "You have a curfew violation"
 *
 * @param {string} userId
 * @param {string} event - SOCKET_EVENTS constant
 * @param {Object} data
 */
function emitToUser(userId, event, data) {
  try {
    const io = getIOSafe();
    if (!io) return;
    io.to(`user:${String(userId)}`).emit(event, { ...data, _ts: Date.now() });
  } catch (err) {
    console.error('[AlertSocket] emitToUser error:', err.message);
  }
}

/**
 * Emit an event to all users of a specific role within a hostel.
 * Use for: "Notify all wardens of hostel X about a curfew violation"
 *
 * @param {string} role - e.g. 'warden', 'owner'
 * @param {string} hostelId
 * @param {string} event - SOCKET_EVENTS constant
 * @param {Object} data
 */
function emitToRole(role, hostelId, event, data) {
  try {
    const io = getIOSafe();
    if (!io) return;
    io.to(`role:${role}:${String(hostelId)}`).emit(event, { ...data, _ts: Date.now() });
  } catch (err) {
    console.error('[AlertSocket] emitToRole error:', err.message);
  }
}

/**
 * Emit an event to ALL users in a hostel (students + staff).
 * Use for: emergency alerts, announcements
 *
 * @param {string} hostelId
 * @param {string} event - SOCKET_EVENTS constant
 * @param {Object} data
 */
function emitToHostel(hostelId, event, data) {
  try {
    const io = getIOSafe();
    if (!io) return;
    io.to(`hostel:${String(hostelId)}`).emit(event, { ...data, _ts: Date.now() });
  } catch (err) {
    console.error('[AlertSocket] emitToHostel error:', err.message);
  }
}

/**
 * Emit to all superadmins (system-wide room).
 *
 * @param {string} event
 * @param {Object} data
 */
function emitToSuperAdmins(event, data) {
  try {
    const io = getIOSafe();
    if (!io) return;
    io.to('superadmin').emit(event, { ...data, _ts: Date.now() });
  } catch (err) {
    console.error('[AlertSocket] emitToSuperAdmins error:', err.message);
  }
}

/**
 * Emit to multiple roles in a hostel.
 * Use for: curfew alerts → warden + owner + superadmin
 *
 * @param {string[]} roles
 * @param {string} hostelId
 * @param {string} event
 * @param {Object} data
 */
function emitToRoles(roles, hostelId, event, data) {
  for (const role of roles) {
    emitToRole(role, hostelId, event, data);
  }
}

/**
 * Emit a new alert notification — the primary event for the client to render
 * an alert badge/toast.
 *
 * @param {string} userId - recipient user ID
 * @param {Object} alertDoc - HostelAlert document (lean)
 */
function emitNewAlert(userId, alertDoc) {
  emitToUser(userId, SOCKET_EVENTS.NEW_ALERT, {
    alert: {
      _id: alertDoc._id,
      type: alertDoc.type,
      category: alertDoc.category,
      title: alertDoc.title,
      message: alertDoc.message,
      priority: alertDoc.priority,
      status: alertDoc.status,
      metadata: alertDoc.metadata,
      createdAt: alertDoc.createdAt,
    },
  });
}

/**
 * Emit a curfew violation to all hostel managers (wardens + owner) of a hostel.
 *
 * @param {string} hostelId
 * @param {Object} violationData - CurfewViolation document (lean)
 */
function emitCurfewViolation(hostelId, violationData) {
  const payload = {
    violation: violationData,
  };
  emitToRole('warden', hostelId, SOCKET_EVENTS.CURFEW_VIOLATION, payload);
  emitToRole('owner', hostelId, SOCKET_EVENTS.CURFEW_VIOLATION, payload);
  emitToSuperAdmins(SOCKET_EVENTS.CURFEW_VIOLATION, { ...payload, hostelId });
}

/**
 * Emit a system-wide emergency broadcast.
 *
 * @param {string} hostelId
 * @param {Object} emergencyData
 */
function emitEmergencyBroadcast(hostelId, emergencyData) {
  emitToHostel(hostelId, SOCKET_EVENTS.EMERGENCY_BROADCAST, emergencyData);
  emitToSuperAdmins(SOCKET_EVENTS.EMERGENCY_BROADCAST, { ...emergencyData, hostelId });
}

/**
 * Emit an occupancy update to hostel staff.
 *
 * @param {string} hostelId
 * @param {Object} occupancyData
 */
function emitOccupancyUpdate(hostelId, occupancyData) {
  emitToRole('warden', hostelId, SOCKET_EVENTS.OCCUPANCY_UPDATE, occupancyData);
  emitToRole('owner', hostelId, SOCKET_EVENTS.OCCUPANCY_UPDATE, occupancyData);
}

module.exports = {
  emitToUser,
  emitToRole,
  emitToHostel,
  emitToSuperAdmins,
  emitToRoles,
  emitNewAlert,
  emitCurfewViolation,
  emitEmergencyBroadcast,
  emitOccupancyUpdate,
};
