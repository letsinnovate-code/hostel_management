/**
 * @file leaveExpiryJob.js
 * @description BullMQ worker for periodic leave expiry check jobs.
 */

'use strict';

const { QUEUE_NAMES } = require('../utils/constants');

function startLeaveExpiryWorker() {
  if (!process.env.REDIS_URL) return null;

  try {
    const { Worker } = require('bullmq');
    const IORedis = require('ioredis');
    const LeaveAutomationService = require('../services/LeaveAutomationService');

    const connection = new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    const worker = new Worker(
      QUEUE_NAMES.LEAVE_EXPIRY,
      async (job) => {
        console.log(`[LeaveExpiryWorker] Processing job ${job.id}`);
        return await LeaveAutomationService.checkExpiredLeaves();
      },
      { connection, concurrency: 1 }
    );

    worker.on('completed', (job, result) =>
      console.log(`[LeaveExpiryWorker] Job ${job.id} completed:`, result)
    );
    worker.on('failed', (job, err) =>
      console.error(`[LeaveExpiryWorker] Job ${job?.id} failed:`, err.message)
    );

    console.log('[LeaveExpiryWorker] Leave expiry worker started');
    return worker;
  } catch (err) {
    console.warn('[LeaveExpiryWorker] Could not start worker:', err.message);
    return null;
  }
}

module.exports = { startLeaveExpiryWorker };
