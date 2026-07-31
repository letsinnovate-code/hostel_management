const mongoose = require('mongoose');

/**
 * One document per check-in or check-out. Full history of gate events;
 * Attendance model keeps current session state and totalMinutesInside.
 */
const gateEventSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  hostelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel',
    required: true,
  },
  type: {
    type: String,
    enum: ['in', 'out'],
    required: true,
  },
  time: {
    type: Date,
    default: Date.now,
    required: true,
  },
  location: {
    latitude: Number,
    longitude: Number,
  },
  verificationMethod: {
    type: String,
    enum: ['auto', 'manual', 'rfid', 'qr'],
    default: 'auto',
  },
  /** Optional link to the Attendance session this event belongs to */
  attendanceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Attendance',
  },
  /** Who triggered: student (app), warden, security, or auto (location update) */
  source: {
    type: String,
    enum: ['student', 'warden', 'security', 'auto'],
    default: 'student',
  },
});

gateEventSchema.index({ hostelId: 1, time: -1 });
gateEventSchema.index({ studentId: 1, time: -1 });
gateEventSchema.index({ hostelId: 1, studentId: 1, time: -1 });

module.exports = mongoose.model('GateEvent', gateEventSchema);
