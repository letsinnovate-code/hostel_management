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
  simulateStudentLocation,
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
  assignComplaint,
  generateRegistrationInviteQR,
  getStudentQR,
} = require('../controllers/ownerController');
const { protect, authorize } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const { requireTenantAccess } = require('../middleware/tenant');
const P = require('../config/permissions');
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
router.post('/hostels', requirePermission(P.HOSTEL_UPDATE), createHostel);
router.get('/hostels', requirePermission(P.HOSTEL_VIEW), getHostels);
router.get('/hostels/:id', validateObjectId('id'), requirePermission(P.HOSTEL_VIEW), requireTenantAccess('Hostel', 'id'), getHostel);
router.put('/hostels/:id', validateObjectId('id'), requirePermission(P.HOSTEL_UPDATE), requireTenantAccess('Hostel', 'id'), updateHostel);
router.delete('/hostels/:id', validateObjectId('id'), requirePermission(P.HOSTEL_UPDATE), requireTenantAccess('Hostel', 'id'), deleteHostel);
router.post('/geocode', geocodeAddressEndpoint);
router.post('/hostels/:hostelId/images', validateObjectId('hostelId'), requirePermission(P.HOSTEL_UPDATE), requireTenantAccess('Hostel', 'hostelId'), imageUpload.array('images', 10), uploadHostelImages);
router.delete('/hostels/:hostelId/images/:imageUrl', validateObjectId('hostelId'), requirePermission(P.HOSTEL_UPDATE), requireTenantAccess('Hostel', 'hostelId'), deleteHostelImage);
router.put('/hostels/:hostelId/cover-image', validateObjectId('hostelId'), requirePermission(P.HOSTEL_UPDATE), requireTenantAccess('Hostel', 'hostelId'), setCoverImage);

// Block Management
router.post('/blocks', requirePermission(P.ROOM_UPDATE), createBlock);
router.get('/hostels/:hostelId/blocks', validateObjectId('hostelId'), requirePermission(P.ROOM_VIEW), requireTenantAccess('Hostel', 'hostelId'), getBlocks);

// Room Management
router.post('/rooms', requirePermission(P.ROOM_UPDATE), createRoom);
router.get('/rooms', requirePermission(P.ROOM_VIEW), getRooms); // Controller must filter by user's hostels
router.get('/blocks/:blockId/rooms', validateObjectId('blockId'), requirePermission(P.ROOM_VIEW), requireTenantAccess('Block', 'blockId'), getRooms);
router.get('/rooms/:id', validateObjectId('id'), requirePermission(P.ROOM_VIEW), requireTenantAccess('Room', 'id'), getRoom);
router.put('/rooms/:id', validateObjectId('id'), requirePermission(P.ROOM_UPDATE), requireTenantAccess('Room', 'id'), updateRoom);
router.delete('/rooms/:id', validateObjectId('id'), requirePermission(P.ROOM_UPDATE), requireTenantAccess('Room', 'id'), deleteRoom);
router.post('/rooms/:roomId/images', validateObjectId('roomId'), requirePermission(P.ROOM_UPDATE), requireTenantAccess('Room', 'roomId'), imageUpload.array('images', 10), uploadRoomImages);
router.delete('/rooms/:roomId/images/:imageUrl', validateObjectId('roomId'), requirePermission(P.ROOM_UPDATE), requireTenantAccess('Room', 'roomId'), deleteRoomImage);
router.put('/rooms/:roomId/cover-image', validateObjectId('roomId'), requirePermission(P.ROOM_UPDATE), requireTenantAccess('Room', 'roomId'), setRoomCoverImage);

// Amenity Management
router.post('/amenities', requirePermission(P.HOSTEL_UPDATE), createAmenity);
router.get('/amenities', requirePermission(P.HOSTEL_VIEW), getAmenities); // Controller must filter
router.get('/amenities/:id', validateObjectId('id'), requirePermission(P.HOSTEL_VIEW), requireTenantAccess('Amenity', 'id'), getAmenity);
router.put('/amenities/:id', validateObjectId('id'), requirePermission(P.HOSTEL_UPDATE), requireTenantAccess('Amenity', 'id'), updateAmenity);
router.delete('/amenities/:id', validateObjectId('id'), requirePermission(P.HOSTEL_UPDATE), requireTenantAccess('Amenity', 'id'), deleteAmenity);
router.post('/amenities/:amenityId/images', validateObjectId('amenityId'), requirePermission(P.HOSTEL_UPDATE), requireTenantAccess('Amenity', 'amenityId'), imageUpload.array('images', 10), uploadAmenityImages);
router.delete('/amenities/:amenityId/images/:imageUrl', validateObjectId('amenityId'), requirePermission(P.HOSTEL_UPDATE), requireTenantAccess('Amenity', 'amenityId'), deleteAmenityImage);

