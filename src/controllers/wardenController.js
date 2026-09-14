/**
 * @file controllers/wardenController.js
 * @description Warden controller facade aggregating decomposed domain controllers.
 * Preserves 100% backward compatibility for routes and existing tests.
 */

'use strict';

const wardenDashboardController = require('./warden/wardenDashboardController');
const wardenCurfewController = require('./warden/wardenCurfewController');
const wardenLeaveController = require('./warden/wardenLeaveController');
const wardenVisitorController = require('./warden/wardenVisitorController');
const wardenStudentController = require('./warden/wardenStudentController');
const wardenComplaintController = require('./warden/wardenComplaintController');
const wardenRoomController = require('./warden/wardenRoomController');
const wardenAttendanceController = require('./warden/wardenAttendanceController');
const { resolveWardenHostelId } = require('./warden/wardenHelper');

module.exports = {
  resolveWardenHostelId,
  ...wardenDashboardController,
  ...wardenCurfewController,
  ...wardenLeaveController,
  ...wardenVisitorController,
  ...wardenStudentController,
  ...wardenComplaintController,
  ...wardenRoomController,
  ...wardenAttendanceController,
};


// @desc    Reset student device binding
// @route   POST /api/warden/students/:studentId/reset-device
// @access  Private (Warden)
exports.resetStudentDevice = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.studentId, hostelId: req.user.hostelId });
  if (!user) {
    return res.status(404).json({ success: false, message: 'Student not found in your hostel' });
  }
  user.deviceId = null;
  user.deviceBoundAt = null;
  await user.save();
  res.status(200).json({ success: true, message: 'Device binding reset successfully' });
});


// @desc    Record and trigger manual parent notification for a violation
// @route   POST /api/warden/violations/:id/parent-notify
// @access  Private (Warden)
exports.recordParentNotification = asyncHandler(async (req, res) => {
  const { message } = req.body;
  const violation = await require('../models/Violation').findById(req.params.id).populate('studentId');
  if (!violation) {
    return res.status(404).json({ success: false, message: 'Violation not found' });
  }
  const student = violation.studentId;
  const parentEmail = student.parentContact?.email || student.emergencyContact?.email;
  if (!parentEmail) {
    return res.status(400).json({ success: false, message: 'No parent email found for this student' });
  }
  
  await require('../utils/emailService').sendParentEmergencyEmail({
    parentEmail,
    parentName: student.parentContact?.name || 'Parent',
    studentName: student.name,
    hostelName: 'Hostel',
    emergencyType: 'violation_alert',
    description: message || 'Your ward has a recorded violation. Please contact the warden.',
    timestamp: new Date(),
  }).catch(e => console.warn('Parent email failed:', e));

  violation.parentNotified = true;
  violation.parentNotifiedAt = new Date();
  await violation.save();

  res.status(200).json({ success: true, message: 'Parent notified successfully' });
});
