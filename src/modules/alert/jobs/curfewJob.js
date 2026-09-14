/**
 * @file curfewJob.js
 * @description BullMQ worker that processes curfew-check jobs.
 *
 * WHY A SEPARATE WORKER FILE:
 * Keeping worker logic separate from the queue setup follows the separation
 * of concerns principle. The worker can be extracted to a separate process
 * for horizontal scaling without changing the queue setup.
 *
 * WORKER CONCURRENCY:
 * Set to 2 — process up to 2 hostel curfew checks simultaneously.
 * Higher concurrency could cause DB contention; lower is safer.
 *
 * INITIALIZATION:
 * startCurfewWorker() is called from cronScheduler.js if Redis is available.
 */

'use strict';

const { JOB_NAMES, QUEUE_NAMES } = require('../utils/constants');

let curfewWorker = null;

/**
 * Start the BullMQ worker for curfew check jobs.
 * Safe to call if Redis is unavailable (no-op).
 *
 * @returns {Object|null} BullMQ Worker instance
 */
function startCurfewWorker() {
  if (!process.env.REDIS_URL) return null;

  try {
    const { Worker } = require('bullmq');
    const IORedis = require('ioredis');
    const CurfewAutomationService = require('../services/CurfewAutomationService');

    const connection = new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    curfewWorker = new Worker(
      QUEUE_NAMES.CURFEW_CHECK,
      async (job) => {
        console.log(`[CurfewWorker] Processing job ${job.id}:`, job.data);

        const { hostelId } = job.data;

        if (hostelId) {
          // Single hostel check
          return await CurfewAutomationService.runCurfewCheckForHostel(hostelId);
        } else {
          // Global check — all hostels
          return await CurfewAutomationService.runGlobalDailyCheck();
        }
      },
      {
        connection,
        concurrency: 2,
      }
    );

    curfewWorker.on('completed', (job, result) => {
      console.log(`[CurfewWorker] Job ${job.id} completed:`, result);
    });

    curfewWorker.on('failed', (job, err) => {
      console.error(`[CurfewWorker] Job ${job?.id} failed:`, err.message);
    });

    curfewWorker.on('error', (err) => {
      console.error('[CurfewWorker] Worker error:', err.message);
    });

    console.log('[CurfewWorker] Curfew check worker started');
    return curfewWorker;
  } catch (err) {
    console.warn('[CurfewWorker] Could not start worker:', err.message);
    return null;
  }
}

module.exports = { startCurfewWorker };
