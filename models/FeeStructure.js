const mongoose = require('mongoose');

const feeStructureSchema = new mongoose.Schema({
  hostelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel',
    required: true,
  },
  name: {
    type: String,
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
  frequency: {
    type: String,
    enum: ['one-time', 'monthly', 'yearly'],
    default: 'monthly',
  },
  applicableTo: {
    type: String,
    enum: ['all', 'room_category', 'specific_rooms'],
    default: 'all',
  },
  roomCategories: [String],
  roomIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
  }],
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('FeeStructure', feeStructureSchema);

