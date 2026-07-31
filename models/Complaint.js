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
  },
  description: {
    type: String,
    required: true,
  },
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
  },
  hostelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel',
  },
  blockId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Block',
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  status: {
    type: String,
    enum: ['open', 'assigned', 'in-progress', 'resolved', 'closed'],
    default: 'open',
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
  },
  images: [String],
  /** Optional: 1–5 star rating (used for food/mess feedback) */
  rating: { type: Number, min: 1, max: 5 },
  /** Optional: meal type for mess feedback (e.g. Breakfast, Lunch, Dinner) */
  mealType: { type: String },
  resolvedAt: Date,
  resolutionNotes: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Complaint', complaintSchema);

