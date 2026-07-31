const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  permissionType: {
    type: String,
    enum: ['late-entry', 'leave', 'overnight', 'multi-day'],
    required: true,
  },
  reason: {
    type: String,
    required: true,
  },
  requestedDate: {
    type: Date,
    required: true,
  },
  returnDate: Date, // For leave requests
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'pending',
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  approvedAt: Date,
  rejectionReason: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Permission', permissionSchema);

