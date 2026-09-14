/**
 * @file services/complaintService.js
 * @description Centralized complaint service managing lifecycle transitions, notifications, timeline, and stats.
 */

'use strict';

const mongoose = require('mongoose');
const Complaint = require('../models/Complaint');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const { emitToUser } = require('../modules/alert/socket/alertSocket');
const { COMPLAINT_STATUS, ALL_COMPLAINT_STATUSES } = require('../constants');

/**
 * Helper to resolve user display name for complaint timeline
 */
function getActorName(user) {
  return String(user?.name || user?.email || 'System User');
}

/**
 * Helper to resolve primary role for complaint timeline
 */
function getActorRole(user) {
  if (Array.isArray(user?.role)) {
    return user.role[0] || 'staff';
  }
  return String(user?.role || 'staff');
}

class ComplaintService {
  /**
   * Retrieve complaint by ID with optional population
   */
  static async getComplaintById(id, options = {}) {
    let query = Complaint.findById(id);
    if (options.populate) {
      if (Array.isArray(options.populate)) {
        for (const pop of options.populate) query = query.populate(pop);
      } else {
        query = query.populate(options.populate);
      }
    }
    if (options.lean) {
      query = query.lean();
    }
    return await query;
  }

  /**
   * List complaints with filtering, sorting, pagination, and population
   */
  static async listComplaints({ filter = {}, skip = 0, limit = 50, sort = { createdAt: -1 }, populate, lean = true } = {}) {
    let query = Complaint.find(filter).sort(sort).skip(skip).limit(limit);
    if (populate) {
      if (Array.isArray(populate)) {
        for (const pop of populate) query = query.populate(pop);
      } else {
        query = query.populate(populate);
      }
    }
    if (lean) {
      query = query.lean();
    }

    const [complaints, total] = await Promise.all([
      query,
      Complaint.countDocuments(filter),
    ]);

    return { complaints, total };
  }

  /**
   * Compute aggregated complaint statistics for a hostel using MongoDB aggregation
   */
  static async getHostelComplaintStats(hostelId) {
    const targetHostelObjId = mongoose.Types.ObjectId.isValid(hostelId)
      ? new mongoose.Types.ObjectId(hostelId)
      : hostelId;

    const statsAgg = await Complaint.aggregate([
      { $match: { hostelId: targetHostelObjId } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          open: { $sum: { $cond: [{ $eq: ['$status', COMPLAINT_STATUS.OPEN] }, 1, 0] } },
          assigned: { $sum: { $cond: [{ $eq: ['$status', COMPLAINT_STATUS.ASSIGNED] }, 1, 0] } },
          inProgress: {
            $sum: {
              $cond: [{ $in: ['$status', [COMPLAINT_STATUS.IN_PROGRESS, COMPLAINT_STATUS.REOPENED]] }, 1, 0],
            },
          },
          resolved: { $sum: { $cond: [{ $eq: ['$status', COMPLAINT_STATUS.RESOLVED] }, 1, 0] } },
          closed: { $sum: { $cond: [{ $eq: ['$status', COMPLAINT_STATUS.CLOSED] }, 1, 0] } },
          critical: {
            $sum: {
              $cond: [{ $in: ['$priority', ['critical', 'urgent']] }, 1, 0],
            },
          },
          escalated: { $sum: { $cond: [{ $eq: ['$isEscalated', true] }, 1, 0] } },
        },
      },
    ]);

