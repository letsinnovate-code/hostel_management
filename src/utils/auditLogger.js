/**
 * @file utils/auditLogger.js
 * @description Utility for tracking sensitive platform actions into the AuditLog collection.
 */

'use strict';

const AuditLog = require('../models/AuditLog');

/**
 * Log a sensitive action to the AuditLog.
 * @param {Object} req - The Express request object (to extract IP, UserAgent, and PerformedBy)
 * @param {Object} params - Audit log parameters
 * @param {string} params.action - The action performed (e.g., 'SUSPEND_OWNER')
 * @param {string} params.entityType - The type of entity affected (e.g., 'user', 'hostel')
 * @param {string} params.entityId - The ID of the affected entity
 * @param {Object} [params.changes] - The changes made (before and after state)
 */
const logAudit = async (req, { action, entityType, entityId, changes }) => {
  try {
    const performedBy = req.user ? req.user.id : null;
    
    // We only log if we have an authenticated user performing the action
    if (!performedBy) return;

    // Use x-forwarded-for if behind proxy, else remoteAddress
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
    const userAgent = req.headers['user-agent'];

    await AuditLog.create({
      action,
      entityType,
      entityId,
      performedBy,
      changes,
      ipAddress,
      userAgent,
    });
  } catch (err) {
    console.error('[AuditLogger] Failed to log audit event:', err.message);
    // We don't throw to avoid breaking the main request flow for a logging failure
  }
};

module.exports = {
  logAudit,
};
