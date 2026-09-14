const mongoose = require('mongoose');

const roomAllocationHistorySchema = new mongoose.Schema({
  hostelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel',
    required: true,
    index: true,
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
  },
  fromRoomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
  },
  toRoomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
  },
  action: {
    type: String,
    enum: ['assign', 'transfer', 'vacate', 'status_change', 'maintenance'],
    required: true,
  },
  reason: {
    type: String,
    default: '',
    trim: true,
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

roomAllocationHistorySchema.index({ hostelId: 1, createdAt: -1 });
roomAllocationHistorySchema.index({ toRoomId: 1, createdAt: -1 });
roomAllocationHistorySchema.index({ fromRoomId: 1, createdAt: -1 });
roomAllocationHistorySchema.index({ studentId: 1, createdAt: -1 });

module.exports = mongoose.model('RoomAllocationHistory', roomAllocationHistorySchema);
