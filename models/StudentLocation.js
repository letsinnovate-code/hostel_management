const mongoose = require('mongoose');

const studentLocationSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    hostelId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hostel',
        required: true,
        index: true,
    },
    location: {
        latitude: {
            type: Number,
            required: true,
        },
        longitude: {
            type: Number,
            required: true,
        },
    },
    isInsideHostel: {
        type: Boolean,
        required: true,
        default: false,
    },
    distanceFromHostel: {
        type: Number, // in meters
    },
    accuracy: {
        type: Number, // GPS accuracy in meters
    },
    source: {
        type: String,
        enum: ['background', 'manual_check', 'owner_triggered'],
        default: 'background',
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true,
    },
});

module.exports = mongoose.model('StudentLocation', studentLocationSchema);
