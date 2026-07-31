const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
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
  status: {
    type: String,
    enum: ['inside', 'outside', 'pending'],
    required: true,
  },
  checkInTime: Date,
  checkOutTime: Date,
  location: {
    latitude: Number,
    longitude: Number,
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  verificationMethod: {
    type: String,
    enum: ['auto', 'manual', 'rfid', 'qr'],
    default: 'auto',
  },
  date: {
    type: Date,
    default: Date.now,
  },
  /** Cumulative minutes inside the hostel for this day (updated on each check-out). */
  totalMinutesInside: {
    type: Number,
    default: 0,
  },
});

// Indexes for fast check-in/check-out, cooldown, and analytics queries
attendanceSchema.index({ studentId: 1, date: -1 });
attendanceSchema.index({ studentId: 1, checkOutTime: -1 });
attendanceSchema.index({ studentId: 1, checkInTime: -1 });

module.exports = mongoose.model('Attendance', attendanceSchema);

