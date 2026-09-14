/**
 * @file controllers/warden/wardenComplaintController.js
 * @description Warden complaint management and assignment controller.
 */

'use strict';

const mongoose = require('mongoose');
const Complaint = require('../../models/Complaint');
const User = require('../../models/User');
const Room = require('../../models/Room');
const Notification = require('../../models/Notification');
const AuditLog = require('../../models/AuditLog');
const ComplaintService = require('../../services/complaintService');
const { COMPLAINT_STATUS } = require('../../constants');
const { parsePagination, buildPaginationMetadata } = require('../../utils/pagination');
const { resolveWardenHostelId } = require('./wardenHelper');
const { sendErrorResponse } = require('../../utils/apiError');
const { emitToUser } = require('../../modules/alert/socket/alertSocket');

const getComplaintActorRole = (u) => (Array.isArray(u?.role) ? u.role[0] || 'warden' : String(u?.role || 'warden'));
const getComplaintActorName = (u) => String(u?.name || 'Warden');

// Report Maintenance Issue (Quick Action)
exports.reportMaintenance = async (req, res) => {
  try {
    const { title, description, roomId, priority = 'medium' } = req.body;
    if (!title || !description) {
      return res.status(400).json({ success: false, message: 'Title and description are required' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    if (!targetHostelId) {
      return res.status(400).json({ success: false, message: 'Warden has no assigned hostel' });
    }

    const complaint = await Complaint.create({
      raisedBy: req.user.id || req.user._id,
      complaintType: 'maintenance',
      title,
      description,
      roomId: roomId || undefined,
      hostelId: targetHostelId,
      priority: ['low', 'medium', 'high', 'urgent'].includes(priority) ? priority : 'medium',
      status: 'open',
    });

    const populated = await Complaint.findById(complaint._id)
      .populate('raisedBy', 'name')
      .populate('roomId', 'roomNumber');

    return res.status(201).json({ success: true, data: populated, message: 'Maintenance request reported successfully' });
  } catch (error) {
    return sendErrorResponse(res, error, 'Failed to report maintenance issue');
  }
};

/**
 * Get Complaints (Warden view with search, filter, pagination, stats)
 */
exports.getComplaints = async (req, res) => {
  try {
    const targetHostelId = await resolveWardenHostelId(req);
    if (!targetHostelId) {
      return res.status(200).json({
        success: true,
        data: [],
        stats: {},
        pagination: { total: 0, page: 1, limit: 20, totalPages: 1 },
      });
    }

    const {
      status,
      type,
      category,
      priority,
      isEscalated,
      search,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = { hostelId: targetHostelId };

    // Status filter
    if (status && status !== 'all') {
      if (status === 'pending' || status === 'active') {
        filter.status = { $in: ['open', 'assigned', 'in-progress'] };
      } else {
        filter.status = status.trim().toLowerCase();
      }
    }

    // Category / Type filter
    const cat = category || type;
    if (cat && cat !== 'all') {
      filter.complaintType = cat.trim().toLowerCase();
    }

    // Priority filter
    if (priority && priority !== 'all') {
      const p = priority.trim().toLowerCase();
      if (p === 'critical' || p === 'urgent') {
        filter.priority = { $in: ['critical', 'urgent'] };
      } else {
        filter.priority = p;
      }
    }

    // Escalated filter
    if (isEscalated !== undefined && isEscalated !== '') {
      filter.isEscalated = isEscalated === 'true' || isEscalated === true;
    }

    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    // Keyword Search
    if (search && String(search).trim()) {
      const q = String(search).trim();
      const regex = new RegExp(q, 'i');

      // Search matching users (students)
      const matchingStudents = await User.find({
        hostelId: targetHostelId,
        $or: [{ name: regex }, { studentId: regex }, { phone: regex }],
      }).select('_id').lean();
      const studentIds = matchingStudents.map((s) => s._id);

      // Search matching rooms
      const matchingRooms = await Room.find({
        hostelId: targetHostelId,
        roomNumber: regex,
      }).select('_id').lean();
      const roomIds = matchingRooms.map((r) => r._id);

      filter.$or = [
        { title: regex },
        { description: regex },
        { assignedStaffName: regex },
        { raisedBy: { $in: studentIds } },
        { roomId: { $in: roomIds } },
      ];
    }

    const { page: pageNum, limit: limitNum, skip } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });

    const [{ complaints, total: totalMatching }, stats] = await Promise.all([
      ComplaintService.listComplaints({
        filter,
        skip,
        limit: limitNum,
        sort: { createdAt: -1 },
        populate: [
          {
            path: 'raisedBy',
            select: 'name email phone studentId roomId gender course year profileImage',
            populate: { path: 'roomId', select: 'roomNumber floorNumber' },
          },
          { path: 'roomId', select: 'roomNumber floorNumber' },
          { path: 'assignedTo', select: 'name email phone role' },
          { path: 'resolvedBy', select: 'name role' },
          { path: 'closedBy', select: 'name role' },
          { path: 'escalatedBy', select: 'name role' },
        ],
        lean: true,
      }),
      ComplaintService.getHostelComplaintStats(targetHostelId),
    ]);

    return res.status(200).json({
      success: true,
      data: complaints,
      stats,
      pagination: {
        total: totalMatching,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalMatching / limitNum) || 1,
      },
    });
  } catch (error) {
    return sendErrorResponse(res, error, 'Failed to fetch complaints');
  }
};

/**
 * Get full complaint details by ID
 */
exports.getComplaintDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const complaint = await ComplaintService.getComplaintById(id, {
      populate: [
        {
          path: 'raisedBy',
          select: 'name email phone studentId roomId gender course year profileImage parentContact emergencyContact',
          populate: { path: 'roomId', select: 'roomNumber floorNumber' },
        },
        { path: 'roomId', select: 'roomNumber floorNumber' },
        { path: 'assignedTo', select: 'name email phone role' },
        { path: 'resolvedBy', select: 'name role' },
        { path: 'closedBy', select: 'name role' },
        { path: 'reopenedBy', select: 'name role' },
        { path: 'escalatedBy', select: 'name role' },
        { path: 'timeline.performedBy', select: 'name role' },
        { path: 'remarks.author', select: 'name role' },
      ],
      lean: true,
    });

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    if (String(complaint.hostelId) !== String(targetHostelId)) {
      return res.status(403).json({ success: false, message: 'Not authorized for this hostel complaint' });
    }

    return res.status(200).json({ success: true, data: complaint });
  } catch (error) {
    return sendErrorResponse(res, error, 'Failed to fetch complaint details');
  }
};

