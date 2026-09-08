/**
 * @file CurfewSession.js
 * @description Persistent historical audit record of each curfew cycle/session.
 * Tracks session start, scheduled/manual termination, student attendance summary,
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
    sessionDate: {
      type: Date,
      required: true,
      index: true,
    },
    sessionType: {
      type: String,
      enum: ['scheduled', 'manual'],
      default: 'scheduled',
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
      enum: ['active', 'completed', 'ended_by_warden', 'cancelled'],
      default: 'active',
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
      onLeaveCount: { type: Number, default: 0 },
      violationsCount: { type: Number, default: 0 },
      resolvedCount: { type: Number, default: 0 },
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

module.exports = mongoose.model('CurfewSession', curfewSessionSchema);
