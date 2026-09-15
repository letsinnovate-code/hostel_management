const express = require('express');
const router = express.Router();
const {
  getDashboard,
  getCurfewViolations,
  triggerManualCheck,
  verifyPresence,
  markAttendance,
  getDailyAttendanceSheet,
  markSingleAttendance,
  bulkMarkAttendance,
  editAttendanceRecord,
  getAttendanceAnalytics,
  getStudentAttendanceHistory,
  exportAttendanceCSV,
  registerStudentByWarden,
  getHostelStudents,
  getStudentsList,
  getStudentDetails,
  updateStudentInfo,
  updateStudentStatus,
  checkoutStudent,
  resetStudentDevice,
  getWardenRooms,
  getUnassignedStudents,
  assignBed,
  transferBed,
  vacateBed,
  updateRoomStatus,
  reportRoomProblem,
  getRoomAllocationHistory,
  getPendingPermissions,
  getLeaveApplications,
  getCurrentlyAbsentStudents,
  getOverdueLeaves,
  approveLeaveApplication,
  approvePermission,
  rejectLeaveApplication,
  rejectPermission,
  cancelLeaveApplication,
  recordLeaveCheckOut,
  recordLeaveReturn,
  getStudentLeaveHistory,
  updateLeaveRemarks,
  deletePermission,
  createIncident,
  getIncidents,
  createViolation,
  getViolations,
  getViolationDetails,
  recordDisciplinaryAction,
  recordParentNotification,
  addViolationRemark,
  resolveViolation,
  updateViolation,
  escalateViolation,
  deleteViolation,
  deleteCurfewViolation,
  getVisitors,
  createVisitor,
  approveVisitor,
  rejectVisitor,
  checkoutVisitor,
  deleteVisitor,
  getActiveEmergencies,
  acknowledgeEmergency,
  createAnnouncement,
  getWardenAnnouncements,
  reportMaintenance,
  getComplaints,
  getComplaintDetails,
  assignComplaint,
  updateComplaintStatus,
  resolveComplaint,
  reopenComplaint,
  addComplaintRemark,
  escalateComplaint,
  getHostelStaffForAssignment,
} = require('../controllers/wardenController');
const { getStudentsWithAttendance } = require('../controllers/ownerController');
const { protect, authorize } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validator');
const { requirePermission } = require('../middleware/rbac');
const { requireTenantAccess } = require('../middleware/tenant');
const P = require('../config/permissions');

router.use(protect);
router.use(authorize('warden', 'owner'));

// Dashboard & Students
router.get('/dashboard', requirePermission(P.DASHBOARD_VIEW), getDashboard);
router.post('/students', requirePermission(P.USER_UPDATE), registerStudentByWarden);
router.get('/students', requirePermission(P.USER_VIEW), getHostelStudents);
router.get('/students/list', requirePermission(P.USER_VIEW), getStudentsList);
router.get('/students/with-attendance', requirePermission(P.USER_VIEW), getStudentsWithAttendance);
router.get('/students/:id', validateObjectId('id'), requirePermission(P.USER_VIEW), requireTenantAccess('User', 'id'), getStudentDetails);
router.put('/students/:id', validateObjectId('id'), requirePermission(P.USER_UPDATE), requireTenantAccess('User', 'id'), updateStudentInfo);
router.put('/students/:id/status', validateObjectId('id'), requirePermission(P.USER_UPDATE), requireTenantAccess('User', 'id'), updateStudentStatus);
router.post('/students/:id/checkout', validateObjectId('id'), requirePermission(P.USER_UPDATE), requireTenantAccess('User', 'id'), checkoutStudent);
router.post('/students/:studentId/reset-device', validateObjectId('studentId'), requirePermission(P.USER_UPDATE), requireTenantAccess('User', 'studentId'), resetStudentDevice);

// Room & Bed Management
router.get('/rooms', requirePermission(P.ROOM_VIEW), getWardenRooms);
router.get('/rooms/unassigned-students', requirePermission(P.ROOM_VIEW), getUnassignedStudents);
router.get('/rooms/allocation-history', requirePermission(P.ROOM_VIEW), getRoomAllocationHistory);
router.post('/rooms/:roomId/assign', validateObjectId('roomId'), requirePermission(P.ROOM_UPDATE), requireTenantAccess('Room', 'roomId'), assignBed);
router.post('/rooms/transfer', requirePermission(P.ROOM_UPDATE), transferBed);
router.post('/rooms/:roomId/vacate', validateObjectId('roomId'), requirePermission(P.ROOM_UPDATE), requireTenantAccess('Room', 'roomId'), vacateBed);
router.put('/rooms/:roomId/status', validateObjectId('roomId'), requirePermission(P.ROOM_UPDATE), requireTenantAccess('Room', 'roomId'), updateRoomStatus);
router.post('/rooms/:roomId/report-problem', validateObjectId('roomId'), requirePermission(P.ROOM_UPDATE), requireTenantAccess('Room', 'roomId'), reportRoomProblem);

