/**
 * @file config/roleMappings.js
 * @description Maps specific string roles to arrays of granular permissions.
 */

'use strict';

const P = require('./permissions');

const ROLE_PERMISSIONS = {
  superadmin: [P.WILDCARD],
  
  owner: [
    P.HOSTEL_VIEW,
    P.HOSTEL_UPDATE,
    P.STUDENT_VIEW,
    P.STUDENT_CREATE,
    P.STUDENT_UPDATE,
    P.STUDENT_DELETE,
    P.ATTENDANCE_VIEW,
    P.ROOM_VIEW,
    P.ROOM_CREATE,
    P.ROOM_UPDATE,
    P.ROOM_ASSIGN,
    P.LEAVE_VIEW,
    P.VISITOR_VIEW,
    P.CURFEW_VIEW,
    P.COMPLAINT_VIEW,
    P.MAINTENANCE_VIEW,
    P.CLEANING_VIEW,
    P.STAFF_VIEW,
    P.STAFF_CREATE,
    P.STAFF_UPDATE,
    P.STAFF_DISABLE,
    P.PAYMENT_VIEW,
    P.PAYMENT_CREATE,
    P.PAYMENT_REFUND,
  ],
  
  warden: [
    P.STUDENT_VIEW,
    P.STUDENT_CREATE,
    P.STUDENT_UPDATE,
    P.STUDENT_DELETE,
    P.ATTENDANCE_VIEW,
    P.ATTENDANCE_MANAGE,
    P.ROOM_VIEW,
    P.ROOM_CREATE,
    P.ROOM_UPDATE,
    P.ROOM_ASSIGN,
    P.LEAVE_VIEW,
    P.LEAVE_CREATE,
    P.LEAVE_APPROVE,
    P.LEAVE_REJECT,
    P.VISITOR_VIEW,
    P.CURFEW_VIEW,
    P.CURFEW_MANAGE,
    P.COMPLAINT_VIEW,
    P.COMPLAINT_CREATE,
    P.COMPLAINT_ASSIGN,
    P.COMPLAINT_RESOLVE,
  ],
  
  supervisor: [
    P.STUDENT_VIEW,
    P.ATTENDANCE_VIEW,
    P.ROOM_VIEW,
    P.CURFEW_VIEW,
    P.COMPLAINT_VIEW,
    P.COMPLAINT_CREATE,
    P.COMPLAINT_ASSIGN,
    P.COMPLAINT_RESOLVE,
    P.MAINTENANCE_VIEW,
    P.MAINTENANCE_CREATE,
    P.MAINTENANCE_ASSIGN,
    P.MAINTENANCE_COMPLETE,
    P.CLEANING_VIEW,
    P.CLEANING_ASSIGN,
    P.CLEANING_COMPLETE,
  ],
  
  security: [
    P.ATTENDANCE_MANAGE,
    P.LEAVE_VIEW,
    P.VISITOR_VIEW,
    P.VISITOR_CREATE,
    P.VISITOR_CHECKOUT,
    P.ENTRY_CREATE,
    P.ENTRY_VIEW,
    P.EXIT_CREATE,
    P.EXIT_VIEW,
    P.CURFEW_VIEW,
  ],
  
  cleaner: [
    P.CLEANING_VIEW,
    P.CLEANING_ASSIGN,
    P.CLEANING_COMPLETE,
  ],
  
  student: [
    // Students typically only view/manage their OWN resources
    // The middleware handles ownership context for students.
    P.STUDENT_VIEW, // Self only
    P.ATTENDANCE_VIEW, // Self only
    P.ROOM_VIEW, // Self only
    P.LEAVE_VIEW, // Self only
    P.LEAVE_CREATE, // Self only
    P.COMPLAINT_VIEW, // Self only
    P.COMPLAINT_CREATE, // Self only
    P.PAYMENT_VIEW, // Self only
    P.PAYMENT_CREATE, // Self only
  ]
};

/**
 * Get all unique permissions for an array of roles.
 * @param {string[]} roles Array of user roles
 * @returns {string[]} Array of unique permission strings
 */
const getPermissionsForRoles = (roles = []) => {
  const permissionsSet = new Set();
  
  roles.forEach(role => {
    const permissions = ROLE_PERMISSIONS[role.toLowerCase()] || [];
    permissions.forEach(p => permissionsSet.add(p));
  });
  
  return Array.from(permissionsSet);
};

module.exports = {
  ROLE_PERMISSIONS,
  getPermissionsForRoles
};
