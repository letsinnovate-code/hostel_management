const mongoose = require('mongoose');

const enquirySchema = new mongoose.Schema({
  hostelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel',
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    enum: ['pending', 'contacted', 'resolved', 'closed'],
    default: 'pending',
  },
  respondedAt: Date,
  notes: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

enquirySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Enquiry', enquirySchema);

