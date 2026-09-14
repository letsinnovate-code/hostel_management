const express = require('express');
const router = express.Router();
const {
  getTasks,
  getTask,
  updateTaskStatus,
  completeTask,
  uploadTaskImages,
  getAvailableRequests,
  acceptRequest,
  getAssignedComplaints,
  updateComplaintStatus,
  clockIn,
  clockOut,
  createLeaveRequest,
  getLeaveRequests,
  getShiftSchedule,
} = require('../controllers/cleanerController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('cleaner', 'supervisor'));

// Tasks
router.get('/tasks/available', getAvailableRequests); // Pool
router.put('/tasks/:id/accept', acceptRequest);       // Claim from pool
router.get('/tasks', getTasks);
router.get('/tasks/:id', getTask);
router.put('/tasks/:id/status', updateTaskStatus);
router.post('/tasks/:id/complete', completeTask);
router.post('/tasks/images', uploadTaskImages);

// Complaints
router.get('/complaints', getAssignedComplaints);
router.put('/complaints/:id/status', updateComplaintStatus);

// Attendance
router.post('/attendance/clock-in', clockIn);
router.post('/attendance/clock-out', clockOut);

// Leave Requests
router.post('/leave', createLeaveRequest);
router.get('/leave', getLeaveRequests);

// Shift Schedule
router.get('/schedule', getShiftSchedule);

module.exports = router;

