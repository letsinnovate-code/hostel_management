/**
 * @file config/permissions.js
 * @description Centralized registry of all application permissions.
 */

'use strict';

const PERMISSIONS = {
  // Hostel & Business Management
  HOSTEL_VIEW: 'hostel.view',
  HOSTEL_UPDATE: 'hostel.update',
  
  // Student Management
  STUDENT_VIEW: 'student.view',
  STUDENT_CREATE: 'student.create',
  STUDENT_UPDATE: 'student.update',
  STUDENT_DELETE: 'student.delete',
  
  // Attendance
  ATTENDANCE_VIEW: 'attendance.view',
  ATTENDANCE_MANAGE: 'attendance.manage',
  
  // Room & Block Management
  ROOM_VIEW: 'room.view',
  ROOM_CREATE: 'room.create',
  ROOM_UPDATE: 'room.update',
  ROOM_ASSIGN: 'room.assign',
  
  // Leave & Pass Management
  LEAVE_VIEW: 'leave.view',
  LEAVE_CREATE: 'leave.create',
  LEAVE_APPROVE: 'leave.approve',
  LEAVE_REJECT: 'leave.reject',
  
  // Visitor & Gate Management
  VISITOR_VIEW: 'visitor.view',
  VISITOR_CREATE: 'visitor.create',
  VISITOR_CHECKOUT: 'visitor.checkout',
  ENTRY_CREATE: 'entry.create',
  ENTRY_VIEW: 'entry.view',
  EXIT_CREATE: 'exit.create',
  EXIT_VIEW: 'exit.view',
  
  // Curfew & Rules
  CURFEW_VIEW: 'curfew.view',
  CURFEW_MANAGE: 'curfew.manage',
  
  // Complaints & Support
  COMPLAINT_VIEW: 'complaint.view',
  COMPLAINT_CREATE: 'complaint.create',
  COMPLAINT_ASSIGN: 'complaint.assign',
  COMPLAINT_RESOLVE: 'complaint.resolve',
  
  // Maintenance & Cleaning
  MAINTENANCE_VIEW: 'maintenance.view',
  MAINTENANCE_CREATE: 'maintenance.create',
  MAINTENANCE_ASSIGN: 'maintenance.assign',
  MAINTENANCE_COMPLETE: 'maintenance.complete',
  CLEANING_VIEW: 'cleaning.view',
  CLEANING_ASSIGN: 'cleaning.assign',
  CLEANING_COMPLETE: 'cleaning.complete',
  
  // Staff Management
  STAFF_VIEW: 'staff.view',
  STAFF_CREATE: 'staff.create',
  STAFF_UPDATE: 'staff.update',
  STAFF_DISABLE: 'staff.disable',
  
  // Billing & Payments
  PAYMENT_VIEW: 'payment.view',
  PAYMENT_CREATE: 'payment.create',
  PAYMENT_REFUND: 'payment.refund',

  // Domain Aliases for Cross-Role Consistency
  USER_VIEW: 'student.view',
  USER_CREATE: 'student.create',
  USER_UPDATE: 'student.update',
  USER_DELETE: 'student.delete',
  DASHBOARD_VIEW: 'student.view',
  COMMUNICATION_VIEW: 'student.view',
  COMMUNICATION_UPDATE: 'student.update',
  DISCIPLINE_VIEW: 'curfew.view',
  DISCIPLINE_UPDATE: 'curfew.manage',
  ATTENDANCE_UPDATE: 'attendance.manage',
  REPORT_VIEW: 'attendance.view',
  FINANCE_VIEW: 'payment.view',
  FINANCE_UPDATE: 'payment.create',
  RULE_VIEW: 'curfew.view',
  RULE_UPDATE: 'curfew.manage',
  FEEDBACK_VIEW: 'hostel.view',

  // Global / Super Admin wildcard
  WILDCARD: '*'
};

module.exports = PERMISSIONS;
