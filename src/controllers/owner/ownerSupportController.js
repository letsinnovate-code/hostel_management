/**
 * @file controllers/owner/ownerSupportController.js
 * @description Owner support ticket, enquiry, and callback request controller.
 */

'use strict';

const mongoose = require('mongoose');
const SupportTicket = require('../../models/SupportTicket');
const Enquiry = require('../../models/Enquiry');
const CallbackRequest = require('../../models/CallbackRequest');
const Hostel = require('../../models/Hostel');
const { assertOwnsHostel, getOwnerHostelIds, getScopedHostelIds } = require('./ownerHelper');

exports.createSupportTicket = async (req, res) => {
  try {
    const { category, priority, subject, description, hostelId, attachments } = req.body;

    if (!category || !subject || !description) {
      return res.status(400).json({ success: false, message: 'category, subject, and description are required' });
    }

    const validCategories = ['technical', 'billing', 'feature_request', 'bug', 'other'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ success: false, message: `Invalid category. Allowed: ${validCategories.join(', ')}` });
    }

    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    const finalPriority = priority && validPriorities.includes(priority) ? priority : 'medium';

    if (hostelId) {
      await assertOwnsHostel(req, hostelId);
    }

    const ticketNumber = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const ticket = await SupportTicket.create({
      ticketNumber,
      raisedBy: req.user.id || req.user._id,
      hostelId: hostelId || undefined,
      category,
      priority: finalPriority,
      subject: String(subject).trim().slice(0, 200),
      description: String(description).trim().slice(0, 2000),
      status: 'open',
      attachments: Array.isArray(attachments) ? attachments.map(String).slice(0, 5) : [],
    });
    res.status(201).json({ success: true, data: ticket });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};


exports.getSupportTickets = async (req, res) => {
  try {
    const tickets = await SupportTicket.find({ raisedBy: req.user.id })
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: tickets });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};



exports.getEnquiries = async (req, res) => {
  try {
    const Enquiry = require('../../models/Enquiry');
    const { hostelId } = req.query;
    const scopedHostelIds = await getScopedHostelIds(req, hostelId);
    if (scopedHostelIds.length === 0) {
      return res.status(200).json({ success: true, count: 0, data: [] });
    }

    const enquiries = await Enquiry.find({ hostelId: { $in: scopedHostelIds } })
      .populate('hostelId', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: enquiries.length, data: enquiries });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Update enquiry status

exports.updateEnquiryStatus = async (req, res) => {
  try {
    const Enquiry = require('../../models/Enquiry');
    const { status, notes } = req.body;

    const enquiry = await Enquiry.findById(req.params.id);
    if (!enquiry) {
      return res.status(404).json({ success: false, message: 'Enquiry not found' });
    }

    await assertOwnsHostel(req, enquiry.hostelId);

    enquiry.status = status || enquiry.status;
    if (notes) enquiry.notes = notes;
    if (status === 'contacted' || status === 'resolved') {
      enquiry.respondedAt = new Date();
    }

    await enquiry.save();
    res.status(200).json({ success: true, data: enquiry });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Get callback requests for owner's hostels

exports.getCallbackRequests = async (req, res) => {
  try {
    const CallbackRequest = require('../../models/CallbackRequest');
    const { hostelId } = req.query;
    const scopedHostelIds = await getScopedHostelIds(req, hostelId);
    if (scopedHostelIds.length === 0) {
      return res.status(200).json({ success: true, count: 0, data: [] });
    }

    const callbacks = await CallbackRequest.find({ hostelId: { $in: scopedHostelIds } })
      .populate('hostelId', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: callbacks.length, data: callbacks });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Update callback request status

exports.updateCallbackStatus = async (req, res) => {
  try {
    const CallbackRequest = require('../../models/CallbackRequest');
    const { status, notes } = req.body;

    const callback = await CallbackRequest.findById(req.params.id);
    if (!callback) {
      return res.status(404).json({ success: false, message: 'Callback request not found' });
    }

    await assertOwnsHostel(req, callback.hostelId);

    callback.status = status || callback.status;
    if (notes) callback.notes = notes;
    if (status === 'called') {
      callback.calledAt = new Date();
    }

    await callback.save();
    res.status(200).json({ success: true, data: callback });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Trigger Attendance Check - Fetches latest location for all students and determines presence