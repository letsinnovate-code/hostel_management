const mongoose = require('mongoose');

const hostelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['boys', 'girls', 'co-ed'],
    required: true,
  },
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    country: { type: String, default: 'India' },
    coordinates: {
      latitude: Number,
      longitude: Number,
    },
    formattedAddress: String,
    placeId: String,
  },
  contact: {
    phone: String,
    email: String,
    alternatePhone: String,
    managerName: String,
    managerPhone: String,
    managerEmail: String,
    wardenName: String,
    wardenPhone: String,
    wardenEmail: String,
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  capacity: {
    type: Number,
    default: 0,
  },
  currentOccupancy: {
    type: Number,
    default: 0,
  },
  availableRooms: {
    type: Number,
    default: 0,
  },
  totalRooms: {
    type: Number,
    default: 0,
  },
  totalBlocks: {
    type: Number,
    default: 0,
  },
  totalFloors: {
    type: Number,
    default: 0,
  },
  images: [String], // S3 URLs
  coverImage: String, // Main cover image S3 URL
  amenities: {
    wifi: { type: Boolean, default: false },
    wifiSpeed: String, // e.g., "100 Mbps", "Unlimited"
    wifiCost: { type: Number, default: 0 }, // Monthly cost if not included
    laundry: { type: Boolean, default: false },
    laundryType: { type: String, enum: ['self-service', 'service', 'both'], default: 'self-service' },
    laundryCost: { type: Number, default: 0 },
    mess: { type: Boolean, default: false },
    messType: { type: String, enum: ['vegetarian', 'non-vegetarian', 'both'], default: 'both' },
    messCost: { type: Number, default: 0 }, // Monthly mess charges
    parking: { type: Boolean, default: false },
    parkingType: { type: String, enum: ['two-wheeler', 'four-wheeler', 'both'], default: 'two-wheeler' },
    parkingCost: { type: Number, default: 0 },
    gym: { type: Boolean, default: false },
    gymEquipment: [String], // List of equipment available
    library: { type: Boolean, default: false },
    libraryBooks: { type: Number, default: 0 },
    commonRoom: { type: Boolean, default: false },
    tvRoom: { type: Boolean, default: false },
    studyRoom: { type: Boolean, default: false },
    others: [String],
  },
  description: String,
  shortDescription: String, // Brief description for listings
  highlights: [String], // Key highlights/features
  tags: [String], // Tags for search and filtering
  facilities: {
    security: { type: Boolean, default: false },
    securityGuards: { type: Number, default: 0 },
    cctv: { type: Boolean, default: false },
    cctvCount: { type: Number, default: 0 },
    powerBackup: { type: Boolean, default: false },
    powerBackupHours: { type: Number, default: 0 },
    waterSupply: { type: Boolean, default: true },
    waterSupplyType: { type: String, enum: ['24x7', 'scheduled', 'limited'], default: '24x7' },
    medicalFacility: { type: Boolean, default: false },
    sportsFacility: { type: Boolean, default: false },
    fireSafety: { type: Boolean, default: false },
    lift: { type: Boolean, default: false },
    generator: { type: Boolean, default: false },
  },
  nearbyPlaces: [{
    name: String,
    distance: String,
    type: String, // e.g., 'hospital', 'college', 'market'
  }],
  rules: {
    curfewTime: String, // HH:mm format
    weekendCurfewTime: String, // HH:mm format for weekends
    lateEntryAllowed: Boolean,
    lateEntryFine: { type: Number, default: 0 },
    visitorPolicy: String,
    visitorAllowed: { type: Boolean, default: true },
    visitorTimings: String, // e.g., "10:00 AM - 8:00 PM"
    messTimings: {
      breakfast: String, // e.g., "7:00 AM - 9:00 AM"
      lunch: String, // e.g., "12:00 PM - 2:00 PM"
      dinner: String, // e.g., "7:00 PM - 9:00 PM"
    },
    smokingAllowed: { type: Boolean, default: false },
    alcoholAllowed: { type: Boolean, default: false },
    petsAllowed: { type: Boolean, default: false },
    oppositeGenderAllowed: { type: Boolean, default: false },
    customRules: [{ type: String }],
  },
  // Pricing Information
  pricing: {
    minRent: { type: Number, default: 0 }, // Minimum monthly rent
    maxRent: { type: Number, default: 0 }, // Maximum monthly rent
    securityDeposit: { type: Number, default: 0 },
    maintenanceCharges: { type: Number, default: 0 }, // Monthly
    electricityCharges: { type: String, enum: ['included', 'separate', 'metered'], default: 'separate' },
    waterCharges: { type: String, enum: ['included', 'separate'], default: 'included' },
    currency: { type: String, default: 'INR' },
  },
  // Operating Information
  operatingHours: {
    officeHours: String, // e.g., "9:00 AM - 6:00 PM"
    checkInTime: String, // e.g., "10:00 AM"
    checkOutTime: String, // e.g., "11:00 AM"
    maintenanceHours: String, // e.g., "8:00 AM - 5:00 PM"
  },
  // Room Types Available
  roomTypes: [{
    type: { type: String, enum: ['single', 'double', 'triple', 'quad', 'dormitory'], required: true },
    count: { type: Number, default: 0 },
    price: { type: Number, default: 0 },
    amenities: [String], // Room-specific amenities
  }],
  // Emergency Contacts
  emergencyContacts: [{
    name: String,
    phone: String,
    relation: { type: String, enum: ['security', 'medical', 'fire', 'police', 'other'], default: 'other' },
  }],
  // Business Information
  businessInfo: {
    gstNumber: String,
    licenseNumber: String,
    registrationNumber: String,
    panNumber: String,
    bankAccountNumber: String,
    bankName: String,
    ifscCode: String,
    accountHolderName: String,
  },
  // Verification & Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending', 'suspended'],
    default: 'active',
  },
  isVerified: { type: Boolean, default: false },
  verificationDate: Date,
  rating: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0 },
  },
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update the updatedAt field before saving
hostelSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Update the updatedAt field before updating
hostelSchema.pre(['updateOne', 'findOneAndUpdate'], function (next) {
  this.set({ updatedAt: Date.now() });
  next();
});

module.exports = mongoose.model('Hostel', hostelSchema);

