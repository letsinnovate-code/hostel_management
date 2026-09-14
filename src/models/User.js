const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
    select: false,
  },
  role: {
    type: [String],
    enum: ['owner', 'warden', 'cleaner', 'supervisor', 'student', 'security', 'superadmin'],
    required: true,
    default: [],
  },
  currentRole: {
    type: String,
    default: null,
  },
  // Optional: multiple roles for staff (e.g. warden + supervisor)
  roles: [{
    type: String,
    enum: ['owner', 'warden', 'cleaner', 'supervisor', 'student', 'security', 'superadmin'],
  }],
  phone: {
    type: String,
    required: true,
  },
  hostelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel',
  },
  blockId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Block',
  },
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
  },
  room: String, // String snapshot of roomNumber (e.g. 204 or B-102)
  bedNumber: String,
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
  },
  studentId: {
    type: String,
    unique: true,
    sparse: true,
  },
  status: {
    type: String,
    enum: ['active', 'on-leave', 'exited', 'suspended', 'pending_onboarding'],
    default: 'active',
    index: true,
  },
  tokenVersion: {
    type: Number,
    default: 0,
    index: true,
  },
  onboardingStatus: {
    type: String,
    enum: ['not_started', 'in_progress', 'completed'],
    default: 'not_started',
    index: true,
  },
  onboardingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StudentOnboarding',
  },
  academicInfo: {
    college: String,
    department: String,
    semester: String,
    admissionNumber: String,
    studentIdNumber: String,
    course: String,
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
  },
  course: {
    type: String,
    trim: true,
  },
  year: {
    type: String,
    trim: true,
  },
  parentContact: {
    name: String,
    phone: String,
    email: String,
    relation: String,
    relationship: String,
    address: String,
    occupation: String,
  },
  parentInfo: {
    name: String,
    phone: String,
    email: String,
    relation: String,
    relationship: String,
    address: String,
    occupation: String,
  },
  profileImage: String,
  documents: [{
    type: { type: String }, // 'aadhar', 'pan', 'college-id', 'address-proof', 'other'
    name: String,
    url: String,
    uploadedAt: { type: Date, default: Date.now },
  }],
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    country: { type: String, default: 'India' },
  },
  dateOfBirth: Date,
  emergencyContact: {
    name: String,
    phone: String,
    relation: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastLogin: Date,
  locationPermissionStatus: {
    type: String,
    enum: ['granted', 'denied', 'not_requested'],
    default: 'not_requested',
  },
  lastLocationUpdate: Date,
  currentLocation: {
    latitude: Number,
    longitude: Number,
    timestamp: Date,
    accuracy: Number,
  },
  pushToken: {
    type: String,
    default: null,
  },
  expoPushToken: {
    type: String,
    default: null,
  },
  welcomeEmailSent: {
    type: Boolean,
    default: false,
    index: true,
  },
  welcomeEmailSentAt: {
    type: Date,
  },
});

userSchema.index({ hostelId: 1, role: 1, status: 1 });
userSchema.index({ hostelId: 1, roomId: 1 });
userSchema.index({ roomId: 1, role: 1 });

userSchema.pre('save', async function (next) {
  // Normalize role to array and ensure currentRole is set
  if (Array.isArray(this.role)) {
    if (this.role.length === 0) this.role = ['student'];
  } else if (typeof this.role === 'string' && this.role) {
    this.role = [this.role];
  } else {
    this.role = ['student'];
  }

  if (!this.currentRole && this.role.length > 0) {
    this.currentRole = this.role[0];
  }

  // Canonical Parent Contact synchronization (TASK 4)
  const pc = this.parentContact;
  const pi = this.parentInfo;
  if ((!pc || (!pc.name && !pc.phone)) && pi && (pi.name || pi.phone)) {
    this.parentContact = {
      name: pi.name || '',
      phone: pi.phone || '',
      email: pi.email || '',
      relation: pi.relation || pi.relationship || '',
      relationship: pi.relationship || pi.relation || '',
      address: pi.address || '',
      occupation: pi.occupation || '',
    };
  }
  // Keep parentInfo synchronized for legacy readers
  if (this.parentContact && (this.parentContact.name || this.parentContact.phone)) {
    this.parentInfo = {
      name: this.parentContact.name || '',
      phone: this.parentContact.phone || '',
      email: this.parentContact.email || '',
      relation: this.parentContact.relation || this.parentContact.relationship || '',
      relationship: this.parentContact.relationship || this.parentContact.relation || '',
      address: this.parentContact.address || '',
      occupation: this.parentContact.occupation || '',
    };
  }

  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.invalidateTokens = async function () {
  this.tokenVersion = (this.tokenVersion || 0) + 1;
  return await this.save();
};

module.exports = mongoose.model('User', userSchema);

