/**
 * @file CurfewSession.js
 * @description Persistent audit record of each curfew cycle/session.
 * Tracks session start, scheduled/manual execution, student monitoring counts,
 * and records of violations that occurred during the session.
 */

'use strict';

const mongoose = require('mongoose');

const curfewSessionSchema = new mongoose.Schema(
  {
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hostel',
      required: true,
      index: true,
    },
    configurationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CurfewConfiguration',
    },
    sessionDate: {
      type: Date,
      required: true,
      index: true,
    },
    scheduledStartAt: {
      type: Date,
    },
    actualStartAt: {
      type: Date,
    },
    scheduledEndAt: {
      type: Date,
    },
    actualEndAt: {
      type: Date,
    },
    sessionType: {
      type: String,
      enum: ['scheduled', 'manual'],
      default: 'scheduled',
    },
    triggerType: {
      type: String,
      enum: ['AUTOMATIC', 'MANUAL', 'SCHEDULED'],
      default: 'AUTOMATIC',
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata',
    },
    curfewStartTime: {
      type: String,
      default: '21:00',
    },
    curfewEndTime: {
      type: String,
      default: '06:00',
    },
    startTime: {
      type: Date,
      default: Date.now,
    },
    endTime: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['SCHEDULED', 'ACTIVE', 'ENDED', 'CANCELLED', 'INACTIVE', 'active', 'completed', 'ended_by_warden', 'cancelled'],
      default: 'SCHEDULED',
      index: true,
    },
    startedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    endedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    summary: {
      totalStudents: { type: Number, default: 0 },
      presentCount: { type: Number, default: 0 },
      outsideCount: { type: Number, default: 0 },
      lateComersCount: { type: Number, default: 0 },
      onLeaveCount: { type: Number, default: 0 },
      violationsCount: { type: Number, default: 0 },
      resolvedCount: { type: Number, default: 0 },
      parentAlertsCount: { type: Number, default: 0 },
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

curfewSessionSchema.index({ hostelId: 1, sessionDate: -1 });
curfewSessionSchema.index({ hostelId: 1, status: 1 });
curfewSessionSchema.index({ scheduledStartAt: 1, status: 1 });

module.exports = mongoose.model('CurfewSession', curfewSessionSchema);
