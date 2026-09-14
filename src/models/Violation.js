const mongoose = require('mongoose');

const violationSchema = new mongoose.Schema({
  hostelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel',
    index: true,
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  ruleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Rule',
  },
  title: {
    type: String,
    trim: true,
    default: '',
  },
  violationType: {
    type: String,
    enum: [
      'curfew',
      'late-entry',
      'unauthorized-visitor',
      'noise',
      'damage',
      'improper-checkout',
      'substance',
      'fighting',
      'ragging',
      'theft',
      'misconduct',
      'other'
    ],
    required: true,
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low',
    index: true,
  },
  description: {
    type: String,
    required: true,
  },
  incidentDate: {
    type: Date,
    default: Date.now,
  },
  location: {
    type: String,
    trim: true,
    default: '',
  },
  involvedStudents: [
    {
      studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      name: String,
      rollNumber: String,
      roomNumber: String,
      roleInIncident: {
        type: String,
        enum: ['primary_offender', 'accomplice', 'instigator', 'involved_party', 'bystander'],
        default: 'involved_party',
      },
    },
  ],
  witnesses: [
    {
      name: { type: String, required: true },
      contact: String,
      role: {
        type: String,
        enum: ['student', 'guard', 'cleaning_staff', 'warden', 'faculty', 'other'],
        default: 'student',
      },
      statement: String,
      recordedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  evidence: [
    {
      name: String,
      url: String,
      fileType: String,
      description: String,
      uploadedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  fineAmount: {
    type: Number,
    default: 0,
  },
  warningLevel: {
    type: String,
    enum: ['warning', 'first', 'second', 'final'],
    default: 'warning',
  },
  actionTaken: {
    type: String,
    enum: [
      'none',
      'verbal_warning',
      'written_warning',
      'fine',
      'room_transfer',
      'suspension',
      'parent_summons',
      'community_service',
      'referred_to_committee',
      'other'
    ],
    default: 'none',
  },
  actionDetails: String,
  actionDate: Date,
  actionBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  parentNotified: {
    type: Boolean,
    default: false,
  },
  parentNotifiedAt: Date,
  parentNotificationMethod: {
    type: String,
    enum: ['call', 'sms', 'email', 'in_person', 'whatsapp', 'official_letter', 'other'],
  },
  parentNotificationNotes: String,
  parentContactInfo: String,
  status: {
    type: String,
    enum: ['pending', 'investigating', 'action_taken', 'resolved', 'escalated', 'closed'],
    default: 'pending',
    index: true,
  },
  isEscalated: {
    type: Boolean,
    default: false,
  },
  escalatedTo: {
    type: String,
    enum: ['warden', 'owner', 'parent', 'management', 'committee'],
  },
  escalationReason: String,
  escalatedAt: Date,
  escalatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  resolutionNotes: String,
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  resolvedAt: Date,
  remarks: [
    {
      author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      authorName: String,
      authorRole: {
        type: String,
        set: (v) => (Array.isArray(v) ? v[0] || 'warden' : String(v || 'warden')),
      },
      comment: {
        type: String,
        required: true,
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  timeline: [
    {
      action: {
        type: String,
        required: true,
      },
      performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      performedByName: String,
      performedByRole: {
        type: String,
        set: (v) => (Array.isArray(v) ? v[0] || 'warden' : String(v || 'warden')),
      },
      notes: String,
      fromStatus: String,
      toStatus: String,
      timestamp: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

violationSchema.index({ hostelId: 1, status: 1 });
violationSchema.index({ hostelId: 1, severity: 1 });
violationSchema.index({ hostelId: 1, createdAt: -1 });
violationSchema.index({ studentId: 1, createdAt: -1 });

module.exports = mongoose.model('Violation', violationSchema);

