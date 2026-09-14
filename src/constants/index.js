/**
 * @file constants/index.js
 * @description Centralized domain constants, role definitions, status enums, thresholds, and cooldowns.
 */

'use strict';

const ROLES = Object.freeze({
  OWNER: 'owner',
  WARDEN: 'warden',
  CLEANER: 'cleaner',
  SUPERVISOR: 'supervisor',
  STUDENT: 'student',
  SECURITY: 'security',
  SUPERADMIN: 'superadmin',
});

const ALL_ROLES = Object.freeze(Object.values(ROLES));

const COMPLAINT_STATUS = Object.freeze({
  OPEN: 'open',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in-progress',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
  REOPENED: 'reopened',
});

const ALL_COMPLAINT_STATUSES = Object.freeze(Object.values(COMPLAINT_STATUS));

const COMPLAINT_PRIORITY = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
  CRITICAL: 'critical',
});

const ALL_COMPLAINT_PRIORITIES = Object.freeze(Object.values(COMPLAINT_PRIORITY));

const COMPLAINT_TYPE = Object.freeze({
  MAINTENANCE: 'maintenance',
  CLEANING: 'cleaning',
  FOOD: 'food',
  SAFETY: 'safety',
  OTHER: 'other',
});

const ALL_COMPLAINT_TYPES = Object.freeze(Object.values(COMPLAINT_TYPE));

const PERMISSION_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  CHECKED_OUT: 'checked-out',
  RETURNED: 'returned',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
});

const ALL_PERMISSION_STATUSES = Object.freeze(Object.values(PERMISSION_STATUS));

const PERMISSION_TYPE = Object.freeze({
  LATE_ENTRY: 'late-entry',
  LEAVE: 'leave',
  OVERNIGHT: 'overnight',
  MULTI_DAY: 'multi-day',
  NIGHT_OUT: 'night-out',
  DAY_PASS: 'day-pass',
  EMERGENCY: 'emergency',
  MEDICAL: 'medical',
  VACATION: 'vacation',
  OTHER: 'other',
});

const ALL_PERMISSION_TYPES = Object.freeze(Object.values(PERMISSION_TYPE));

const VISITOR_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
});

const ALL_VISITOR_STATUSES = Object.freeze(Object.values(VISITOR_STATUS));

const ATTENDANCE_STATUS = Object.freeze({
  PRESENT: 'present',
  ABSENT: 'absent',
  LATE: 'late',
  ON_LEAVE: 'on-leave',
  HALF_DAY: 'half-day',
});

const ALL_ATTENDANCE_STATUSES = Object.freeze(Object.values(ATTENDANCE_STATUS));

const PRESENCE_STATUS = Object.freeze({
  INSIDE: 'inside',
  OUTSIDE: 'outside',
  PENDING: 'pending',
  UNKNOWN: 'unknown',
  PERMISSION_DENIED: 'permission_denied',
  PERMISSION_NOT_REQUESTED: 'permission_not_requested',
  NO_DATA: 'no_data',
});

const ALL_PRESENCE_STATUSES = Object.freeze(Object.values(PRESENCE_STATUS));

const BUSINESS_THRESHOLDS = Object.freeze({
  GEOFENCE_RADIUS_METERS: 500,
  DEFAULT_ABSENCE_THRESHOLD_DAYS: 3,
  LOW_ATTENDANCE_PERCENTAGE: 75,
  MAX_ANALYTICS_PERIOD_DAYS: 90,
  DEFAULT_ANALYTICS_PERIOD_DAYS: 30,
  MIN_ANALYTICS_PERIOD_DAYS: 7,
  CONSECUTIVE_ABSENCE_ALERT: 2,
  CURFEW_GRACE_PERIOD_MINUTES: 15,
  LEAVE_OVERDUE_THRESHOLD_HOURS: 2,
});

const COOLDOWNS = Object.freeze({
  CHECKOUT_COOLDOWN_MS: 2 * 60 * 1000, // 2 minutes
  NOTIFICATION_DEDUPE_WINDOW_MS: 30 * 60 * 1000, // 30 minutes
});

module.exports = {
  ROLES,
  ALL_ROLES,
  COMPLAINT_STATUS,
  ALL_COMPLAINT_STATUSES,
  COMPLAINT_PRIORITY,
  ALL_COMPLAINT_PRIORITIES,
  COMPLAINT_TYPE,
  ALL_COMPLAINT_TYPES,
  PERMISSION_STATUS,
  ALL_PERMISSION_STATUSES,
  PERMISSION_TYPE,
  ALL_PERMISSION_TYPES,
  VISITOR_STATUS,
  ALL_VISITOR_STATUSES,
  ATTENDANCE_STATUS,
  ALL_ATTENDANCE_STATUSES,
  PRESENCE_STATUS,
  ALL_PRESENCE_STATUSES,
  BUSINESS_THRESHOLDS,
  COOLDOWNS,
};
