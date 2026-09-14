const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
  hostelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel',
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  durationMonths: {
    type: Number,
    required: true,
    enum: [1, 3, 6, 12],
  },
  amount: {
    type: Number,
    required: true,
    default: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Plan', planSchema);
