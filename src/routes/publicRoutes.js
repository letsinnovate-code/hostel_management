const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const {
  getPublicHostels,
  getPublicHostel,
  createEnquiry,
  createCallbackRequest,
  uploadSelfDocuments,
} = require('../controllers/publicController');
const { createUploadMiddleware } = require('../middleware/uploadValidation.js');
const { validateObjectId, validateBoundedString, handleValidationErrors } = require('../middleware/validator.js');
const { body } = require('express-validator');

// Rate limiting for public form submissions (anti-spam / anti-DoS)
const publicFormLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many submissions from this IP. Please try again after 15 minutes.',
  },
});

// Secure upload middleware with binary magic byte validation and size limits
const upload = createUploadMiddleware({
  allowedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.pdf'],
  maxFileSize: 5 * 1024 * 1024, // 5MB
  maxFiles: 10,
});

// Public hostel routes (no authentication required)
router.get('/hostels', getPublicHostels);
router.get('/hostels/:id', validateObjectId('id'), getPublicHostel);

// Enquiry and callback routes (rate limited & validated)
router.post(
  '/enquiries',
  publicFormLimiter,
  [
    body('hostelId').notEmpty().withMessage('Hostel ID is required'),
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
    body('email').trim().isEmail().withMessage('Valid email is required'),
    body('phone').trim().isLength({ min: 10, max: 15 }).withMessage('Phone must be 10 to 15 digits'),
    body('message').optional().isLength({ max: 2000 }).withMessage('Message cannot exceed 2000 characters'),
    handleValidationErrors,
  ],
  createEnquiry
);

router.post(
  '/callbacks',
  publicFormLimiter,
  [
    body('hostelId').notEmpty().withMessage('Hostel ID is required'),
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
    body('phone').trim().isLength({ min: 10, max: 15 }).withMessage('Phone must be 10 to 15 digits'),
    body('preferredTime').optional().isLength({ max: 100 }).withMessage('Preferred time cannot exceed 100 characters'),
    handleValidationErrors,
  ],
  createCallbackRequest
);

// Verify a student registration invite token (public — no auth needed)
router.get('/verify-invite/:token', (req, res) => {
  try {
    const { token } = req.params;
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('[PublicRoutes] CRITICAL: JWT_SECRET environment variable is missing.');
      return res.status(500).json({ success: false, message: 'Server configuration error' });
    }
    const decoded = jwt.verify(token, secret);
    if (decoded.type !== 'registration-invite') {
      return res.status(400).json({ success: false, message: 'Invalid invite token type' });
    }
    res.status(200).json({
      success: true,
      data: {
        hostelId: decoded.hostelId,
        role: decoded.role,
        expiresAt: new Date(decoded.exp * 1000).toISOString(),
      },
    });
  } catch (err) {
    res.status(400).json({ success: false, message: 'Invalid or expired invite token' });
  }
});

// Student self-document upload after QR registration (uses student's own JWT)
router.post(
  '/self-documents/:studentId',
  validateObjectId('studentId'),
  upload.array('documents', 10),
  uploadSelfDocuments
);

module.exports = router;