// Curfew Monitoring
router.get('/curfew/violations', requirePermission(P.DISCIPLINE_VIEW), getCurfewViolations);

// Attendance & Presence Verification
router.get('/attendance/sheet', requirePermission(P.ATTENDANCE_VIEW), getDailyAttendanceSheet);
router.post('/attendance/mark-single', requirePermission(P.ATTENDANCE_UPDATE), markSingleAttendance);
router.post('/attendance/bulk-mark', requirePermission(P.ATTENDANCE_UPDATE), bulkMarkAttendance);
router.put('/attendance/:id/edit', validateObjectId('id'), requirePermission(P.ATTENDANCE_UPDATE), editAttendanceRecord);
router.get('/attendance/analytics', requirePermission(P.REPORT_VIEW), getAttendanceAnalytics);
router.get('/attendance/student/:studentId', validateObjectId('studentId'), requirePermission(P.ATTENDANCE_VIEW), requireTenantAccess('User', 'studentId'), getStudentAttendanceHistory);
router.get('/attendance/export', requirePermission(P.REPORT_VIEW), exportAttendanceCSV);
router.post('/attendance/trigger-check', requirePermission(P.ATTENDANCE_UPDATE), triggerManualCheck);
router.post('/attendance/verify', requirePermission(P.ATTENDANCE_UPDATE), verifyPresence);
router.post('/attendance/mark', requirePermission(P.ATTENDANCE_UPDATE), markAttendance);

// Leave & Permission Management
router.get('/leaves', requirePermission(P.USER_VIEW), getLeaveApplications);
router.get('/leaves/pending', requirePermission(P.USER_VIEW), getPendingPermissions);
router.get('/leaves/currently-absent', requirePermission(P.USER_VIEW), getCurrentlyAbsentStudents);
router.get('/leaves/overdue', requirePermission(P.USER_VIEW), getOverdueLeaves);
router.get('/leaves/student/:studentId', validateObjectId('studentId'), requirePermission(P.USER_VIEW), requireTenantAccess('User', 'studentId'), getStudentLeaveHistory);
router.post('/leaves/:id/approve', validateObjectId('id'), requirePermission(P.USER_UPDATE), requireTenantAccess('Permission', 'id'), approveLeaveApplication);
router.post('/leaves/:id/reject', validateObjectId('id'), requirePermission(P.USER_UPDATE), requireTenantAccess('Permission', 'id'), rejectLeaveApplication);
router.post('/leaves/:id/cancel', validateObjectId('id'), requirePermission(P.USER_UPDATE), requireTenantAccess('Permission', 'id'), cancelLeaveApplication);
router.post('/leaves/:id/checkout', validateObjectId('id'), requirePermission(P.USER_UPDATE), requireTenantAccess('Permission', 'id'), recordLeaveCheckOut);
router.post('/leaves/:id/return', validateObjectId('id'), requirePermission(P.USER_UPDATE), requireTenantAccess('Permission', 'id'), recordLeaveReturn);
router.put('/leaves/:id/remarks', validateObjectId('id'), requirePermission(P.USER_UPDATE), requireTenantAccess('Permission', 'id'), updateLeaveRemarks);
router.delete('/leaves/:id', validateObjectId('id'), requirePermission(P.USER_UPDATE), requireTenantAccess('Permission', 'id'), deletePermission);

// Backward-compatible permission aliases
router.get('/permissions/pending', requirePermission(P.USER_VIEW), getPendingPermissions);
router.post('/permissions/:permissionId/approve', validateObjectId('permissionId'), requirePermission(P.USER_UPDATE), requireTenantAccess('Permission', 'permissionId'), approvePermission);
router.post('/permissions/:permissionId/reject', validateObjectId('permissionId'), requirePermission(P.USER_UPDATE), requireTenantAccess('Permission', 'permissionId'), rejectPermission);
router.delete('/permissions/:permissionId', validateObjectId('permissionId'), requirePermission(P.USER_UPDATE), requireTenantAccess('Permission', 'permissionId'), deletePermission);

// Incident & Safety Reporting
router.post('/incidents', requirePermission(P.DISCIPLINE_UPDATE), createIncident);
router.get('/incidents', requirePermission(P.DISCIPLINE_VIEW), getIncidents);

