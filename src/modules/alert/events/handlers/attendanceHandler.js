/**
 * @file attendanceHandler.js
 * @description Handles attendance marking events from hostelEventEmitter.
 *
 * REGISTERED EVENTS:
 * - STUDENT_PRESENT / STUDENT_ABSENT → AttendanceAutomationService.handleAttendanceMarked()
 *
 * PAYLOAD EXPECTED:
 * { studentId: string, hostelId: string, status: 'inside'|'outside'|'pending', markedBy?: string }
 */

'use strict';

const hostelEventEmitter = require('../hostelEventEmitter');
const AttendanceAutomationService = require('../../services/AttendanceAutomationService');
const { ALERT_TYPES } = require('../../utils/constants');

/**
 * Register all attendance event handlers.
 */
function registerAttendanceHandlers() {
  // Both PRESENT and ABSENT fire through the same handler with different status
  const handleAttendance = (payload) => {
    setImmediate(async () => {
      try {
        const { studentId, hostelId, status, markedBy } = payload;
        if (!studentId || !hostelId || !status) return;
        await AttendanceAutomationService.handleAttendanceMarked({ studentId, hostelId, status, markedBy });
      } catch (err) {
        console.error('[AttendanceHandler] Error:', err.message);
      }
    });
  };

  hostelEventEmitter.on(ALERT_TYPES.STUDENT_PRESENT, handleAttendance);
  hostelEventEmitter.on(ALERT_TYPES.STUDENT_ABSENT, handleAttendance);
  hostelEventEmitter.on(ALERT_TYPES.ATTENDANCE_MISSING, handleAttendance);

  console.log('[AttendanceHandler] Attendance event handlers registered');
}

module.exports = { registerAttendanceHandlers };
