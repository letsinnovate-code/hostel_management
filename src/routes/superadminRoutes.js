const express = require('express');
const router = express.Router();
const {
  getAllSupportTickets,
  updateSupportTicket,
  getAllHostels,
  getAllOwners,
  getAllUsers,
  getDashboardStats,
  createOwner,
  seedDummyUsers,
  updateUserStatus,
  updateHostelStatus,
  updateUserRole,
  getRolesAndPermissions,
  getAuditLogs,
  getReports,
} = require('../controllers/superadminController');
const { protect, authorize } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const P = require('../config/permissions');

router.use(protect);
router.use(authorize('superadmin'));

router.get('/dashboard', getDashboardStats);
router.post('/create-owner', createOwner);
router.get('/support-tickets', getAllSupportTickets);
router.put('/support-tickets/:id', updateSupportTicket);

// Hostel endpoints
router.get('/hostels', getAllHostels);
router.put('/hostels/:id/status', updateHostelStatus);

// User & Owner endpoints
router.get('/owners', getAllOwners);
router.get('/users', getAllUsers);
router.put('/users/:id/status', updateUserStatus);
router.put('/users/:id/role', updateUserRole);

// Roles, Audit & Reports
router.get('/roles', getRolesAndPermissions);
router.get('/audit-logs', getAuditLogs);
router.get('/reports', getReports);

router.post('/seed-dummy-users', seedDummyUsers);

module.exports = router;
