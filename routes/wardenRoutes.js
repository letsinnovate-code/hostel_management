const express = require('express');
const router = express.Router();
const {
  getDashboard,
  getCurfewViolations,
  triggerManualCheck,
  verifyPresence,
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
  approveVisitor,
  rejectVisitor,
  deleteVisitor,
  getActiveEmergencies,
  acknowledgeEmergency,
} = require('../controllers/wardenController');
const { getStudentsWithAttendance } = require('../controllers/ownerController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('warden', 'owner'));

// Dashboard & Students
router.get('/dashboard', getDashboard);
router.get('/students/with-attendance', getStudentsWithAttendance);

// Curfew Monitoring
router.get('/curfew/violations', getCurfewViolations);

// Presence Verification
router.post('/attendance/trigger-check', triggerManualCheck);
router.post('/attendance/verify', verifyPresence);

// Permission Management
router.get('/permissions/pending', getPendingPermissions);
router.post('/permissions/:permissionId/approve', approvePermission);
router.post('/permissions/:permissionId/reject', rejectPermission);
router.delete('/permissions/:permissionId', deletePermission);

// Incident Reporting
router.post('/incidents', createIncident);
router.get('/incidents', getIncidents);

// Violation Management
router.post('/violations', createViolation);
router.get('/violations', getViolations);
router.put('/violations/:id', updateViolation);
router.post('/violations/:violationId/escalate', escalateViolation);
router.delete('/violations/:id', deleteViolation);
router.delete('/curfew/violations/:id', deleteCurfewViolation);

// Visitor Log
router.get('/visitors', getVisitors);
router.post('/visitors/:visitorId/approve', approveVisitor);
router.post('/visitors/:visitorId/reject', rejectVisitor);
router.delete('/visitors/:visitorId', deleteVisitor);

// Emergency Mode
router.get('/emergencies', getActiveEmergencies);
router.post('/emergencies/:emergencyId/acknowledge', acknowledgeEmergency);

module.exports = router;

