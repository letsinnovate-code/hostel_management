/**
 * @file CurfewStudentStatus.js
 * @description Real-time presence and escalation tracking record for each student per curfew session.
 * Tracks outside status, grace deadlines, entry time for late comers, resolved violations, and alert dispatch keys.
 */

'use strict';

const mongoose = require('mongoose');

const curfewStudentStatusSchema = new mongoose.Schema(
  {
    curfewSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CurfewSession',
      required: true,
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hostel',
      required: true,
      index: true,
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
    },
    roomNumber: {
      type: String,
      default: 'N/A',
    },
    block: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: [
        'INSIDE',
        'OUTSIDE_GRACE',
        'LATE_COMER',
        'VIOLATION',
        'VIOLATION_RESOLVED',
        'LOCATION_UNAVAILABLE',
        'LOCATION_PERMISSION_DENIED',
        'LOCATION_STALE',
        'LOW_ACCURACY',
        'ON_LEAVE',
      ],
      default: 'INSIDE',
      index: true,
    },
    initialLocation: {
      latitude: Number,
      longitude: Number,
      accuracy: Number,
      timestamp: Date,
    },
    currentLocation: {
      latitude: Number,
      longitude: Number,
      accuracy: Number,
      timestamp: Date,
    },
    currentAccuracy: {
      type: Number,
    },
    lastLocationAt: {
      type: Date,
    },
    distanceFromHostel: {
      type: Number, // in meters
    },
    locationSource: {
      type: String,
      enum: ['mobile_background', 'web_browser', 'user_cached', 'gate_checkin', 'attendance', 'manual', 'none'],
      default: 'none',
    },
    outsideSince: {
      type: Date,
    },
    graceDeadline: {
      type: Date, // Curfew start + 15m
    },
    secondCountdownDeadline: {
      type: Date, // Curfew start + 30m
    },
    thirdCountdownDeadline: {
      type: Date, // Curfew start + 45m
    },
    studentAlertSentAt: {
      type: Date,
    },
    violationAt: {
      type: Date,
    },
    wardenAlertAt: {
      type: Date,
    },
    ownerAlertAt: {
      type: Date,
    },
    parentAlertAt: {
      type: Date,
    },
    returnedAt: {
      type: Date,
    },
    entryTime: {
      type: Date,
    },
    entryLocation: {
      latitude: Number,
      longitude: Number,
      accuracy: Number,
      distance: Number,
    },
    delayMinutes: {
      type: Number,
      default: 0,
    },
    totalTimeOutsideMinutes: {
      type: Number,
      default: 0,
    },
    resolutionStatus: {
      type: String,
      enum: ['NONE', 'RETURNED_GRACE', 'RETURNED_AFTER_VIOLATION', 'MANUAL_RESOLVED'],
      default: 'NONE',
    },
    resolutionNote: {
      type: String,
      default: '',
    },
    idempotentKeys: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

curfewStudentStatusSchema.index({ curfewSessionId: 1, studentId: 1 }, { unique: true });
curfewStudentStatusSchema.index({ hostelId: 1, status: 1 });

module.exports = mongoose.model('CurfewStudentStatus', curfewStudentStatusSchema);