// Disciplinary & Violation Management
router.post('/violations', requirePermission(P.DISCIPLINE_UPDATE), createViolation);
router.get('/violations', requirePermission(P.DISCIPLINE_VIEW), getViolations);
router.get('/violations/:id', validateObjectId('id'), requirePermission(P.DISCIPLINE_VIEW), requireTenantAccess('Violation', 'id'), getViolationDetails);
router.get('/violations/:id/details', validateObjectId('id'), requirePermission(P.DISCIPLINE_VIEW), requireTenantAccess('Violation', 'id'), getViolationDetails);
router.put('/violations/:id', validateObjectId('id'), requirePermission(P.DISCIPLINE_UPDATE), requireTenantAccess('Violation', 'id'), updateViolation);
router.post('/violations/:id/action', validateObjectId('id'), requirePermission(P.DISCIPLINE_UPDATE), requireTenantAccess('Violation', 'id'), recordDisciplinaryAction);
router.post('/violations/:id/parent-notify', validateObjectId('id'), requirePermission(P.DISCIPLINE_UPDATE), requireTenantAccess('Violation', 'id'), recordParentNotification);
router.post('/violations/:id/remarks', validateObjectId('id'), requirePermission(P.DISCIPLINE_UPDATE), requireTenantAccess('Violation', 'id'), addViolationRemark);
router.post('/violations/:id/resolve', validateObjectId('id'), requirePermission(P.DISCIPLINE_UPDATE), requireTenantAccess('Violation', 'id'), resolveViolation);
router.post('/violations/:violationId/escalate', validateObjectId('violationId'), requirePermission(P.DISCIPLINE_UPDATE), requireTenantAccess('Violation', 'violationId'), escalateViolation);
router.delete('/violations/:id', validateObjectId('id'), requirePermission(P.DISCIPLINE_UPDATE), requireTenantAccess('Violation', 'id'), deleteViolation);
router.delete('/curfew/violations/:id', validateObjectId('id'), requirePermission(P.DISCIPLINE_UPDATE), requireTenantAccess('Violation', 'id'), deleteCurfewViolation);

// Visitor Log & Management
router.get('/visitors', requirePermission(P.USER_VIEW), getVisitors);
router.post('/visitors', requirePermission(P.USER_UPDATE), createVisitor);
router.post('/visitors/:visitorId/approve', validateObjectId('visitorId'), requirePermission(P.USER_UPDATE), requireTenantAccess('Visitor', 'visitorId'), approveVisitor);
router.post('/visitors/:visitorId/reject', validateObjectId('visitorId'), requirePermission(P.USER_UPDATE), requireTenantAccess('Visitor', 'visitorId'), rejectVisitor);
router.post('/visitors/:visitorId/checkout', validateObjectId('visitorId'), requirePermission(P.USER_UPDATE), requireTenantAccess('Visitor', 'visitorId'), checkoutVisitor);
router.delete('/visitors/:visitorId', validateObjectId('visitorId'), requirePermission(P.USER_UPDATE), requireTenantAccess('Visitor', 'visitorId'), deleteVisitor);

// Emergency Mode
router.get('/emergencies', requirePermission(P.DASHBOARD_VIEW), getActiveEmergencies);
router.post('/emergencies/:emergencyId/acknowledge', validateObjectId('emergencyId'), requirePermission(P.COMMUNICATION_UPDATE), acknowledgeEmergency);

// Announcements & Broadcasts
router.get('/announcements', requirePermission(P.COMMUNICATION_VIEW), getWardenAnnouncements);
router.post('/announcements', requirePermission(P.COMMUNICATION_UPDATE), createAnnouncement);

// Complaints Management
router.get('/complaints', requirePermission(P.ROOM_VIEW), getComplaints);
router.get('/complaints/staff', requirePermission(P.USER_VIEW), getHostelStaffForAssignment);
router.get('/complaints/:id', validateObjectId('id'), requirePermission(P.ROOM_VIEW), requireTenantAccess('Complaint', 'id'), getComplaintDetails);
router.post('/complaints/:id/assign', validateObjectId('id'), requirePermission(P.ROOM_UPDATE), requireTenantAccess('Complaint', 'id'), assignComplaint);
router.put('/complaints/:id/status', validateObjectId('id'), requirePermission(P.ROOM_UPDATE), requireTenantAccess('Complaint', 'id'), updateComplaintStatus);
router.post('/complaints/:id/resolve', validateObjectId('id'), requirePermission(P.ROOM_UPDATE), requireTenantAccess('Complaint', 'id'), resolveComplaint);
router.post('/complaints/:id/reopen', validateObjectId('id'), requirePermission(P.ROOM_UPDATE), requireTenantAccess('Complaint', 'id'), reopenComplaint);
router.post('/complaints/:id/remarks', validateObjectId('id'), requirePermission(P.ROOM_UPDATE), requireTenantAccess('Complaint', 'id'), addComplaintRemark);
router.post('/complaints/:id/escalate', validateObjectId('id'), requirePermission(P.ROOM_UPDATE), requireTenantAccess('Complaint', 'id'), escalateComplaint);
router.post('/maintenance', requirePermission(P.ROOM_UPDATE), reportMaintenance);

module.exports = router;