// Rule Engine
router.post('/rules', requirePermission(P.RULE_UPDATE), createRule);
router.get('/rules', requirePermission(P.RULE_VIEW), getRules); // Controller must filter
router.get('/hostels/:hostelId/rules', validateObjectId('hostelId'), requirePermission(P.RULE_VIEW), requireTenantAccess('Hostel', 'hostelId'), getRules);
router.put('/rules/:id', validateObjectId('id'), requirePermission(P.RULE_UPDATE), requireTenantAccess('Rule', 'id'), updateRule);
router.delete('/rules/:id', validateObjectId('id'), requirePermission(P.RULE_UPDATE), requireTenantAccess('Rule', 'id'), deleteRule);

// User Management (Staff/Students)
router.post('/users', requirePermission(P.USER_UPDATE), createUser);
router.get('/users', requirePermission(P.USER_VIEW), getUsers); // Controller must filter
router.get('/users/:id', validateObjectId('id'), requirePermission(P.USER_VIEW), requireTenantAccess('User', 'id'), getUser);
router.put('/users/:id', validateObjectId('id'), requirePermission(P.USER_UPDATE), requireTenantAccess('User', 'id'), updateUser);
router.delete('/users/:id', validateObjectId('id'), requirePermission(P.USER_UPDATE), requireTenantAccess('User', 'id'), deleteUser);

// Student Lifecycle
// NOTE: specific routes must come BEFORE /:id param routes
router.get('/students/registration-invite-qr', requirePermission(P.USER_VIEW), generateRegistrationInviteQR);
router.get('/students/status/:status', requirePermission(P.USER_VIEW), getStudentsByStatus);
router.post('/students/:id/resend-welcome-email', validateObjectId('id'), requirePermission(P.USER_UPDATE), requireTenantAccess('User', 'id'), resendWelcomeEmail);
router.post('/students/:studentId/profile-image', validateObjectId('studentId'), requirePermission(P.USER_UPDATE), requireTenantAccess('User', 'studentId'), imageUpload.single('image'), uploadStudentProfileImage);
router.post('/students/:studentId/documents', validateObjectId('studentId'), requirePermission(P.USER_UPDATE), requireTenantAccess('User', 'studentId'), documentUpload.array('documents', 10), uploadStudentDocuments);
router.delete('/students/:studentId/documents/:documentId', validateObjectId(['studentId', 'documentId']), requirePermission(P.USER_UPDATE), requireTenantAccess('User', 'studentId'), deleteStudentDocument);
router.get('/students/:id/qr', validateObjectId('id'), requirePermission(P.USER_VIEW), requireTenantAccess('User', 'id'), getStudentQR);

// Analytics & Reports
router.get('/analytics/attendance', requirePermission(P.REPORT_VIEW), getAttendanceTrends);
router.get('/analytics/violations', requirePermission(P.REPORT_VIEW), getViolationHeatmap);
router.get('/violations/recent', requirePermission(P.REPORT_VIEW), getRecentViolations);
router.get('/analytics/discipline', requirePermission(P.REPORT_VIEW), getMonthlyDisciplineReport);

// Notifications / Notice Board
router.post('/notifications', requirePermission(P.COMMUNICATION_UPDATE), sendNotification);
router.post('/notifications/broadcast', requirePermission(P.COMMUNICATION_UPDATE), sendNotificationToAll);
router.get('/notifications/receipts', requirePermission(P.COMMUNICATION_VIEW), getNotificationReceipts);

router.get('/visitors', requirePermission(P.USER_VIEW), getVisitorRequests);
router.post('/visitors/:visitorId/approve', requirePermission(P.USER_UPDATE), approveVisitorRequest);
router.post('/visitors/:visitorId/reject', requirePermission(P.USER_UPDATE), rejectVisitorRequest);
router.get('/hostels/:hostelId/notifications', validateObjectId('hostelId'), requirePermission(P.COMMUNICATION_VIEW), requireTenantAccess('Hostel', 'hostelId'), getNotifications);
router.get('/notifications/:id', validateObjectId('id'), requirePermission(P.COMMUNICATION_VIEW), getNotification);
router.post('/notifications/:id/send-reminder', validateObjectId('id'), requirePermission(P.COMMUNICATION_UPDATE), sendNotificationReminder);
router.put('/notifications/:id', validateObjectId('id'), requirePermission(P.COMMUNICATION_UPDATE), updateNotification);
router.delete('/notifications/:id', validateObjectId('id'), requirePermission(P.COMMUNICATION_UPDATE), deleteNotification);

