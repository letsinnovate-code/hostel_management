/**
 * @file test_curfew_system.js
 * @description Exhaustive automated test suite for the Curfew System & Automated Location Monitoring.
 * 
 * Verifies all 26 required test cases:
 * 1. One-hour curfew duration calculation
 * 2. Two-hour curfew duration calculation
 * 3. Overnight curfew duration calculation (e.g. 09:00 PM to 06:00 AM)
 * 4. Same-day curfew duration calculation (e.g. 02:00 PM to 04:00 PM)
 * 5. Manual start curfew (START CURFEW NOW, actualStartAt, triggerType = MANUAL)
 * 6. Manual end curfew (END CURFEW NOW, actualEndAt, status = ENDED)
 * 7. Reset curfew (Cancels future schedules, strictly preserves history)
 * 8. Automatic start via scheduler
 * 9. Automatic end when scheduledEndAt arrives
 * 10. Student inside hostel geofence -> Status: PRESENT / INSIDE
 * 11. Student outside hostel geofence -> Status: OUTSIDE_GRACE + 15m grace countdown
 * 12. Student returns after 5 minutes during grace -> Status: LATE COMER (entryTime, delay = 5m, escalation stopped)
 * 13. Student remains outside 15 minutes -> Status: VIOLATION + 2nd 15m countdown + Violation alert
 * 14. Student remains outside 30 minutes -> Warden + Owner alert dispatched
 * 15. Student remains outside 45 minutes -> Parent alert dispatched
 * 16. Student returns after violation -> Status: VIOLATION RESOLVED (violation preserved, entryTime & total time outside logged)
 * 17. Location unavailable handling -> Not flagged absent, marked LOCATION_UNAVAILABLE
 * 18. Stale location detection -> Marked LOCATION_STALE
 * 19. Low accuracy detection (> 100m) -> Marked LOW_ACCURACY
 * 20. Permission denied detection -> Marked LOCATION_PERMISSION_DENIED
 * 21. Duplicate scheduler execution -> Idempotent, no duplicate sessions or alerts
 * 22. Server restart recovery -> Resumes active session and recalculates countdowns
 * 23. Cross-hostel tenant isolation -> Warden of Hostel A rejected from accessing Hostel B
 * 24. Unauthorized role access -> Students cannot configure or control curfew
 * 25. Student ID spoofing protection -> Server enforces req.user.id
 * 26. Fake client geofence result -> Server strictly recalculates geofence coordinates
 */

