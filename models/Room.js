const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  roomNumber: {
    type: String,
    required: true,
  },
  hostelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel',
    required: false, // optional for backward compatibility with existing rooms
  },
  blockId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Block',
    required: false,
  },
  floorNumber: {
    type: Number,
    required: true,
  },
  capacity: {
    type: Number,
    required: true,
    default: 2,
  },
  currentOccupancy: {
    type: Number,
    default: 0,
  },
  students: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  status: {
    type: String,
    enum: ['available', 'occupied', 'maintenance', 'unavailable'],
    default: 'available',
  },
  category: {
    type: String,
    enum: ['AC', 'Non-AC', 'Deluxe', 'Standard'],
    default: 'Standard',
  },
  pricing: {
    monthly: { type: Number, default: 0 },
    yearly: { type: Number, default: 0 },
    perBed: { type: Number, default: 0 },
  },
  amenities: [String],
  images: [String], // S3 URLs for room images
  coverImage: String, // Main cover image S3 URL
  description: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

roomSchema.index({ hostelId: 1, blockId: 1, roomNumber: 1 });
roomSchema.index({ hostelId: 1, status: 1 });

module.exports = mongoose.model('Room', roomSchema);

