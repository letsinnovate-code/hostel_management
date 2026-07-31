/**
 * @file LeaveViolation.js
 * @description Tracks students who did not return after their approved leave expired.
 *
 * WHY: Leave violations are distinct from curfew violations because they can happen
 * at any time of day (not just 9 PM), require linking to a specific Permission,
 * and have their own escalation timeline. The leave expiry check runs every 30 min.
 *
 * INDEXES:
 * - permissionId: for deduplication (one violation per leave request)
 * - hostelId + status: for warden dashboard
 * - studentId: for student history
 */

'use strict';

const mongoose = require('mongoose');

const leaveViolationSchema = new mongoose.Schema(
  {
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
    // Link to the Permission (leave) that expired
    permissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Permission',
      required: true,
    },
    roomNumber: String,

    // ─── Timeline ─────────────────────────────────────────────────────
    // When the leave was supposed to end
    leaveEndTime: {
      type: Date,
      required: true,
    },
    // When the system first detected this violation
    detectedAt: {
      type: Date,
      default: Date.now,
    },
    // When the student actually returned (if they did)
    actualReturnTime: Date,
    // Hours overdue at the time of first detection
    hoursOverdue: {
      type: Number,
      default: 0,
    },

    // ─── Status ───────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['open', 'returned', 'escalated', 'resolved', 'false_positive'],
      default: 'open',
    },

    // ─── Escalation tracking ──────────────────────────────────────────
    escalationLevel: {
      type: Number,
      default: 0,
    },
    // Array of objects recording each escalation step with timestamp
    escalationLog: [
      {
        level: Number,
        escalatedTo: String, // 'warden', 'admin', 'superadmin', 'parent'
        escalatedAt: { type: Date, default: Date.now },
        note: String,
      },
    ],

    // ─── Alerts sent ──────────────────────────────────────────────────
    // Track which alerts were already generated to avoid duplicates
    alertsSent: [
      {
        alertId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'HostelAlert',
        },
        sentAt: { type: Date, default: Date.now },
        alertType: String,
      },
    ],

    // ─── Resolution ───────────────────────────────────────────────────
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    resolvedAt: Date,
    resolutionNote: String,
  },
  {
    timestamps: true,
  }
);

// ─────────────────────────────────────────────
// INDEXES
// ─────────────────────────────────────────────
// One violation per permission (prevent duplicates)
leaveViolationSchema.index({ permissionId: 1 }, { unique: true });
leaveViolationSchema.index({ hostelId: 1, status: 1, createdAt: -1 });
leaveViolationSchema.index({ studentId: 1, createdAt: -1 });

module.exports = mongoose.model('LeaveViolation', leaveViolationSchema);
