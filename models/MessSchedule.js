const mongoose = require('mongoose');

const messScheduleSchema = new mongoose.Schema({
  hostelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel',
    required: true,
    index: true,
  },
  mealType: {
    type: String,
    enum: ['breakfast', 'lunch', 'dinner', 'snacks'],
    required: true,
  },
  /** Display name e.g. "Breakfast", "Lunch" */
  title: {
    type: String,
    default: '',
  },
  /** Food items served (e.g. ["Rice", "Dal", "Curry"]) */
  items: [{
    type: String,
    trim: true,
  }],
  /** Time when food service starts (e.g. "07:00") */
  startTime: {
    type: String,
    required: true,
  },
  /** Time when food service ends (e.g. "09:00") */
  endTime: {
    type: String,
    required: true,
  },
  /** Optional: 0 = Sunday, 1 = Monday, ... 6 = Saturday; empty = daily */
  dayOfWeek: {
    type: Number,
    min: 0,
    max: 6,
    default: null,
  },
  active: {
    type: Boolean,
    default: true,
  },
  order: {
    type: Number,
    default: 0,
  },
}, { timestamps: true });

messScheduleSchema.index({ hostelId: 1, mealType: 1, dayOfWeek: 1 });

module.exports = mongoose.model('MessSchedule', messScheduleSchema);
