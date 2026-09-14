/**
 * @file attendanceJob.js
 * @description BullMQ worker for daily attendance check jobs.
 */

'use strict';

const { QUEUE_NAMES } = require('../utils/constants');

function startAttendanceWorker() {
  if (!process.env.REDIS_URL) return null;

  try {
    const { Worker } = require('bullmq');
    const IORedis = require('ioredis');
    const AttendanceAutomationService = require('../services/AttendanceAutomationService');

    const connection = new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    const worker = new Worker(
      QUEUE_NAMES.ATTENDANCE_CHECK,
      async (job) => {
        console.log(`[AttendanceWorker] Processing job ${job.id}`);
        const { hostelId } = job.data;
        if (hostelId) {
          return await AttendanceAutomationService.runAttendanceCheckForHostel(hostelId);
        } else {
          return await AttendanceAutomationService.runGlobalDailyCheck();
        }
      },
      { connection, concurrency: 2 }
    );

    worker.on('completed', (job, result) =>
      console.log(`[AttendanceWorker] Job ${job.id} completed:`, result)
    );
    worker.on('failed', (job, err) =>
      console.error(`[AttendanceWorker] Job ${job?.id} failed:`, err.message)
    );

    console.log('[AttendanceWorker] Attendance check worker started');
    return worker;
  } catch (err) {
    console.warn('[AttendanceWorker] Could not start worker:', err.message);
    return null;
  }
}

module.exports = { startAttendanceWorker };
