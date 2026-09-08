const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  hostelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel',
    required: true,
  },
  type: {
    type: String,
    enum: ['hostel_rent', 'fine', 'mess', 'maintenance', 'other'],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending',
  },
  paymentMethod: {
    type: String,
    enum: ['upi', 'card', 'netbanking', 'cash', 'other'],
  },
  transactionId: String,
  razorpayOrderId: String,
  invoiceId: String,
  dueDate: Date,
  paidDate: Date,
  periodStart: Date,
  periodEnd: Date,
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
  },
  metadata: mongoose.Schema.Types.Mixed,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

paymentSchema.index({ razorpayOrderId: 1 }, { sparse: true });
paymentSchema.index({ studentId: 1, status: 1 });
paymentSchema.index({ hostelId: 1, status: 1 });
paymentSchema.index({ hostelId: 1, createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);

