const mongoose = require('mongoose');

const amenitySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  hostelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel',
    required: true,
  },
  category: {
    type: String,
    enum: ['wifi', 'laundry', 'mess', 'parking', 'gym', 'library', 'common-room', 'tv-room', 'study-room', 'security', 'medical', 'sports', 'other'],
    required: true,
  },
  description: String,
  isAvailable: {
    type: Boolean,
    default: true,
  },
  // Inventory/Quantity tracking
  quantity: {
    type: Number,
    default: 1,
  },
  availableQuantity: {
    type: Number,
    default: 1,
  },
  unit: {
    type: String,
    enum: ['unit', 'piece', 'room', 'machine', 'slot', 'other'],
    default: 'unit',
  },
  // Pricing
  cost: {
    type: Number,
    default: 0,
  },
  costType: {
    type: String,
    enum: ['free', 'monthly', 'per-use', 'one-time'],
    default: 'free',
  },
  // Additional details based on category
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  images: [String], // S3 URLs
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

amenitySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Amenity', amenitySchema);

