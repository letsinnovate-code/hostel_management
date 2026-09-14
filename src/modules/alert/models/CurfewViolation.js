/**
 * @file CurfewViolation.js
 * @description Persistent record of each curfew violation detected by the automation engine.
 *
 * WHY SEPARATE FROM HostelAlert:
 * HostelAlert is the notification/alert sent to wardens. CurfewViolation is the
 * structured RECORD of who violated curfew, with full context for reporting,
 * escalation, and audit. They have a 1:1 relationship via alertId.
 * This separation follows CQRS thinking: alerts are for real-time delivery,
 * violations are for reporting and dashboards.
 *
 * INDEXES:
 * - studentId + violationDate: for per-student history queries
 * - hostelId + violationDate: for warden dashboard daily view
 * - status: for counting open violations
 */

'use strict';

const mongoose = require('mongoose');

const curfewViolationSchema = new mongoose.Schema(
  {
    // ─── Who violated ─────────────────────────────────────────────────
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
    // roomId stored for quick display without populating student
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
    },
    roomNumber: String, // Denormalized for performance (avoid extra join in reports)

    // ─── When ─────────────────────────────────────────────────────────
    violationDate: {
      type: Date,
      required: true,
    },
    // The curfew time that was active when violation was detected (HH:mm string)
    curfewTime: {
      type: String,
      required: true,
    },

    // ─── Context ──────────────────────────────────────────────────────
    // Last recorded check-out time before curfew
    lastCheckOutTime: Date,
    // Attendance status at time of detection
    attendanceStatus: {
      type: String,
      enum: ['outside', 'pending', 'unknown'],
      default: 'outside',
    },
    // Was the student on an approved leave?
    leaveStatus: {
      type: String,
      enum: ['no_leave', 'expired_leave', 'approved_leave', 'unknown'],
      default: 'no_leave',
    },
    // If on leave, link to the permission
    permissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Permission',
    },
    // Minutes since student was last known to be inside
    minutesMissing: {
      type: Number,
      default: 0,
    },
    lastKnownActivity: {
      type: String,
      maxlength: 300,
    },

    // ─── Lifecycle ────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['open', 'acknowledged', 'resolved', 'false_positive', 'pending_recheck'],
      default: 'open',
    },
    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    acknowledgedAt: Date,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    resolvedAt: Date,
    resolutionNote: {
      type: String,
      maxlength: 1000,
    },
    // Did the student eventually return?
    studentReturnedAt: Date,

    // ─── Multi-Stage Grace Period & Escalation Tracking ──────────────
    // Stage 0: Grace Period (10 mins), Stage 1: Confirmed Violation, Stage 2: Parent Escallated
    stage: {
      type: Number,
      default: 0,
    },
    graceExpiresAt: Date,
    tenMinRechecked: {
      type: Boolean,
      default: false,
    },
    tenMinRecheckedAt: Date,
    parentNotified: {
      type: Boolean,
      default: false,
    },
    parentNotifiedAt: Date,
    parentEmail: String,
    locationVerified: {
      type: Boolean,
      default: false,
    },
    locationMethod: {
      type: String,
      enum: ['gps', 'attendance', 'manual', 'none'],
      default: 'none',
    },

    // ─── Escalation ───────────────────────────────────────────────────
    escalationLevel: {
      type: Number,
      default: 0, // 0=warden, 1=admin/owner, 2=superadmin, 3=parent
    },
    escalatedAt: [Date],

    // ─── Link to generated alert ──────────────────────────────────────
    alertId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HostelAlert',
    },
  },
  {
    timestamps: true,
  }
);

// ─────────────────────────────────────────────
// INDEXES
// ─────────────────────────────────────────────
curfewViolationSchema.index({ hostelId: 1, violationDate: -1, status: 1 });
curfewViolationSchema.index({ studentId: 1, violationDate: -1 });
curfewViolationSchema.index({ status: 1, createdAt: -1 });
// Prevent creating duplicate violation for same student on same day
curfewViolationSchema.index({ studentId: 1, violationDate: 1 }, { unique: false });

module.exports = mongoose.model('CurfewViolation', curfewViolationSchema);
