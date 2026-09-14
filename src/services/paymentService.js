/**
 * @file services/paymentService.js
 * @description Domain service for Payments, Razorpay order workflows, invoices, and fee calculations.
 */

'use strict';

const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const FeeStructure = require('../models/FeeStructure');
const PaymentAdapter = require('../adapters/paymentAdapter');
const AuditLog = require('../models/AuditLog');

class PaymentService {
  /**
   * Create Razorpay order for student payment
   */
  static async createStudentPaymentOrder({ studentId, hostelId, feeStructureId, paymentId, invoiceId, type }) {
    if (!hostelId) throw new Error('Not assigned to a hostel');

    let finalAmount = null;
    let resolvedFeeStructureId = feeStructureId;
    let targetPayment = null;

    const targetPaymentId = paymentId || invoiceId;
    if (targetPaymentId) {
      if (!mongoose.Types.ObjectId.isValid(String(targetPaymentId))) {
        throw new Error('Invalid payment or invoice ID');
      }
      targetPayment = await Payment.findOne({ _id: targetPaymentId, studentId });
      if (!targetPayment) throw new Error('Payment record not found for this student');
      if (targetPayment.status === 'paid') throw new Error('This invoice has already been paid');
      finalAmount = Number(targetPayment.amount);
      if (targetPayment.metadata?.feeStructureId) {
        resolvedFeeStructureId = targetPayment.metadata.feeStructureId;
      }
    } else if (feeStructureId) {
      if (!mongoose.Types.ObjectId.isValid(String(feeStructureId))) {
        throw new Error('Invalid fee structure ID');
      }
      const fee = await FeeStructure.findOne({ _id: feeStructureId, hostelId, isActive: true });
      if (!fee) throw new Error('Active fee structure not found for this hostel');
      finalAmount = Number(fee.amount);
    } else {
      throw new Error('Authoritative feeStructureId, invoiceId, or paymentId is required');
    }

    if (!finalAmount || finalAmount < 1 || isNaN(finalAmount)) {
      throw new Error('Invalid authoritative fee amount');
    }

    let payment = targetPayment;
    if (!payment) {
      payment = await Payment.create({
        studentId,
        hostelId,
        type: type || 'hostel_rent',
        amount: finalAmount,
        status: 'pending',
        metadata: { feeStructureId: resolvedFeeStructureId },
      });
    } else if (payment.amount !== finalAmount) {
      payment.amount = finalAmount;
    }

    const orderData = await PaymentAdapter.createOrder(finalAmount, payment._id.toString(), {
      paymentId: payment._id.toString(),
    });
    if (!orderData) throw new Error('Failed to create Razorpay order');

    payment.razorpayOrderId = orderData.id;
    await payment.save();

    return {
      orderId: orderData.id,
      amount: orderData.amount,
      currency: orderData.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      paymentId: payment._id,
      payment,
    };
  }

  /**
   * Verify Razorpay payment and mark Payment as paid
   */
  static async verifyPayment({ razorpayOrderId, razorpayPaymentId, razorpaySignature, paymentId }) {
    const isValid = PaymentAdapter.verifyPaymentSignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );
    if (!isValid) throw new Error('Invalid payment signature');

    let payment = null;
    if (paymentId) {
      payment = await Payment.findById(paymentId);
    }
    if (!payment && razorpayOrderId) {
      payment = await Payment.findOne({ razorpayOrderId });
    }
    if (!payment) throw new Error('Payment record not found');

    payment.status = 'paid';
    payment.paidDate = new Date();
    payment.transactionId = razorpayPaymentId;
    await payment.save();

    return payment;
  }

  /**
   * List payments with filtering & pagination
   */
  static async listPayments(filter = {}, options = {}) {
    let query = Payment.find(filter)
      .populate('studentId', 'name email phone admissionNumber roomId')
      .populate('hostelId', 'name');

    if (options.sort) query = query.sort(options.sort);
    if (options.limit) query = query.limit(options.limit);
    if (options.skip) query = query.skip(options.skip);

    const [payments, total] = await Promise.all([
      query.lean(),
      Payment.countDocuments(filter),
    ]);

    return { payments, total };
  }
}

module.exports = PaymentService;
