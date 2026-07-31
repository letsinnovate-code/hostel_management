/**
 * @file checkInHandler.js
 * @description Handles check-in and check-out events from hostelEventEmitter.
 *
 * REGISTERED EVENTS:
 * - CHECKIN → CheckInAutomationService.handleCheckIn() + OccupancyService.checkOccupancyLimits()
 * - CHECKOUT → CheckInAutomationService.handleCheckOut()
 *
 * WHY setImmediate:
 * All handler logic runs in setImmediate to ensure the check-in API response
 * returns IMMEDIATELY to the student. The alert processing happens on the next
 * iteration of the event loop — no latency added to the main request.
 *
 * PAYLOAD EXPECTED:
 * { studentId: string, hostelId: string, time: Date, source?: string }
 */

'use strict';

const hostelEventEmitter = require('../hostelEventEmitter');
const CheckInAutomationService = require('../../services/CheckInAutomationService');
const OccupancyService = require('../../services/OccupancyService');
const { ALERT_TYPES } = require('../../utils/constants');

/**
 * Register all check-in/check-out event handlers.
 * Call this once at application startup.
 */
function registerCheckInHandlers() {
  // ─── Check-In Handler ──────────────────────────────────────────────
  hostelEventEmitter.on(ALERT_TYPES.CHECKIN, (payload) => {
    setImmediate(async () => {
      try {
        const { studentId, hostelId, time } = payload;
        if (!studentId || !hostelId) return;

        // Detect if this was a late check-in
        await CheckInAutomationService.handleCheckIn({ studentId, hostelId, time: time || new Date() });

        // Update occupancy and check limits
        await OccupancyService.checkOccupancyLimits(hostelId);
      } catch (err) {
        console.error('[CheckInHandler] Error handling CHECKIN event:', err.message);
      }
    });
  });

  // ─── Check-Out Handler ─────────────────────────────────────────────
  hostelEventEmitter.on(ALERT_TYPES.CHECKOUT, (payload) => {
    setImmediate(async () => {
      try {
        const { studentId, hostelId, time } = payload;
        if (!studentId || !hostelId) return;

        // Detect unauthorized checkouts
        await CheckInAutomationService.handleCheckOut({ studentId, hostelId, time: time || new Date() });

        // Update occupancy after checkout
        await OccupancyService.checkOccupancyLimits(hostelId);
      } catch (err) {
        console.error('[CheckInHandler] Error handling CHECKOUT event:', err.message);
      }
    });
  });

  console.log('[CheckInHandler] Check-in/out event handlers registered');
}

module.exports = { registerCheckInHandlers };
