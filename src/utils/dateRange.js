/**
 * @file dateRange.js
 * @description Reusable date range helpers for day-boundary queries.
 *
 * Eliminates the repeated pattern of:
 *   const todayStart = new Date(); todayStart.setHours(0,0,0,0);
 *   const todayEnd = new Date(todayStart); todayEnd.setDate(todayEnd.getDate() + 1);
 */

'use strict';

/**
 * Get the start and end Date objects for "today" (local server time).
 * start = 00:00:00.000 today
 * end   = 00:00:00.000 tomorrow (exclusive upper bound for $lt queries)
 *
 * @returns {{ start: Date, end: Date }}
 */
function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

/**
 * Get start and end Date objects for a specific date.
 *
 * @param {Date|string} date - The target date
 * @returns {{ start: Date, end: Date }}
 */
function getDateRange(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

module.exports = { getTodayRange, getDateRange };
