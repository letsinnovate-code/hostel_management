const mongoose = require('mongoose');

const violationSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  ruleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Rule',
  },
  violationType: {
    type: String,
    enum: ['curfew', 'late-entry', 'unauthorized-visitor', 'noise', 'damage', 'improper-checkout', 'other'],
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  fineAmount: Number,
  warningLevel: {
    type: String,
    enum: ['warning', 'first', 'second', 'final'],
    default: 'warning',
  },
  status: {
    type: String,
    enum: ['pending', 'resolved', 'escalated'],
    default: 'pending',
  },
  escalatedTo: {
    type: String,
    enum: ['warden', 'owner', 'parent'],
  },
  resolvedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Violation', violationSchema);

