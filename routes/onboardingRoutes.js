const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getStudentOnboardingState,
  saveOnboardingProfile,
  saveOnboardingContacts,
  uploadOnboardingDocument,
  resubmitOnboardingDocument,
  selectOnboardingHostel,
  getAvailableRoomsForOnboarding,
  getOnboardingFeeBreakdown,
  initiateOnboardingPayment,
  verifyOnboardingPayment,
  acceptHostelAgreement,
  submitOnboardingFinalReview,
  getWardenOnboardingApplications,
  getWardenOnboardingApplicationDetails,
  verifyWardenDocument,
  allocateWardenOnboardingRoom,
  confirmWardenOfflineFee,
  requestWardenCorrection,
  approveWardenOnboardingFinal,
  rejectWardenOnboarding,
  getOnboardingMetrics,
} = require('../controllers/onboardingController');
const { createUploadMiddleware } = require('../middleware/uploadValidation');
const { validateObjectId } = require('../middleware/validator');

// Hardened upload middleware with MIME, extension, and magic-byte signature validation
const upload = createUploadMiddleware({
  allowedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.pdf'],
  maxFileSize: 10 * 1024 * 1024, // 10MB limit
  maxFiles: 5,
});

// All onboarding routes require authentication
router.use(protect);

// ==========================================
// STUDENT ONBOARDING ENDPOINTS
// ==========================================
router.get('/state', authorize('student'), getStudentOnboardingState);
router.post('/profile', authorize('student'), saveOnboardingProfile);
router.post('/contacts', authorize('student'), saveOnboardingContacts);
router.post('/documents', authorize('student'), upload.single('file'), uploadOnboardingDocument);
router.post('/documents/resubmit', authorize('student'), upload.single('file'), resubmitOnboardingDocument);
router.post('/hostel', authorize('student'), selectOnboardingHostel);
router.get('/available-rooms', authorize('student'), getAvailableRoomsForOnboarding);
router.get('/fee-breakdown', authorize('student'), getOnboardingFeeBreakdown);
router.post('/payment/initiate', authorize('student'), initiateOnboardingPayment);
router.post('/payment/verify', authorize('student'), verifyOnboardingPayment);
router.post('/agreement', authorize('student'), acceptHostelAgreement);
router.post('/submit-review', authorize('student'), submitOnboardingFinalReview);

// ==========================================
// WARDEN & ADMIN ONBOARDING MANAGEMENT ENDPOINTS
// ==========================================
const staffRoles = ['warden', 'owner', 'superadmin'];

router.get('/applications', authorize(...staffRoles), getWardenOnboardingApplications);
router.get('/applications/:id', authorize(...staffRoles), validateObjectId('id'), getWardenOnboardingApplicationDetails);
router.post('/applications/:id/verify-document', authorize(...staffRoles), validateObjectId('id'), verifyWardenDocument);
router.post('/applications/:id/allocate-room', authorize(...staffRoles), validateObjectId('id'), allocateWardenOnboardingRoom);
router.post('/applications/:id/confirm-offline-fee', authorize(...staffRoles), validateObjectId('id'), confirmWardenOfflineFee);
router.post('/applications/:id/request-correction', authorize(...staffRoles), validateObjectId('id'), requestWardenCorrection);
router.post('/applications/:id/approve', authorize(...staffRoles), validateObjectId('id'), approveWardenOnboardingFinal);
router.post('/applications/:id/reject', authorize(...staffRoles), validateObjectId('id'), rejectWardenOnboarding);
router.get('/metrics', authorize(...staffRoles), getOnboardingMetrics);

module.exports = router;
