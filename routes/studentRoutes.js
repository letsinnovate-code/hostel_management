const express = require('express');
const router = express.Router();
const {
  getProfile,
  updateProfile,
  getStatus,
  checkIn,
  checkOut,
  getAttendanceAnalytics,
  updateLocation,
  updateLocationPermission,
  registerPushToken,
  clearPushToken,
  registerExpoPushToken,
  getHostelBoundary,
  createPermissionRequest,
  getPermissionRequests,
  cancelPermissionRequest,
  getViolationHistory,
  createComplaint,
  getComplaints,
  createCleaningRequest,
  createEmergency,
  getEmergencyHistory,
  getNotifications,
  markNotificationRead,
  dismissNotification,
  createVisitorRequest,
  getVisitorRequests,
  getMessSchedule,
  submitMessFeedback,
  getMyFeeStructure,
  getMyPayments,
  createRazorpayOrder,
  createOrderForExistingPayment,
  verifyRazorpayPayment,
  getSupportTickets,
  createSupportTicket,
} = require('../controllers/studentController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('student'));

// Profile
router.get('/profile', getProfile);
router.put('/profile', updateProfile);

// Presence Verification (Manual check-in/out + automatic)
router.get('/status', getStatus);
router.post('/check-in', checkIn);
router.post('/check-out', checkOut);
router.get('/hostel-boundary', getHostelBoundary);
router.post('/location/update', updateLocation);
router.put('/location/permission', updateLocationPermission);
router.post('/push-token', registerPushToken);
router.delete('/push-token', clearPushToken);
router.post('/expo-push-token', registerExpoPushToken);
router.get('/attendance/analytics', getAttendanceAnalytics);

// Permission Requests
router.post('/permissions', createPermissionRequest);
router.get('/permissions', getPermissionRequests);
router.post('/permissions/:id/cancel', cancelPermissionRequest);

// Violation History
router.get('/violations', getViolationHistory);

// Complaints
router.post('/complaints', createComplaint);
router.get('/complaints', getComplaints);

// Cleaning
router.post('/cleaning', createCleaningRequest);


// Emergency SOS
router.post('/emergency', createEmergency);
router.get('/emergency', getEmergencyHistory);

// Notice Board
router.get('/notifications', getNotifications);
router.post('/notifications/:id/read', markNotificationRead);
router.post('/notifications/:id/dismiss', dismissNotification);

// Visitors
router.post('/visitors', createVisitorRequest);
router.get('/visitors', getVisitorRequests);

// Mess
router.get('/mess', getMessSchedule);
router.post('/mess/feedback', submitMessFeedback);

// Fee & Payments
router.get('/fee-structure', getMyFeeStructure);
router.get('/payments', getMyPayments);
router.post('/payments/create-order', createRazorpayOrder);
router.post('/payments/:paymentId/create-order', createOrderForExistingPayment);
router.post('/payments/verify', verifyRazorpayPayment);

// Support tickets
router.get('/support-tickets', getSupportTickets);
router.post('/support-tickets', createSupportTicket);

module.exports = router;