// Enhanced Hostel Setup
router.put('/hostels/:id/amenities', validateObjectId('id'), requirePermission(P.HOSTEL_UPDATE), requireTenantAccess('Hostel', 'id'), updateHostelAmenities);

// Room Pricing & Allocation
router.put('/rooms/pricing', requirePermission(P.ROOM_UPDATE), setRoomPricing);
router.put('/rooms/pricing/bulk', requirePermission(P.ROOM_UPDATE), bulkUpdateRoomPricing);
router.post('/rooms/allocate', requirePermission(P.ROOM_UPDATE), autoAllocateRooms);

// Enhanced Rule Engine
router.post('/rules/curfew', requirePermission(P.RULE_UPDATE), createCurfewRule);
router.post('/rules/late-entry', requirePermission(P.RULE_UPDATE), createLateEntryRule);
router.post('/rules/leave-policy', requirePermission(P.RULE_UPDATE), createLeavePolicy);
router.post('/rules/discipline-matrix', requirePermission(P.RULE_UPDATE), createDisciplineMatrix);

// Geo-Fence
router.post('/geo-fence', requirePermission(P.HOSTEL_UPDATE), createGeoFence);
router.get('/hostels/:hostelId/geo-fence', validateObjectId('hostelId'), requirePermission(P.HOSTEL_VIEW), requireTenantAccess('Hostel', 'hostelId'), getGeoFences);
router.get('/geo-fences', requirePermission(P.HOSTEL_VIEW), getGeoFences);
router.put('/geo-fence/:id', validateObjectId('id'), requirePermission(P.HOSTEL_UPDATE), updateGeoFence);

// Fee Structure
router.post('/fee-structure', requirePermission(P.FINANCE_UPDATE), createFeeStructure);
router.get('/hostels/:hostelId/fee-structure', validateObjectId('hostelId'), requirePermission(P.FINANCE_VIEW), requireTenantAccess('Hostel', 'hostelId'), getFeeStructures);
router.get('/hostels/:hostelId/students/:studentId/applicable-fee', validateObjectId(['hostelId', 'studentId']), requirePermission(P.FINANCE_VIEW), requireTenantAccess('Hostel', 'hostelId'), requireTenantAccess('User', 'studentId'), getApplicableFeeForStudent);

// Plans (1/3/6/12 month)
router.get('/hostels/:hostelId/plans', validateObjectId('hostelId'), requirePermission(P.FINANCE_VIEW), requireTenantAccess('Hostel', 'hostelId'), getPlans);
router.post('/hostels/:hostelId/plans/seed', validateObjectId('hostelId'), requirePermission(P.FINANCE_UPDATE), requireTenantAccess('Hostel', 'hostelId'), seedPlans);
router.put('/plans/:id', validateObjectId('id'), requirePermission(P.FINANCE_UPDATE), updatePlan);

// Payments
router.post('/payments', requirePermission(P.FINANCE_UPDATE), createPayment);
router.get('/payments', requirePermission(P.FINANCE_VIEW), getPayments);
router.put('/payments/:id/status', validateObjectId('id'), requirePermission(P.FINANCE_UPDATE), updatePaymentStatus);
router.delete('/payments/:id', validateObjectId('id'), requirePermission(P.FINANCE_UPDATE), deletePayment);
router.post('/payments/:id/invoice', validateObjectId('id'), requirePermission(P.FINANCE_VIEW), generateInvoice);

// Student Management
router.post('/students/bulk-upload', requirePermission(P.USER_UPDATE), excelUpload.single('file'), bulkUploadStudents);
router.post('/students/:id/approve', validateObjectId('id'), requirePermission(P.USER_UPDATE), requireTenantAccess('User', 'id'), approveStudentOnboarding);
router.put('/students/:id/status', validateObjectId('id'), requirePermission(P.USER_UPDATE), requireTenantAccess('User', 'id'), updateStudentStatus);