/**
 * Assign Complaint to a staff user or external technician
 */
exports.assignComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedTo, assignedStaffName, assignedStaffPhone, assignedStaffRole, remarks } = req.body;

    const complaint = await ComplaintService.getComplaintById(id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    if (String(complaint.hostelId) !== String(targetHostelId)) {
      return res.status(403).json({ success: false, message: 'Not authorized for this hostel complaint' });
    }

    let staffId = assignedTo;
    let staffName = assignedStaffName || '';
    let staffPhone = assignedStaffPhone || '';
    let staffRole = assignedStaffRole || 'Staff';

    if (assignedTo) {
      const staffUser = await User.findById(assignedTo).select('name role phone').lean();
      if (staffUser) {
        staffName = staffUser.name;
        staffRole = getComplaintActorRole(staffUser);
        if (staffUser.phone && !assignedStaffPhone) {
          staffPhone = staffUser.phone;
        }
      }
    }

    const populated = await ComplaintService.assignComplaint(id, {
      staffId,
      staffName,
      staffPhone,
      staffRole,
      remarks,
      user: req.user,
      ip: req.ip || '',
      userAgent: req.headers?.['user-agent'] || '',
    });

    return res.status(200).json({
      success: true,
      data: populated,
      message: 'Complaint assigned successfully',
    });
  } catch (error) {
    return sendErrorResponse(res, error, 'Failed to assign complaint');
  }
};

/**
 * Update Complaint Status (Workflow transition)
 */
exports.updateComplaintStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolutionNotes, remarks, assignedTo } = req.body;

    const complaint = await ComplaintService.getComplaintById(id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    if (String(complaint.hostelId) !== String(targetHostelId)) {
      return res.status(403).json({ success: false, message: 'Not authorized for this hostel complaint' });
    }

    const updated = await ComplaintService.updateStatus(id, {
      status,
      resolutionNotes,
      remarks,
      assignedTo,
      user: req.user,
      ip: req.ip || '',
      userAgent: req.headers?.['user-agent'] || '',
    });

    return res.status(200).json({
      success: true,
      data: updated,
      message: 'Complaint updated successfully',
    });
  } catch (error) {
    return sendErrorResponse(res, error, 'Failed to update complaint');
  }
};

/**
 * Resolve Complaint (Dedicated endpoint with mandatory resolution notes)
 */
