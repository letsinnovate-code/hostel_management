const mongoose = require('mongoose');

const emergencySchema = new mongoose.Schema({
  raisedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  emergencyType: {
    type: String,
    enum: ['sos', 'medical', 'fire', 'security', 'other'],
    required: true,
  },
  location: {
    latitude: Number,
    longitude: Number,
    address: String,
  },
  description: String,
  status: {
    type: String,
    enum: ['active', 'acknowledged', 'resolved'],
    default: 'active',
  },
  acknowledgedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  acknowledgedAt: Date,
  resolvedAt: Date,
  resolutionNotes: String,
  parentNotified: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Emergency', emergencySchema);

