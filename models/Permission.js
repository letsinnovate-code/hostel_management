const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  hostelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel',
  },
  permissionType: {
    type: String,
    enum: ['late-entry', 'leave', 'overnight', 'multi-day', 'night-out', 'day-pass', 'emergency', 'medical', 'vacation', 'other'],
    lowercase: true,
    trim: true,
    set: (v) => (typeof v === 'string' ? v.toLowerCase().trim().replace(/_/g, '-') : v),
    required: true,
  },
  reason: {
    type: String,
    required: true,
  },
  destination: {
    type: String,
    default: '',
    trim: true,
  },
  requestedDate: {
    type: Date,
    required: true,
  },
  returnDate: Date, // Expected return date
  actualCheckOutTime: Date, // Timestamp of physical departure
  actualReturnTime: Date, // Timestamp of physical return
  status: {
    type: String,
    enum: ['pending', 'approved', 'checked-out', 'returned', 'rejected', 'cancelled'],
    default: 'pending',
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  approvedAt: Date,
  rejectionReason: String,
  wardenRemarks: {
    type: String,
    default: '',
    trim: true,
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  cancelledAt: Date,
  cancellationReason: String,
  supportingDocuments: [
    {
      name: String,
      url: String,
      uploadedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  emergencyContact: {
    name: String,
    phone: String,
    relation: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes for fast querying, status filtering, overlap checks, and overdue scans
permissionSchema.index({ hostelId: 1, status: 1, createdAt: -1 });
permissionSchema.index({ studentId: 1, status: 1 });
permissionSchema.index({ studentId: 1, requestedDate: 1, returnDate: 1 });
permissionSchema.index({ status: 1, returnDate: 1 });

module.exports = mongoose.model('Permission', permissionSchema);