exports.resolveComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolutionNotes, remarks } = req.body;

    if (!resolutionNotes || !String(resolutionNotes).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Resolution notes are required to resolve a complaint',
      });
    }

    req.body.status = 'resolved';
    return exports.updateComplaintStatus(req, res);
  } catch (error) {
    return sendErrorResponse(res, error, 'Failed to resolve complaint');
  }
};

/**
 * Reopen a resolved or closed complaint
 */
exports.reopenComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const { reopenReason, remarks } = req.body;

    if (!reopenReason || !String(reopenReason).trim()) {
      return res.status(400).json({
        success: false,
        message: 'A reason is required to reopen a complaint',
      });
    }

    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    if (String(complaint.hostelId) !== String(targetHostelId)) {
      return res.status(403).json({ success: false, message: 'Not authorized for this hostel complaint' });
    }

    const beforeState = complaint.toObject();
    const prevStatus = complaint.status;

    complaint.status = 'in-progress';
    complaint.reopenedAt = new Date();
    complaint.reopenedBy = req.user._id || req.user.id;
    complaint.reopenReason = String(reopenReason).trim();

    // Timeline event
    complaint.timeline.push({
      action: 'reopened',
      performedBy: req.user._id || req.user.id,
      performedByName: getComplaintActorName(req.user),
      performedByRole: getComplaintActorRole(req.user),
      notes: `Complaint reopened. Reason: ${reopenReason.trim()}`,
      fromStatus: prevStatus,
      toStatus: 'in-progress',
      timestamp: new Date(),
    });

    if (remarks && String(remarks).trim()) {
      complaint.remarks.push({
        author: req.user._id || req.user.id,
        authorName: getComplaintActorName(req.user),
        authorRole: getComplaintActorRole(req.user),
        comment: `Reopen note: ${String(remarks).trim()}`,
        createdAt: new Date(),
      });
    }

    complaint.updatedAt = new Date();
    await complaint.save();

    // In-App Notification
    try {
      await Notification.create({
        title: 'Complaint Reopened',
        message: `Your complaint "${complaint.title}" was reopened for further action. Reason: ${reopenReason.trim()}`,
        type: 'alert',
        priority: 'high',
        hostelId: targetHostelId,
        createdBy: req.user._id || req.user.id,
        recipients: [complaint.raisedBy],
        targetAudience: 'students',
      });
      emitToUser(String(complaint.raisedBy), 'notification', {
        title: 'Complaint Reopened',
        message: `Your complaint "${complaint.title}" has been reopened.`,
      });
    } catch (notifErr) {
      console.warn('Notification error (reopenComplaint):', notifErr.message);
    }

    // Audit Log
    try {
      await AuditLog.create({
        action: 'complaint_reopened',
        entityType: 'complaint',
        entityId: complaint._id,
        performedBy: req.user._id || req.user.id,
        changes: { before: beforeState, after: complaint.toObject() },
        ipAddress: req.ip || '',
        userAgent: req.headers?.['user-agent'] || '',
      });
    } catch (auditErr) {
      console.warn('AuditLog error (reopenComplaint):', auditErr.message);
    }

    return res.status(200).json({
      success: true,
      data: complaint,
      message: 'Complaint reopened successfully',
    });
  } catch (error) {
    return sendErrorResponse(res, error, 'Failed to reopen complaint');
  }
};

/**
 * Add internal remark / comment to complaint
 */
exports.addComplaintRemark = async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;

    if (!comment || !String(comment).trim()) {
      return res.status(400).json({ success: false, message: 'Comment content is required' });
    }

    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    if (String(complaint.hostelId) !== String(targetHostelId)) {
      return res.status(403).json({ success: false, message: 'Not authorized for this hostel complaint' });
    }

    const remarkObj = {
      author: req.user._id || req.user.id,
      authorName: getComplaintActorName(req.user),
      authorRole: getComplaintActorRole(req.user),
      comment: String(comment).trim(),
      createdAt: new Date(),
    };

    complaint.remarks.push(remarkObj);

    complaint.timeline.push({
      action: 'remark_added',
      performedBy: req.user._id || req.user.id,
      performedByName: getComplaintActorName(req.user),
      performedByRole: getComplaintActorRole(req.user),
      notes: `Remark added: ${String(comment).trim()}`,
      fromStatus: complaint.status,
      toStatus: complaint.status,
      timestamp: new Date(),
    });

    complaint.updatedAt = new Date();
    await complaint.save();

    // Audit Log
    try {
      await AuditLog.create({
        action: 'complaint_remark_added',
        entityType: 'complaint',
        entityId: complaint._id,
        performedBy: req.user._id || req.user.id,
        changes: { newRemark: remarkObj },
        ipAddress: req.ip || '',
        userAgent: req.headers?.['user-agent'] || '',
      });
    } catch (auditErr) {
      console.warn('AuditLog error (addComplaintRemark):', auditErr.message);
    }

    return res.status(200).json({
      success: true,
      data: complaint,
      message: 'Remark added successfully',
    });
  } catch (error) {
    return sendErrorResponse(res, error, 'Failed to add complaint remark');
  }
};

