// services/timezoneService.js
/**
 * Centralized Timezone & Business Date Service
 * 
 * Guarantees consistent business-day calculation regardless of host server timezone
 * (e.g. AWS UTC cloud instance vs developer machine).
 */

const DEFAULT_TIMEZONE = 'Asia/Kolkata';

/**
 * Format a date as YYYY-MM-DD in the given timezone.
 * @param {Date|string|number} date
 * @param {string} timezone - IANA timezone (default: 'Asia/Kolkata')
 * @returns {string} e.g. "2026-09-07"
 */
function getBusinessDateString(date = new Date(), timezone = DEFAULT_TIMEZONE) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) {
    throw new Error('Invalid date passed to getBusinessDateString');
  }

  const tz = timezone || DEFAULT_TIMEZONE;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(d);
}

/**
 * Get the normalized business Date object at UTC midnight for a given date and timezone.
 * Consistent across all servers.
 * Example: For 2026-09-07 in Asia/Kolkata, returns Date(2026-09-07T00:00:00.000Z).
 * 
 * @param {Date|string|number} date
 * @param {string} timezone
 * @returns {Date}
 */
function getBusinessDate(date = new Date(), timezone = DEFAULT_TIMEZONE) {
  const dateStr = getBusinessDateString(date, timezone);
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/**
 * Get the exact UTC start and end Date for a given business day in the specified timezone.
 * For Asia/Kolkata (+05:30) on 2026-09-07:
 * Start: 2026-09-06T18:30:00.000Z (00:00:00 IST)
 * End:   2026-09-07T18:29:59.999Z (23:59:59.999 IST)
 * 
 * @param {Date|string|number} date
 * @param {string} timezone
 * @returns {{ start: Date, end: Date, dateStr: string }}
 */
function getBusinessDayRange(date = new Date(), timezone = DEFAULT_TIMEZONE) {
  const tz = timezone || DEFAULT_TIMEZONE;
  const dateStr = getBusinessDateString(date, tz);
  const [year, month, day] = dateStr.split('-').map(Number);

  // Determine timezone offset for the target day
  // Create an approximate UTC instant for noon of that day
  const approxUtc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  
  // Format approx instant in target timezone to find offset
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(approxUtc);

  const partMap = {};
  for (const p of parts) partMap[p.type] = p.value;

  const targetDateInTz = new Date(
    Date.UTC(
      Number(partMap.year),
      Number(partMap.month) - 1,
      Number(partMap.day),
      Number(partMap.hour),
      Number(partMap.minute),
      Number(partMap.second)
    )
  );

  const offsetMs = targetDateInTz.getTime() - approxUtc.getTime();

  // 00:00:00.000 in target timezone converted to UTC
  const startUtcMs = Date.UTC(year, month - 1, day, 0, 0, 0, 0) - offsetMs;
  const start = new Date(startUtcMs);
  const end = new Date(startUtcMs + 24 * 60 * 60 * 1000 - 1);

  return { start, end, dateStr };
}

/**
 * Format date for user display in hostel timezone.
 * @param {Date|string|number} date
 * @param {string} timezone
 * @param {Object} options
 * @returns {string}
 */
function formatInHostelTimezone(date, timezone = DEFAULT_TIMEZONE, options = {}) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: timezone || DEFAULT_TIMEZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
    ...options,
  }).format(d);
}

module.exports = {
  DEFAULT_TIMEZONE,
  getBusinessDateString,
  getBusinessDate,
  getBusinessDayRange,
  formatInHostelTimezone,
};