// Templates
router.post('/templates', requirePermission(P.COMMUNICATION_UPDATE), createTemplate);
router.get('/hostels/:hostelId/templates', validateObjectId('hostelId'), requirePermission(P.COMMUNICATION_VIEW), requireTenantAccess('Hostel', 'hostelId'), getTemplates);

// Analytics & Reporting
router.get('/dashboard/kpis', requirePermission(P.REPORT_VIEW), getDashboardKPIs);
router.get('/analytics/staff-performance', requirePermission(P.REPORT_VIEW), getStaffPerformance);
router.get('/analytics/occupancy', requirePermission(P.REPORT_VIEW), getOccupancyReport);
router.get('/analytics/financial', requirePermission(P.REPORT_VIEW), getFinancialReport);

// Compliance & Audit
router.get('/audit-logs', requirePermission(P.REPORT_VIEW), getAuditLogs);
router.get('/export', requirePermission(P.REPORT_VIEW), exportData);

// Support & System
router.post('/support-tickets', requirePermission(P.USER_UPDATE), createSupportTicket);
router.get('/support-tickets', requirePermission(P.USER_VIEW), getSupportTickets);
router.get('/system-logs', requirePermission(P.REPORT_VIEW), getSystemLogs);

// Attendance & Location
router.post('/attendance/check', requirePermission(P.USER_UPDATE), triggerAttendanceCheck);
router.get('/attendance/daily', requirePermission(P.USER_VIEW), getDailyAttendance);
router.get('/gate-logs', requirePermission(P.USER_VIEW), getGateLogs);
router.get('/students/locations', requirePermission(P.USER_VIEW), getStudentLocations);
router.post('/students/simulate-telemetry', requirePermission(P.USER_UPDATE), simulateStudentLocation);
router.get('/students/location-permissions', requirePermission(P.USER_VIEW), getLocationPermissionStatus);

// Marketplace - Enquiries & Callbacks
router.get('/enquiries', requirePermission(P.COMMUNICATION_VIEW), getEnquiries);
router.put('/enquiries/:id', validateObjectId('id'), requirePermission(P.COMMUNICATION_UPDATE), updateEnquiryStatus);
router.get('/callbacks', requirePermission(P.COMMUNICATION_VIEW), getCallbackRequests);
router.put('/callbacks/:id', validateObjectId('id'), requirePermission(P.COMMUNICATION_UPDATE), updateCallbackStatus);

// Mess Schedule
router.get('/hostels/:hostelId/mess', validateObjectId('hostelId'), requirePermission(P.HOSTEL_VIEW), requireTenantAccess('Hostel', 'hostelId'), getMessSchedules);
router.post('/hostels/:hostelId/mess', validateObjectId('hostelId'), requirePermission(P.HOSTEL_UPDATE), requireTenantAccess('Hostel', 'hostelId'), createMessSchedule);
router.post('/hostels/:hostelId/mess/seed', validateObjectId('hostelId'), requirePermission(P.HOSTEL_UPDATE), requireTenantAccess('Hostel', 'hostelId'), seedMessSchedules);
router.get('/mess-feedback', requirePermission(P.FEEDBACK_VIEW), getMessFeedback);
router.get('/leave-requests', requirePermission(P.USER_VIEW), getLeaveRequests);
router.post('/leave-requests/:permissionId/approve', validateObjectId('permissionId'), requirePermission(P.USER_UPDATE), approveLeaveRequest);
router.post('/leave-requests/:permissionId/reject', validateObjectId('permissionId'), requirePermission(P.USER_UPDATE), rejectLeaveRequest);
router.get('/maintenance', requirePermission(P.ROOM_VIEW), getMaintenanceComplaints);
router.get('/complaints', requirePermission(P.ROOM_VIEW), getMaintenanceComplaints);
router.put('/complaints/:id/status', validateObjectId('id'), requirePermission(P.ROOM_UPDATE), updateComplaintStatus);
router.post('/complaints/:id/assign', validateObjectId('id'), requirePermission(P.ROOM_UPDATE), assignComplaint);
router.put('/hostels/:hostelId/mess/:scheduleId', validateObjectId(['hostelId', 'scheduleId']), requirePermission(P.HOSTEL_UPDATE), requireTenantAccess('Hostel', 'hostelId'), updateMessSchedule);
router.delete('/hostels/:hostelId/mess/:scheduleId', validateObjectId(['hostelId', 'scheduleId']), requirePermission(P.HOSTEL_UPDATE), requireTenantAccess('Hostel', 'hostelId'), deleteMessSchedule);

module.exports = router;