/**
 * Escalate complaint to Owner or SuperAdmin
 */
exports.escalateComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const { escalateTo = 'owner', escalationReason } = req.body;

    if (!escalationReason || !String(escalationReason).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Escalation reason is required',
      });
    }

    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    if (String(complaint.hostelId) !== String(targetHostelId)) {
      return res.status(403).json({ success: false, message: 'Not authorized for this hostel complaint' });
    }

    const beforeState = complaint.toObject();

    complaint.isEscalated = true;
    complaint.escalatedTo = escalateTo;
    complaint.escalatedAt = new Date();
    complaint.escalatedBy = req.user._id || req.user.id;
    complaint.escalationReason = String(escalationReason).trim();
    complaint.priority = 'critical';

    // Timeline event
    complaint.timeline.push({
      action: 'escalated',
      performedBy: req.user._id || req.user.id,
      performedByName: getComplaintActorName(req.user),
      performedByRole: getComplaintActorRole(req.user),
      notes: `Complaint escalated to ${escalateTo.toUpperCase()}. Reason: ${escalationReason.trim()}`,
      fromStatus: complaint.status,
      toStatus: complaint.status,
      timestamp: new Date(),
    });

    complaint.updatedAt = new Date();
    await complaint.save();

    // In-App Notification for Owner
    try {
      const owners = await User.find({ role: 'owner' }).select('_id').lean();
      const ownerIds = owners.map((o) => o._id);
      if (ownerIds.length > 0) {
        await Notification.create({
          title: 'Critical Complaint Escalated',
          message: `Complaint "${complaint.title}" at hostel was escalated by Warden. Reason: ${escalationReason.trim()}`,
          type: 'alert',
          priority: 'high',
          hostelId: targetHostelId,
          createdBy: req.user._id || req.user.id,
          recipients: ownerIds,
          targetAudience: 'staff',
        });
      }

      // Notify student
      await Notification.create({
        title: 'Complaint Escalated to Management',
        message: `Your complaint "${complaint.title}" has been escalated for priority handling.`,
        type: 'alert',
        priority: 'medium',
        hostelId: targetHostelId,
        createdBy: req.user._id || req.user.id,
        recipients: [complaint.raisedBy],
        targetAudience: 'students',
      });
      emitToUser(String(complaint.raisedBy), 'notification', {
        title: 'Complaint Escalated',
        message: `Your complaint "${complaint.title}" was escalated to management.`,
      });
    } catch (notifErr) {
      console.warn('Notification error (escalateComplaint):', notifErr.message);
    }

    // Audit Log
    try {
      await AuditLog.create({
        action: 'complaint_escalated',
        entityType: 'complaint',
        entityId: complaint._id,
        performedBy: req.user._id || req.user.id,
        changes: { before: beforeState, after: complaint.toObject() },
        ipAddress: req.ip || '',
        userAgent: req.headers?.['user-agent'] || '',
      });
    } catch (auditErr) {
      console.warn('AuditLog error (escalateComplaint):', auditErr.message);
    }

    return res.status(200).json({
      success: true,
      data: complaint,
      message: 'Complaint escalated successfully',
    });
  } catch (error) {
    return sendErrorResponse(res, error, 'Failed to escalate complaint');
  }
};

/**
 * Get available staff users in hostel for assignment dropdown
 */
exports.getHostelStaffForAssignment = async (req, res) => {
  try {
    const targetHostelId = await resolveWardenHostelId(req);
    if (!targetHostelId) {
      return res.status(200).json({ success: true, data: [] });
    }

    const staffUsers = await User.find({
      hostelId: targetHostelId,
      role: { $in: ['warden', 'cleaner', 'maintenance', 'staff', 'owner'] },
    })
      .select('name email phone role')
      .sort({ role: 1, name: 1 })
      .lean();

    return res.status(200).json({ success: true, data: staffUsers });
  } catch (error) {
    return sendErrorResponse(res, error, 'Failed to get hostel staff for assignment');
  }
};
