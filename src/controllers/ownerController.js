/**
 * @file controllers/ownerController.js
 * @description Owner controller facade aggregating decomposed domain controllers.
 * Preserves 100% backward compatibility for routes and existing tests.
 */

'use strict';

const ownerHostelController = require('./owner/ownerHostelController');
const ownerRoomController = require('./owner/ownerRoomController');
const ownerAmenityController = require('./owner/ownerAmenityController');
const ownerDisciplineController = require('./owner/ownerDisciplineController');
const ownerStaffController = require('./owner/ownerStaffController');
const ownerStudentController = require('./owner/ownerStudentController');
const ownerAttendanceController = require('./owner/ownerAttendanceController');
const ownerNotificationController = require('./owner/ownerNotificationController');
const ownerBillingController = require('./owner/ownerBillingController');
const ownerVisitorController = require('./owner/ownerVisitorController');
const ownerAnalyticsController = require('./owner/ownerAnalyticsController');
const ownerSupportController = require('./owner/ownerSupportController');
const ownerMessController = require('./owner/ownerMessController');
const ownerLeaveController = require('./owner/ownerLeaveController');
const ownerComplaintController = require('./owner/ownerComplaintController');

module.exports = {
  ...ownerHostelController,
  ...ownerRoomController,
  ...ownerAmenityController,
  ...ownerDisciplineController,
  ...ownerStaffController,
  ...ownerStudentController,
  ...ownerAttendanceController,
  ...ownerNotificationController,
  ...ownerBillingController,
  ...ownerVisitorController,
  ...ownerAnalyticsController,
  ...ownerSupportController,
  ...ownerMessController,
  ...ownerLeaveController,
  ...ownerComplaintController,
};
