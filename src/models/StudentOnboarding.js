const mongoose = require('mongoose');

const studentOnboardingSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hostel',
      index: true,
    },
    blockId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Block',
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      index: true,
    },
    bedNumber: {
      type: String,
      trim: true,
      default: '',
    },
    roomType: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: [
        'REGISTERED',
        'PROFILE_INCOMPLETE',
        'PROFILE_COMPLETED',
        'DOCUMENTS_PENDING',
        'DOCUMENTS_UNDER_REVIEW',
        'DOCUMENTS_APPROVED',
        'ROOM_ALLOCATION_PENDING',
        'ROOM_ALLOCATED',
        'PAYMENT_PENDING',
        'PAYMENT_COMPLETED',
        'AGREEMENT_PENDING',
        'AGREEMENT_COMPLETED',
        'FINAL_REVIEW',
        'ONBOARDING_COMPLETED',
        'CORRECTION_REQUIRED',
        'REJECTED',
        'CANCELLED',
        'SUSPENDED',
      ],
      default: 'REGISTERED',
      index: true,
    },
    currentStep: {
      type: String,
      enum: ['profile', 'contacts', 'documents', 'room', 'payment', 'agreement', 'review', 'completed'],
      default: 'profile',
    },
    progressPercentage: {
      type: Number,
      default: 15,
      min: 0,
      max: 100,
    },
    // 1. Personal Information
    personalInfo: {
      fullName: { type: String, trim: true },
      dateOfBirth: Date,
      gender: { type: String, enum: ['male', 'female', 'other', ''] },
      phone: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true },
      bloodGroup: { type: String, trim: true },
      nationality: { type: String, default: 'Indian' },
      address: {
        street: { type: String, default: '' },
        city: { type: String, default: '' },
        state: { type: String, default: '' },
        pincode: { type: String, default: '' },
        country: { type: String, default: 'India' },
      },
    },
    // 2. Academic Information
    academicInfo: {
      studentIdNumber: { type: String, trim: true }, // College enrollment or roll ID
      college: { type: String, trim: true },
      course: { type: String, trim: true },
      department: { type: String, trim: true },
      yearSemester: { type: String, trim: true },
      admissionDate: Date,
      admissionNumber: { type: String, trim: true },
    },
    // 3. Parent / Guardian Details
    parentInfo: {
      name: { type: String, trim: true },
      relationship: { type: String, trim: true },
      phone: { type: String, trim: true },
      email: { type: String, trim: true },
      address: { type: String, trim: true },
      occupation: { type: String, trim: true },
    },
    // 4. Emergency Contact
    emergencyContact: {
      name: { type: String, trim: true },
      relationship: { type: String, trim: true },
      phone: { type: String, trim: true },
      alternatePhone: { type: String, trim: true },
    },
    // 5. Document Management
    documents: [
      {
        documentType: {
          type: String,
          enum: [
            'govt_id',
            'gov_id',
            'college_id',
            'admission_proof',
            'photograph',
            'photo',
            'address_proof',
            'aadhar',
            'pan',
            'other',
          ],
          required: true,
        },
        name: { type: String, required: true },
        url: { type: String, required: true },
        fileType: { type: String, default: 'image/jpeg' },
        fileSize: { type: Number, default: 0 },
        uploadedAt: { type: Date, default: Date.now },
        status: {
          type: String,
          enum: ['not_uploaded', 'uploaded', 'under_review', 'approved', 'rejected', 'resubmission_required'],
          default: 'under_review',
        },
        rejectionReason: { type: String, default: '' },
        correctionInstructions: { type: String, default: '' },
        verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        verifiedAt: Date,
      },
    ],
    // 6. Fee & Payment Breakdown
    feeDetails: {
      feeStructureId: { type: mongoose.Schema.Types.ObjectId, ref: 'FeeStructure' },
      hostelRent: { type: Number, default: 0 },
      securityDeposit: { type: Number, default: 0 },
      additionalCharges: { type: Number, default: 0 },
      totalAmount: { type: Number, default: 0 },
      amountPaid: { type: Number, default: 0 },
      amountPending: { type: Number, default: 0 },
      paymentStatus: {
        type: String,
        enum: ['pending', 'payment_initiated', 'successful', 'failed', 'refunded', 'partially_paid'],
        default: 'pending',
      },
      paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
      transactionId: { type: String, default: '' },
      paymentMethod: { type: String, default: '' },
      receiptUrl: { type: String, default: '' },
      paidAt: Date,
      offlinePaymentReceipt: {
        confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        confirmedAt: Date,
        notes: { type: String, default: '' },
        referenceNo: { type: String, default: '' },
      },
    },
    // 7. Rules & Agreement Acceptance
    agreement: {
      accepted: { type: Boolean, default: false },
      acceptedAt: Date,
      agreementVersion: { type: String, default: '1.0' },
      ipAddress: { type: String, default: '' },
      userAgent: { type: String, default: '' },
      rulesSnapshot: [{ type: String }],
    },
    // 8. Administrative Approval & Verification
    approval: {
      approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      approvedAt: Date,
      remarks: { type: String, default: '' },
      rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      rejectedAt: Date,
      rejectionReason: { type: String, default: '' },
      correctionRequestedAt: Date,
      correctionNotes: { type: String, default: '' },
    },
    // 9. Chronological Action Timeline
    timeline: [
      {
        step: { type: String, required: true },
        action: { type: String, required: true },
        fromStatus: { type: String },
        toStatus: { type: String },
        performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        performedByName: { type: String, default: '' },
        performedByRole: { type: String, default: '' },
        notes: { type: String, default: '' },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    // Draft persistence for saving progress
    draftData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Smoothness Metrics
    metrics: {
      startedAt: { type: Date, default: Date.now },
      completedAt: Date,
      totalDurationMinutes: { type: Number, default: 0 },
      correctionsCount: { type: Number, default: 0 },
      rejectionsCount: { type: Number, default: 0 },
      deviceType: { type: String, default: 'desktop' },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Helpful Virtuals for Frontend & API Ergonomics
studentOnboardingSchema.virtual('guardianInfo').get(function () {
  return this.parentInfo;
});

studentOnboardingSchema.virtual('roomAllocated').get(function () {
  return !!this.roomId;
});

studentOnboardingSchema.virtual('paymentCompleted').get(function () {
  return this.feeDetails?.paymentStatus === 'successful';
});

studentOnboardingSchema.virtual('documentsApproved').get(function () {
  const docs = this.documents || [];
  return docs.length > 0 && docs.every((d) => d.status === 'approved');
});

studentOnboardingSchema.virtual('agreementAccepted').get(function () {
  return !!this.agreement?.accepted;
});

studentOnboardingSchema.virtual('agreementAcceptedAt').get(function () {
  return this.agreement?.acceptedAt;
});

studentOnboardingSchema.virtual('agreementVersion').get(function () {
  return this.agreement?.agreementVersion || '1.0';
});

studentOnboardingSchema.virtual('agreementAudit').get(function () {
  return this.agreement;
});

studentOnboardingSchema.virtual('allocationDetails').get(function () {
  if (!this.roomId) return null;
  return {
    roomId: this.roomId._id || this.roomId,
    roomNumber: this.roomId.roomNumber || '',
    floor: this.roomId.floorNumber || 1,
    bedNumber: this.bedNumber || 'Bed 1',
    roomType: this.roomId.category || this.roomType || 'Standard',
    allocatedAt: this.allocationDate,
  };
});

studentOnboardingSchema.index({ hostelId: 1, status: 1 });
studentOnboardingSchema.index({ hostelId: 1, createdAt: -1 });
studentOnboardingSchema.index({ studentId: 1, status: 1 });

module.exports = mongoose.model('StudentOnboarding', studentOnboardingSchema);
