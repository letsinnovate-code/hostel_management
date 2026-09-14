/**
 * @file services/permissionService.js
 * @description Centralized permission and leave application service managing approvals, rejections, check-outs, returns, cancellations, and notifications.
 */

'use strict';

const Permission = require('../models/Permission');
const User = require('../models/User');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const { hostelEventEmitter } = require('../modules/alert');
const { ALERT_TYPES } = require('../modules/alert/utils/constants');
const { emitToUser } = require('../modules/alert/socket/alertSocket');
const { PERMISSION_STATUS } = require('../constants');

class PermissionService {
  /**
   * Retrieve permission by ID with optional population
   */
  static async getPermissionById(id, options = {}) {
    let query = Permission.findById(id);
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
   * List permissions with filtering, pagination, and sorting
   */
  static async listPermissions({ filter = {}, skip = 0, limit = 50, sort = { createdAt: -1 }, populate, lean = true } = {}) {
    let query = Permission.find(filter).sort(sort).skip(skip).limit(limit);
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

    const [permissions, total] = await Promise.all([
      query,
      Permission.countDocuments(filter),
    ]);

    return { permissions, total };
  }

  /**
   * Approve a leave application with overlap validation, notifications, and event emission
   */
  static async approvePermission(id, { user, wardenRemarks, ip = '', userAgent = '' } = {}) {
    const permission = await Permission.findById(id).populate('studentId');
    if (!permission) {
      const err = new Error('Leave application not found');
      err.statusCode = 404;
      throw err;
    }

    if (permission.status === PERMISSION_STATUS.APPROVED || permission.status === PERMISSION_STATUS.CHECKED_OUT) {
      const err = new Error('This leave application is already approved');
      err.statusCode = 400;
      throw err;
    }

    if (permission.returnDate && new Date(permission.requestedDate) > new Date(permission.returnDate)) {
      const err = new Error('Invalid dates: return date cannot be before departure date');
      err.statusCode = 400;
      throw err;
    }

    const student = permission.studentId;
    const studentId = student?._id || permission.studentId;

    // Check for overlapping approved or checked-out leave for this student
    const sStart = new Date(permission.requestedDate);
    const sEnd = permission.returnDate ? new Date(permission.returnDate) : sStart;

    const overlap = await Permission.findOne({
      studentId: studentId,
      _id: { $ne: permission._id },
      status: { $in: [PERMISSION_STATUS.APPROVED, PERMISSION_STATUS.CHECKED_OUT] },
      requestedDate: { $lte: sEnd },
      $or: [
        { returnDate: { $gte: sStart } },
        { returnDate: null },
      ],
    });

    if (overlap) {
      const err = new Error(
        `Overlapping leave conflict: Student already has an active ${overlap.status} leave from ${new Date(overlap.requestedDate).toLocaleDateString()} to ${overlap.returnDate ? new Date(overlap.returnDate).toLocaleDateString() : 'N/A'}.`
      );
      err.statusCode = 400;
      throw err;
    }

    const beforeState = permission.toObject();

    permission.status = PERMISSION_STATUS.APPROVED;
    permission.approvedBy = user?._id || user?.id;
    permission.approvedAt = new Date();
    if (wardenRemarks !== undefined) {
      permission.wardenRemarks = String(wardenRemarks).trim();
    }

    await permission.save();
    await permission.populate('approvedBy', 'name role');

    const hostelId = permission.hostelId || student?.hostelId;

    // In-app notification for student
    try {
      await Notification.create({
        title: 'Leave Request Approved',
        message: `Your ${permission.permissionType} request from ${new Date(permission.requestedDate).toLocaleDateString()} to ${permission.returnDate ? new Date(permission.returnDate).toLocaleDateString() : 'N/A'} has been approved.${wardenRemarks ? ` Note: ${wardenRemarks}` : ''}`,
        type: 'alert',
        priority: 'medium',
        hostelId,
        createdBy: user?._id || user?.id,
        recipients: [studentId],
        targetAudience: 'students',
      });
      emitToUser(String(studentId), 'notification', {
        title: 'Leave Request Approved',
        message: 'Your leave application has been approved by the Warden.',
      });
    } catch (notifErr) {
      console.warn('[PermissionService] Notification creation warning:', notifErr.message);
    }

    // Alert Module Event
    hostelEventEmitter.emit(ALERT_TYPES.LEAVE_APPROVED, {
      studentId: String(studentId),
      hostelId: String(hostelId),
      permissionId: String(permission._id),
      returnDate: permission.returnDate,
    });

    // Audit Log
    if (user) {
      try {
        await AuditLog.create({
          action: 'leave_approved',
          entityType: 'permission',
          entityId: permission._id,
          performedBy: user._id || user.id,
          changes: { before: beforeState, after: permission.toObject() },
          ipAddress: ip || '',
          userAgent: userAgent || '',
        });
      } catch (auditErr) {
        console.warn('[PermissionService] AuditLog warning:', auditErr.message);
      }
    }

    return permission;
  }

  /**
   * Reject a leave application with a required reason
   */
  static async rejectPermission(id, { user, rejectionReason, wardenRemarks, ip = '', userAgent = '' } = {}) {
    if (!rejectionReason || !String(rejectionReason).trim()) {
      const err = new Error('Rejection reason is required');
      err.statusCode = 400;
      throw err;
    }

    const permission = await Permission.findById(id).populate('studentId');
    if (!permission) {
      const err = new Error('Leave application not found');
      err.statusCode = 404;
      throw err;
    }

    const student = permission.studentId;
    const studentId = student?._id || permission.studentId;
    const hostelId = permission.hostelId || student?.hostelId;
    const beforeState = permission.toObject();

    permission.status = PERMISSION_STATUS.REJECTED;
    permission.rejectionReason = String(rejectionReason).trim();
    permission.approvedBy = user?._id || user?.id;
    permission.approvedAt = new Date();
    if (wardenRemarks) {
      permission.wardenRemarks = String(wardenRemarks).trim();
    }

    await permission.save();
    await permission.populate('approvedBy', 'name role');

    // In-app notification for student
    try {
      await Notification.create({
        title: 'Leave Request Rejected',
        message: `Your ${permission.permissionType} request was rejected. Reason: ${rejectionReason.trim()}`,
        type: 'alert',
        priority: 'high',
        hostelId,
        createdBy: user?._id || user?.id,
        recipients: [studentId],
        targetAudience: 'students',
      });
      emitToUser(String(studentId), 'notification', {
        title: 'Leave Request Rejected',
        message: `Your leave request was rejected: ${rejectionReason.trim()}`,
      });
    } catch (notifErr) {
      console.warn('[PermissionService] Notification creation warning:', notifErr.message);
    }

    // Alert Module Event
    hostelEventEmitter.emit(ALERT_TYPES.LEAVE_REJECTED, {
      studentId: String(studentId),
      hostelId: String(hostelId),
      permissionId: String(permission._id),
      reason: rejectionReason.trim(),
    });

    // Audit Log
    if (user) {
      try {
        await AuditLog.create({
          action: 'leave_rejected',
          entityType: 'permission',
          entityId: permission._id,
          performedBy: user._id || user.id,
          changes: { before: beforeState, after: permission.toObject() },
          ipAddress: ip || '',
          userAgent: userAgent || '',
        });
      } catch (auditErr) {
        console.warn('[PermissionService] AuditLog warning:', auditErr.message);
      }
    }

    return permission;
  }

  /**
   * Cancel or revoke a leave application
   */
  static async cancelPermission(id, { user, cancellationReason, ip = '', userAgent = '', isStudent = false } = {}) {
    const permission = await Permission.findById(id).populate('studentId');
    if (!permission) {
      const err = new Error('Permission not found');
      err.statusCode = 404;
      throw err;
    }

    if (isStudent) {
      if (permission.status !== PERMISSION_STATUS.PENDING && permission.status !== PERMISSION_STATUS.APPROVED) {
        const err = new Error(`Cannot cancel a permission request that is already ${permission.status}`);
        err.statusCode = 400;
        throw err;
      }
    } else {
      if (!cancellationReason || !String(cancellationReason).trim()) {
        const err = new Error('Cancellation reason is required');
        err.statusCode = 400;
        throw err;
      }
    }

    const student = permission.studentId;
    const studentId = student?._id || permission.studentId;
    const hostelId = permission.hostelId || student?.hostelId;
    const beforeState = permission.toObject();

    permission.status = PERMISSION_STATUS.CANCELLED;
    if (cancellationReason) {
      permission.cancellationReason = String(cancellationReason).trim();
    }
    if (!isStudent) {
      permission.cancelledBy = user?._id || user?.id;
      permission.cancelledAt = new Date();
    }

    await permission.save();

    // Restore student status to active if on-leave
    if (student && student.status === 'on-leave') {
      student.status = 'active';
      await student.save();
    }

    // In-app notification if cancelled by staff
    if (!isStudent) {
      try {
        await Notification.create({
          title: 'Leave Revoked / Cancelled',
          message: `Your leave request has been cancelled by the Warden. Reason: ${cancellationReason?.trim() || 'Administrative decision'}`,
          type: 'alert',
          priority: 'high',
          hostelId,
          createdBy: user?._id || user?.id,
          recipients: [studentId],
          targetAudience: 'students',
        });
        emitToUser(String(studentId), 'notification', {
          title: 'Leave Cancelled',
          message: `Your leave was cancelled: ${cancellationReason?.trim() || ''}`,
        });
      } catch (notifErr) {
        console.warn('[PermissionService] Notification creation warning:', notifErr.message);
      }
    }

    // Alert Module Event
    hostelEventEmitter.emit(ALERT_TYPES.LEAVE_CANCELLED, {
      studentId: String(studentId),
      hostelId: String(hostelId),
      permissionId: String(permission._id),
      reason: cancellationReason?.trim() || 'Cancelled',
    });

    // Audit Log
    if (user) {
      try {
        await AuditLog.create({
          action: 'leave_cancelled',
          entityType: 'permission',
          entityId: permission._id,
          performedBy: user._id || user.id,
          changes: { before: beforeState, after: permission.toObject() },
          ipAddress: ip || '',
          userAgent: userAgent || '',
        });
      } catch (auditErr) {
        console.warn('[PermissionService] AuditLog warning:', auditErr.message);
      }
    }

    return permission;
  }

  /**
   * Record student physical departure (Check Out)
   */
  static async recordLeaveCheckOut(id, { user, actualCheckOutTime, remarks, ip = '', userAgent = '' } = {}) {
    const permission = await Permission.findById(id).populate('studentId');
    if (!permission) {
      const err = new Error('Leave application not found');
      err.statusCode = 404;
      throw err;
    }

    if (permission.status !== PERMISSION_STATUS.APPROVED) {
      const err = new Error(`Cannot record check-out: Leave is currently '${permission.status}'. It must be 'approved' first.`);
      err.statusCode = 400;
      throw err;
    }

    const beforeState = permission.toObject();
    const departureTime = actualCheckOutTime ? new Date(actualCheckOutTime) : new Date();

    permission.status = PERMISSION_STATUS.CHECKED_OUT;
    permission.actualCheckOutTime = departureTime;
    if (remarks) {
      permission.wardenRemarks = (permission.wardenRemarks ? permission.wardenRemarks + ' | ' : '') + String(remarks).trim();
    }

    await permission.save();

    // Mark student status as 'on-leave'
    const student = permission.studentId;
    const studentId = student?._id || permission.studentId;
    if (student) {
      student.status = 'on-leave';
      await student.save();
    }

    const hostelId = permission.hostelId || student?.hostelId;

    // Gate Event telemetry
    try {
      const { logGateEvent } = require('../utils/gateEventService');
      await logGateEvent({
        studentId,
        hostelId,
        type: 'out',
        time: departureTime,
        verificationMethod: 'manual',
        source: user?.role || 'warden',
        reason: 'leave_departure',
      });
    } catch (gateErr) {
      console.warn('[PermissionService] GateEvent log warning:', gateErr.message);
    }

    // In-app notification
    try {
      await Notification.create({
        title: 'Departure Recorded',
        message: `Your leave departure has been verified. Expected return: ${permission.returnDate ? new Date(permission.returnDate).toLocaleString() : 'N/A'}`,
        type: 'alert',
        priority: 'medium',
        hostelId,
        createdBy: user?._id || user?.id,
        recipients: [studentId],
        targetAudience: 'students',
      });
    } catch (notifErr) {
      console.warn('[PermissionService] Notification warning:', notifErr.message);
    }

    // Alert Module Event
    hostelEventEmitter.emit(ALERT_TYPES.LEAVE_CHECKOUT, {
      studentId: String(studentId),
      hostelId: String(hostelId),
      permissionId: String(permission._id),
      departureTime,
    });

    // Audit Log
    if (user) {
      try {
        await AuditLog.create({
          action: 'leave_checked_out',
          entityType: 'permission',
          entityId: permission._id,
          performedBy: user._id || user.id,
          changes: { before: beforeState, after: permission.toObject() },
          ipAddress: ip || '',
          userAgent: userAgent || '',
        });
      } catch (auditErr) {
        console.warn('[PermissionService] AuditLog warning:', auditErr.message);
      }
    }

    return permission;
  }

  /**
   * Record student physical return
   */
  static async recordLeaveReturn(id, { user, actualReturnTime, remarks, ip = '', userAgent = '' } = {}) {
    const permission = await Permission.findById(id).populate('studentId');
    if (!permission) {
      const err = new Error('Leave application not found');
      err.statusCode = 404;
      throw err;
    }

    if (permission.status !== PERMISSION_STATUS.CHECKED_OUT && permission.status !== PERMISSION_STATUS.APPROVED) {
      const err = new Error(`Cannot record return: Leave is currently '${permission.status}'.`);
      err.statusCode = 400;
      throw err;
    }

    const beforeState = permission.toObject();
    const returnTime = actualReturnTime ? new Date(actualReturnTime) : new Date();

    permission.status = PERMISSION_STATUS.RETURNED;
    permission.actualReturnTime = returnTime;
    if (remarks) {
      permission.wardenRemarks = (permission.wardenRemarks ? permission.wardenRemarks + ' | ' : '') + String(remarks).trim();
    }

    await permission.save();

    // Restore student status to 'active'
    const student = permission.studentId;
    const studentId = student?._id || permission.studentId;
    if (student && student.status === 'on-leave') {
      student.status = 'active';
      await student.save();
    }

    const hostelId = permission.hostelId || student?.hostelId;

    // Auto-resolve any open LeaveViolation for this permission
    try {
      const LeaveViolation = require('../modules/alert/models/LeaveViolation');
      await LeaveViolation.updateMany(
        { permissionId: permission._id, status: 'open' },
        {
          status: 'returned',
          actualReturnTime: returnTime,
          resolvedBy: user?._id || user?.id,
          resolvedAt: new Date(),
          resolutionNote: remarks || 'Student returned to hostel recorded by warden',
        }
      );
    } catch (lvErr) {
      console.warn('[PermissionService] LeaveViolation updateMany warning:', lvErr.message);
    }

    // Gate Event telemetry
    try {
      const { logGateEvent } = require('../utils/gateEventService');
      await logGateEvent({
        studentId,
        hostelId,
        type: 'in',
        time: returnTime,
        verificationMethod: 'manual',
        source: user?.role || 'warden',
        reason: 'leave_return',
      });
    } catch (gateErr) {
      console.warn('[PermissionService] GateEvent log warning:', gateErr.message);
    }

    // In-app notification
    try {
      await Notification.create({
        title: 'Return Recorded',
        message: 'Your return to the hostel has been verified and recorded.',
        type: 'alert',
        priority: 'medium',
        hostelId,
        createdBy: user?._id || user?.id,
        recipients: [studentId],
        targetAudience: 'students',
      });
    } catch (notifErr) {
      console.warn('[PermissionService] Notification warning:', notifErr.message);
    }

    // Alert Module Event
    hostelEventEmitter.emit(ALERT_TYPES.LEAVE_RETURNED, {
      studentId: String(studentId),
      hostelId: String(hostelId),
      permissionId: String(permission._id),
      returnTime,
    });

    // Audit Log
    if (user) {
      try {
        await AuditLog.create({
          action: 'leave_returned',
          entityType: 'permission',
          entityId: permission._id,
          performedBy: user._id || user.id,
          changes: { before: beforeState, after: permission.toObject() },
          ipAddress: ip || '',
          userAgent: userAgent || '',
        });
      } catch (auditErr) {
        console.warn('[PermissionService] AuditLog warning:', auditErr.message);
      }
    }

    return permission;
  }
}

module.exports = PermissionService;
