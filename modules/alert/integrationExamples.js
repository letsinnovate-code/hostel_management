/**
 * @file integrationExamples.js
 * @description Example integration hooks showing HOW to add alert events
 * into your existing controllers (attendance, check-in, leave).
 *
 * IMPORTANT: These are EXAMPLES ONLY — do not import this file.
 * Copy the relevant lines into your existing controllers.
 *
 * The approach uses the hostelEventEmitter (event-driven, non-blocking).
 * No direct imports of alert services required in your existing controllers.
 * This avoids circular dependencies and keeps existing code clean.
 *
 * ─────────────────────────────────────────────────────────────────────
 * PATTERN:
 * 1. Import hostelEventEmitter at the top of your controller
 * 2. After your existing business logic succeeds, emit an event
 * 3. That's it — the alert module handles everything else
 * ─────────────────────────────────────────────────────────────────────
 */

// ══════════════════════════════════════════════════════════════════════
// EXAMPLE 1: studentController.js — Check-In Integration
// ══════════════════════════════════════════════════════════════════════

/*
// At the top of studentController.js, add:
const hostelEventEmitter = require('../modules/alert').hostelEventEmitter;

// Inside your checkIn handler, AFTER saving attendance:
exports.checkIn = async (req, res) => {
  try {
    // ... your existing check-in logic ...
    // ... attendance.save() ...

    // ✅ ADD THIS: Emit check-in event to trigger alert automation
    hostelEventEmitter.emit(hostelEventEmitter.EVENTS.CHECKIN, {
      studentId: String(req.user.id),
      hostelId: String(req.user.hostelId),
      time: new Date(),
      source: 'student',
    });

    res.status(200).json({ success: true, message: 'Checked in successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Inside your checkOut handler, AFTER saving attendance:
exports.checkOut = async (req, res) => {
  try {
    // ... your existing check-out logic ...

    // ✅ ADD THIS:
    hostelEventEmitter.emit(hostelEventEmitter.EVENTS.CHECKOUT, {
      studentId: String(req.user.id),
      hostelId: String(req.user.hostelId),
      time: new Date(),
    });

    res.status(200).json({ success: true, message: 'Checked out successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
*/

// ══════════════════════════════════════════════════════════════════════
// EXAMPLE 2: wardenController.js — Leave Approval Integration
// ══════════════════════════════════════════════════════════════════════

/*
// At the top of wardenController.js:
const hostelEventEmitter = require('../modules/alert').hostelEventEmitter;
const { ALERT_TYPES } = require('../modules/alert/utils/constants');

// Inside approvePermission:
exports.approvePermission = async (req, res) => {
  try {
    // ... your existing approval logic ...
    const permission = await Permission.findByIdAndUpdate(
      permissionId,
      { status: 'approved', approvedBy: req.user.id, approvedAt: new Date() },
      { new: true }
    );

    // ✅ ADD THIS: Notify student and log the event
    hostelEventEmitter.emit(ALERT_TYPES.LEAVE_APPROVED, {
      studentId: String(permission.studentId),
      hostelId: String(req.user.hostelId),
      permissionId: String(permission._id),
      returnDate: permission.returnDate,
    });

    res.status(200).json({ success: true, message: 'Permission approved' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Inside rejectPermission:
exports.rejectPermission = async (req, res) => {
  try {
    const { reason } = req.body;
    const permission = await Permission.findByIdAndUpdate(
      permissionId,
      { status: 'rejected', rejectionReason: reason },
      { new: true }
    );

    // ✅ ADD THIS:
    hostelEventEmitter.emit(ALERT_TYPES.LEAVE_REJECTED, {
      studentId: String(permission.studentId),
      hostelId: String(req.user.hostelId),
      permissionId: String(permission._id),
      reason,
    });

    res.status(200).json({ success: true, message: 'Permission rejected' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
*/

// ══════════════════════════════════════════════════════════════════════
// EXAMPLE 3: studentController.js — Leave Request Integration
// ══════════════════════════════════════════════════════════════════════

/*
// Inside requestLeave / createPermission:
exports.requestLeave = async (req, res) => {
  try {
    const permission = await Permission.create({
      studentId: req.user.id,
      permissionType: req.body.permissionType,
      reason: req.body.reason,
      requestedDate: req.body.requestedDate,
      returnDate: req.body.returnDate,
    });

    // ✅ ADD THIS: Notify wardens of new leave request
    hostelEventEmitter.emit(ALERT_TYPES.LEAVE_REQUESTED, {
      studentId: String(req.user.id),
      hostelId: String(req.user.hostelId),
      permissionId: String(permission._id),
      returnDate: permission.returnDate,
    });

    res.status(201).json({ success: true, data: permission });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
*/

// ══════════════════════════════════════════════════════════════════════
// EXAMPLE 4: Direct Service Call (when you don't want events)
// ══════════════════════════════════════════════════════════════════════

/*
// You can also call HostelAlertService directly from anywhere:
const HostelAlertService = require('../modules/alert').HostelAlertService;

// Send a custom alert:
await HostelAlertService.send({
  recipientRole: 'warden',
  type: 'CURFEW_VIOLATION',
  title: 'Student Outside Hostel',
  message: 'Rahul Sharma (Room A-203) has not returned before curfew.',
  hostelId: '64abc123def456',
  studentId: '64abc789xyz012',
  metadata: {
    studentName: 'Rahul Sharma',
    roomNumber: 'A-203',
    lastCheckOutTime: new Date(),
    curfewTime: '21:00',
  },
});

// Broadcast to multiple roles:
await HostelAlertService.broadcast({
  hostelId: '64abc123def456',
  type: 'ANNOUNCEMENT',
  title: 'Hostel Meeting Tomorrow',
  message: 'All students must attend the hostel meeting at 6 PM tomorrow.',
  targetRoles: ['student'],
});

// Send to specific user:
await HostelAlertService.sendToUser({
  userId: '64abc789xyz012',
  type: 'LEAVE_APPROVED',
  title: 'Leave Request Approved',
  message: 'Your leave request has been approved. Return by Sunday 9 PM.',
  hostelId: '64abc123def456',
});
*/

module.exports = {}; // Empty export — this file is documentation only
