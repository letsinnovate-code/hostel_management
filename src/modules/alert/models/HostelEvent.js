/**
 * @file HostelEvent.js
 * @description Immutable audit log for all automation-triggered events.
 *
 * WHY: Every time the automation engine fires (curfew check, attendance check,
 * leave expiry), it logs a HostelEvent. This provides:
 * 1. Full traceability: "what happened and when"
 * 2. Debugging: replay automation results
 * 3. Compliance: immutable audit trail
 *
 * Documents are NEVER updated after creation. resolvedAt is set once.
 *
 * INDEXES:
 * - hostelId + eventType + createdAt: for event history by hostel
 * - studentId + eventType: for per-student audit
 */

'use strict';

const mongoose = require('mongoose');
const { ALERT_TYPES } = require('../utils/constants');

const hostelEventSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      enum: Object.values(ALERT_TYPES),
      required: true,
    },
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hostel',
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    // 'system' for automated jobs, 'user' for manual triggers
    triggeredBy: {
      type: String,
      enum: ['system', 'user'],
      default: 'system',
    },
    triggeredByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    // Full event payload stored for audit/replay
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // IDs of HostelAlerts generated as a result of this event
    alertsGenerated: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'HostelAlert',
      },
    ],
    // Was processing successful?
    success: {
      type: Boolean,
      default: true,
    },
    errorMessage: String,
  },
  {
    timestamps: true,
  }
);

// ─────────────────────────────────────────────
// INDEXES
// ─────────────────────────────────────────────
hostelEventSchema.index({ hostelId: 1, eventType: 1, createdAt: -1 });
hostelEventSchema.index({ studentId: 1, eventType: 1, createdAt: -1 });
hostelEventSchema.index({ createdAt: -1 });

// TTL index: auto-delete audit events older than 6 months (180 days)
// WHY: Keeps the collection lean in production without manual cleanup.
hostelEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 15552000 });

module.exports = mongoose.model('HostelEvent', hostelEventSchema);
