const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  raisedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  complaintType: {
    type: String,
    enum: ['cleaning', 'food', 'safety', 'maintenance', 'other'],
    required: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
    trim: true,
  },
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
  },
  hostelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel',
    required: true,
  },
  blockId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Block',
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  assignedStaffName: {
    type: String,
    trim: true,
  },
  assignedStaffPhone: {
    type: String,
    trim: true,
  },
  assignedStaffRole: {
    type: String,
    trim: true,
  },
  assignedAt: {
    type: Date,
  },
  status: {
    type: String,
    enum: ['open', 'assigned', 'in-progress', 'resolved', 'closed', 'reopened'],
    default: 'open',
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent', 'critical'],
    default: 'medium',
    lowercase: true,
    trim: true,
  },
  images: [String],
  attachments: [
    {
      name: String,
      url: { type: String, required: true },
      fileType: String,
      uploadedAt: { type: Date, default: Date.now },
    },
  ],
  /** Optional: 1–5 star rating (used for food/mess feedback) */
  rating: { type: Number, min: 1, max: 5 },
  /** Optional: meal type for mess feedback (e.g. Breakfast, Lunch, Dinner) */
  mealType: { type: String },
  resolvedAt: Date,
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  resolutionNotes: String,
  closedAt: Date,
  closedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  reopenedAt: Date,
  reopenedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  reopenReason: String,
  isEscalated: {
    type: Boolean,
    default: false,
  },
  escalatedTo: {
    type: String,
    enum: ['owner', 'superadmin', 'management'],
  },
  escalatedAt: Date,
  escalatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  escalationReason: String,
  remarks: [
    {
      author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      authorName: String,
      authorRole: {
        type: String,
        set: (v) => (Array.isArray(v) ? v[0] || 'warden' : String(v || 'warden')),
      },
      comment: {
        type: String,
        required: true,
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  timeline: [
    {
      action: {
        type: String,
        required: true, // e.g., 'created', 'assigned', 'in-progress', 'remark_added', 'resolved', 'reopened', 'closed', 'escalated'
      },
      performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      performedByName: String,
      performedByRole: {
        type: String,
        set: (v) => (Array.isArray(v) ? v[0] || 'warden' : String(v || 'warden')),
      },
      notes: String,
      fromStatus: String,
      toStatus: String,
      timestamp: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes for high performance querying
complaintSchema.index({ hostelId: 1, status: 1 });
complaintSchema.index({ hostelId: 1, priority: 1 });
complaintSchema.index({ raisedBy: 1, createdAt: -1 });
complaintSchema.index({ assignedTo: 1, status: 1 });

module.exports = mongoose.model('Complaint', complaintSchema);
