/**
 * @file CurfewConfiguration.js
 * @description Curfew configuration model for managing scheduled, one-time, and recurring curfews.
 * Provides warden/owner with flexible scheduling (any start date/time, end date/time, overnight spans,
 * recurrence patterns, and configurable grace/escalation periods).
 */

'use strict';

const mongoose = require('mongoose');

const curfewConfigurationSchema = new mongoose.Schema(
  {
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hostel',
      required: true,
      index: true,
    },
    startDate: {
      type: String, // 'YYYY-MM-DD'
      required: true,
    },
    startTime: {
      type: String, // 'HH:mm'
      required: true,
    },
    endDate: {
      type: String, // 'YYYY-MM-DD'
      required: true,
    },
    endTime: {
      type: String, // 'HH:mm'
      required: true,
    },
    durationMinutes: {
      type: Number,
      required: true,
      min: 1,
    },
    durationDisplay: {
      type: String, // e.g. "1 hour", "2 hours", "9 hours"
      default: '1 hour',
    },
    recurrence: {
      type: {
        type: String,
        enum: ['one_time', 'daily', 'selected_days', 'weekly', 'monthly', 'custom'],
        default: 'one_time',
      },
      selectedDays: {
        type: [String], // ['monday', 'tuesday', ...] or ['0', '1', ...]
        default: [],
      },
    },
    gracePeriodMinutes: {
      type: Number,
      default: 15,
      min: 1,
    },
    escalationPeriodMinutes: {
      type: Number,
      default: 15,
      min: 1,
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'scheduled', 'ended', 'cancelled'],
      default: 'scheduled',
      index: true,
    },
    configuredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    history: [
      {
        action: { type: String }, // 'CREATED', 'UPDATED', 'RESET', 'CANCELLED'
        actionBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        timestamp: { type: Date, default: Date.now },
        previousConfig: { type: mongoose.Schema.Types.Mixed },
        note: { type: String },
      },
    ],
  },
  {
    timestamps: true,
  }
);

curfewConfigurationSchema.index({ hostelId: 1, isActive: 1 });

module.exports = mongoose.model('CurfewConfiguration', curfewConfigurationSchema);
