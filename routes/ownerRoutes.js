const express = require('express');
const router = express.Router();
const {
  createHostel,
  getHostels,
  getHostel,
  updateHostel,
  deleteHostel,
  updateHostelAmenities,
  uploadHostelImages,
  deleteHostelImage,
  setCoverImage,
  createBlock,
  getBlocks,
  createRoom,
  getRooms,
  getRoom,
  updateRoom,
  deleteRoom,
  uploadRoomImages,
  deleteRoomImage,
  setRoomCoverImage,
  setRoomPricing,
  bulkUpdateRoomPricing,
  autoAllocateRooms,
  createRule,
  getRules,
  updateRule,
  deleteRule,
  createCurfewRule,
  createLateEntryRule,
  createLeavePolicy,
  createDisciplineMatrix,
  createUser,
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  getStudentsByStatus,
  bulkUploadStudents,
  approveStudentOnboarding,
  updateStudentStatus,
  getAttendanceTrends,
  getViolationHeatmap,
  getRecentViolations,
  getMonthlyDisciplineReport,
  sendNotification,
  getNotifications,
  getNotification,
  updateNotification,
  deleteNotification,
  sendNotificationReminder,
  createGeoFence,
  getGeoFences,
  updateGeoFence,
  createFeeStructure,
  getFeeStructures,
  getApplicableFeeForStudent,
  getPlans,
  seedPlans,
  updatePlan,
  createPayment,
  getPayments,
  updatePaymentStatus,
  deletePayment,
  generateInvoice,
  createTemplate,
  getTemplates,
  getDashboardKPIs,
  getStaffPerformance,
  getOccupancyReport,
  getFinancialReport,
  getAuditLogs,
  exportData,
  createSupportTicket,
  getSupportTickets,
  getSystemLogs,
  geocodeAddressEndpoint,
  resendWelcomeEmail,
  uploadStudentProfileImage,
  uploadStudentDocuments,
  deleteStudentDocument,
  createAmenity,
  getAmenities,
  getAmenity,
  updateAmenity,
  deleteAmenity,
  uploadAmenityImages,
  deleteAmenityImage,
  getEnquiries,
  updateEnquiryStatus,
  getCallbackRequests,
  updateCallbackStatus,
  triggerAttendanceCheck,
  getStudentLocations,
  getLocationPermissionStatus,
  getStudentsWithAttendance,
  getDailyAttendance,
  getGateLogs,
  sendNotificationToAll,
  getNotificationReceipts,
  getVisitorRequests,
  approveVisitorRequest,
  rejectVisitorRequest,
  getMessSchedules,
  createMessSchedule,
  updateMessSchedule,
  deleteMessSchedule,
  seedMessSchedules,
  getMessFeedback,
  getLeaveRequests,
  approveLeaveRequest,
  rejectLeaveRequest,
  getMaintenanceComplaints,
  updateComplaintStatus,
  generateRegistrationInviteQR,
  getStudentQR,
} = require('../controllers/ownerController');
const { protect, authorize } = require('../middleware/auth');
const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({ storage });

// All routes require authentication and owner role
router.use(protect);
router.use(authorize('owner'));

// Hostel Configuration
router.post('/hostels', createHostel);
router.get('/hostels', getHostels);
router.get('/hostels/:id', getHostel);
router.put('/hostels/:id', updateHostel);
router.delete('/hostels/:id', deleteHostel);
router.post('/geocode', geocodeAddressEndpoint);
router.post('/hostels/:hostelId/images', upload.array('images', 10), uploadHostelImages);
router.delete('/hostels/:hostelId/images/:imageUrl', deleteHostelImage);
router.put('/hostels/:hostelId/cover-image', setCoverImage);

// Block Management
router.post('/blocks', createBlock);
router.get('/hostels/:hostelId/blocks', getBlocks);

// Room Management
router.post('/rooms', createRoom);
router.get('/rooms', getRooms); // Get all rooms (with optional query params: hostelId, blockId, status, category)
router.get('/blocks/:blockId/rooms', getRooms); // Get rooms by block (backward compatibility)
router.get('/rooms/:id', getRoom);
router.put('/rooms/:id', updateRoom);
router.delete('/rooms/:id', deleteRoom);
router.post('/rooms/:roomId/images', upload.array('images', 10), uploadRoomImages);
router.delete('/rooms/:roomId/images/:imageUrl', deleteRoomImage);
router.put('/rooms/:roomId/cover-image', setRoomCoverImage);

// Amenity Management
router.post('/amenities', createAmenity);
router.get('/amenities', getAmenities); // Get all amenities (with optional query params: hostelId, category, isAvailable)
router.get('/amenities/:id', getAmenity);
router.put('/amenities/:id', updateAmenity);
router.delete('/amenities/:id', deleteAmenity);
router.post('/amenities/:amenityId/images', upload.array('images', 10), uploadAmenityImages);
router.delete('/amenities/:amenityId/images/:imageUrl', deleteAmenityImage);

// Rule Engine
router.post('/rules', createRule);
router.get('/rules', getRules); // Get all rules (with optional hostelId query param)
router.get('/hostels/:hostelId/rules', getRules); // Get rules by hostel (backward compatibility)
router.put('/rules/:id', updateRule);
router.delete('/rules/:id', deleteRule);

// User Management
router.post('/users', createUser);
router.get('/users', getUsers);
router.get('/users/:id', getUser);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

