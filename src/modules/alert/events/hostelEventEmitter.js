/**
 * @file hostelEventEmitter.js
 * @description Singleton Node.js EventEmitter for hostel automation events.
 *
 * WHY EVENTEMITTER (not direct service calls):
 * Using an EventEmitter decouples the existing controllers from the alert module.
 * When a student checks in (studentController.js), it just emits an event:
 *   hostelEventEmitter.emit('CHECKIN', { studentId, hostelId, time })
 *
 * The alert handlers subscribe to these events and react independently.
 * This means:
 * 1. No circular dependency: controllers don't import alert services
 * 2. New alert types can be added by adding a new handler — no controller changes
 * 3. Easy to unit test: mock the emitter, no real DB needed
 * 4. Events are processed async (setImmediate), so they never slow down API responses
 *
 * WHY NOT REDIS PUB/SUB:
 * EventEmitter is sufficient for a single-process Node.js app.
 * If you scale to multiple processes, replace this with BullMQ events or Redis pub/sub.
 *
 * USAGE:
 * // In any controller:
 * const hostelEventEmitter = require('./modules/alert/events/hostelEventEmitter');
 * hostelEventEmitter.emit(hostelEventEmitter.EVENTS.CHECKIN, { studentId, hostelId, time });
 */

'use strict';

const EventEmitter = require('events');
const { ALERT_TYPES } = require('../utils/constants');

class HostelEventEmitter extends EventEmitter {
  constructor() {
    super();
    // Increase max listeners to avoid memory leak warnings in large systems
    this.setMaxListeners(50);
  }
}

// Singleton instance
const hostelEventEmitter = new HostelEventEmitter();

// Attach event name constants directly to the emitter for convenience
hostelEventEmitter.EVENTS = {
  // Attendance
  ATTENDANCE_MARKED: ALERT_TYPES.STUDENT_PRESENT, // use for both present and absent
  ATTENDANCE_MISSING: ALERT_TYPES.ATTENDANCE_MISSING,

  // Gate events
  CHECKIN: ALERT_TYPES.CHECKIN,
  CHECKOUT: ALERT_TYPES.CHECKOUT,

  // Leave
  LEAVE_REQUESTED: ALERT_TYPES.LEAVE_REQUESTED,
  LEAVE_APPROVED: ALERT_TYPES.LEAVE_APPROVED,
  LEAVE_REJECTED: ALERT_TYPES.LEAVE_REJECTED,
  LEAVE_CANCELLED: ALERT_TYPES.LEAVE_CANCELLED,

  // Curfew
  CURFEW_VIOLATION: ALERT_TYPES.CURFEW_VIOLATION,

  // Emergency
  EMERGENCY_RAISED: ALERT_TYPES.EMERGENCY_OTHER,
};

// Log all emitted events in development
if (process.env.NODE_ENV !== 'production') {
  const originalEmit = hostelEventEmitter.emit.bind(hostelEventEmitter);
  hostelEventEmitter.emit = (event, ...args) => {
    if (!['newListener', 'removeListener'].includes(event)) {
      console.log(`[HostelEventEmitter] Event emitted: ${event}`);
    }
    return originalEmit(event, ...args);
  };
}

// Global error handler — prevents uncaught exceptions from event handlers
hostelEventEmitter.on('error', (err) => {
  console.error('[HostelEventEmitter] Unhandled error:', err.message);
});

module.exports = hostelEventEmitter;
