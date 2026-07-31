const GateEvent = require('../models/GateEvent');

/** Same student + same type within this window are treated as duplicate (ms). */
const DEDUPE_WINDOW_MS = 60 * 1000;

/**
 * Append one check-in or check-out to the gate event log.
 * Skips insert if the same student already has the same event type within DEDUPE_WINDOW_MS (avoids duplicate IN/OUT from double-tap or race).
 * @param {Object} opts
 * @param {string} opts.studentId - User _id
 * @param {string} opts.hostelId - Hostel _id
 * @param {'in'|'out'} opts.type - 'in' or 'out'
 * @param {Date} [opts.time] - Defaults to new Date()
 * @param {{ latitude: number, longitude: number }} [opts.location]
 * @param {string} [opts.verificationMethod] - 'auto'|'manual'|'rfid'|'qr'
 * @param {string} [opts.attendanceId] - Optional Attendance _id
 * @param {string} [opts.source] - 'student'|'warden'|'security'|'auto'
 */
async function logGateEvent(opts) {
  const {
    studentId,
    hostelId,
    type,
    time = new Date(),
    location,
    verificationMethod = 'auto',
    attendanceId,
    source = 'student',
  } = opts;
  if (!studentId || !hostelId || !type) return;

  const t = time instanceof Date ? time : new Date(time);
  const windowStart = new Date(t.getTime() - DEDUPE_WINDOW_MS);

  const existing = await GateEvent.findOne({
    studentId,
    hostelId,
    type,
    time: { $gte: windowStart, $lte: new Date(t.getTime() + 1000) },
  }).lean();

  if (existing) return;

  await GateEvent.create({
    studentId,
    hostelId,
    type,
    time: t,
    location: location && (location.latitude != null && location.longitude != null) ? location : undefined,
    verificationMethod: ['auto', 'manual', 'rfid', 'qr'].includes(verificationMethod) ? verificationMethod : 'auto',
    attendanceId: attendanceId || undefined,
    source: ['student', 'warden', 'security', 'auto'].includes(source) ? source : 'student',
  });
}

module.exports = { logGateEvent };
