const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['announcement', 'alert', 'reminder', 'emergency'],
    default: 'announcement',
  },
  hostelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel',
  },
  targetAudience: {
    type: String,
    enum: ['all', 'students', 'staff', 'wardens', 'cleaners', 'owner', 'superadmin'],
    default: 'all',
  },
  recipients: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  isRead: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    readAt: Date,
  }],
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
  },
  expiresAt: Date,
  /** User IDs who dismissed this notification (student list view) */
  dismissedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes for fast audience query and notification feeds
notificationSchema.index({ hostelId: 1, createdAt: -1 });
notificationSchema.index({ targetAudience: 1, hostelId: 1 });
notificationSchema.index({ 'isRead.userId': 1 });
notificationSchema.index({ dismissedBy: 1 });

module.exports = mongoose.model('Notification', notificationSchema);

