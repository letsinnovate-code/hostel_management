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
const { createUploadMiddleware } = require('../middleware/uploadValidation');
const { validateObjectId } = require('../middleware/validator');

const imageUpload = createUploadMiddleware({
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
  maxFileSize: 5 * 1024 * 1024,
  maxFiles: 10,
});

const documentUpload = createUploadMiddleware({
  allowedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.pdf'],
  maxFileSize: 5 * 1024 * 1024,
  maxFiles: 10,
});

const excelUpload = createUploadMiddleware({
  allowedTypes: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/octet-stream',
  ],
  allowedExtensions: ['.xlsx', '.xls', '.csv'],
  maxFileSize: 10 * 1024 * 1024,
  maxFiles: 1,
});

// All routes require authentication
router.use(protect);

// Routes accessible by owner, superadmin, and warden
router.get('/students/with-attendance', authorize('owner', 'warden', 'superadmin'), getStudentsWithAttendance);

// Remaining routes require owner or superadmin role
router.use(authorize('owner', 'superadmin'));

// Hostel Configuration
router.post('/hostels', createHostel);
router.get('/hostels', getHostels);
router.get('/hostels/:id', validateObjectId('id'), getHostel);
router.put('/hostels/:id', validateObjectId('id'), updateHostel);
router.delete('/hostels/:id', validateObjectId('id'), deleteHostel);
router.post('/geocode', geocodeAddressEndpoint);
router.post('/hostels/:hostelId/images', validateObjectId('hostelId'), imageUpload.array('images', 10), uploadHostelImages);
router.delete('/hostels/:hostelId/images/:imageUrl', validateObjectId('hostelId'), deleteHostelImage);
router.put('/hostels/:hostelId/cover-image', validateObjectId('hostelId'), setCoverImage);

// Block Management
router.post('/blocks', createBlock);
router.get('/hostels/:hostelId/blocks', validateObjectId('hostelId'), getBlocks);

// Room Management
router.post('/rooms', createRoom);
router.get('/rooms', getRooms); // Get all rooms (with optional query params: hostelId, blockId, status, category)
router.get('/blocks/:blockId/rooms', validateObjectId('blockId'), getRooms); // Get rooms by block (backward compatibility)
router.get('/rooms/:id', validateObjectId('id'), getRoom);
router.put('/rooms/:id', validateObjectId('id'), updateRoom);
router.delete('/rooms/:id', validateObjectId('id'), deleteRoom);
router.post('/rooms/:roomId/images', validateObjectId('roomId'), imageUpload.array('images', 10), uploadRoomImages);
router.delete('/rooms/:roomId/images/:imageUrl', validateObjectId('roomId'), deleteRoomImage);
router.put('/rooms/:roomId/cover-image', validateObjectId('roomId'), setRoomCoverImage);

// Amenity Management
router.post('/amenities', createAmenity);
router.get('/amenities', getAmenities); // Get all amenities (with optional query params: hostelId, category, isAvailable)
router.get('/amenities/:id', validateObjectId('id'), getAmenity);
router.put('/amenities/:id', validateObjectId('id'), updateAmenity);
router.delete('/amenities/:id', validateObjectId('id'), deleteAmenity);
router.post('/amenities/:amenityId/images', validateObjectId('amenityId'), imageUpload.array('images', 10), uploadAmenityImages);
router.delete('/amenities/:amenityId/images/:imageUrl', validateObjectId('amenityId'), deleteAmenityImage);

// Rule Engine
router.post('/rules', createRule);
router.get('/rules', getRules); // Get all rules (with optional hostelId query param)
router.get('/hostels/:hostelId/rules', validateObjectId('hostelId'), getRules); // Get rules by hostel (backward compatibility)
router.put('/rules/:id', validateObjectId('id'), updateRule);
router.delete('/rules/:id', validateObjectId('id'), deleteRule);

// User Management
router.post('/users', createUser);
router.get('/users', getUsers);
router.get('/users/:id', validateObjectId('id'), getUser);
router.put('/users/:id', validateObjectId('id'), updateUser);
router.delete('/users/:id', validateObjectId('id'), deleteUser);

