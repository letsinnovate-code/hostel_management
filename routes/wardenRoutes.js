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
  createIncident,
  getIncidents,
  createViolation,
  getViolations,
  updateViolation,
  escalateViolation,
  getVisitors,
  approveVisitor,
  rejectVisitor,
  getActiveEmergencies,
  acknowledgeEmergency,
} = require('../controllers/wardenController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('warden', 'owner'));

// Dashboard
router.get('/dashboard', getDashboard);

// Curfew Monitoring
router.get('/curfew/violations', getCurfewViolations);

// Presence Verification
router.post('/attendance/trigger-check', triggerManualCheck);
router.post('/attendance/verify', verifyPresence);

// Permission Management
router.get('/permissions/pending', getPendingPermissions);
router.post('/permissions/:permissionId/approve', approvePermission);
router.post('/permissions/:permissionId/reject', rejectPermission);

// Incident Reporting
router.post('/incidents', createIncident);
router.get('/incidents', getIncidents);

// Violation Management
router.post('/violations', createViolation);
router.get('/violations', getViolations);
router.put('/violations/:id', updateViolation);
router.post('/violations/:violationId/escalate', escalateViolation);

// Visitor Log
router.get('/visitors', getVisitors);
router.post('/visitors/:visitorId/approve', approveVisitor);
router.post('/visitors/:visitorId/reject', rejectVisitor);

// Emergency Mode
router.get('/emergencies', getActiveEmergencies);
router.post('/emergencies/:emergencyId/acknowledge', acknowledgeEmergency);

module.exports = router;

