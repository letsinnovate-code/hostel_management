const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['sms', 'email', 'push'],
    required: true,
  },
  category: {
    type: String,
    enum: ['notice', 'holiday', 'emergency', 'payment', 'violation', 'other'],
    default: 'notice',
  },
  subject: String, // For email
  content: {
    type: String,
    required: true,
  },
  variables: [String], // e.g., ['{name}', '{room}', '{date}']
  hostelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel',
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

module.exports = mongoose.model('Template', templateSchema);

