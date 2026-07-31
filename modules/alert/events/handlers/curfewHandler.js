/**
 * @file curfewHandler.js
 * @description Handles manual curfew check trigger events from hostelEventEmitter.
 *
 * WHY: The existing wardenController.js has a `triggerManualCheck` endpoint.
 * Instead of directly calling CurfewAutomationService there (would create a
 * dependency from controller → alert module), the controller just emits an event.
 *
 * REGISTERED EVENTS:
 * - CURFEW_VIOLATION → CurfewAutomationService.runCurfewCheckForHostel()
 *
 * PAYLOAD EXPECTED:
 * { hostelId: string, triggeredBy?: string }
 */

'use strict';

const hostelEventEmitter = require('../hostelEventEmitter');
const CurfewAutomationService = require('../../services/CurfewAutomationService');
const { ALERT_TYPES } = require('../../utils/constants');

// Custom event name for manual trigger (separate from violation result event)
const MANUAL_CURFEW_TRIGGER = 'MANUAL_CURFEW_CHECK';

/**
 * Register curfew event handlers.
 */
function registerCurfewHandlers() {
  hostelEventEmitter.on(MANUAL_CURFEW_TRIGGER, (payload) => {
    setImmediate(async () => {
      try {
        const { hostelId } = payload;
        if (!hostelId) return;
        console.log(`[CurfewHandler] Manual curfew check triggered for hostel ${hostelId}`);
        await CurfewAutomationService.runCurfewCheckForHostel(hostelId);
      } catch (err) {
        console.error('[CurfewHandler] Error:', err.message);
      }
    });
  });

  console.log('[CurfewHandler] Curfew event handlers registered');
}

// Export the event name so controllers can use it without importing constants
module.exports = { registerCurfewHandlers, MANUAL_CURFEW_TRIGGER };
