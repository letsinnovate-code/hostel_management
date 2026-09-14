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
} = require('./setup');
const app = require('../server');

const ComplaintService = require('../src/services/complaintService');
const PermissionService = require('../src/services/permissionService');
const VisitorService = require('../src/services/visitorService');
const AttendanceAnalyticsService = require('../src/services/attendanceAnalyticsService');
const {
  ROLES,
  COMPLAINT_STATUS,
  COMPLAINT_PRIORITY,
  COMPLAINT_TYPE,
  PERMISSION_STATUS,
  VISITOR_STATUS,
  ATTENDANCE_STATUS,
  BUSINESS_THRESHOLDS,
  COOLDOWNS,
} = require('../src/constants');

const Attendance = require('../src/models/Attendance');
const Complaint = require('../src/models/Complaint');
const Permission = require('../src/models/Permission');
const Visitor = require('../src/models/Visitor');

describe('Phase 4 — DRY & Business Logic Refactor Test Suite', () => {
  let owner;
  let warden;
  let student;
  let cleaner;
  let hostel;
  let ownerToken;
  let wardenToken;
  let studentToken;
  let cleanerToken;

  before(async () => {
    await connectTestDB();
  });

  after(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();

    // Setup Owner
    const ownerData = await createTestUser({
      name: 'Owner User',
      email: 'owner.refactor@hostelzify.com',
      role: 'owner',
      currentRole: 'owner',
    });
    owner = ownerData.user;
    ownerToken = ownerData.token;

    // Setup Hostel
    hostel = await createTestHostel(owner._id, {
      name: 'Refactor Test Hostel',
      timezone: 'Asia/Kolkata',
    });

    // Setup Warden
    const wardenData = await createTestUser({
      name: 'Warden User',
      email: 'warden.refactor@hostelzify.com',
      role: 'warden',
      currentRole: 'warden',
      hostelId: hostel._id,
    });
    warden = wardenData.user;
    wardenToken = wardenData.token;

    // Setup Student
    const studentData = await createTestUser({
      name: 'Student User',
      email: 'student.refactor@hostelzify.com',
      role: 'student',
      currentRole: 'student',
      hostelId: hostel._id,
    });
    student = studentData.user;
    studentToken = studentData.token;

    // Setup Cleaner
    const cleanerData = await createTestUser({
      name: 'Cleaner User',
      email: 'cleaner.refactor@hostelzify.com',
      role: 'cleaner',
      currentRole: 'cleaner',
      hostelId: hostel._id,
    });
    cleaner = cleanerData.user;
    cleanerToken = cleanerData.token;
  });

  describe('TASK 5 — Centralized Constants', () => {
    it('should provide complete and immutable role constants', () => {
      assert.equal(ROLES.OWNER, 'owner');
      assert.equal(ROLES.WARDEN, 'warden');
      assert.equal(ROLES.STUDENT, 'student');
      assert.equal(ROLES.CLEANER, 'cleaner');
      assert.throws(() => {
        ROLES.NEW_ROLE = 'forbidden';
      });
    });

    it('should provide complaint and permission statuses and thresholds', () => {
      assert.equal(COMPLAINT_STATUS.OPEN, 'open');
      assert.equal(COMPLAINT_STATUS.RESOLVED, 'resolved');
      assert.equal(PERMISSION_STATUS.APPROVED, 'approved');
      assert.equal(VISITOR_STATUS.COMPLETED, 'completed');
      assert.equal(ATTENDANCE_STATUS.PRESENT, 'present');
      assert.equal(BUSINESS_THRESHOLDS.LOW_ATTENDANCE_PERCENTAGE, 75);
      assert.equal(COOLDOWNS.CHECKOUT_COOLDOWN_MS, 120000);
    });
  });

  describe('TASK 1 — ComplaintService & Controller Integration', () => {
    it('should handle full complaint lifecycle via ComplaintService directly', async () => {
      // 1. Create Complaint
      const complaint = await ComplaintService.createComplaint({
        title: 'Leaking Tap',
        description: 'Bathroom tap is leaking constantly',
        complaintType: COMPLAINT_TYPE.MAINTENANCE,
        priority: COMPLAINT_PRIORITY.HIGH,
        hostelId: hostel._id,
        raisedBy: student._id,
      }, student);

      assert.ok(complaint._id);
      assert.equal(complaint.status, COMPLAINT_STATUS.OPEN);
      assert.equal(complaint.timeline.length, 1);

      // 2. Assign Complaint
      const assigned = await ComplaintService.assignComplaint(complaint._id, {
        staffId: cleaner._id,
        staffName: cleaner.name,
        staffRole: 'cleaner',
        notes: 'Assigned to cleaner for inspection',
        user: warden,
      });
      assert.equal(assigned.status, COMPLAINT_STATUS.ASSIGNED);
      assert.equal(String(assigned.assignedTo._id), String(cleaner._id));

      // 3. Update Status to In-Progress
      const inProgress = await ComplaintService.updateStatus(complaint._id, {
        status: COMPLAINT_STATUS.IN_PROGRESS,
        remarks: 'Working on replacing washer',
        user: cleaner,
      });
      assert.equal(inProgress.status, COMPLAINT_STATUS.IN_PROGRESS);

      // 4. Resolve Complaint
      const resolved = await ComplaintService.updateStatus(complaint._id, {
        status: COMPLAINT_STATUS.RESOLVED,
        resolutionNotes: 'Tap washer replaced and leak stopped.',
        user: warden,
      });
      assert.equal(resolved.status, COMPLAINT_STATUS.RESOLVED);
      assert.ok(resolved.resolvedAt);

      // 5. Check Hostel Complaint Stats
      const stats = await ComplaintService.getHostelComplaintStats(hostel._id);
      assert.equal(stats.total, 1);
      assert.equal(stats.resolved, 1);
      assert.equal(stats.open, 0);
    });

    it('should support cleaner accepting and resolving complaints via API routes', async () => {
      const complaint = await Complaint.create({
        title: 'Dusty Hallway',
        description: 'Floor 2 hallway needs sweeping',
        complaintType: 'cleaning',
        hostelId: hostel._id,
        raisedBy: student._id,
        assignedTo: cleaner._id,
        status: 'assigned',
      });

      // Cleaner updates status
      const res = await request(app)
        .put(`/api/cleaner/complaints/${complaint._id}/status`)
        .set('Authorization', `Bearer ${cleanerToken}`)
        .send({
          status: 'resolved',
          resolutionNotes: 'Floor 2 hallway thoroughly swept and mopped',
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.status, 'resolved');
    });
  });

  describe('TASK 2 — Permission/LeaveService & Controller Integration', () => {
    it('should manage leave approvals, overlap validation, checkout, and return', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfter = new Date();
      dayAfter.setDate(dayAfter.getDate() + 3);

      // 1. Create Permission
      const permission = await Permission.create({
        studentId: student._id,
        hostelId: hostel._id,
        permissionType: 'leave',
        reason: 'Family visit',
        requestedDate: tomorrow,
        returnDate: dayAfter,
        status: 'pending',
      });

      // 2. Approve Permission via PermissionService
      const approved = await PermissionService.approvePermission(permission._id, {
        user: warden,
        wardenRemarks: 'Approved for weekend',
      });
      assert.equal(approved.status, PERMISSION_STATUS.APPROVED);
      assert.equal(approved.wardenRemarks, 'Approved for weekend');

      // 3. Attempting to approve an overlapping leave should reject with error
      const overlappingLeave = await Permission.create({
        studentId: student._id,
        hostelId: hostel._id,
        permissionType: 'leave',
        reason: 'Conflict test',
        requestedDate: tomorrow,
        returnDate: dayAfter,
        status: 'pending',
      });

      await assert.rejects(
        async () => {
          await PermissionService.approvePermission(overlappingLeave._id, { user: warden });
        },
        /Overlapping leave conflict/
      );

      // 4. Record Check Out
      const checkedOut = await PermissionService.recordLeaveCheckOut(permission._id, {
        user: warden,
        actualCheckOutTime: new Date(),
        remarks: 'Departed via main gate',
      });
      assert.equal(checkedOut.status, PERMISSION_STATUS.CHECKED_OUT);

      // 5. Record Return
      const returned = await PermissionService.recordLeaveReturn(permission._id, {
        user: warden,
        actualReturnTime: new Date(),
        remarks: 'Returned safely',
      });
      assert.equal(returned.status, PERMISSION_STATUS.RETURNED);
    });

    it('should allow student to cancel their pending leave request via API', async () => {
      const leave = await Permission.create({
        studentId: student._id,
        hostelId: hostel._id,
        permissionType: 'leave',
        reason: 'Change of plans',
        requestedDate: new Date(),
        status: 'pending',
      });

      const res = await request(app)
        .post(`/api/student/permissions/${leave._id}/cancel`)
        .set('Authorization', `Bearer ${studentToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.status, 'cancelled');
    });
  });

  describe('TASK 3 — VisitorService & Controller Integration', () => {
    it('should create, list, approve, checkout, and delete visitors via VisitorService', async () => {
      // 1. Create Visitor
      const visitor = await VisitorService.createVisitor({
        visitorName: 'John Parent',
        visitorPhone: '9876543210',
        visitingStudentId: student._id,
        purpose: 'Bringing semester supplies',
        visitDate: new Date(),
        status: VISITOR_STATUS.PENDING,
      });
      assert.ok(visitor._id);
      assert.equal(visitor.status, VISITOR_STATUS.PENDING);

      // 2. List Visitors
      const { visitors, total } = await VisitorService.listVisitors({
        filter: { visitingStudentId: student._id },
      });
      assert.equal(total, 1);
      assert.equal(visitors[0].visitorName, 'John Parent');

      // 3. Approve Visitor
      const approved = await VisitorService.approveVisitor(visitor._id, {
        user: warden,
        entryTime: new Date(),
      });
      assert.equal(approved.status, VISITOR_STATUS.APPROVED);
      assert.ok(approved.entryTime);

      // 4. Checkout Visitor
      const completed = await VisitorService.checkoutVisitor(visitor._id, {
        user: warden,
        exitTime: new Date(),
      });
      assert.equal(completed.status, VISITOR_STATUS.COMPLETED);
      assert.ok(completed.exitTime);

      // 5. Delete Visitor
      const delResult = await VisitorService.deleteVisitor(visitor._id);
      assert.equal(delResult.success, true);
      const afterDel = await VisitorService.getVisitorById(visitor._id);
      assert.equal(afterDel, null);
    });

    it('should allow student to request a visitor and warden to approve via API', async () => {
      const createRes = await request(app)
        .post('/api/student/visitors')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          visitorName: 'Jane Sister',
          visitorPhone: '9123456780',
          purpose: 'Short visit',
        });

      assert.equal(createRes.status, 201);
      assert.equal(createRes.body.success, true);
      const visitorId = createRes.body.data._id;

      // Warden approves visitor
      const approveRes = await request(app)
        .post(`/api/warden/visitors/${visitorId}/approve`)
        .set('Authorization', `Bearer ${wardenToken}`);

      assert.equal(approveRes.status, 200);
      assert.equal(approveRes.body.success, true);
      assert.equal(approveRes.body.data.status, 'approved');
    });
  });

  describe('TASK 4 — AttendanceAnalyticsService', () => {
    it('should compute consistent date ranges for daily, week, month, and custom periods', () => {
      const weekRange = AttendanceAnalyticsService.getDateRangeForPeriod('week', 30, 'Asia/Kolkata');
      assert.ok(weekRange.startDate);
      assert.ok(weekRange.endDate);
      assert.ok(weekRange.todayStr);

      const diffDays = Math.round((weekRange.endDate - weekRange.startDate) / (1000 * 60 * 60 * 24));
      assert.equal(diffDays, 7);
    });

    it('should calculate student attendance analytics and metrics accurately', async () => {
      const now = new Date();
      await Attendance.create([
        {
          studentId: student._id,
          hostelId: hostel._id,
          date: now,
          status: 'inside',
          attendanceStatus: 'present',
          checkInTime: new Date(now.getTime() - 4 * 60 * 60 * 1000),
          checkOutTime: new Date(now.getTime() - 1 * 60 * 60 * 1000),
          businessDate: now.toISOString().slice(0, 10),
        },
      ]);

      const analytics = await AttendanceAnalyticsService.calculateStudentAttendanceAnalytics(student._id, {
        period: 'week',
        hostelId: hostel._id,
      });

      assert.equal(analytics.totalCheckIns, 1);
      assert.equal(analytics.totalCheckOuts, 1);
      assert.ok(analytics.avgDurationHours > 0);
      assert.equal(analytics.periodData.length, 7);
    });

    it('should calculate hostel-wide attendance trends for owner dashboard', async () => {
      const now = new Date();
      await Attendance.create([
        {
          studentId: student._id,
          hostelId: hostel._id,
          date: now,
          status: 'inside',
          businessDate: now.toISOString().slice(0, 10),
        },
      ]);

      const trends = await AttendanceAnalyticsService.calculateHostelAttendanceTrends([hostel._id]);
      assert.equal(trends.total, 1);
      assert.equal(trends.inside, 1);
      assert.equal(trends.outside, 0);

      // Verify owner attendance trends endpoint via API
      const res = await request(app)
        .get(`/api/owner/analytics/attendance?hostelId=${hostel._id}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.inside, 1);
    });
  });
});
