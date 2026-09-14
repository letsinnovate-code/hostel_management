'use strict';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const {
  connectTestDB,
  clearTestDB,
  closeTestDB,
  createTestUser,
  createTestHostel,
  generateTestToken,
} = require('./setup');
const app = require('../server');

describe('Critical Business Flows', () => {
  let owner;
  let warden;
  let student;
  let hostel;
  let ownerToken;
  let wardenToken;
  let studentToken;

  before(async () => {
    await connectTestDB();
  });

  after(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();

    // 1. Create Owner
    const ownerData = await createTestUser({
      name: 'Hostel Owner',
      email: 'owner.biz@hostelzify.com',
      role: 'owner',
      currentRole: 'owner',
    });
    owner = ownerData.user;
    ownerToken = ownerData.token;

    // 2. Create Hostel with defined GPS coordinates (Bangalore: 12.9716, 77.5946)
    hostel = await createTestHostel(owner._id, {
      name: 'Business Test Hostel',
      address: {
        street: '123 Test St',
        city: 'Bangalore',
        state: 'Karnataka',
        pincode: '560001',
        coordinates: {
          latitude: 12.9716,
          longitude: 77.5946,
        },
      },
    });

    // Link owner to hostel
    owner.hostelId = hostel._id;
    await owner.save();

    // 3. Create Warden
    const wardenData = await createTestUser({
      name: 'Hostel Warden',
      email: 'warden.biz@hostelzify.com',
      role: 'warden',
      currentRole: 'warden',
      hostelId: hostel._id,
    });
    warden = wardenData.user;
    wardenToken = wardenData.token;

    // 4. Create Student
    const studentData = await createTestUser({
      name: 'Hostel Student',
      email: 'student.biz@hostelzify.com',
      role: 'student',
      currentRole: 'student',
      hostelId: hostel._id,
    });
    student = studentData.user;
    studentToken = studentData.token;
  });

  describe('1. Student Check-In', () => {
    it('should successfully check in when within hostel boundary', async () => {
      const payload = {
        latitude: 12.9716,
        longitude: 77.5946,
        accuracy: 10,
        timestamp: new Date().toISOString(),
      };

      const res = await request(app)
        .post('/api/student/check-in')
        .set('Authorization', `Bearer ${studentToken}`)
        .send(payload);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.status, 'inside');
    });

    it('should reject check-in when coordinates are invalid or missing', async () => {
      const res = await request(app)
        .post('/api/student/check-in')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ latitude: 'invalid', longitude: 77.5946 });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    it('should reject check-in when student is outside hostel geofence boundary', async () => {
      // Coordinate far away (Delhi: 28.6139, 77.2090)
      const payload = {
        latitude: 28.6139,
        longitude: 77.2090,
        accuracy: 10,
        timestamp: new Date().toISOString(),
      };

      const res = await request(app)
        .post('/api/student/check-in')
        .set('Authorization', `Bearer ${studentToken}`)
        .send(payload);

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.code, 'OUTSIDE_GEOFENCE');
    });
  });

  describe('2. Attendance', () => {
    it('should retrieve student attendance status reflecting presence state', async () => {
      // First check-in
      await request(app)
        .post('/api/student/check-in')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          latitude: 12.9716,
          longitude: 77.5946,
          accuracy: 10,
          timestamp: new Date().toISOString(),
        });

      // Now query status
      const res = await request(app)
        .get('/api/student/status')
        .set('Authorization', `Bearer ${studentToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.status, 'inside');
    });

    it('should retrieve attendance analytics for student', async () => {
      const res = await request(app)
        .get('/api/student/attendance/analytics')
        .set('Authorization', `Bearer ${studentToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data);
    });
  });

  describe('3. Leave Approval Workflow', () => {
    it('should allow student to submit leave request and warden to approve it', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfter = new Date();
      dayAfter.setDate(dayAfter.getDate() + 3);

      // Student submits leave request
      const createRes = await request(app)
        .post('/api/student/permissions')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          permissionType: 'leave',
          reason: 'Family wedding event',
          destination: 'Home town',
          requestedDate: tomorrow.toISOString(),
          returnDate: dayAfter.toISOString(),
        });

      assert.equal(createRes.status, 201);
      assert.equal(createRes.body.success, true);
      const permissionId = createRes.body.data._id;
      assert.ok(permissionId);
      assert.equal(createRes.body.data.status, 'pending');

      // Warden approves leave request
      const approveRes = await request(app)
        .post(`/api/warden/leaves/${permissionId}/approve`)
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ wardenRemarks: 'Approved, enjoy the event' });

      assert.equal(approveRes.status, 200);
      assert.equal(approveRes.body.success, true);
      assert.equal(approveRes.body.data.status, 'approved');
    });
  });

  describe('4. Complaint Workflow', () => {
    it('should allow student to raise complaint and warden to update status', async () => {
      // Student creates complaint
      const createRes = await request(app)
        .post('/api/student/complaints')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          title: 'Leaking faucet in washroom',
          description: 'Water is dripping continuously from the tap.',
          complaintType: 'maintenance',
          priority: 'medium',
        });

      assert.equal(createRes.status, 201);
      assert.equal(createRes.body.success, true);
      const complaintId = createRes.body.data._id;
      assert.ok(complaintId);
      assert.equal(createRes.body.data.status, 'open');

      // Warden updates complaint status to in-progress
      const updateRes = await request(app)
        .put(`/api/warden/complaints/${complaintId}/status`)
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({
          status: 'in-progress',
          remarks: 'Plumber assigned to inspect',
        });

      assert.equal(updateRes.status, 200);
      assert.equal(updateRes.body.success, true);
      assert.equal(updateRes.body.data.status, 'in-progress');

      // Warden resolves the complaint
      const resolveRes = await request(app)
        .put(`/api/warden/complaints/${complaintId}/status`)
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({
          status: 'resolved',
          resolutionNotes: 'Faucet washer replaced by plumber.',
        });

      assert.equal(resolveRes.status, 200);
      assert.equal(resolveRes.body.success, true);
      assert.equal(resolveRes.body.data.status, 'resolved');
    });
  });

  describe('5. Room Assignment', () => {
    it('should allow owner to create a room, warden to assign a student, and reject over-capacity', async () => {
      // 1. Owner creates a room with capacity 1
      const roomRes = await request(app)
        .post('/api/owner/rooms')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          roomNumber: '101-B',
          hostelId: hostel._id.toString(),
          floorNumber: 1,
          capacity: 1,
          category: 'Standard',
        });

      assert.equal(roomRes.status, 201);
      assert.equal(roomRes.body.success, true);
      const roomId = roomRes.body.data._id;
      assert.ok(roomId);

      // 2. Warden assigns student to the room
      const assignRes = await request(app)
        .post(`/api/warden/rooms/${roomId}/assign`)
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ studentId: student._id.toString() });

      assert.equal(assignRes.status, 200);
      assert.equal(assignRes.body.success, true);
      assert.equal(assignRes.body.data.room.status, 'occupied');
      assert.equal(assignRes.body.data.room.currentOccupancy, 1);

      // 3. Create a second student in the same hostel
      const { user: student2 } = await createTestUser({
        name: 'Second Student',
        email: 'student2.biz@hostelzify.com',
        role: 'student',
        currentRole: 'student',
        hostelId: hostel._id,
      });

      // 4. Attempting to assign second student to the full room should fail with 400
      const overCapacityRes = await request(app)
        .post(`/api/warden/rooms/${roomId}/assign`)
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ studentId: student2._id.toString() });

      assert.equal(overCapacityRes.status, 400);
      assert.equal(overCapacityRes.body.success, false);
      assert.match(overCapacityRes.body.message, /full capacity/i);
    });
  });
});
