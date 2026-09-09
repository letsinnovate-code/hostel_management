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
  getHostelStudents,
  getStudentsList,
  getStudentDetails,
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

router.use(protect);
router.use(authorize('warden', 'owner'));

// Dashboard & Students
router.get('/dashboard', getDashboard);
router.get('/students', getHostelStudents);
router.get('/students/list', getStudentsList);
router.get('/students/with-attendance', getStudentsWithAttendance);
router.get('/students/:id', validateObjectId('id'), getStudentDetails);

// Room & Bed Management
router.get('/rooms', getWardenRooms);
router.get('/rooms/unassigned-students', getUnassignedStudents);
router.get('/rooms/allocation-history', getRoomAllocationHistory);
router.post('/rooms/:roomId/assign', validateObjectId('roomId'), assignBed);
router.post('/rooms/transfer', transferBed);
router.post('/rooms/:roomId/vacate', validateObjectId('roomId'), vacateBed);
router.put('/rooms/:roomId/status', validateObjectId('roomId'), updateRoomStatus);
router.post('/rooms/:roomId/report-problem', validateObjectId('roomId'), reportRoomProblem);

// Curfew Monitoring
router.get('/curfew/violations', getCurfewViolations);

// Attendance & Presence Verification
router.get('/attendance/sheet', getDailyAttendanceSheet);
router.post('/attendance/mark-single', markSingleAttendance);
router.post('/attendance/bulk-mark', bulkMarkAttendance);
router.put('/attendance/:id/edit', validateObjectId('id'), editAttendanceRecord);
router.get('/attendance/analytics', getAttendanceAnalytics);
router.get('/attendance/student/:studentId', validateObjectId('studentId'), getStudentAttendanceHistory);
router.get('/attendance/export', exportAttendanceCSV);
router.post('/attendance/trigger-check', triggerManualCheck);
router.post('/attendance/verify', verifyPresence);
router.post('/attendance/mark', markAttendance);

// Leave & Permission Management
router.get('/leaves', getLeaveApplications);
router.get('/leaves/pending', getPendingPermissions);
router.get('/leaves/currently-absent', getCurrentlyAbsentStudents);
router.get('/leaves/overdue', getOverdueLeaves);
router.get('/leaves/student/:studentId', validateObjectId('studentId'), getStudentLeaveHistory);
router.post('/leaves/:id/approve', validateObjectId('id'), approveLeaveApplication);
router.post('/leaves/:id/reject', validateObjectId('id'), rejectLeaveApplication);
router.post('/leaves/:id/cancel', validateObjectId('id'), cancelLeaveApplication);
router.post('/leaves/:id/checkout', validateObjectId('id'), recordLeaveCheckOut);
router.post('/leaves/:id/return', validateObjectId('id'), recordLeaveReturn);
router.put('/leaves/:id/remarks', validateObjectId('id'), updateLeaveRemarks);
router.delete('/leaves/:id', validateObjectId('id'), deletePermission);

// Backward-compatible permission aliases
router.get('/permissions/pending', getPendingPermissions);
router.post('/permissions/:permissionId/approve', validateObjectId('permissionId'), approvePermission);
router.post('/permissions/:permissionId/reject', validateObjectId('permissionId'), rejectPermission);
router.delete('/permissions/:permissionId', validateObjectId('permissionId'), deletePermission);

// Incident & Safety Reporting
router.post('/incidents', createIncident);
router.get('/incidents', getIncidents);

// Disciplinary & Violation Management
router.post('/violations', createViolation);
router.get('/violations', getViolations);
router.get('/violations/:id', validateObjectId('id'), getViolationDetails);
router.get('/violations/:id/details', validateObjectId('id'), getViolationDetails);
router.put('/violations/:id', validateObjectId('id'), updateViolation);
router.post('/violations/:id/action', validateObjectId('id'), recordDisciplinaryAction);
router.post('/violations/:id/parent-notify', validateObjectId('id'), recordParentNotification);
router.post('/violations/:id/remarks', validateObjectId('id'), addViolationRemark);
router.post('/violations/:id/resolve', validateObjectId('id'), resolveViolation);
router.post('/violations/:violationId/escalate', validateObjectId('violationId'), escalateViolation);
router.delete('/violations/:id', validateObjectId('id'), deleteViolation);
router.delete('/curfew/violations/:id', validateObjectId('id'), deleteCurfewViolation);

// Visitor Log & Management
router.get('/visitors', getVisitors);
router.post('/visitors', createVisitor);
router.post('/visitors/:visitorId/approve', validateObjectId('visitorId'), approveVisitor);
router.post('/visitors/:visitorId/reject', validateObjectId('visitorId'), rejectVisitor);
router.post('/visitors/:visitorId/checkout', validateObjectId('visitorId'), checkoutVisitor);
router.delete('/visitors/:visitorId', validateObjectId('visitorId'), deleteVisitor);

// Emergency Mode
router.get('/emergencies', getActiveEmergencies);
router.post('/emergencies/:emergencyId/acknowledge', validateObjectId('emergencyId'), acknowledgeEmergency);

// Announcements & Broadcasts
router.post('/announcements', createAnnouncement);

// Complaints Management
router.get('/complaints', getComplaints);
router.get('/complaints/staff', getHostelStaffForAssignment);
router.get('/complaints/:id', validateObjectId('id'), getComplaintDetails);
router.post('/complaints/:id/assign', validateObjectId('id'), assignComplaint);
router.put('/complaints/:id/status', validateObjectId('id'), updateComplaintStatus);
router.post('/complaints/:id/resolve', validateObjectId('id'), resolveComplaint);
router.post('/complaints/:id/reopen', validateObjectId('id'), reopenComplaint);
router.post('/complaints/:id/remarks', validateObjectId('id'), addComplaintRemark);
router.post('/complaints/:id/escalate', validateObjectId('id'), escalateComplaint);
router.post('/maintenance', reportMaintenance);

module.exports = router;


