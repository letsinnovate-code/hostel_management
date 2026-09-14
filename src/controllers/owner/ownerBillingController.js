/**
 * @file controllers/owner/ownerBillingController.js
 * @description Owner billing, fee structure, payment, and plan controller.
 */

'use strict';

const mongoose = require('mongoose');
const FeeStructure = require('../../models/FeeStructure');
const Payment = require('../../models/Payment');
const Plan = require('../../models/Plan');
const User = require('../../models/User');
const Hostel = require('../../models/Hostel');
const { assertOwnsHostel, getOwnerHostelIds, getScopedHostelIds } = require('./ownerHelper');
const { setPeriodFromPlan } = require('../../utils/paymentPeriod');

exports.createFeeStructure = async (req, res) => {
  try {
    const { hostelId, name, type, amount, frequency, applicableTo, roomCategories, roomIds, isActive } = req.body;
    if (!hostelId || !name || !type || amount === undefined) {
      return res.status(400).json({ success: false, message: 'hostelId, name, type, and amount are required' });
    }
    await assertOwnsHostel(req, hostelId);
    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      return res.status(400).json({ success: false, message: 'Amount must be a non-negative number' });
    }
    const validTypes = ['hostel_rent', 'fine', 'mess', 'maintenance', 'other'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ success: false, message: `Invalid type. Allowed: ${validTypes.join(', ')}` });
    }

    const feeStructureData = {
      hostelId,
      name: String(name).trim().slice(0, 100),
      type,
      amount: parsedAmount,
      frequency: ['one-time', 'monthly', 'yearly'].includes(frequency) ? frequency : 'monthly',
      applicableTo: ['all', 'room_category', 'specific_rooms'].includes(applicableTo) ? applicableTo : 'all',
      roomCategories: Array.isArray(roomCategories) ? roomCategories.map(String) : [],
      roomIds: Array.isArray(roomIds) ? roomIds : [],
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    };
    const feeStructure = await FeeStructure.create(feeStructureData);
    res.status(201).json({ success: true, data: feeStructure });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};


