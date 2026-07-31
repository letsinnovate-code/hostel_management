const express = require('express');
const router = express.Router();
const {
  getCheckedInStudents,
  getCheckedOutStudents,
  getAllStudentsStatus,
  getDashboardStats,
} = require('../controllers/securityController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('security'));

// Dashboard
router.get('/dashboard/stats', getDashboardStats);

// Students Status
router.get('/students/status', getAllStudentsStatus);
router.get('/students/checked-in', getCheckedInStudents);
router.get('/students/checked-out', getCheckedOutStudents);

module.exports = router;

