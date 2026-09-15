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
const asyncHandler = require('../utils/asyncHandler');

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
