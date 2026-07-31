// /**
//  * @file cronScheduler.js
//  * @description Cron-based scheduler for daily and periodic automation tasks.
//  *
//  * JOBS SCHEDULED:
//  * ┌─────────────────────────────────────────────────────────────────┐
//  * │ Job                    │ Schedule       │ Description           │
//  * ├─────────────────────────────────────────────────────────────────┤
//  * │ Curfew Check           │ 21:00 daily    │ Read from hostel DB   │
//  * │ Attendance Check       │ 08:00 daily    │ Morning attendance    │
//  * │ Leave Expiry Check     │ */30 * * * *   │ Every 30 minutes      │
//  * │ 24h Outside Check      │ 06:00 daily    │ Never-returned scan   │
//  * └─────────────────────────────────────────────────────────────────┘
//  *
//  * CURFEW SCHEDULE STRATEGY:
//  * Different hostels may have different curfew times. We cannot know all times
//  * at startup. Instead, we run at 21:00 (9 PM IST) as a reasonable default
//  * and also re-read the hostel's curfewTime in the service.
//  *
//  * For production with diverse curfew times, consider:
//  * 1. Running the check every minute from 20:00-23:00 (polling window)
//  * 2. Or scheduling per-hostel jobs with exact times using BullMQ delayed jobs
//  *
//  * WHY node-cron OVER setInterval:
//  * node-cron respects system timezone, supports cron expressions, and doesn't
//  * drift like setInterval. It also restarts itself after server restarts.
//  *
//  * GRACEFUL SHUTDOWN:
//  * All cron tasks are stored and can be stopped via stopScheduler().
//  */

'use strict';

const cron = require('node-cron');
const CurfewAutomationService = require('../services/CurfewAutomationService');
const AttendanceAutomationService = require('../services/AttendanceAutomationService');
const LeaveAutomationService = require('../services/LeaveAutomationService');
const CheckInAutomationService = require('../services/CheckInAutomationService');
const { addCurfewJob, addAttendanceJob, addLeaveExpiryJob, isQueueAvailable } = require('../jobs/queueManager');
const Hostel = require('../../../models/Hostel');

// Track all scheduled tasks for graceful shutdown
const scheduledTasks = [];

/**
 * Start all cron jobs.
 * Should be called once at application startup (from server.js).
 */
async function startScheduler() {
  console.log('[Scheduler] Initializing cron scheduler...');

  // ────────────────────────────────────────────────────────────────────
  // 1. CURFEW CHECK — runs at 9:00 PM IST (21:00) every day
  //
  // NOTE: We schedule a GLOBAL check at 21:00. Individual hostel curfew
  // times are checked within the service. If a hostel has curfew at 22:00,
  // the service correctly compares against 22:00 — students checked out
  // after 21:00 but before 22:00 will not be flagged.
  // For truly per-hostel scheduling, see docs below.
  // ────────────────────────────────────────────────────────────────────
  const curfewTask = cron.schedule(
    '0 21 * * *', // Every day at 9:00 PM
    async () => {
      console.log('[Scheduler] ⏰ Triggering curfew check (21:00)');
      try {
        if (isQueueAvailable()) {
          // Use BullMQ queue (distributed, retriable)
          await addCurfewJob(null);
        } else {
          // Run inline (single process)
          await CurfewAutomationService.runGlobalDailyCheck();
        }
      } catch (err) {
        console.error('[Scheduler] Curfew check failed:', err.message);
      }
    },
    {
      timezone: 'Asia/Kolkata', // IST timezone
    }
  );
  scheduledTasks.push(curfewTask);

  // ────────────────────────────────────────────────────────────────────
  // 2. ATTENDANCE CHECK — runs at 8:00 AM IST every day
  // ────────────────────────────────────────────────────────────────────
  const attendanceTask = cron.schedule(
    '0 8 * * *',
    async () => {
      console.log('[Scheduler] ⏰ Triggering attendance check (08:00)');
      try {
        if (isQueueAvailable()) {
          await addAttendanceJob(null);
        } else {
          await AttendanceAutomationService.runGlobalDailyCheck();
        }
      } catch (err) {
        console.error('[Scheduler] Attendance check failed:', err.message);
      }
    },
    { timezone: 'Asia/Kolkata' }
  );
  scheduledTasks.push(attendanceTask);

  // ────────────────────────────────────────────────────────────────────
  // 3. LEAVE EXPIRY CHECK — runs every 30 minutes
  // ────────────────────────────────────────────────────────────────────
  const leaveExpiryTask = cron.schedule(
    '*/30 * * * *',
    async () => {
      console.log('[Scheduler] ⏰ Triggering leave expiry check');
      try {
        if (isQueueAvailable()) {
          await addLeaveExpiryJob();
        } else {
          await LeaveAutomationService.checkExpiredLeaves();
        }
      } catch (err) {
        console.error('[Scheduler] Leave expiry check failed:', err.message);
      }
    },
    { timezone: 'Asia/Kolkata' }
  );
  scheduledTasks.push(leaveExpiryTask);

  // ────────────────────────────────────────────────────────────────────
  // 4. 24-HOUR OUTSIDE SCAN — runs at 6:00 AM IST every day
  //    Finds students who never returned after checking out (>24h ago)
  // ────────────────────────────────────────────────────────────────────
  const neverReturnedTask = cron.schedule(
    '0 6 * * *',
    async () => {
      console.log('[Scheduler] ⏰ Running 24h outside scan (06:00)');
      try {
        const hostels = await Hostel.find({ status: 'active' }).select('_id').lean();
        for (const hostel of hostels) {
          await CheckInAutomationService.detectNeverCheckedBackIn(String(hostel._id));
        }
      } catch (err) {
        console.error('[Scheduler] 24h outside scan failed:', err.message);
      }
    },
    { timezone: 'Asia/Kolkata' }
  );
  scheduledTasks.push(neverReturnedTask);

  console.log(`[Scheduler] ✅ ${scheduledTasks.length} cron job(s) scheduled`);
  console.log('[Scheduler] Schedule: Curfew=21:00 IST, Attendance=08:00 IST, Leave=*/30min, Outside=06:00 IST');
}

/**
 * Stop all scheduled cron tasks.
 * Call on graceful shutdown (SIGTERM handler in server.js).
 */
function stopScheduler() {
  for (const task of scheduledTasks) {
    task.stop();
  }
  scheduledTasks.length = 0;
  console.log('[Scheduler] All cron tasks stopped');
}

/**
 * Manually trigger the curfew check for a specific hostel.
 * Useful for testing and manual overrides from admin panel.
 *
 * @param {string} hostelId
 * @returns {Promise<Object>}
 */
async function triggerCurfewCheckNow(hostelId) {
  console.log(`[Scheduler] Manual curfew check triggered for hostel ${hostelId}`);
  return CurfewAutomationService.runCurfewCheckForHostel(hostelId);
}

/**
 * Manually trigger the leave expiry check.
 *
 * @returns {Promise<Object>}
 */
async function triggerLeaveExpiryNow() {
  console.log('[Scheduler] Manual leave expiry check triggered');
  return LeaveAutomationService.checkExpiredLeaves();
}

module.exports = {
  startScheduler,
  stopScheduler,
  triggerCurfewCheckNow,
  triggerLeaveExpiryNow,
};
