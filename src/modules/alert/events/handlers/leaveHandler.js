/**
 * @file leaveHandler.js
 * @description Handles leave lifecycle events from hostelEventEmitter.
 *
 * REGISTERED EVENTS:
 * - LEAVE_REQUESTED / LEAVE_APPROVED / LEAVE_REJECTED / LEAVE_CANCELLED
 *   → LeaveAutomationService.handleLeaveEvent()
 *
 * PAYLOAD EXPECTED:
 * {
 *   type: string,           // ALERT_TYPES constant
 *   studentId: string,
 *   hostelId: string,
 *   permissionId: string,
 *   reason?: string,        // rejection reason
 *   returnDate?: Date,
 * }
 */

'use strict';

const hostelEventEmitter = require('../hostelEventEmitter');
const LeaveAutomationService = require('../../services/LeaveAutomationService');
const { ALERT_TYPES } = require('../../utils/constants');

/**
 * Register all leave event handlers.
 */
function registerLeaveHandlers() {
  const handleLeave = (type) => (payload) => {
    setImmediate(async () => {
      try {
        if (!payload.studentId || !payload.hostelId) return;
        await LeaveAutomationService.handleLeaveEvent({ ...payload, type });
      } catch (err) {
        console.error(`[LeaveHandler] Error handling ${type}:`, err.message);
      }
    });
  };

  hostelEventEmitter.on(ALERT_TYPES.LEAVE_REQUESTED, handleLeave(ALERT_TYPES.LEAVE_REQUESTED));
  hostelEventEmitter.on(ALERT_TYPES.LEAVE_APPROVED, handleLeave(ALERT_TYPES.LEAVE_APPROVED));
  hostelEventEmitter.on(ALERT_TYPES.LEAVE_REJECTED, handleLeave(ALERT_TYPES.LEAVE_REJECTED));
  hostelEventEmitter.on(ALERT_TYPES.LEAVE_CANCELLED, handleLeave(ALERT_TYPES.LEAVE_CANCELLED));

  console.log('[LeaveHandler] Leave event handlers registered');
}

module.exports = { registerLeaveHandlers };
