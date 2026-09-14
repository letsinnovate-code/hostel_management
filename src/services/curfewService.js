/**
 * @file services/curfewService.js
 * @description Domain service for Curfew, Violations, Emergency acknowledgments, and Discipline workflows.
 */

'use strict';

const Violation = require('../models/Violation');
const Emergency = require('../models/Emergency');
const AuditLog = require('../models/AuditLog');
const { emitToUser } = require('../modules/alert/socket/alertSocket');

class CurfewService {
  /**
   * List violations for a hostel
   */
  static async listViolations(filter = {}, options = {}) {
    let query = Violation.find(filter)
      .populate('studentId', 'name email phone admissionNumber roomId')
      .populate('ruleId', 'title category penaltyType fineAmount')
      .populate('reportedBy', 'name role')
      .populate('resolvedBy', 'name role');

    if (options.sort) query = query.sort(options.sort);
    if (options.limit) query = query.limit(options.limit);
    if (options.skip) query = query.skip(options.skip);

    const [violations, total] = await Promise.all([
      query.lean(),
      Violation.countDocuments(filter),
    ]);

    return { violations, total };
  }

  /**
   * Create a violation record
   */
  static async createViolation(data, actorUser) {
    const violation = await Violation.create({
      ...data,
      reportedBy: actorUser ? actorUser._id : undefined,
    });

    if (actorUser) {
      await AuditLog.create({
        hostelId: violation.hostelId,
        action: 'VIOLATION_CREATED',
        entityType: 'Violation',
        entityId: violation._id,
        performedBy: actorUser._id,
        details: {
          studentId: violation.studentId,
          violationType: violation.violationType,
          severity: violation.severity,
        },
      });
    }

    // Socket alert to student
    try {
      emitToUser(String(violation.studentId), 'violation_recorded', {
        violationId: violation._id,
        violationType: violation.violationType,
        severity: violation.severity,
        incidentDate: violation.incidentDate,
      });
    } catch (socketErr) {
      // Non-blocking
    }

    return violation;
  }

  /**
   * Resolve a violation
   */
  static async resolveViolation(violationId, { resolvedBy, resolutionNotes, finePaid = false }) {
    const violation = await Violation.findById(violationId);
    if (!violation) throw new Error('Violation not found');

    violation.status = 'resolved';
    violation.resolvedBy = resolvedBy?._id || resolvedBy;
    violation.resolutionDate = new Date();
    if (resolutionNotes) violation.resolutionNotes = resolutionNotes;
    if (finePaid) violation.finePaid = true;

    await violation.save();

    if (resolvedBy) {
      await AuditLog.create({
        hostelId: violation.hostelId,
        action: 'VIOLATION_RESOLVED',
        entityType: 'Violation',
        entityId: violation._id,
        performedBy: resolvedBy._id || resolvedBy,
        details: { resolutionNotes, finePaid },
      });
    }

    return violation;
  }

  /**
   * Acknowledge an active emergency
   */
  static async acknowledgeEmergency(emergencyId, actorUser) {
    const emergency = await Emergency.findById(emergencyId);
    if (!emergency) throw new Error('Emergency not found');

    emergency.status = 'acknowledged';
    emergency.acknowledgedBy = actorUser._id;
    emergency.acknowledgedAt = new Date();
    await emergency.save();

    return emergency;
  }
}

module.exports = CurfewService;