// Student Lifecycle
// NOTE: specific routes must come BEFORE /:id param routes
router.get('/students/registration-invite-qr', generateRegistrationInviteQR);
router.get('/students/status/:status', getStudentsByStatus);
router.post('/students/:id/resend-welcome-email', resendWelcomeEmail);
router.post('/students/:studentId/profile-image', upload.single('image'), uploadStudentProfileImage);
router.post('/students/:studentId/documents', upload.array('documents', 10), uploadStudentDocuments);
router.delete('/students/:studentId/documents/:documentId', deleteStudentDocument);
router.get('/students/:id/qr', getStudentQR);

// Analytics & Reports
router.get('/analytics/attendance', getAttendanceTrends);
router.get('/analytics/violations', getViolationHeatmap);
router.get('/violations/recent', getRecentViolations);
router.get('/analytics/discipline', getMonthlyDisciplineReport);

// Notifications / Notice Board
router.post('/notifications', sendNotification);
router.post('/notifications/broadcast', sendNotificationToAll);
router.get('/notifications/receipts', getNotificationReceipts);

router.get('/visitors', getVisitorRequests);
router.post('/visitors/:visitorId/approve', approveVisitorRequest);
router.post('/visitors/:visitorId/reject', rejectVisitorRequest);
router.get('/hostels/:hostelId/notifications', getNotifications);
router.get('/notifications/:id', getNotification);
router.post('/notifications/:id/send-reminder', sendNotificationReminder);
router.put('/notifications/:id', updateNotification);
router.delete('/notifications/:id', deleteNotification);

// Enhanced Hostel Setup
router.put('/hostels/:id/amenities', updateHostelAmenities);

// Room Pricing & Allocation
router.put('/rooms/pricing', setRoomPricing);
router.put('/rooms/pricing/bulk', bulkUpdateRoomPricing);
router.post('/rooms/allocate', autoAllocateRooms);

// Enhanced Rule Engine
router.post('/rules/curfew', createCurfewRule);
router.post('/rules/late-entry', createLateEntryRule);
router.post('/rules/leave-policy', createLeavePolicy);
router.post('/rules/discipline-matrix', createDisciplineMatrix);

// Geo-Fence
router.post('/geo-fence', createGeoFence);
router.get('/hostels/:hostelId/geo-fence', getGeoFences);
router.put('/geo-fence/:id', updateGeoFence);

// Fee Structure
router.post('/fee-structure', createFeeStructure);
router.get('/hostels/:hostelId/fee-structure', getFeeStructures);
router.get('/hostels/:hostelId/students/:studentId/applicable-fee', getApplicableFeeForStudent);

// Plans (1/3/6/12 month)
router.get('/hostels/:hostelId/plans', getPlans);
router.post('/hostels/:hostelId/plans/seed', seedPlans);
router.put('/plans/:id', updatePlan);

// Payments
router.post('/payments', createPayment);
router.get('/payments', getPayments);
router.put('/payments/:id/status', updatePaymentStatus);
router.delete('/payments/:id', deletePayment);
router.post('/payments/:id/invoice', generateInvoice);

// Student Management
router.post('/students/bulk-upload', upload.single('file'), bulkUploadStudents);
router.post('/students/:id/approve', approveStudentOnboarding);
router.put('/students/:id/status', updateStudentStatus);

// Templates
router.post('/templates', createTemplate);
router.get('/hostels/:hostelId/templates', getTemplates);

// Analytics & Reporting
router.get('/dashboard/kpis', getDashboardKPIs);
router.get('/analytics/staff-performance', getStaffPerformance);
router.get('/analytics/occupancy', getOccupancyReport);
router.get('/analytics/financial', getFinancialReport);

// Compliance & Audit
router.get('/audit-logs', getAuditLogs);
router.get('/export', exportData);

// Support & System
router.post('/support-tickets', createSupportTicket);
router.get('/support-tickets', getSupportTickets);
router.get('/system-logs', getSystemLogs);

// Attendance & Location
router.post('/attendance/check', triggerAttendanceCheck);
router.get('/attendance/daily', getDailyAttendance);
router.get('/gate-logs', getGateLogs);
router.get('/students/locations', getStudentLocations);
router.get('/students/location-permissions', getLocationPermissionStatus);
router.get('/students/with-attendance', getStudentsWithAttendance);

// Marketplace - Enquiries & Callbacks
router.get('/enquiries', getEnquiries);
router.put('/enquiries/:id', updateEnquiryStatus);
router.get('/callbacks', getCallbackRequests);
router.put('/callbacks/:id', updateCallbackStatus);

// Mess Schedule
router.get('/hostels/:hostelId/mess', getMessSchedules);
router.post('/hostels/:hostelId/mess', createMessSchedule);
router.post('/hostels/:hostelId/mess/seed', seedMessSchedules);
router.get('/mess-feedback', getMessFeedback);
router.get('/leave-requests', getLeaveRequests);
router.post('/leave-requests/:permissionId/approve', approveLeaveRequest);
router.post('/leave-requests/:permissionId/reject', rejectLeaveRequest);
router.get('/maintenance', getMaintenanceComplaints);
router.put('/complaints/:id/status', updateComplaintStatus);
router.put('/hostels/:hostelId/mess/:scheduleId', updateMessSchedule);
router.delete('/hostels/:hostelId/mess/:scheduleId', deleteMessSchedule);

module.exports = router;

