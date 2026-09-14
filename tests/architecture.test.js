/**
 * @file tests/architecture.test.js
 * @description Architecture & Domain Modularization Test Suite (Phase 5)
 */

'use strict';

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

// Repositories
const RoomRepository = require('../src/repositories/roomRepository');
const AttendanceRepository = require('../src/repositories/attendanceRepository');
const StudentRepository = require('../src/repositories/studentRepository');

// Adapters
const PaymentAdapter = require('../src/adapters/paymentAdapter');
const StorageAdapter = require('../src/adapters/storageAdapter');
const EmailAdapter = require('../src/adapters/emailAdapter');
const GeoAdapter = require('../src/adapters/geoAdapter');
const PushAdapter = require('../src/adapters/pushAdapter');

// Services
const RoomService = require('../src/services/roomService');
const CurfewService = require('../src/services/curfewService');
const PaymentService = require('../src/services/paymentService');
const StudentManagementService = require('../src/services/studentManagementService');
const OnboardingService = require('../src/services/onboardingService');

// Facades & Sub-controllers
const wardenController = require('../src/controllers/wardenController');
const ownerController = require('../src/controllers/ownerController');
const paymentController = require('../src/controllers/paymentController');
const paymentRoutes = require('../src/routes/paymentRoutes');

// Test utilities
const { connectTestDB, clearTestDB, closeTestDB, createTestUser, createTestHostel } = require('./setup');
const Room = require('../src/models/Room');
const User = require('../src/models/User');

