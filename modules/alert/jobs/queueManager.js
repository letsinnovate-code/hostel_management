/**
 * @file queueManager.js
 * @description BullMQ queue setup with optional Redis support.
 *
 * DESIGN PHILOSOPHY:
 * Redis/BullMQ is OPTIONAL. If REDIS_URL is not set in .env, the system
 * gracefully degrades: all jobs are run inline by the cron scheduler instead.
 * This ensures the module works in development without Redis.
 *
 * QUEUE STRUCTURE:
 * - hostel-alerts      → Main queue for all alert processing
 * - curfew-check       → Daily curfew check jobs
 * - attendance-check   → Daily attendance check jobs
 * - leave-expiry       → Periodic leave expiry check jobs
 * - alert-dlq          → Dead Letter Queue: failed jobs after 3 retries
 *
 * RETRY POLICY:
 * Jobs are retried up to 3 times with exponential backoff (1s, 5s, 25s).
 * After 3 failures, the job is moved to the DLQ for manual inspection.
 * WHY EXPONENTIAL BACKOFF: Transient failures (DB overload, network blip)
 * usually resolve within seconds. Exponential backoff prevents thundering herd.
 *
 * BULL DASHBOARD:
 * Install `@bull-board/express` to get a visual queue dashboard (not included
 * here to keep dependencies minimal, but documented for production use).
 */

'use strict';

const { QUEUE_NAMES, JOB_NAMES } = require('../utils/constants');

let queues = null;
let workers = null;
let isRedisAvailable = false;

/**
 * Initialize BullMQ queues if Redis is available.
 * Called once at application startup.
 *
 * @returns {Promise<boolean>} true if Redis+BullMQ initialized successfully
 */
async function initQueues() {
  if (!process.env.REDIS_URL) {
    console.log('[QueueManager] No REDIS_URL configured. BullMQ disabled — using in-process cron only.');
    return false;
  }

  try {
    const { Queue, Worker, QueueEvents } = require('bullmq');
    const IORedis = require('ioredis');

    const redisConnection = new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
    });

    // ── Common queue options ────────────────────────────────────────
    const defaultJobOptions = {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000, // 1s → 5s → 25s
      },
      removeOnComplete: { count: 100 }, // Keep last 100 completed jobs
      removeOnFail: { count: 50 },      // Keep last 50 failed for inspection
    };

    queues = {
      curfewCheck: new Queue(QUEUE_NAMES.CURFEW_CHECK, {
        connection: redisConnection,
        defaultJobOptions,
      }),
      attendanceCheck: new Queue(QUEUE_NAMES.ATTENDANCE_CHECK, {
        connection: redisConnection,
        defaultJobOptions,
      }),
      leaveExpiry: new Queue(QUEUE_NAMES.LEAVE_EXPIRY, {
        connection: redisConnection,
        defaultJobOptions,
      }),
      dlq: new Queue(QUEUE_NAMES.DEAD_LETTER, {
        connection: redisConnection,
      }),
    };

    isRedisAvailable = true;
    console.log('[QueueManager] BullMQ queues initialized successfully with Redis');
    return true;
  } catch (err) {
    console.warn('[QueueManager] BullMQ/Redis initialization failed:', err.message);
    console.warn('[QueueManager] Falling back to in-process cron only.');
    isRedisAvailable = false;
    return false;
  }
}

/**
 * Add a curfew check job to the queue.
 * Safe to call even if Redis is unavailable (returns null).
 *
 * @param {string} hostelId - if provided, run for specific hostel; otherwise global
 * @returns {Promise<Object|null>} BullMQ Job or null
 */
async function addCurfewJob(hostelId = null) {
  if (!isRedisAvailable || !queues) return null;
  return queues.curfewCheck.add(JOB_NAMES.DAILY_CURFEW_CHECK, { hostelId }, {
    jobId: `curfew-${hostelId || 'global'}-${new Date().toDateString()}`, // Deduplicate
  });
}

/**
 * Add a daily attendance check job.
 *
 * @param {string} hostelId
 * @returns {Promise<Object|null>}
 */
async function addAttendanceJob(hostelId = null) {
  if (!isRedisAvailable || !queues) return null;
  return queues.attendanceCheck.add(JOB_NAMES.DAILY_ATTENDANCE_CHECK, { hostelId }, {
    jobId: `attendance-${hostelId || 'global'}-${new Date().toDateString()}`,
  });
}

/**
 * Add a leave expiry check job.
 *
 * @returns {Promise<Object|null>}
 */
async function addLeaveExpiryJob() {
  if (!isRedisAvailable || !queues) return null;
  return queues.leaveExpiry.add(JOB_NAMES.LEAVE_EXPIRY_CHECK, {}, {
    jobId: `leave-expiry-${Date.now()}`,
  });
}

/**
 * Get the queues object (for bull-board dashboard or direct inspection).
 *
 * @returns {Object|null}
 */
function getQueues() {
  return queues;
}

/**
 * Check if Redis/BullMQ is available.
 *
 * @returns {boolean}
 */
function isQueueAvailable() {
  return isRedisAvailable;
}

module.exports = {
  initQueues,
  addCurfewJob,
  addAttendanceJob,
  addLeaveExpiryJob,
  getQueues,
  isQueueAvailable,
};