exports.getFeeStructures = async (req, res) => {
  try {
    await assertOwnsHostel(req, req.params.hostelId);
    const feeStructures = await FeeStructure.find({ hostelId: req.params.hostelId })
      .populate('roomIds', 'roomNumber category');
    res.status(200).json({ success: true, data: feeStructures });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Plans (1 / 3 / 6 / 12 month rent plans)

exports.getPlans = async (req, res) => {
  try {
    await assertOwnsHostel(req, req.params.hostelId);
    const plans = await Plan.find({ hostelId: req.params.hostelId }).sort({ durationMonths: 1 });
    res.status(200).json({ success: true, data: plans });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};


exports.seedPlans = async (req, res) => {
  try {
    const hostelId = req.params.hostelId;
    await assertOwnsHostel(req, hostelId);
    const existing = await Plan.countDocuments({ hostelId });
    if (existing > 0) {
      return res.status(400).json({ success: false, message: 'Plans already exist for this hostel. Delete or edit them instead.' });
    }
    const defaults = [
      { name: '1 Month', durationMonths: 1, amount: 0 },
      { name: '3 Months', durationMonths: 3, amount: 0 },
      { name: '6 Months', durationMonths: 6, amount: 0 },
      { name: '12 Months', durationMonths: 12, amount: 0 },
    ];
    const plans = await Plan.insertMany(defaults.map((p) => ({ ...p, hostelId })));
    res.status(201).json({ success: true, data: plans, message: 'Plans seeded (1, 3, 6, 12 month). Update amounts in the table.' });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};


exports.updatePlan = async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    await assertOwnsHostel(req, plan.hostelId);
    const updated = await Plan.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Get applicable fee amount for a student by fee type (based on room/category)

exports.getApplicableFeeForStudent = async (req, res) => {
  try {
    const { hostelId, studentId } = req.params;
    await assertOwnsHostel(req, hostelId);
    const { type } = req.query;
    const student = await User.findById(studentId).populate('roomId', 'category _id');
    if (!student || !student.hostelId || student.hostelId.toString() !== hostelId) {
      return res.status(404).json({ success: false, message: 'Student not found in this hostel' });
    }
    const feeStructures = await FeeStructure.find({
      hostelId,
      type: type || { $exists: true },
      isActive: true,
    });
    const roomCategory = student.roomId?.category;
    const roomIdStr = student.roomId?._id?.toString();
    const pick = (list) => {
      for (const f of list) {
        if (f.applicableTo === 'specific_rooms' && f.roomIds?.length) {
          const ids = (f.roomIds || []).map((r) => (r._id || r).toString());
          if (roomIdStr && ids.includes(roomIdStr)) return f;
        }
        if (f.applicableTo === 'room_category' && f.roomCategories?.length && roomCategory) {
          if (f.roomCategories.includes(roomCategory)) return f;
        }
        if (f.applicableTo === 'all') return f;
      }
      return null;
    };
    const byType = {};
    for (const f of feeStructures) {
      if (!byType[f.type]) byType[f.type] = [];
      byType[f.type].push(f);
    }
    const result = {};
    for (const t of Object.keys(byType)) {
      const ordered = [...(byType[t].filter((f) => f.applicableTo === 'specific_rooms')), ...(byType[t].filter((f) => f.applicableTo === 'room_category')), ...(byType[t].filter((f) => f.applicableTo === 'all'))];
      const applicable = pick(ordered);
      if (applicable) result[t] = { amount: applicable.amount, name: applicable.name, frequency: applicable.frequency };
    }
    if (type) {
      return res.status(200).json({ success: true, data: result[type] || null });
    }
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};


exports.createPayment = async (req, res) => {
  try {
    const {
      studentId,
      hostelId,
      type,
      amount,
      status,
      paymentMethod,
      transactionId,
      dueDate,
      paidDate,
      periodStart,
      periodEnd,
      planId,
      metadata,
    } = req.body;

    if (!studentId || !hostelId || !type || amount === undefined || amount === null) {
      return res.status(400).json({ success: false, message: 'studentId, hostelId, type, and amount are required' });
    }

    await assertOwnsHostel(req, hostelId);

    // Verify student belongs to hostel
    const student = await User.findById(studentId).select('hostelId');
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    if (String(student.hostelId) !== String(hostelId)) {
      return res.status(400).json({ success: false, message: 'Student does not belong to the specified hostel' });
    }

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      return res.status(400).json({ success: false, message: 'Amount must be a non-negative number' });
    }

    const validTypes = ['hostel_rent', 'fine', 'mess', 'maintenance', 'other'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ success: false, message: `Invalid payment type. Allowed: ${validTypes.join(', ')}` });
    }

    const validStatuses = ['pending', 'paid', 'failed', 'refunded'];
    const finalStatus = status && validStatuses.includes(status) ? status : 'pending';

    let normalizedMethod = paymentMethod;
    if (normalizedMethod === 'offline_cash') normalizedMethod = 'cash';
    const validMethods = ['upi', 'card', 'netbanking', 'cash', 'other'];
    if (normalizedMethod && !validMethods.includes(normalizedMethod)) {
      return res.status(400).json({ success: false, message: `Invalid payment method. Allowed: ${validMethods.join(', ')}` });
    }

    const paymentData = {
      studentId,
      hostelId,
      type,
      amount: parsedAmount,
      status: finalStatus,
      paymentMethod: normalizedMethod,
      transactionId: typeof transactionId === 'string' ? transactionId.slice(0, 100) : undefined,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      paidDate: paidDate ? new Date(paidDate) : (finalStatus === 'paid' ? new Date() : undefined),
      periodStart: periodStart ? new Date(periodStart) : undefined,
      periodEnd: periodEnd ? new Date(periodEnd) : undefined,
      planId: planId || undefined,
      metadata: typeof metadata === 'object' ? metadata : undefined,
    };

    if (planId) {
      const plan = await Plan.findById(planId).select('durationMonths').lean();
      if (plan && plan.durationMonths) {
        const startDate = dueDate ? new Date(dueDate) : new Date();
        setPeriodFromPlan(paymentData, startDate, plan.durationMonths);
      }
    }

    const payment = await Payment.create(paymentData);
    res.status(201).json({ success: true, data: payment });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};


exports.getPayments = async (req, res) => {
  try {
    const { hostelId, studentId, status, type } = req.query;
    // Security: scope payments to owner's hostels only
    const scopedHostelIds = await getScopedHostelIds(req, hostelId);
    if (scopedHostelIds.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }
    const filter = { hostelId: { $in: scopedHostelIds } };
    if (studentId) filter.studentId = studentId;
    if (status) filter.status = status;
    if (type) filter.type = type;

    let payments = await Payment.find(filter)
      .populate({ path: 'studentId', select: 'name email roomId planId', populate: [{ path: 'roomId', select: 'roomNumber category' }, { path: 'planId', select: 'name durationMonths amount' }] })
      .populate('hostelId', 'name')
      .populate('planId', 'name durationMonths amount')
      .sort({ createdAt: -1 })
      .lean();
    // Backfill period for paid payments that have plan but no period
    for (const p of payments) {
      if (p.status === 'paid' && p.planId && (!p.periodStart || !p.periodEnd) && p.planId.durationMonths) {
        const start = p.paidDate ? new Date(p.paidDate) : new Date(p.updatedAt || p.createdAt);
        setPeriodFromPlan(p, start, p.planId.durationMonths);
        await Payment.updateOne({ _id: p._id }, { $set: { periodStart: p.periodStart, periodEnd: p.periodEnd } });
      }
    }
    res.status(200).json({ success: true, data: payments });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};


exports.updatePaymentStatus = async (req, res) => {
  try {
    const { status, transactionId, paymentMethod } = req.body;
    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }
    await assertOwnsHostel(req, payment.hostelId);
    payment.status = status;
    if (transactionId != null) payment.transactionId = transactionId;
    if (paymentMethod != null) payment.paymentMethod = paymentMethod;
    if (status === 'paid') {
      payment.paidDate = new Date();
      if (payment.planId) {
        const plan = await Plan.findById(payment.planId).select('durationMonths').lean();
        if (plan && plan.durationMonths) setPeriodFromPlan(payment, payment.paidDate, plan.durationMonths);
      }
    } else {
      payment.paidDate = null;
    }
    await payment.save();
    const updated = await Payment.findById(payment._id)
      .populate('studentId', 'name roomId')
      .populate('planId', 'name durationMonths amount')
      .lean();
    res.status(200).json({ success: true, data: updated || payment });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};


exports.deletePayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }
    await assertOwnsHostel(req, payment.hostelId);
    await Payment.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, data: { _id: payment._id } });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};


exports.generateInvoice = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id).populate('studentId').populate('hostelId');
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }
    await assertOwnsHostel(req, payment.hostelId?._id || payment.hostelId);

    const invoiceId = `INV-${Date.now()}-${payment._id.toString().slice(-6)}`;
    payment.invoiceId = invoiceId;
    await payment.save();

    res.status(200).json({
      success: true,
      data: {
        invoiceId,
        payment,
        generatedAt: new Date(),
      },
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