describe('Phase 5 — Backend Architecture Refactor Test Suite', () => {
  before(async () => {
    await connectTestDB();
  });

  after(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  describe('TASK 1, 2, 3 — Controller Facade & Modular Decomposition', () => {
    it('wardenController facade exports all 70 expected functions', () => {
      const keys = Object.keys(wardenController);
      assert.equal(keys.length, 70, `Expected 70 exported functions from wardenController facade, got ${keys.length}`);
      for (const key of keys) {
        assert.equal(typeof wardenController[key], 'function', `Exported property ${key} must be a function`);
      }
    });

    it('ownerController facade exports all 115 expected functions', () => {
      const keys = Object.keys(ownerController);
      assert.equal(keys.length, 115, `Expected 115 exported functions from ownerController facade, got ${keys.length}`);
      for (const key of keys) {
        assert.equal(typeof ownerController[key], 'function', `Exported property ${key} must be a function`);
      }
    });

    it('facade functions match underlying domain sub-controller exports', () => {
      const wardenLeaveController = require('../src/controllers/warden/wardenLeaveController');
      assert.equal(wardenController.getWardenLeaves, wardenLeaveController.getWardenLeaves);
      assert.equal(wardenController.approveLeave, wardenLeaveController.approveLeave);

      const ownerRoomController = require('../src/controllers/owner/ownerRoomController');
      assert.equal(ownerController.getRooms, ownerRoomController.getRooms);
      assert.equal(ownerController.createRoom, ownerRoomController.createRoom);
    });
  });

  describe('TASK 5 — Repository Layer', () => {
    it('RoomRepository executes batched room queries without N+1', async () => {
      const { user: owner } = await createTestUser({ role: 'owner', email: 'repo_owner@test.com' });
      const hostel = await createTestHostel(owner._id);

      const roomA = await Room.create({
        roomNumber: '101',
        hostelId: hostel._id,
        capacity: 2,
        occupiedBeds: 1,
        floorNumber: 1,
      });
      const roomB = await Room.create({
        roomNumber: '102',
        hostelId: hostel._id,
        capacity: 2,
        occupiedBeds: 1,
        floorNumber: 1,
      });

      const { user: student1 } = await createTestUser({
        role: 'student',
        hostelId: hostel._id,
        roomId: roomA._id,
        bedNumber: 'A',
      });
      const { user: student2 } = await createTestUser({
        role: 'student',
        hostelId: hostel._id,
        roomId: roomB._id,
        bedNumber: 'B',
      });

      const rooms = await RoomRepository.findRoomsWithStudents({ hostelId: hostel._id });
      assert.equal(rooms.length, 2);

      const foundRoomA = rooms.find((r) => r._id.toString() === roomA._id.toString());
      assert.ok(foundRoomA);
      assert.equal(foundRoomA.students.length, 1);
      assert.equal(foundRoomA.students[0]._id.toString(), student1._id.toString());

      const foundRoomB = rooms.find((r) => r._id.toString() === roomB._id.toString());
      assert.ok(foundRoomB);
      assert.equal(foundRoomB.students.length, 1);
      assert.equal(foundRoomB.students[0]._id.toString(), student2._id.toString());
    });

    it('StudentRepository finds students by hostel and unassigned students', async () => {
      const { user: owner } = await createTestUser({ role: 'owner', email: 'stu_repo_owner@test.com' });
      const hostel = await createTestHostel(owner._id);

      const { user: assignedStudent } = await createTestUser({
        role: 'student',
        hostelId: hostel._id,
        roomId: new mongoose.Types.ObjectId(),
        bedNumber: 'A',
      });
      const { user: unassignedStudent } = await createTestUser({
        role: 'student',
        hostelId: hostel._id,
        roomId: null,
      });

      const allStudents = await StudentRepository.findByHostelId(hostel._id);
      assert.equal(allStudents.length, 2);

      const unassigned = await StudentRepository.findUnassignedStudents(hostel._id);
      assert.equal(unassigned.length, 1);
      assert.equal(unassigned[0]._id.toString(), unassignedStudent._id.toString());
    });

    it('AttendanceRepository aggregates latest locations in single query', async () => {
      const studentId = new mongoose.Types.ObjectId();
      const locationMap = await AttendanceRepository.getLatestStudentLocations([studentId]);
      assert.ok(locationMap instanceof Map);
      assert.equal(locationMap.size, 0);
    });
  });

  describe('TASK 6 — Infrastructure Adapters', () => {
    it('PaymentAdapter exposes order creation and signature verification methods', () => {
      assert.equal(typeof PaymentAdapter.createOrder, 'function');
      assert.equal(typeof PaymentAdapter.verifyPaymentSignature, 'function');

      // Test verification delegates to underlying provider (returns true under test harness mock)
      const isValid = PaymentAdapter.verifyPaymentSignature('order_test_123', 'pay_test_456', 'mock_sig');
      assert.equal(typeof isValid, 'boolean');
      assert.equal(isValid, true);
    });

    it('StorageAdapter provides uniform S3 abstraction', () => {
      assert.equal(typeof StorageAdapter.uploadImage, 'function');
      assert.equal(typeof StorageAdapter.uploadMultipleImages, 'function');
      assert.equal(typeof StorageAdapter.deleteImage, 'function');
    });

    it('EmailAdapter provides email sending abstraction', () => {
      assert.equal(typeof EmailAdapter.sendEmail, 'function');
      assert.equal(typeof EmailAdapter.sendWelcomeEmail, 'function');
      assert.equal(typeof EmailAdapter.sendApprovalEmail, 'function');
      assert.equal(typeof EmailAdapter.sendNoticeEmail, 'function');
      assert.equal(typeof EmailAdapter.sendParentEmergencyEmail, 'function');
    });

    it('GeoAdapter provides distance calculation and geocoding', () => {
      assert.equal(typeof GeoAdapter.calculateDistance, 'function');
      assert.equal(typeof GeoAdapter.geocodeAddress, 'function');
      assert.equal(typeof GeoAdapter.getNearbyPlaces, 'function');

      // 0 distance between identical coords
      const dist = GeoAdapter.calculateDistance(12.9716, 77.5946, 12.9716, 77.5946);
      assert.equal(Math.round(dist), 0);
    });

    it('PushAdapter provides push notification dispatch', () => {
      assert.equal(typeof PushAdapter.sendPushNotification, 'function');
      assert.equal(typeof PushAdapter.sendMulticastNotification, 'function');
      assert.equal(typeof PushAdapter.sendCurfewAlert, 'function');
      assert.equal(typeof PushAdapter.sendLeaveNotification, 'function');
      assert.equal(typeof PushAdapter.getExpoReceipts, 'function');
    });
  });

  describe('TASK 4 & 7 — Domain Services & Onboarding', () => {
    it('OnboardingService validates document URLs and calculates progress', () => {
      assert.equal(OnboardingService.validateDocumentUrl('https://s3.amazonaws.com/mybucket/doc.pdf'), true);
      assert.equal(OnboardingService.validateDocumentUrl('ftp://invalid-url.com'), false);
      assert.equal(OnboardingService.validateDocumentUrl('http://169.254.169.254/latest/meta-data'), false);

      const progress0 = OnboardingService.calculateProgress({});
      assert.equal(progress0, 10); // Base registration is 10%

      const progressComplete = OnboardingService.calculateProgress({
        personalInfo: { fullName: 'John Doe', phone: '1234567890' },
        academicInfo: { course: 'CS', studentIdNumber: 'CS001' },
        parentInfo: { name: 'Parent', phone: '1234567890' },
        emergencyContact: { name: 'Emergency', phone: '0987654321' },
        documents: [
          { documentType: 'aadhar', fileUrl: 'https://s3.amazonaws.com/aadhar.pdf' },
          { documentType: 'photo', fileUrl: 'https://s3.amazonaws.com/photo.jpg' },
        ],
        hostelId: new mongoose.Types.ObjectId(),
        roomPreferences: { selectedRoomId: new mongoose.Types.ObjectId() },
        paymentInfo: { paymentStatus: 'PAID' },
        rulesAgreement: { agreed: true },
      });
      assert.equal(progressComplete, 100);
    });

    it('RoomService handles bed allocation, capacity check, and vacancy', async () => {
      const { user: owner } = await createTestUser({ role: 'owner', email: 'room_svc_owner@test.com' });
      const hostel = await createTestHostel(owner._id);

      const room = await Room.create({
        roomNumber: '201',
        hostelId: hostel._id,
        capacity: 1,
        occupiedBeds: 0,
        floorNumber: 2,
      });

      const { user: student } = await createTestUser({
        role: 'student',
        hostelId: hostel._id,
      });

      // Allocate
      const allocated = await RoomService.assignBed({
        roomId: room._id,
        studentId: student._id,
        bedNumber: 'A1',
      });
      assert.equal(allocated.room.currentOccupancy, 1);

      const updatedStudent = await User.findById(student._id);
      assert.equal(updatedStudent.roomId.toString(), room._id.toString());
      assert.equal(updatedStudent.bedNumber, 'A1');

      // Attempt allocating again when capacity full
      const { user: student2 } = await createTestUser({
        role: 'student',
        hostelId: hostel._id,
      });
      await assert.rejects(
        async () => {
          await RoomService.assignBed({
            roomId: room._id,
            studentId: student2._id,
            bedNumber: 'A2',
          });
        },
        /Room 201 is already at full capacity/
      );

      // Vacate
      const vacated = await RoomService.vacateBed({
        roomId: room._id,
        studentId: student._id,
      });
      assert.equal(vacated.room.currentOccupancy, 0);
      const vacatedStudent = await User.findById(student._id);
      assert.ok(!vacatedStudent.roomId);
      assert.ok(!vacatedStudent.bedNumber);
    });
  });

  describe('TASK 8 — Server.js Payment Modularization', () => {
    it('paymentRoutes exports an Express router with checkout and callback endpoints', () => {
      assert.ok(paymentRoutes);
      assert.equal(typeof paymentRoutes, 'function'); // Express router is a function
      assert.equal(typeof paymentController.renderRazorpayCheckout, 'function');
      assert.equal(typeof paymentController.handleRazorpayCallback, 'function');
    });
  });
});
