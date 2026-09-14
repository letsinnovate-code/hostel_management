/**
 * @file controllers/owner/ownerVisitorController.js
 * @description Owner visitor request management controller.
 */

'use strict';

const mongoose = require('mongoose');
const Visitor = require('../../models/Visitor');
const Hostel = require('../../models/Hostel');
const { assertOwnsHostel, getOwnerHostelIds, getScopedHostelIds } = require('./ownerHelper');
const VisitorService = require('../../services/visitorService');
const { VISITOR_STATUS } = require('../../constants');

exports.getVisitorRequests = async (req, res) => {
  try {
    const { hostelId, status } = req.query;
    const scopedHostelIds = await getScopedHostelIds(req, hostelId);
    if (scopedHostelIds.length === 0) {
      return res.status(200).json({ success: true, count: 0, data: [] });
    }

    const filter = { hostelId: { $in: scopedHostelIds } };
    if (status) filter.status = status;

    const { visitors } = await VisitorService.listVisitors({
      filter,
      sort: { createdAt: -1 },
      populate: [
        { path: 'visitingStudentId', select: 'name email phone roomId' },
        { path: 'hostelId', select: 'name' },
      ],
      lean: true,
    });

    res.status(200).json({ success: true, count: visitors.length, data: visitors });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.approveVisitorRequest = async (req, res) => {
  try {
    const visitor = await Visitor.findById(req.params.id);
    if (!visitor) {
      return res.status(404).json({ success: false, message: 'Visitor request not found' });
    }
    await assertOwnsHostel(req, visitor.hostelId);

    const updated = await VisitorService.approveVisitor(req.params.id, {
      user: req.user,
      remarks: req.body.remarks,
    });

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.rejectVisitorRequest = async (req, res) => {
  try {
    const visitor = await Visitor.findById(req.params.id);
    if (!visitor) {
      return res.status(404).json({ success: false, message: 'Visitor request not found' });
    }
    await assertOwnsHostel(req, visitor.hostelId);

    const updated = await VisitorService.rejectVisitor(req.params.id, {
      user: req.user,
      reason: req.body.reason,
    });

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};