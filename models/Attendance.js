const mongoose = require('mongoose');
const { getBusinessDate, getBusinessDateString } = require('../services/timezoneService');

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
    enum: ['inside', 'outside', 'pending', 'on-leave'],
    required: true,
  },
  checkInTime: Date,
  checkOutTime: Date,
  location: {
    latitude: Number,
    longitude: Number,
  },
  // Forensics & Telemetry fields
  accuracy: Number,
  distanceFromHostel: Number,
  capturedAt: Date,
  serverReceivedAt: {
    type: Date,
    default: Date.now,
  },
  clientIp: String,
  userAgent: String,
  source: {
    type: String,
    enum: ['web', 'mobile', 'background', 'warden', 'security', 'auto'],
    default: 'web',
  },
  verificationStatus: {
    type: String,
    enum: ['verified', 'unverified', 'stale_location', 'outside_buffer'],
    default: 'verified',
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  verificationMethod: {
    type: String,
    enum: ['auto', 'manual', 'rfid', 'qr', 'curfew_geofence', 'manual_curfew'],
    default: 'auto',
  },
  // Normalized business date: UTC midnight of the business day
  date: {
    type: Date,
    required: true,
    default: () => getBusinessDate(),
  },
  businessDate: {
    type: String,
    default: () => getBusinessDateString(),
  },
  /** Cumulative minutes inside the hostel for this day (updated on each check-out). */
  totalMinutesInside: {
    type: Number,
    default: 0,
  },
});

// Database-level constraint: exactly one attendance document per student per business day
attendanceSchema.index({ studentId: 1, date: 1 }, { unique: true });

// Indexes for fast check-in/check-out, cooldown, and analytics queries
attendanceSchema.index({ studentId: 1, date: -1 });
attendanceSchema.index({ studentId: 1, checkOutTime: -1 });
attendanceSchema.index({ studentId: 1, checkInTime: -1 });
attendanceSchema.index({ hostelId: 1, date: -1 });
attendanceSchema.index({ hostelId: 1, status: 1 });
attendanceSchema.index({ studentId: 1, businessDate: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);


