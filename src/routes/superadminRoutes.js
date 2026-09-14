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
} = require('../controllers/superadminController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('superadmin'));

router.get('/dashboard', getDashboardStats);
router.post('/create-owner', createOwner);
router.get('/support-tickets', getAllSupportTickets);
router.put('/support-tickets/:id', updateSupportTicket);
router.get('/hostels', getAllHostels);
router.get('/owners', getAllOwners);
router.get('/users', getAllUsers);
router.post('/seed-dummy-users', seedDummyUsers);

module.exports = router;
