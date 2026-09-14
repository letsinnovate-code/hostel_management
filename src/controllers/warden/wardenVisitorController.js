/**
 * @file controllers/warden/wardenVisitorController.js
 * @description Warden visitor management and logging controller.
 */

'use strict';

const Visitor = require('../../models/Visitor');
const User = require('../../models/User');
const VisitorService = require('../../services/visitorService');
const { VISITOR_STATUS } = require('../../constants');
const { parsePagination, buildPaginationMetadata } = require('../../utils/pagination');
const { resolveWardenHostelId } = require('./wardenHelper');
const { sendErrorResponse } = require('../../utils/apiError');

exports.getVisitors = async (req, res) => {
  try {
    const targetHostelId = await resolveWardenHostelId(req);
    if (!targetHostelId) {
      return res.status(200).json({ success: true, count: 0, data: [] });
    }

    const students = await User.find({ hostelId: targetHostelId, role: 'student' }).select('_id').lean();
    const studentIds = students.map((s) => s._id);
    if (studentIds.length === 0) {
      return res.status(200).json({ success: true, count: 0, data: [] });
    }

    const { page, limit, skip, isExplicit } = parsePagination(req.query, { defaultLimit: 50, maxLimit: 100 });
    const visitorQuery = { visitingStudentId: { $in: studentIds } };

    const { visitors, total } = await VisitorService.listVisitors({
      filter: visitorQuery,
      skip: isExplicit ? skip : 0,
      limit: isExplicit ? limit : 0,
      populate: [
        { path: 'visitingStudentId', select: 'name roomId' },
        { path: 'approvedBy', select: 'name' },
      ],
      sort: { createdAt: -1 },
      lean: true,
    });

    const responsePayload = {
      success: true,
      count: visitors.length,
      data: visitors,
    };
    if (isExplicit) {
      responsePayload.pagination = buildPaginationMetadata(total, page, limit);
    }
    res.status(200).json(responsePayload);
  } catch (error) {
    return sendErrorResponse(res, error, 'Failed to fetch visitors');
  }
};

// Approve Visitor
exports.approveVisitor = async (req, res) => {
  try {
    const { visitorId } = req.params;
    const visitor = await VisitorService.getVisitorById(visitorId, { populate: { path: 'visitingStudentId', select: 'hostelId' } });
    if (!visitor) {
      return res.status(404).json({ success: false, message: 'Visitor not found' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    const studentHostelId = String(visitor.visitingStudentId?.hostelId || '');
    if (!studentHostelId || studentHostelId !== String(targetHostelId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to approve visitors for this hostel' });
    }

    const updated = await VisitorService.approveVisitor(visitorId, {
      user: req.user,
      entryTime: new Date(),
    });

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    return sendErrorResponse(res, error, 'Failed to approve visitor');
  }
};

// Reject Visitor
exports.rejectVisitor = async (req, res) => {
  try {
    const { visitorId } = req.params;
    const { rejectionReason } = req.body;
    const visitor = await VisitorService.getVisitorById(visitorId, { populate: { path: 'visitingStudentId', select: 'hostelId' } });
    if (!visitor) {
      return res.status(404).json({ success: false, message: 'Visitor not found' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    const studentHostelId = String(visitor.visitingStudentId?.hostelId || '');
    if (!studentHostelId || studentHostelId !== String(targetHostelId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to reject visitors for this hostel' });
    }

    const updated = await VisitorService.rejectVisitor(visitorId, {
      user: req.user,
      rejectionReason,
    });

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    return sendErrorResponse(res, error, 'Failed to reject visitor');
  }
};

// Delete Visitor
exports.deleteVisitor = async (req, res) => {
  try {
    const { visitorId } = req.params;
    const visitor = await VisitorService.getVisitorById(visitorId, { populate: { path: 'visitingStudentId', select: 'hostelId' } });
    if (!visitor) {
      return res.status(404).json({ success: false, message: 'Visitor record not found' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    const studentHostelId = String(visitor.visitingStudentId?.hostelId || '');
    if (!studentHostelId || studentHostelId !== String(targetHostelId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete visitor records for this hostel' });
    }

    await VisitorService.deleteVisitor(visitorId);
    res.status(200).json({ success: true, message: 'Visitor record deleted successfully' });
  } catch (error) {
    return sendErrorResponse(res, error, 'Failed to delete visitor');
  }
};

// Create Visitor (Manual entry by warden)
exports.createVisitor = async (req, res) => {
  try {
    const { visitorName, visitorPhone, visitorIdProof, visitingStudentId, purpose, visitDate, autoApprove } = req.body;
    if (!visitorName || !visitorPhone || !visitingStudentId || !purpose) {
      return res.status(400).json({ success: false, message: 'Visitor name, phone, student, and purpose are required' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    const student = await User.findById(visitingStudentId);
    if (!student || String(student.hostelId) !== String(targetHostelId)) {
      return res.status(404).json({ success: false, message: 'Visiting student not found in this hostel' });
    }

    const now = new Date();
    const visitor = await VisitorService.createVisitor({
      visitorName,
      visitorPhone,
      visitorIdProof: visitorIdProof || '',
      visitingStudentId,
      purpose,
      visitDate: visitDate ? new Date(visitDate) : now,
      status: autoApprove ? 'approved' : 'pending',
      approvedBy: autoApprove ? req.user.id : undefined,
      entryTime: autoApprove ? now : undefined,
    });

    const populatedVisitor = await Visitor.findById(visitor._id).populate('visitingStudentId', 'name roomId phone');
    res.status(201).json({ success: true, data: populatedVisitor, message: 'Visitor registered successfully' });
  } catch (error) {
    return sendErrorResponse(res, error, 'Failed to register visitor');
  }
};

// Checkout Visitor
exports.checkoutVisitor = async (req, res) => {
  try {
    const { visitorId } = req.params;
    const visitor = await VisitorService.getVisitorById(visitorId, { populate: { path: 'visitingStudentId', select: 'hostelId' } });
    if (!visitor) {
      return res.status(404).json({ success: false, message: 'Visitor record not found' });
    }

    const targetHostelId = await resolveWardenHostelId(req);
    const studentHostelId = String(visitor.visitingStudentId?.hostelId || '');
    if (!studentHostelId || studentHostelId !== String(targetHostelId)) {
      return res.status(403).json({ success: false, message: 'Not authorized for this hostel' });
    }

    const updated = await VisitorService.checkoutVisitor(visitorId, {
      user: req.user,
      exitTime: new Date(),
    });

    res.status(200).json({ success: true, data: updated, message: 'Visitor checked out successfully' });
  } catch (error) {
    return sendErrorResponse(res, error, 'Failed to checkout visitor');
  }
};