    const s = statsAgg[0] || {};
    return {
      total: s.total || 0,
      open: s.open || 0,
      assigned: s.assigned || 0,
      inProgress: s.inProgress || 0,
      resolved: s.resolved || 0,
      closed: s.closed || 0,
      critical: s.critical || 0,
      escalated: s.escalated || 0,
    };
  }

  /**
   * Transition complaint status, record timeline, update timestamps, and dispatch notifications
   */
  static async updateStatus(id, { status, resolutionNotes, remarks, assignedTo, user, ip = '', userAgent = '', notify = true } = {}) {
    const complaint = await Complaint.findById(id);
    if (!complaint) {
      const err = new Error('Complaint not found');
      err.statusCode = 404;
      throw err;
    }

    const beforeState = complaint.toObject();
    const prevStatus = complaint.status;

    if (status) {
      const targetStatus = status.trim().toLowerCase();
      if (!ALL_COMPLAINT_STATUSES.includes(targetStatus)) {
        const err = new Error(`Invalid status: '${status}'. Must be one of: ${ALL_COMPLAINT_STATUSES.join(', ')}`);
        err.statusCode = 400;
        throw err;
      }

      if (targetStatus === COMPLAINT_STATUS.RESOLVED) {
        if (!resolutionNotes || !String(resolutionNotes).trim()) {
          const err = new Error('Resolution notes are required when marking a complaint as resolved');
          err.statusCode = 400;
          throw err;
        }
        complaint.resolvedAt = new Date();
        complaint.resolvedBy = user?._id || user?.id;
        complaint.resolutionNotes = String(resolutionNotes).trim();
      } else if (targetStatus === COMPLAINT_STATUS.CLOSED) {
        complaint.closedAt = new Date();
        complaint.closedBy = user?._id || user?.id;
      } else if (targetStatus === COMPLAINT_STATUS.REOPENED) {
        complaint.reopenedAt = new Date();
        complaint.reopenedBy = user?._id || user?.id;
      }

      complaint.status = targetStatus === COMPLAINT_STATUS.REOPENED ? COMPLAINT_STATUS.IN_PROGRESS : targetStatus;
    }

    if (resolutionNotes !== undefined && resolutionNotes !== null) {
      complaint.resolutionNotes = String(resolutionNotes).trim();
    }

    if (assignedTo !== undefined) {
      complaint.assignedTo = assignedTo || undefined;
    }

    // Timeline update
    if (Array.isArray(complaint.timeline)) {
      complaint.timeline.push({
        action: 'status_changed',
        performedBy: user?._id || user?.id,
        performedByName: getActorName(user),
        performedByRole: getActorRole(user),
        notes: remarks || resolutionNotes || `Status updated from ${prevStatus} to ${complaint.status}`,
        fromStatus: prevStatus,
        toStatus: complaint.status,
        timestamp: new Date(),
      });
    }

    // Remarks update
    if (remarks && String(remarks).trim() && Array.isArray(complaint.remarks)) {
      complaint.remarks.push({
        author: user?._id || user?.id,
        authorName: getActorName(user),
        authorRole: getActorRole(user),
        comment: String(remarks).trim(),
        createdAt: new Date(),
      });
    }

    complaint.updatedAt = new Date();
    await complaint.save();

    // Dispatch in-app notification & socket event to student if applicable
    if (notify && complaint.raisedBy) {
      try {
        await Notification.create({
          title: `Complaint ${complaint.status.toUpperCase()}`,
          message: `Your complaint "${complaint.title}" status changed to ${complaint.status}.${resolutionNotes ? ` Note: ${resolutionNotes}` : ''}`,
          type: 'alert',
          priority: 'medium',
          hostelId: complaint.hostelId,
          createdBy: user?._id || user?.id,
          recipients: [complaint.raisedBy],
          targetAudience: 'students',
        });
        emitToUser(String(complaint.raisedBy), 'notification', {
          title: `Complaint ${complaint.status}`,
          message: `Your complaint "${complaint.title}" is now ${complaint.status}.`,
        });
      } catch (notifErr) {
        console.warn('[ComplaintService] Notification warning:', notifErr.message);
      }
    }

    // Audit log
    if (user) {
      try {
        await AuditLog.create({
          action: 'complaint_status_updated',
          entityType: 'complaint',
          entityId: complaint._id,
          performedBy: user._id || user.id,
          changes: { before: beforeState, after: complaint.toObject() },
          ipAddress: ip || '',
          userAgent: userAgent || '',
        });
      } catch (auditErr) {
        console.warn('[ComplaintService] AuditLog warning:', auditErr.message);
      }
    }

    return await Complaint.findById(complaint._id)
      .populate('raisedBy', 'name phone studentId')
      .populate('assignedTo', 'name role');
  }

  /**
   * Assign complaint to a staff member or technician
   */
  static async assignComplaint(id, { staffId, staffName, staffPhone, staffRole, notes, remarks, user, ip = '', userAgent = '' } = {}) {
    const complaint = await Complaint.findById(id);
    if (!complaint) {
      const err = new Error('Complaint not found');
      err.statusCode = 404;
      throw err;
    }

    const beforeState = complaint.toObject();
    const prevStatus = complaint.status;

    if (staffId !== undefined) {
      complaint.assignedTo = staffId || undefined;
    }
    if (staffName) {
      complaint.assignedStaffName = String(staffName).trim();
    }
    if (staffPhone) {
      complaint.assignedStaffPhone = String(staffPhone).trim();
    }
    if (staffRole) {
      complaint.assignedStaffRole = String(staffRole).trim();
    }
    complaint.assignedAt = new Date();

    if (complaint.status === COMPLAINT_STATUS.OPEN) {
      complaint.status = COMPLAINT_STATUS.ASSIGNED;
    }

    if (Array.isArray(complaint.timeline)) {
      complaint.timeline.push({
        action: 'assigned',
        performedBy: user?._id || user?.id,
        performedByName: getActorName(user),
        performedByRole: getActorRole(user),
        notes: notes || `Assigned to ${staffName || 'staff'} (${staffRole || 'technician'})`.trim(),
        fromStatus: prevStatus,
        toStatus: complaint.status,
        timestamp: new Date(),
      });
    }

    if (remarks && String(remarks).trim() && Array.isArray(complaint.remarks)) {
      complaint.remarks.push({
        author: user?._id || user?.id,
        authorName: getActorName(user),
        authorRole: getActorRole(user),
        comment: `Assignment note: ${String(remarks).trim()}`,
        createdAt: new Date(),
      });
    }

    complaint.updatedAt = new Date();
    await complaint.save();

    // In-app notification for student
    if (complaint.raisedBy) {
      try {
        await Notification.create({
          title: 'Complaint Assigned',
          message: `Your complaint "${complaint.title}" has been assigned to ${staffName || 'maintenance'}.`,
          type: 'alert',
          priority: 'medium',
          hostelId: complaint.hostelId,
          createdBy: user?._id || user?.id,
          recipients: [complaint.raisedBy],
          targetAudience: 'students',
        });
        emitToUser(String(complaint.raisedBy), 'notification', {
          title: 'Complaint Assigned',
          message: `Your complaint "${complaint.title}" has been assigned to ${staffName || 'maintenance'}.`,
        });
      } catch (notifErr) {
        console.warn('[ComplaintService] Assign notification warning:', notifErr.message);
      }
    }

    // Audit log
    if (user) {
      try {
        await AuditLog.create({
          action: 'complaint_assigned',
          entityType: 'complaint',
          entityId: complaint._id,
          performedBy: user._id || user.id,
          changes: { before: beforeState, after: complaint.toObject() },
          ipAddress: ip || '',
          userAgent: userAgent || '',
        });
      } catch (auditErr) {
        console.warn('[ComplaintService] Assign AuditLog warning:', auditErr.message);
      }
    }

    return await Complaint.findById(complaint._id)
      .populate('assignedTo', 'name email phone role')
      .populate('raisedBy', 'name phone studentId');
  }

  /**
   * Create a new complaint with initial timeline entry
   */
  static async createComplaint(data, user = null) {
    const complaintData = {
      ...data,
      timeline: data.timeline || [
        {
          action: 'created',
          performedBy: user?._id || user?.id || data.raisedBy,
          performedByName: getActorName(user),
          performedByRole: getActorRole(user),
          notes: 'Complaint submitted',
          fromStatus: 'none',
          toStatus: data.status || COMPLAINT_STATUS.OPEN,
          timestamp: new Date(),
        },
      ],
    };

    return await Complaint.create(complaintData);
  }
}

module.exports = ComplaintService;
