
'use strict';

const User = require('../../../models/User');
const { ALERT_TYPE_TO_CATEGORY, ALERT_TYPE_PRIORITY, ALERT_PRIORITY } = require('./constants');

// ─────────────────────────────────────────────
// TIME HELPERS
// ─────────────────────────────────────────────

/**
 * Convert a HH:mm string (24-hour) to a Date object for today's date.
 * WHY: The curfew time is stored as a string like "21:00" in Hostel.rules.curfewTime.
 * We need a Date object to compare against current time or schedule cron jobs.
 *
 * @param {string} timeStr - e.g. "21:00"
 * @param {Date} [referenceDate] - defaults to now (today)
 * @returns {Date}
 */
function timeStrToDate(timeStr, referenceDate = new Date()) {
  const [hours, minutes] = (timeStr || '21:00').split(':').map(Number);
  const d = new Date(referenceDate);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

/**
 * Parse HH:mm string into { hour, minute } object.
 * Used by node-cron to build cron expressions dynamically.
 *
 * @param {string} timeStr - e.g. "21:00"
 * @returns {{ hour: number, minute: number }}
 */
function parseTimeStr(timeStr) {
  const [hour, minute] = (timeStr || '21:00').split(':').map(Number);
  return { hour: isNaN(hour) ? 21 : hour, minute: isNaN(minute) ? 0 : minute };
}

/**
 * Format a duration in minutes to a human-readable string.
 * e.g. 75 → "1 hour 15 minutes"
 *
 * @param {number} minutes
 * @returns {string}
 */
function formatDuration(minutes) {
  if (!minutes || minutes < 1) return 'less than a minute';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const parts = [];
  if (h > 0) parts.push(`${h} hour${h !== 1 ? 's' : ''}`);
  if (m > 0) parts.push(`${m} minute${m !== 1 ? 's' : ''}`);
  return parts.join(' ');
}

/**
 * Format a Date to a locale-friendly IST time string.
 * e.g. "09:35 PM"
 *
 * @param {Date|string} date
 * @returns {string}
 */
function formatTime(date) {
  if (!date) return 'N/A';
  return new Date(date).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
}

/**
 * Format a Date to a locale-friendly IST date-time string.
 *
 * @param {Date|string} date
 * @returns {string}
 */
function formatDateTime(date) {
  if (!date) return 'N/A';
  return new Date(date).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

/**
 * Calculate minutes elapsed since a given Date.
 *
 * @param {Date|string} date
 * @returns {number}
 */
function minutesSince(date) {
  return Math.floor((Date.now() - new Date(date).getTime()) / 60000);
}

// ─────────────────────────────────────────────
// ROLE & USER HELPERS
// ─────────────────────────────────────────────

/**
 * Find all users in a hostel with a given role.
 * WHY: Alerts often need to be sent to "all wardens of hostel X" —
 * this centralises that DB query to avoid N+1 issues.
 *
 * @param {string} hostelId - MongoDB ObjectId string
 * @param {string|string[]} roles - role string or array
 * @returns {Promise<Array>} lean user documents
 */
async function getUsersByRoleInHostel(hostelId, roles) {
  const roleArray = Array.isArray(roles) ? roles : [roles];
  return User.find({
    hostelId,
    role: { $in: roleArray },
    status: 'active',
  })
    .select('_id name email pushToken expoPushToken')
    .lean();
}

/**
 * Find all superadmin users (hostel-agnostic, system-wide).
 *
 * @returns {Promise<Array>} lean user documents
 */
async function getSuperAdmins() {
  return User.find({ role: 'superadmin', status: 'active' })
    .select('_id name email pushToken expoPushToken')
    .lean();
}

/**
 * Extract user IDs from a list of user documents.
 *
 * @param {Array} users
 * @returns {string[]}
 */
function extractUserIds(users) {
  return users.map((u) => String(u._id));
}

// ─────────────────────────────────────────────
// ALERT HELPERS
// ─────────────────────────────────────────────

/**
 * Resolve the category for an alert type automatically.
 * Falls back to 'hostel_operations' if not mapped.
 *
 * @param {string} type - ALERT_TYPES constant
 * @returns {string}
 */
function resolveCategoryForType(type) {
  return ALERT_TYPE_TO_CATEGORY[type] || 'hostel_operations';
}

/**
 * Resolve the default priority for an alert type.
 * Falls back to 'medium' if not mapped.
 *
 * @param {string} type - ALERT_TYPES constant
 * @returns {string}
 */
function resolvePriorityForType(type) {
  return ALERT_TYPE_PRIORITY[type] || ALERT_PRIORITY.MEDIUM;
}

/**
 * Build a safe, consistent metadata object for alert records.
 * Strips undefined values and ensures string coercion for ObjectIds.
 *
 * @param {Object} meta - raw metadata
 * @returns {Object}
 */
function sanitizeMetadata(meta = {}) {
  const safe = {};
  for (const [key, value] of Object.entries(meta)) {
    if (value === undefined || value === null) continue;
    // Convert Mongoose ObjectIds to strings for JSON serialization
    safe[key] = value && typeof value.toString === 'function' ? value.toString() : value;
  }
  return safe;
}

/**
 * Build a standard curfew violation message string.
 *
 * @param {Object} opts
 * @param {string} opts.studentName
 * @param {string} opts.roomNumber
 * @param {string} opts.lastCheckOutTime
 * @param {string} opts.curfewTime
 * @param {number} opts.minutesMissing
 * @returns {string}
 */
function buildCurfewMessage({ studentName, roomNumber, lastCheckOutTime, curfewTime, minutesMissing }) {
  return (
    `${studentName} (Room ${roomNumber || 'N/A'}) has not returned before curfew (${curfewTime}). ` +
    `Last check-out: ${formatTime(lastCheckOutTime)}. ` +
    `Missing for: ${formatDuration(minutesMissing)}.`
  );
}

/**
 * Build a standard leave overdue message string.
 *
 * @param {Object} opts
 * @param {string} opts.studentName
 * @param {string} opts.roomNumber
 * @param {Date} opts.leaveEndTime
 * @param {number} opts.hoursOverdue
 * @returns {string}
 */
function buildLeaveOverdueMessage({ studentName, roomNumber, leaveEndTime, hoursOverdue }) {
  return (
    `${studentName} (Room ${roomNumber || 'N/A'}) has not returned after approved leave ended at ` +
    `${formatDateTime(leaveEndTime)}. Overdue by ${Math.round(hoursOverdue)} hour(s).`
  );
}

/**
 * Check if the current time is past a given curfew time string (HH:mm).
 *
 * @param {string} curfewTimeStr - e.g. "21:00"
 * @param {number} [gracePeriodMinutes=0]
 * @returns {boolean}
 */
function isPastCurfew(curfewTimeStr, gracePeriodMinutes = 0) {
  const now = new Date();
  const curfew = timeStrToDate(curfewTimeStr, now);
  curfew.setMinutes(curfew.getMinutes() + gracePeriodMinutes);
  return now >= curfew;
}

// ─────────────────────────────────────────────
// PAGINATION HELPER
// ─────────────────────────────────────────────

/**
 * Parse and validate pagination query params.
 * WHY: Consistent pagination across all alert listing endpoints.
 *
 * @param {Object} query - req.query
 * @returns {{ page: number, limit: number, skip: number }}
 */
function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

/**
 * Build a standard paginated response object.
 *
 * @param {Object} opts
 * @param {Array} opts.data
 * @param {number} opts.total
 * @param {number} opts.page
 * @param {number} opts.limit
 * @returns {Object}
 */
function buildPaginatedResponse({ data, total, page, limit }) {
  return {
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  };
}

module.exports = {
  timeStrToDate,
  parseTimeStr,
  formatDuration,
  formatTime,
  formatDateTime,
  minutesSince,
  getUsersByRoleInHostel,
  getSuperAdmins,
  extractUserIds,
  resolveCategoryForType,
  resolvePriorityForType,
  sanitizeMetadata,
  buildCurfewMessage,
  buildLeaveOverdueMessage,
  isPastCurfew,
  parsePagination,
  buildPaginatedResponse,
};