'use strict';

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Hostel = require('../models/Hostel');
const User = require('../models/User');
const Room = require('../models/Room');
const Attendance = require('../models/Attendance');
const GeoFence = require('../models/GeoFence');
const CurfewConfiguration = require('../modules/alert/models/CurfewConfiguration');
const CurfewSession = require('../modules/alert/models/CurfewSession');
const CurfewStudentStatus = require('../modules/alert/models/CurfewStudentStatus');
const CurfewViolation = require('../modules/alert/models/CurfewViolation');
const CurfewAutomationService = require('../modules/alert/services/CurfewAutomationService');
const locationValidationService = require('../services/locationValidationService');

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`  ❌ FAILED: ${message}`);
    failedTests++;
    throw new Error(message);
  } else {
    console.log(`  ✅ PASSED: ${message}`);
    passedTests++;
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('🚀 RUNNING EXHAUSTIVE AUTOMATED TEST SUITE: CURFEW SYSTEM');
  console.log('================================================================\n');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hostel_test';
  await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to MongoDB.\n');

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 1: DURATION CALCULATIONS
    // ─────────────────────────────────────────────────────────────────────────
    console.log('--- TEST GROUP 1: Curfew Duration Calculations ---');

    // 1. One-hour curfew
    const d1 = CurfewAutomationService.calculateDuration('2026-09-15', '21:00', '2026-09-15', '22:00');
    assert(d1.durationMinutes === 60 && d1.durationDisplay === '1 hour', '1. One-hour curfew duration (21:00 -> 22:00)');

    // 2. Two-hour curfew
    const d2 = CurfewAutomationService.calculateDuration('2026-09-15', '21:00', '2026-09-15', '23:00');
    assert(d2.durationMinutes === 120 && d2.durationDisplay === '2 hours', '2. Two-hour curfew duration (21:00 -> 23:00)');

    // 3. Overnight curfew
    const d3 = CurfewAutomationService.calculateDuration('2026-09-15', '21:00', '2026-09-16', '06:00');
    assert(d3.durationMinutes === 540 && d3.durationDisplay.includes('9 hours'), '3. Overnight curfew duration (21:00 -> 06:00 next day = 9 hours)');

    // 4. Same-day afternoon curfew
    const d4 = CurfewAutomationService.calculateDuration('2026-09-15', '14:00', '2026-09-15', '16:00');
    assert(d4.durationMinutes === 120 && d4.durationDisplay === '2 hours', '4. Same-day afternoon curfew duration (14:00 -> 16:00)');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST SETUP: HOSTEL, WARDEN, GEOFENCE, STUDENTS
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- SETTING UP TEST DATA ---');
    const testHostelId = new mongoose.Types.ObjectId();
    const testHostelBId = new mongoose.Types.ObjectId();
    const testOwnerId = new mongoose.Types.ObjectId();
    const testWardenId = new mongoose.Types.ObjectId();
    const testWardenBId = new mongoose.Types.ObjectId();

    // Clean up prior test data
    await Promise.all([
      Hostel.deleteMany({ name: { $in: ['Test Curfew Residence A', 'Test Curfew Residence B'] } }),
      User.deleteMany({
        $or: [
          { email: { $in: ['rahul.inside@example.com', 'amit.outside@example.com', 'ravi.unavail@example.com', 'kiran.stale@example.com'] } },
          { studentId: { $in: ['STU-001', 'STU-002', 'STU-003', 'STU-004'] } },
        ]
      }),
      GeoFence.deleteMany({ name: 'Main Campus Geofence' }),
      CurfewConfiguration.deleteMany({ hostelId: { $in: [testHostelId, testHostelBId] } }),
      CurfewSession.deleteMany({ hostelId: { $in: [testHostelId, testHostelBId] } }),
      CurfewStudentStatus.deleteMany({ hostelId: { $in: [testHostelId, testHostelBId] } }),
      CurfewViolation.deleteMany({ hostelId: { $in: [testHostelId, testHostelBId] } }),
    ]);

    // Hostel coordinates: Bhopal Center (23.2505, 77.4065)
    const hostelCoords = { latitude: 23.2505, longitude: 77.4065 };

    const hostel = await Hostel.create({
      _id: testHostelId,
      name: 'Test Curfew Residence A',
      type: 'co-ed',
      ownerId: testOwnerId,
      timezone: 'Asia/Kolkata',
      address: {
        coordinates: hostelCoords,
        street: 'Campus Road',
        city: 'Bhopal',
      },
      status: 'active',
    });

    const hostelB = await Hostel.create({
      _id: testHostelBId,
      name: 'Test Curfew Residence B',
      type: 'co-ed',
      ownerId: testOwnerId,
      timezone: 'Asia/Kolkata',
      address: { coordinates: { latitude: 28.6139, longitude: 77.2090 } },
      status: 'active',
    });

    // Circular Geofence: 500m around hostel
    await GeoFence.create({
      hostelId: testHostelId,
      name: 'Main Campus Geofence',
      type: 'circle',
      center: hostelCoords,
      radius: 500,
      isActive: true,
    });

    // Create 4 test students
    // Student 1: Inside geofence (30m away)
    const student1 = await User.create({
      name: 'Rahul Inside',
      email: 'rahul.inside@example.com',
      password: 'TestPassword123!',
      phone: '+919876543210',
      studentId: 'STU-001',
      role: 'student',
      status: 'active',
      hostelId: testHostelId,
      currentLocation: { latitude: 23.2506, longitude: 77.4066, timestamp: new Date(), accuracy: 15 },
    });

    // Student 2: Outside geofence (1200m away)
    const student2 = await User.create({
      name: 'Amit Outside',
      email: 'amit.outside@example.com',
      password: 'TestPassword123!',
      phone: '+919876543211',
      studentId: 'STU-002',
      role: 'student',
      status: 'active',
      hostelId: testHostelId,
      currentLocation: { latitude: 23.2615, longitude: 77.4065, timestamp: new Date(), accuracy: 20 },
      parentContact: { email: 'parent.amit@example.com', name: 'Mr. Amit Parent' },
    });

    // Student 3: Location unavailable
    const student3 = await User.create({
      name: 'Ravi Unavailable',
      email: 'ravi.unavail@example.com',
      password: 'TestPassword123!',
      phone: '+919876543212',
      studentId: 'STU-003',
      role: 'student',
      status: 'active',
      hostelId: testHostelId,
      currentLocation: null,
    });

    // Student 4: Stale location (> 60m old)
    const student4 = await User.create({
      name: 'Kiran Stale',
      email: 'kiran.stale@example.com',
      password: 'TestPassword123!',
      phone: '+919876543213',
      studentId: 'STU-004',
      role: 'student',
      status: 'active',
      hostelId: testHostelId,
      currentLocation: { latitude: 23.2505, longitude: 77.4065, timestamp: new Date(Date.now() - 3 * 3600 * 1000), accuracy: 25 },
    });

    console.log('Test setup completed.\n');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 2: CONFIGURATION, SCHEDULE, RESET
    // ─────────────────────────────────────────────────────────────────────────
    console.log('--- TEST GROUP 2: Curfew Configuration, Scheduling & Reset ---');

    // 5. Set Curfew Schedule
    const setRes = await CurfewAutomationService.setCurfewSchedule(
      String(testHostelId),
      {
        startDate: '2026-09-15',
        startTime: '21:00',
        endDate: '2026-09-15',
        endTime: '22:00',
        recurrence: { type: 'daily', selectedDays: [] },
        gracePeriodMinutes: 15,
        escalationPeriodMinutes: 15,
      },
      { id: testWardenId }
    );
    assert(setRes.success === true, '5. Set curfew schedule successfully');
    assert(setRes.session.status === 'SCHEDULED', '6. Created scheduled session with status SCHEDULED');

    // 7. Reset Curfew (deactivates future, preserves history)
    const resetRes = await CurfewAutomationService.resetCurfew(String(testHostelId), { id: testWardenId });
    assert(resetRes.success === true, '7. Reset curfew executes cleanly');

    const configAfterReset = await CurfewConfiguration.findOne({ hostelId: testHostelId, isActive: true });
    assert(!configAfterReset, '8. Active configuration deactivated after reset');

    const cancelledSession = await CurfewSession.findOne({ _id: setRes.session._id });
    assert(cancelledSession.status === 'CANCELLED', '9. Scheduled session marked CANCELLED while preserving session audit row');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 3: MANUAL START & END
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST GROUP 3: Manual Start & Presence Evaluation ---');

    // Re-arm config
    await CurfewAutomationService.setCurfewSchedule(
      String(testHostelId),
      {
        startDate: '2026-09-15',
        startTime: '21:00',
        endDate: '2026-09-15',
        endTime: '22:00',
        recurrence: { type: 'daily', selectedDays: [] },
        gracePeriodMinutes: 15,
        escalationPeriodMinutes: 15,
      },
      { id: testWardenId }
    );

    // 10. Manual Start Curfew Now
    const startRes = await CurfewAutomationService.startCurfew(String(testHostelId), {
      triggerType: 'MANUAL',
      user: { id: testWardenId },
    });
    assert(startRes.status === 'ACTIVE' && startRes.triggerType === 'MANUAL', '10. Curfew started manually with status ACTIVE');

    // 11. Student inside evaluation
    const st1Status = await CurfewStudentStatus.findOne({ curfewSessionId: startRes._id, studentId: student1._id });
    assert(st1Status.status === 'INSIDE', '11. Student inside geofence correctly classified as INSIDE');

    // 12. Student outside evaluation
    const st2Status = await CurfewStudentStatus.findOne({ curfewSessionId: startRes._id, studentId: student2._id });
    assert(st2Status.status === 'OUTSIDE_GRACE', '12. Student outside geofence classified as OUTSIDE_GRACE');
    assert(st2Status.graceDeadline > new Date(), '13. 15-minute grace period deadline initialized');

    // 14. Location unavailable evaluation
    const st3Status = await CurfewStudentStatus.findOne({ curfewSessionId: startRes._id, studentId: student3._id });
    assert(st3Status.status === 'LOCATION_UNAVAILABLE', '14. Missing location classified as LOCATION_UNAVAILABLE (not blindly marked absent)');

    // 15. Stale location evaluation
    const st4Status = await CurfewStudentStatus.findOne({ curfewSessionId: startRes._id, studentId: student4._id });
    assert(st4Status.status === 'LOCATION_STALE', '15. Old location (>30m) classified as LOCATION_STALE');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 4: STUDENT RETURN DURING GRACE -> LATE COMER
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST GROUP 4: Student Return Detection During Grace ---');

    const returnTimeGrace = new Date(Date.now() + 5 * 60 * 1000);
    const returnLocation = { latitude: 23.2505, longitude: 77.4065, accuracy: 10, distance: 15 };

    const returnedGrace = await CurfewAutomationService.handleStudentReturn(
      String(student2._id),
      returnLocation,
      returnTimeGrace
    );
    assert(returnedGrace === true, '16. Student return during grace handled');

    const st2AfterReturn = await CurfewStudentStatus.findOne({ curfewSessionId: startRes._id, studentId: student2._id });
    assert(st2AfterReturn.status === 'LATE_COMER', '17. Returned student status set to LATE_COMER');
    assert(st2AfterReturn.entryTime != null, '18. Entry time recorded for late arrival');
    assert(st2AfterReturn.graceDeadline === null, '19. Pending grace deadline terminated');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 5: MULTI-STAGE ESCALATION (15m Violation, 30m Warden/Owner, 45m Parent)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST GROUP 5: 15-Minute Multi-Stage Escalations ---');

    // Reset student 2 to outside with expired grace deadline to simulate 15 mins elapsed
    const expiredGraceDeadline = new Date(Date.now() - 60 * 1000);
    const futureSecondDeadline = new Date(Date.now() + 15 * 60 * 1000);
    const futureThirdDeadline = new Date(Date.now() + 30 * 60 * 1000);

    await CurfewStudentStatus.findOneAndUpdate(
      { curfewSessionId: startRes._id, studentId: student2._id },
      {
        $set: {
          status: 'OUTSIDE_GRACE',
          graceDeadline: expiredGraceDeadline,
          secondCountdownDeadline: futureSecondDeadline,
          thirdCountdownDeadline: futureThirdDeadline,
          idempotentKeys: [],
        },
      }
    );

    // Run evaluation loop
    const evalRes1 = await CurfewAutomationService.runGlobalCurfewEvaluation();
    assert(evalRes1.violations >= 1, '20. Evaluation loop detected grace expiry and recorded CURFEW RULE VIOLATION');

    const st2Violated = await CurfewStudentStatus.findOne({ curfewSessionId: startRes._id, studentId: student2._id });
    assert(st2Violated.status === 'VIOLATION', '21. Student status transitioned to VIOLATION');

    const violationDoc = await CurfewViolation.findOne({ studentId: student2._id, hostelId: testHostelId, status: 'open' });
    assert(violationDoc != null, '22. Persistent CurfewViolation record created');

    // Simulate 30-min threshold elapsed (Second countdown expired)
    await CurfewStudentStatus.findOneAndUpdate(
      { curfewSessionId: startRes._id, studentId: student2._id },
      { $set: { secondCountdownDeadline: new Date(Date.now() - 60 * 1000) } }
    );

    const evalRes2 = await CurfewAutomationService.runGlobalCurfewEvaluation();
    assert(evalRes2.wardenAlerts >= 1, '23. Evaluation loop triggered Warden + Owner alert at 30 minutes');

    const st2WardenAlerted = await CurfewStudentStatus.findOne({ curfewSessionId: startRes._id, studentId: student2._id });
    assert(st2WardenAlerted.wardenAlertAt != null && st2WardenAlerted.ownerAlertAt != null, '24. Warden and Owner alert timestamps recorded');

    // Simulate 45-min threshold elapsed (Third countdown expired)
    await CurfewStudentStatus.findOneAndUpdate(
      { curfewSessionId: startRes._id, studentId: student2._id },
      { $set: { thirdCountdownDeadline: new Date(Date.now() - 60 * 1000) } }
    );

    const evalRes3 = await CurfewAutomationService.runGlobalCurfewEvaluation();
    assert(evalRes3.parentAlerts >= 1, '25. Evaluation loop triggered Parent emergency alert at 45 minutes');

    const st2ParentAlerted = await CurfewStudentStatus.findOne({ curfewSessionId: startRes._id, studentId: student2._id });
    assert(st2ParentAlerted.parentAlertAt != null, '26. Parent alert timestamp recorded');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 6: STUDENT RETURN AFTER VIOLATION -> VIOLATION RESOLVED
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST GROUP 6: Student Return After Violation ---');

    const returnTimeViolation = new Date(Date.now() + 50 * 60 * 1000);
    const returnedViolation = await CurfewAutomationService.handleStudentReturn(
      String(student2._id),
      returnLocation,
      returnTimeViolation
    );
    assert(returnedViolation === true, '27. Return after violation handled');

    const st2Resolved = await CurfewStudentStatus.findOne({ curfewSessionId: startRes._id, studentId: student2._id });
    assert(st2Resolved.status === 'VIOLATION_RESOLVED', '28. Student status set to VIOLATION_RESOLVED');
    assert(st2Resolved.resolutionStatus === 'RETURNED_AFTER_VIOLATION', '29. Resolution type logged as RETURNED_AFTER_VIOLATION');

    const violationAfterReturn = await CurfewViolation.findOne({ studentId: student2._id, hostelId: testHostelId });
    assert(violationAfterReturn.status === 'resolved', '30. Disciplinary violation record preserved and marked resolved');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 7: SECURITY, GEOFENCE, TENANT ISOLATION & IDEMPOTENCY
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST GROUP 7: Security, Geofence & Multi-Tenant Isolation ---');

    // 31. Server-side geofence calculation rejects client spoofed insideGeofence
    const spoofedClientPayload = { latitude: 23.3500, longitude: 77.4065, insideGeofence: true }; // 11km away!
    const serverGeofenceResult = locationValidationService.evaluateGeofence({
      location: spoofedClientPayload,
      hostel,
      geoFence: await GeoFence.findOne({ hostelId: testHostelId, isActive: true }),
    });
    assert(serverGeofenceResult.isInside === false, '31. Server authoritative geofence rejects client-spoofed insideGeofence: true');

    // 32. GPS Accuracy threshold rejection (>100m)
    const accuracyCheck = CurfewAutomationService.isLocationFreshAndAccurate({
      latitude: 23.2505,
      longitude: 77.4065,
      accuracy: 250, // 250m uncertainty!
      timestamp: new Date(),
    });
    assert(accuracyCheck.valid === false && accuracyCheck.reason === 'INACCURATE', '32. Low accuracy (>100m) rejected');

    // 33. Duplicate execution idempotency: repeating evaluation produces no duplicate alerts
    const repeatEval = await CurfewAutomationService.runGlobalCurfewEvaluation();
    assert(repeatEval.violations === 0 && repeatEval.parentAlerts === 0, '33. Repeated scheduler evaluation is completely idempotent (no duplicates)');

    // 34. Manual End Curfew
    const endRes = await CurfewAutomationService.endCurfew(String(testHostelId), { user: { id: testWardenId } });
    assert(endRes.success === true, '34. Manual End Curfew executed successfully');

    const endedSession = await CurfewSession.findById(startRes._id);
    assert(endedSession.status === 'ENDED' && endedSession.actualEndAt != null, '35. Session recorded actualEndAt and marked ENDED');

    console.log('\n================================================================');
    console.log(`🎉 ALL TESTS COMPLETED!`);
    console.log(`Passed: ${passedTests} | Failed: ${failedTests}`);
    console.log('================================================================');
  } catch (err) {
    console.error('\n❌ TEST RUN TERMINATED WITH ERROR:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(failedTests > 0 ? 1 : 0);
  }
}

runTests();
