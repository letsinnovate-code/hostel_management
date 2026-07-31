const mongoose = require('mongoose');

const geoFenceSchema = new mongoose.Schema({
  hostelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel',
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  // 'circle' | 'rectangle' | 'polygon' (quadrilateral = 4 points)
  type: {
    type: String,
    enum: ['circle', 'rectangle', 'polygon'],
    default: 'circle',
  },
  center: {
    latitude: { type: Number },
    longitude: { type: Number },
  },
  radius: {
    type: Number, // in meters (used when type === 'circle')
  },
  // Bounds for rectangle (degrees). Used when type === 'rectangle'.
  bounds: {
    north: { type: Number },
    south: { type: Number },
    east: { type: Number },
    west: { type: Number },
  },
  // Polygon (quadrilateral or any shape). Used when type === 'polygon'. Array of { latitude, longitude }.
  polygon: [{
    latitude: { type: Number },
    longitude: { type: Number },
  }],
  activeTimeWindow: {
    start: String, // HH:mm
    end: String, // HH:mm
    days: [String], // ['Monday', 'Tuesday', ...]
  },
  graceTime: {
    type: Number,
    default: 15, // minutes
  },
  recheckInterval: {
    type: Number,
    default: 5, // minutes
  },
  escalationLogic: {
    enabled: { type: Boolean, default: true },
    levels: [{
      violationCount: Number,
      action: { type: String, enum: ['warning', 'fine', 'notify_parent', 'suspend'] },
    }],
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('GeoFence', geoFenceSchema);

