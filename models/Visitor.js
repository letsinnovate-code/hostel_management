const mongoose = require('mongoose');

const visitorSchema = new mongoose.Schema({
  visitorName: {
    type: String,
    required: true,
  },
  visitorPhone: {
    type: String,
    required: true,
  },
  visitorIdProof: {
    type: String,
    default: '',
  },
  visitingStudentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  purpose: {
    type: String,
    required: true,
  },
  visitDate: {
    type: Date,
    default: null,
  },
  entryTime: Date,
  exitTime: Date,
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'completed'],
    default: 'pending',
  },
  rejectionReason: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Visitor', visitorSchema);

