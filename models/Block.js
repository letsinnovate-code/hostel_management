const mongoose = require('mongoose');

const blockSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  hostelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel',
    required: true,
  },
  floors: [{
    floorNumber: {
      type: Number,
      required: true,
    },
    rooms: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
    }],
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Block', blockSchema);

