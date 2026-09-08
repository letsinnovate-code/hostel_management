const express = require('express');
const router = express.Router();
const {
  getDashboard,
  getCurfewViolations,
  triggerManualCheck,
  verifyPresence,
  markAttendance,
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
  approvePermission,
  rejectPermission,
  deletePermission,
  createIncident,
  getIncidents,
  createViolation,
  getViolations,
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
  updateComplaintStatus,
} = require('../controllers/wardenController');
const { getStudentsWithAttendance } = require('../controllers/ownerController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('warden', 'owner'));

// Dashboard & Students
router.get('/dashboard', getDashboard);
router.get('/students', getHostelStudents);
router.get('/students/list', getStudentsList);
router.get('/students/with-attendance', getStudentsWithAttendance);
router.get('/students/:id', getStudentDetails);

// Room & Bed Management
router.get('/rooms', getWardenRooms);
router.get('/rooms/unassigned-students', getUnassignedStudents);
router.get('/rooms/allocation-history', getRoomAllocationHistory);
router.post('/rooms/:roomId/assign', assignBed);
router.post('/rooms/transfer', transferBed);
router.post('/rooms/:roomId/vacate', vacateBed);
router.put('/rooms/:roomId/status', updateRoomStatus);
router.post('/rooms/:roomId/report-problem', reportRoomProblem);

// Curfew Monitoring
router.get('/curfew/violations', getCurfewViolations);

// Attendance & Presence Verification
router.post('/attendance/trigger-check', triggerManualCheck);
router.post('/attendance/verify', verifyPresence);
router.post('/attendance/mark', markAttendance);

// Permission Management
router.get('/permissions/pending', getPendingPermissions);
router.post('/permissions/:permissionId/approve', approvePermission);
router.post('/permissions/:permissionId/reject', rejectPermission);
router.delete('/permissions/:permissionId', deletePermission);

// Incident & Safety Reporting
router.post('/incidents', createIncident);
router.get('/incidents', getIncidents);

// Violation Management
router.post('/violations', createViolation);
router.get('/violations', getViolations);
router.put('/violations/:id', updateViolation);
router.post('/violations/:violationId/escalate', escalateViolation);
router.delete('/violations/:id', deleteViolation);
router.delete('/curfew/violations/:id', deleteCurfewViolation);

// Visitor Log & Management
router.get('/visitors', getVisitors);
router.post('/visitors', createVisitor);
router.post('/visitors/:visitorId/approve', approveVisitor);
router.post('/visitors/:visitorId/reject', rejectVisitor);
router.post('/visitors/:visitorId/checkout', checkoutVisitor);
router.delete('/visitors/:visitorId', deleteVisitor);

// Emergency Mode
router.get('/emergencies', getActiveEmergencies);
router.post('/emergencies/:emergencyId/acknowledge', acknowledgeEmergency);

// Announcements & Broadcasts
router.post('/announcements', createAnnouncement);

// Complaints & Maintenance
router.get('/complaints', getComplaints);
router.put('/complaints/:id/status', updateComplaintStatus);
router.post('/maintenance', reportMaintenance);

module.exports = router;


