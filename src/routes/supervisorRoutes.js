const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getDashboardStats,
  getStaff,
  createTask,
  getTasks,
  updateTask
} = require('../controllers/supervisorController');

// All supervisor routes require auth and 'supervisor' role
router.use(protect);
router.use(authorize('supervisor'));

// Dashboard
router.get('/dashboard', getDashboardStats);

// Staff management
router.get('/staff', getStaff);

// Task management
router.route('/tasks')
  .get(getTasks)
  .post(createTask);

router.route('/tasks/:id')
  .put(updateTask);

module.exports = router;