// Student Lifecycle
// NOTE: specific routes must come BEFORE /:id param routes
router.get('/students/registration-invite-qr', generateRegistrationInviteQR);
router.get('/students/status/:status', getStudentsByStatus);
router.post('/students/:id/resend-welcome-email', validateObjectId('id'), resendWelcomeEmail);
router.post('/students/:studentId/profile-image', validateObjectId('studentId'), imageUpload.single('image'), uploadStudentProfileImage);
router.post('/students/:studentId/documents', validateObjectId('studentId'), documentUpload.array('documents', 10), uploadStudentDocuments);
router.delete('/students/:studentId/documents/:documentId', validateObjectId(['studentId', 'documentId']), deleteStudentDocument);
router.get('/students/:id/qr', validateObjectId('id'), getStudentQR);

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
router.get('/hostels/:hostelId/geo-fence', validateObjectId('hostelId'), getGeoFences);
router.get('/geo-fences', getGeoFences);
router.put('/geo-fence/:id', validateObjectId('id'), updateGeoFence);

// Fee Structure
router.post('/fee-structure', createFeeStructure);
router.get('/hostels/:hostelId/fee-structure', validateObjectId('hostelId'), getFeeStructures);
router.get('/hostels/:hostelId/students/:studentId/applicable-fee', validateObjectId(['hostelId', 'studentId']), getApplicableFeeForStudent);

// Plans (1/3/6/12 month)
router.get('/hostels/:hostelId/plans', validateObjectId('hostelId'), getPlans);
router.post('/hostels/:hostelId/plans/seed', validateObjectId('hostelId'), seedPlans);
router.put('/plans/:id', validateObjectId('id'), updatePlan);

// Payments
router.post('/payments', createPayment);
router.get('/payments', getPayments);
router.put('/payments/:id/status', validateObjectId('id'), updatePaymentStatus);
router.delete('/payments/:id', validateObjectId('id'), deletePayment);
router.post('/payments/:id/invoice', validateObjectId('id'), generateInvoice);

// Student Management
router.post('/students/bulk-upload', excelUpload.single('file'), bulkUploadStudents);
router.post('/students/:id/approve', validateObjectId('id'), approveStudentOnboarding);
router.put('/students/:id/status', validateObjectId('id'), updateStudentStatus);

// Templates
router.post('/templates', createTemplate);
router.get('/hostels/:hostelId/templates', validateObjectId('hostelId'), getTemplates);

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

// Marketplace - Enquiries & Callbacks
router.get('/enquiries', getEnquiries);
router.put('/enquiries/:id', validateObjectId('id'), updateEnquiryStatus);
router.get('/callbacks', getCallbackRequests);
router.put('/callbacks/:id', validateObjectId('id'), updateCallbackStatus);

// Mess Schedule
router.get('/hostels/:hostelId/mess', validateObjectId('hostelId'), getMessSchedules);
router.post('/hostels/:hostelId/mess', validateObjectId('hostelId'), createMessSchedule);
router.post('/hostels/:hostelId/mess/seed', validateObjectId('hostelId'), seedMessSchedules);
router.get('/mess-feedback', getMessFeedback);
router.get('/leave-requests', getLeaveRequests);
router.post('/leave-requests/:permissionId/approve', validateObjectId('permissionId'), approveLeaveRequest);
router.post('/leave-requests/:permissionId/reject', validateObjectId('permissionId'), rejectLeaveRequest);
router.get('/maintenance', getMaintenanceComplaints);
router.put('/complaints/:id/status', validateObjectId('id'), updateComplaintStatus);
router.put('/hostels/:hostelId/mess/:scheduleId', validateObjectId(['hostelId', 'scheduleId']), updateMessSchedule);
router.delete('/hostels/:hostelId/mess/:scheduleId', validateObjectId(['hostelId', 'scheduleId']), deleteMessSchedule);

module.exports = router;

