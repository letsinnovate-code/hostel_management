/**
 * @file controllers/owner/ownerComplaintController.js
 * @description Owner maintenance complaint controller.
 */

'use strict';

const mongoose = require('mongoose');
const Complaint = require('../../models/Complaint');
const Hostel = require('../../models/Hostel');
const { assertOwnsHostel, getOwnerHostelIds, getScopedHostelIds } = require('./ownerHelper');
const ComplaintService = require('../../services/complaintService');
const { COMPLAINT_STATUS } = require('../../constants');

exports.getMaintenanceComplaints = async (req, res) => {
  try {
    const { hostelId, status } = req.query;
    const scopedHostelIds = await getScopedHostelIds(req, hostelId);
    if (scopedHostelIds.length === 0) {
      return res.status(200).json({ success: true, count: 0, data: [] });
    }

    const filter = { hostelId: { $in: scopedHostelIds } };
    if (status) filter.status = status;

    const { complaints } = await ComplaintService.listComplaints({
      filter,
      sort: { createdAt: -1 },
      populate: [
        { path: 'raisedBy', select: 'name email phone roomId' },
        { path: 'roomId', select: 'roomNumber floorNumber' },
        { path: 'assignedTo', select: 'name email phone' },
      ],
      lean: true,
    });

    res.status(200).json({ success: true, count: complaints.length, data: complaints });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.updateComplaintStatus = async (req, res) => {
  try {
    const { status, remarks } = req.body;
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }
    await assertOwnsHostel(req, complaint.hostelId);

    const updated = await ComplaintService.updateStatus(req.params.id, {
      status,
      remarks,
      user: req.user,
      ip: req.ip,
      userAgent: req.headers ? req.headers['user-agent'] : undefined,
    });

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};