/**
 * @file performance.test.js
 * @description Performance, N+1 query elimination, location aggregation, and pagination tests.
 */

'use strict';

const { describe, it, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const {
  connectTestDB,
  clearTestDB,
  closeTestDB,
  createTestUser,
  createTestHostel,
} = require('./setup');

const { parsePagination, buildPaginationMetadata } = require('../src/utils/pagination');
const Room = require('../src/models/Room');
const User = require('../src/models/User');
const StudentLocation = require('../src/models/StudentLocation');
const Complaint = require('../src/models/Complaint');
const Permission = require('../src/models/Permission');
const Visitor = require('../src/models/Visitor');
const AuditLog = require('../src/models/AuditLog');
const Payment = require('../src/models/Payment');

const ownerController = require('../src/controllers/ownerController');
const wardenController = require('../src/controllers/wardenController');

describe('TASK 3 — Defensive Pagination Utility', () => {
  it('returns default page and limit when query is empty', () => {
    const { page, limit, skip } = parsePagination({}, { defaultLimit: 20, maxLimit: 100 });
    assert.equal(page, 1);
    assert.equal(limit, 20);
    assert.equal(skip, 0);
  });

  it('guards against negative page, returning page 1', () => {
    const { page, limit, skip } = parsePagination({ page: -5, limit: 15 }, { defaultLimit: 20, maxLimit: 100 });
    assert.equal(page, 1);
    assert.equal(limit, 15);
    assert.equal(skip, 0);
  });

  it('guards against zero or negative limit, returning default limit', () => {
    const { page, limit } = parsePagination({ page: 2, limit: -10 }, { defaultLimit: 20, maxLimit: 100 });
    assert.equal(page, 2);
    assert.equal(limit, 20);
  });

  it('guards against excessive limit, clamping to maxLimit', () => {
    const { page, limit, skip } = parsePagination({ page: 3, limit: 99999 }, { defaultLimit: 20, maxLimit: 100 });
    assert.equal(page, 3);
    assert.equal(limit, 100);
    assert.equal(skip, 200);
  });

  it('correctly computes pagination metadata', () => {
    const meta = buildPaginationMetadata(75, 2, 20);
    assert.equal(meta.total, 75);
    assert.equal(meta.page, 2);
    assert.equal(meta.limit, 20);
    assert.equal(meta.totalPages, 4);
    assert.equal(meta.hasNext, true);
    assert.equal(meta.hasPrev, true);
  });

  it('pagination metadata hasNext is false on the last page', () => {
    const meta = buildPaginationMetadata(25, 2, 20);
    assert.equal(meta.totalPages, 2);
    assert.equal(meta.hasNext, false);
    assert.equal(meta.hasPrev, true);
  });
});

describe('Database & Performance Controller Optimizations', () => {
  before(async () => {
    await connectTestDB();
  });

  afterEach(async () => {
    await clearTestDB();
  });

  after(async () => {
    await closeTestDB();
  });

  it('TASK 1 — owner getRooms batches student lookups across all rooms', async () => {
    const { user: owner } = await createTestUser({ role: 'owner', email: 'owner_rooms@test.com' });
    const hostel = await createTestHostel(owner._id);

    // Create 3 rooms
    const room1 = await Room.create({
      roomNumber: '101',
      floorNumber: 1,
      hostelId: hostel._id,
      capacity: 2,
      currentOccupancy: 0,
      monthlyRent: 5000,
    });
    const room2 = await Room.create({
      roomNumber: '102',
      floorNumber: 1,
      hostelId: hostel._id,
      capacity: 3,
      currentOccupancy: 0,
      monthlyRent: 4500,
    });
    const room3 = await Room.create({
      roomNumber: '103',
      floorNumber: 1,
      hostelId: hostel._id,
      capacity: 2,
      currentOccupancy: 0,
      monthlyRent: 5000,
    });

    // Create 3 students assigned across room1 and room2
    await createTestUser({
      role: 'student',
      email: 's1@test.com',
      hostelId: hostel._id,
      roomId: room1._id,
      status: 'active',
    });
    await createTestUser({
      role: 'student',
      email: 's2@test.com',
      hostelId: hostel._id,
      roomId: room1._id,
      status: 'active',
    });
    await createTestUser({
      role: 'student',
      email: 's3@test.com',
      hostelId: hostel._id,
      roomId: room2._id,
      status: 'active',
    });

    const req = {
      user: owner,
      query: { hostelId: hostel._id.toString() },
      params: {},
    };

    let responseData = null;
    let statusCode = null;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(payload) {
        responseData = payload;
        return this;
      },
    };

    await ownerController.getRooms(req, res);

    assert.equal(statusCode, 200);
    assert.equal(responseData.success, true);
    assert.equal(responseData.data.length, 3);

    const returnedRoom1 = responseData.data.find((r) => r.roomNumber === '101');
    assert.ok(returnedRoom1);
    assert.equal(returnedRoom1.students.length, 2);
    assert.equal(returnedRoom1.currentOccupancy, 2);

    const returnedRoom2 = responseData.data.find((r) => r.roomNumber === '102');
    assert.ok(returnedRoom2);
    assert.equal(returnedRoom2.students.length, 1);
    assert.equal(returnedRoom2.currentOccupancy, 1);

    const returnedRoom3 = responseData.data.find((r) => r.roomNumber === '103');
    assert.ok(returnedRoom3);
    assert.equal(returnedRoom3.students.length, 0);
    assert.equal(returnedRoom3.currentOccupancy, 0);
  });

  it('TASK 1 — warden getWardenRooms batches student lookups and handles empty rooms', async () => {
    const { user: warden } = await createTestUser({ role: 'warden', email: 'warden_rooms@test.com' });
    const hostel = await createTestHostel(warden._id);
    await User.findByIdAndUpdate(warden._id, { hostelId: hostel._id });
    warden.hostelId = hostel._id;

    const roomA = await Room.create({
      roomNumber: '201',
      floorNumber: 2,
      hostelId: hostel._id,
      capacity: 2,
      currentOccupancy: 0,
    });
    await Room.create({
      roomNumber: '202',
      floorNumber: 2,
      hostelId: hostel._id,
      capacity: 2,
      currentOccupancy: 0,
    });

    await createTestUser({
      role: 'student',
      email: 'resident_a@test.com',
      hostelId: hostel._id,
      roomId: roomA._id,
      status: 'active',
    });

    const req = {
      user: warden,
      query: {},
    };

    let responseData = null;
    let statusCode = null;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(payload) {
        responseData = payload;
        return this;
      },
    };

    await wardenController.getWardenRooms(req, res);

    assert.equal(statusCode, 200);
    assert.equal(responseData.success, true);
    assert.ok(responseData.data.rooms);
    assert.equal(responseData.data.rooms.length, 2);

    const resA = responseData.data.rooms.find((r) => r.roomNumber === '201');
    assert.equal(resA.students.length, 1);
    assert.equal(resA.currentOccupancy, 1);

    const resB = responseData.data.rooms.find((r) => r.roomNumber === '202');
    assert.equal(resB.students.length, 0);
    assert.equal(resB.currentOccupancy, 0);
  });

  it('TASK 2 — triggerAttendanceCheck uses aggregation to pick only latest location per student and handles missing locations', async () => {
    const { user: owner } = await createTestUser({ role: 'owner', email: 'owner_att@test.com' });
    const hostel = await createTestHostel(owner._id, {
      address: {
        street: '123 Main St',
        city: 'City',
        state: 'State',
        pincode: '560001',
        coordinates: {
          latitude: 12.9716,
          longitude: 77.5946,
        },
      },
    });

    const { user: studentA } = await createTestUser({
      role: 'student',
      email: 'att_student_a@test.com',
      hostelId: hostel._id,
      status: 'active',
      locationPermissionStatus: 'granted',
    });
    const { user: studentB } = await createTestUser({
      role: 'student',
      email: 'att_student_b@test.com',
      hostelId: hostel._id,
      status: 'active',
      locationPermissionStatus: 'granted',
    });

    const t0 = new Date(Date.now() - 3600 * 1000);
    const t1 = new Date(Date.now() - 1800 * 1000);
    const tLatest = new Date(Date.now() - 60 * 1000);

    await StudentLocation.create({
      studentId: studentA._id,
      hostelId: hostel._id,
      location: {
        latitude: 12.9716,
        longitude: 77.5946,
      },
      timestamp: t0,
    });
    await StudentLocation.create({
      studentId: studentA._id,
      hostelId: hostel._id,
      location: {
        latitude: 12.9720,
        longitude: 77.5950,
      },
      timestamp: t1,
    });
    await StudentLocation.create({
      studentId: studentA._id,
      hostelId: hostel._id,
      location: {
        latitude: 12.9800,
        longitude: 77.6000,
      },
      timestamp: tLatest,
    });

    const req = {
      user: owner,
      body: { hostelId: hostel._id.toString() },
    };

    let responseData = null;
    let statusCode = null;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(payload) {
        responseData = payload;
        return this;
      },
    };

    await ownerController.triggerAttendanceCheck(req, res);

    assert.equal(statusCode, 200);
    assert.equal(responseData.success, true);
    assert.ok(responseData.data);
    assert.ok(responseData.data.summary);
    assert.equal(responseData.data.summary.total, 2);

    const studentAResult = responseData.data.students.find((r) => r.studentId.toString() === studentA._id.toString());
    assert.ok(studentAResult);
    assert.equal(new Date(studentAResult.lastUpdate).getTime(), tLatest.getTime());

    const studentBResult = responseData.data.students.find((r) => r.studentId.toString() === studentB._id.toString());
    assert.ok(studentBResult);
    assert.equal(studentBResult.presenceStatus, 'no_data');
  });

  it('TASK 4 — Database Compound Indexes are registered', () => {
    const userIndexes = User.schema.indexes();
    assert.ok(userIndexes.some(([fields]) => fields.roomId === 1 && fields.role === 1));

    const complaintIndexes = Complaint.schema.indexes();
    assert.ok(complaintIndexes.some(([fields]) => fields.hostelId === 1 && fields.createdAt === -1));

    const permissionIndexes = Permission.schema.indexes();
    assert.ok(permissionIndexes.some(([fields]) => fields.hostelId === 1 && fields.createdAt === -1));

    const locationIndexes = StudentLocation.schema.indexes();
    assert.ok(locationIndexes.some(([fields]) => fields.studentId === 1 && fields.timestamp === -1));

    const visitorIndexes = Visitor.schema.indexes();
    assert.ok(visitorIndexes.some(([fields]) => fields.visitingStudentId === 1 && fields.createdAt === -1));

    const auditIndexes = AuditLog.schema.indexes();
    assert.ok(auditIndexes.some(([fields]) => fields.timestamp === -1));

    const paymentIndexes = Payment.schema.indexes();
    assert.ok(paymentIndexes.some(([fields]) => fields.studentId === 1 && fields.createdAt === -1));
  });
});
