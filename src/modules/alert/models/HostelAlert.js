/**
 * @file HostelAlert.js
 * @description The core alert/notification document for the Hostel Alert Module.
 *
 * WHY THIS MODEL EXISTS (not reusing existing Notification model):
 * The existing Notification model is designed for broadcast announcements
 * (type: announcement/alert/reminder/emergency, audience: all/students/staff).
 * The HostelAlert model is designed for granular, event-driven automation alerts
 * with rich metadata, per-recipient tracking, resolution workflow, and
 * role-based routing. They serve different purposes and must coexist.
 *
 * INDEXES:
 * Optimized for the most common queries:
 * 1. Student fetching their own alerts (recipientIds + status + createdAt)
 * 2. Warden fetching hostel alerts (hostelId + type + createdAt)
 * 3. Dashboard stats aggregation (hostelId + category + createdAt)
 * 4. Unread count query (recipientIds + status)
 */

'use strict';

const mongoose = require('mongoose');
const { ALERT_TYPES, ALERT_CATEGORIES, ALERT_PRIORITY, ALERT_STATUS } = require('../utils/constants');

const hostelAlertSchema = new mongoose.Schema(
  {
    // ─── What kind of alert ───────────────────────────────────────────
    type: {
      type: String,
      enum: Object.values(ALERT_TYPES),
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: Object.values(ALERT_CATEGORIES),
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: true,
      maxlength: 2000,
    },

    // ─── Who this alert is for ────────────────────────────────────────
    recipientRole: {
      type: String,
      enum: ['student', 'warden', 'owner', 'security', 'superadmin', 'supervisor', 'all'],
    },
    // Specific user IDs this alert is addressed to.
    // WHY array: one alert can be sent to multiple wardens of the same hostel.
    recipientIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    // ─── Context ──────────────────────────────────────────────────────
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hostel',
      index: true,
    },
    // studentId: the student this alert is ABOUT (not necessarily the recipient)
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },

    // ─── Flexible payload ─────────────────────────────────────────────
    // WHY Mixed type: each alert type carries different extra data
    // (roomNumber for curfew, permissionId for leave, etc.).
    // Using Mixed avoids schema explosion while keeping data queryable.
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // ─── Priority & Lifecycle ─────────────────────────────────────────
    priority: {
      type: String,
      enum: Object.values(ALERT_PRIORITY),
      default: ALERT_PRIORITY.MEDIUM,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(ALERT_STATUS),
      default: ALERT_STATUS.UNREAD,
      index: true,
    },

    // ─── Per-recipient read tracking ──────────────────────────────────
    // WHY array vs boolean: alerts go to multiple recipients; each person
    // has their own read state. A plain isRead boolean would be wrong.
    isRead: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // ─── Resolution workflow ──────────────────────────────────────────
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    resolvedAt: Date,
    resolutionNote: {
      type: String,
      maxlength: 1000,
    },

    // ─── Delivery channels used ───────────────────────────────────────
    channels: {
      inApp: { type: Boolean, default: true },
      push: { type: Boolean, default: false },
      socket: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
    },

    // ─── System tracking ─────────────────────────────────────────────
    // Who or what triggered this alert: 'system' (automation), 'user' (manual)
    triggeredBy: {
      type: String,
      enum: ['system', 'user'],
      default: 'system',
    },
    triggeredByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// ─────────────────────────────────────────────
// COMPOUND INDEXES
// Designed for the most frequent query patterns.
// ─────────────────────────────────────────────

// Most common: student fetching own unread alerts
hostelAlertSchema.index({ recipientIds: 1, status: 1, createdAt: -1 });

// Warden dashboard: hostel alerts by category and date
hostelAlertSchema.index({ hostelId: 1, category: 1, createdAt: -1 });

// Curfew/attendance alert history for a student
hostelAlertSchema.index({ studentId: 1, type: 1, createdAt: -1 });

// Dashboard stats aggregation: hostel + priority + date
hostelAlertSchema.index({ hostelId: 1, priority: 1, status: 1, createdAt: -1 });

// ─────────────────────────────────────────────
// VIRTUAL: hasUnread (not stored — computed on query)
// ─────────────────────────────────────────────
hostelAlertSchema.virtual('unreadCount').get(function () {
  return this.recipientIds.length - (this.isRead ? this.isRead.length : 0);
});

module.exports = mongoose.model('HostelAlert', hostelAlertSchema);
