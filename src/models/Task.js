const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: String,
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
  },
  taskType: {
    type: String,
    enum: ['cleaning', 'maintenance', 'inspection'],
    default: 'cleaning',
  },
  scheduledDate: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed', 'cancelled'],
    default: 'pending',
  },
  completedAt: Date,
  beforeImages: [String],
  afterImages: [String],
  notes: String,
  rating: {
    type: Number,
    min: 1,
    max: 5,
  },
  feedback: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Task', taskSchema);

