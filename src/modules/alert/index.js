/**
 * @file index.js
 * @description Alert Module bootstrap — initializes all components.
 *
 * This file is the SINGLE entry point for the alert module.
 * server.js calls initAlertModule(app, httpServer) and everything is wired up.
 *
 * INITIALIZATION ORDER (important):
 * 1. Register event handlers (before anything can emit events)
 * 2. Initialize Socket.IO (before any alert can be sent)
 * 3. Initialize BullMQ queues (before scheduler tries to enqueue)
 * 4. Start cron scheduler (last — now queues and socket are ready)
 *
 * WHY A SINGLE INIT FUNCTION:
 * Keeps server.js clean. All module complexity is encapsulated here.
 * server.js only needs 2 lines to use this entire module.
 */

'use strict';

const { initSocket } = require('./socket/socketManager');
const { startScheduler, stopScheduler } = require('./scheduler/cronScheduler');
const { initQueues } = require('./jobs/queueManager');
const { startCurfewWorker } = require('./jobs/curfewJob');
const { startAttendanceWorker } = require('./jobs/attendanceJob');
const { startLeaveExpiryWorker } = require('./jobs/leaveExpiryJob');
const { registerCheckInHandlers } = require('./events/handlers/checkInHandler');
const { registerAttendanceHandlers } = require('./events/handlers/attendanceHandler');
const { registerLeaveHandlers } = require('./events/handlers/leaveHandler');
const { registerCurfewHandlers } = require('./events/handlers/curfewHandler');

/**
 * Initialize the entire Alert & Automation Module.
 * Call this from server.js BEFORE server.listen().
 *
 * @param {import('http').Server} httpServer - The HTTP server (not Express app)
 * @returns {Promise<void>}
 */
async function initAlertModule(httpServer) {
  console.log('[AlertModule] 🚀 Initializing Hostel Alert & Automation Module...');

  try {
    // ── Step 1: Register event handlers ──────────────────────────────
    registerCheckInHandlers();
    registerAttendanceHandlers();
    registerLeaveHandlers();
    registerCurfewHandlers();
    console.log('[AlertModule] ✅ Event handlers registered');

    // ── Step 2: Initialize Socket.IO ──────────────────────────────────
    initSocket(httpServer);
    console.log('[AlertModule] ✅ Socket.IO initialized');

    // ── Step 3: Initialize BullMQ queues (optional, Redis-dependent) ──
    const queuesReady = await initQueues();

    // ── Step 4: Start BullMQ workers if queues are ready ─────────────
    if (queuesReady) {
      startCurfewWorker();
      startAttendanceWorker();
      startLeaveExpiryWorker();
      console.log('[AlertModule] ✅ BullMQ workers started');
    } else {
      console.log('[AlertModule] ⚡ BullMQ disabled — using in-process cron only');
    }

    // ── Step 5: Start cron scheduler ─────────────────────────────────
    await startScheduler();
    console.log('[AlertModule] ✅ Cron scheduler started');

    console.log('[AlertModule] 🎉 Hostel Alert & Automation Module ready!');
  } catch (err) {
    console.error('[AlertModule] ❌ Initialization failed:', err.message);
    // Non-fatal: alert module failure should not crash the main server
    // The REST API routes will still work; real-time and scheduled features won't
  }
}

/**
 * Gracefully shut down the alert module.
 * Call from SIGTERM/SIGINT handlers in server.js.
 */
function shutdownAlertModule() {
  console.log('[AlertModule] Shutting down...');
  stopScheduler();
}

module.exports = {
  initAlertModule,
  shutdownAlertModule,
  // Re-export key services for direct use from other parts of the app
  HostelAlertService: require('./services/HostelAlertService'),
  hostelEventEmitter: require('./events/hostelEventEmitter'),
};
