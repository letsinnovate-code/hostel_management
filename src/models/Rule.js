const mongoose = require('mongoose');

const ruleSchema = new mongoose.Schema({
  hostelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel',
    required: true,
  },
  ruleType: {
    type: String,
    enum: ['curfew', 'fine', 'late-entry', 'visitor', 'leave', 'discipline', 'general'],
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: String,
  // Curfew Configuration
  curfewConfig: {
    weekday: String, // HH:mm
    weekend: String, // HH:mm
    specialDays: [{
      date: Date,
      time: String,
      reason: String,
    }],
  },
  // Late Entry Rules
  lateEntryConfig: {
    allowedTimes: [String], // ['22:00', '23:00']
    fineAmount: Number,
    maxViolations: Number,
    escalationAfter: Number, // violations before escalation
  },
  // Leave Policies
  leaveConfig: {
    maxLeaveDays: Number,
    maxConsecutiveDays: Number,
    requireParentApproval: { type: Boolean, default: false },
    autoExpiry: { type: Boolean, default: true },
    expiryDays: Number,
  },
  // Discipline Matrix
  disciplineMatrix: {
    violationType: String,
    actions: [{
      level: Number, // 1, 2, 3, etc.
      action: { type: String, enum: ['warning', 'fine', 'suspension', 'expulsion'] },
      fineAmount: Number,
      suspensionDays: Number,
    }],
  },
  fineAmount: Number, // General fine amount
  violationCount: {
    type: Number,
    default: 0,
  },
  escalationLevel: {
    type: String,
    enum: ['warning', 'warden', 'owner', 'parent'],
    default: 'warning',
  },
  version: {
    type: Number,
    default: 1,
  },
  previousVersions: [mongoose.Schema.Types.Mixed],
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Rule', ruleSchema);

