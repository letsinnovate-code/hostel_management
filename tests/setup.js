/**
 * @file setup.js
 * @description Isolated test environment setup using MongoMemoryServer and stubs.
 */

'use strict';

// 1. Force test environment configuration before any application imports
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-minimum-32-chars-long-for-testing';
process.env.JWT_EXPIRE = '1d';
process.env.PORT = '4001';
process.env.APP_URL = 'http://localhost:3000';
process.env.EMAIL_FROM = 'noreply@test.hostelzify.com';
process.env.EMAIL_FROM_NAME = 'Hostelzify Test';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// External service stubs
const emailService = require('../src/utils/emailService');
const notificationService = require('../src/utils/notificationService');
const razorpay = require('../src/utils/razorpay');

// Stub email methods to prevent any real network emails
emailService.sendEmail = async () => ({ success: true, messageId: 'mock-email-id' });
emailService.sendWelcomeEmail = async () => ({ success: true, messageId: 'mock-welcome-id' });
emailService.sendStaffWelcomeEmail = async () => ({ success: true, messageId: 'mock-staff-welcome-id' });
emailService.sendApprovalEmail = async () => ({ success: true, messageId: 'mock-approval-id' });
emailService.sendNoticeEmail = async () => ({ success: true, messageId: 'mock-notice-id' });
emailService.sendBulkNoticeEmails = async () => ({ success: true, count: 1 });
emailService.sendParentEmergencyEmail = async () => ({ success: true, messageId: 'mock-sos-id' });

// Stub notification methods to prevent real FCM / Expo pushes
notificationService.sendPushNotifications = async () => [{ success: true }];
notificationService.sendExpoPushNotifications = async () => [{ status: 'ok' }];
notificationService.sendViolationPushToStudent = async () => ({ success: true });
notificationService.sendCheckInPushToStudent = async () => ({ success: true });
notificationService.sendLeaveRequestUpdateToStudent = async () => ({ success: true });

// Stub Razorpay payment orders
razorpay.createOrder = async (amountINR, receipt, notes = {}) => ({
  orderId: `order_test_${Date.now()}`,
  amount: Math.round(Number(amountINR) * 100),
  currency: 'INR',
  keyId: 'rzp_test_mock_key',
});
razorpay.verifyPaymentSignature = (orderId, paymentId, signature) => true;

// Stub Google Maps to prevent external network calls
const googleMaps = require('../src/utils/googleMaps');
googleMaps.geocodeAddress = async () => ({
  latitude: 12.9716,
  longitude: 77.5946,
  formattedAddress: '123 Test St, Test City',
  placeId: 'mock-place-id',
  addressComponents: [],
});
googleMaps.findNearbyPlaces = async () => [];
googleMaps.calculateDistanceMatrix = async () => ({ distance: { value: 100 }, duration: { value: 120 } });

let mongod = null;

/**
 * Start in-memory MongoDB and connect Mongoose
 */
async function connectTestDB() {
  if (!mongod) {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    process.env.MONGODB_URI = uri;
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  }
}

/**
 * Clear all collections between test suites
 */
async function clearTestDB() {
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
}

/**
 * Disconnect and stop in-memory MongoDB
 */
async function closeTestDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongod) {
    await mongod.stop();
    mongod = null;
  }
}

/**
 * Helper: Generate signed test JWT for a given user ID
 */
function generateTestToken(userId) {
  return jwt.sign({ id: userId.toString() }, process.env.JWT_SECRET, { expiresIn: '1d' });
}

/**
 * Helper: Create a test user directly in the in-memory database
 */
async function createTestUser(overrides = {}) {
  const User = require('../src/models/User');
  const uniqueNum = Date.now() + Math.floor(Math.random() * 1000);
  const password = overrides.password || 'TestPassword@123';
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const role = overrides.role ? (Array.isArray(overrides.role) ? overrides.role : [overrides.role]) : ['student'];
  const currentRole = overrides.currentRole || role[0];

  const userData = {
    name: overrides.name || `Test User ${uniqueNum}`,
    email: overrides.email || `user${uniqueNum}@test.com`,
    password: hashedPassword,
    role,
    roles: role,
    currentRole,
    phone: overrides.phone || '+919876543210',
    status: overrides.status || 'active',
    hostelId: overrides.hostelId || new mongoose.Types.ObjectId(),
    ...overrides,
  };

  const user = await User.create(userData);
  return { user, rawPassword: password, token: generateTestToken(user._id) };
}

/**
 * Helper: Create a test hostel directly in the in-memory database
 */
async function createTestHostel(ownerOrOverrides, overrides = {}) {
  const Hostel = require('../src/models/Hostel');
  let ownerId = ownerOrOverrides;
  let finalOverrides = overrides;
  if (ownerOrOverrides && typeof ownerOrOverrides === 'object' && !(ownerOrOverrides instanceof mongoose.Types.ObjectId)) {
    finalOverrides = ownerOrOverrides;
    ownerId = finalOverrides.ownerId || new mongoose.Types.ObjectId();
  } else if (!ownerId) {
    ownerId = new mongoose.Types.ObjectId();
  }

  const uniqueNum = Date.now() + Math.floor(Math.random() * 1000);
  const hostel = await Hostel.create({
    name: finalOverrides.name || `Test Hostel ${uniqueNum}`,
    type: finalOverrides.type || 'boys',
    ownerId,
    address: {
      street: '123 Test St',
      city: 'Test City',
      state: 'Test State',
      pincode: '123456',
      coordinates: {
        latitude: 12.9716,
        longitude: 77.5946,
      },
    },
    capacity: 100,
    totalRooms: 50,
    ...finalOverrides,
    ownerId: ownerId || finalOverrides.ownerId || new mongoose.Types.ObjectId(),
  });
  return hostel;
}

module.exports = {
  connectTestDB,
  clearTestDB,
  closeTestDB,
  generateTestToken,
  createTestUser,
  createTestHostel,
};
