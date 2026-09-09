const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { register, login, getMe, setCurrentRole, registerStudentViaQR, changePassword } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Brute-force protection for login: max 10 requests per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts from this IP. Please try again after 15 minutes.' }
});

// Registration rate limit: max 20 registrations per hour per IP
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many registration requests from this IP. Please try again later.' }
});

// Informative GET handlers for browser visitors (prevents 404 confusion)
router.get('/register', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Hostelzify User Registration API Endpoint. This endpoint accepts POST requests with JSON payload: { name, email, password, phone, role }.',
    hint: 'To register via the user interface, open the frontend registration page (/register).',
  });
});

router.get('/login', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Hostelzify User Login API Endpoint. This endpoint accepts POST requests with JSON payload: { email, password }.',
    hint: 'To log in via the user interface, open the frontend login page (/login).',
  });
});

const {
  validateEmail,
  validatePhone,
  validatePassword,
  validateBoundedString,
  validateObjectId,
  handleValidationErrors,
  isValidObjectId,
  rfcEmailRegex,
  phoneRegex,
} = require('../middleware/validator');
const { body } = require('express-validator');

const validateRegister = [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  body('email').trim().matches(rfcEmailRegex).withMessage('Must be a valid email address'),
  body('password').isLength({ min: 8, max: 128 }).withMessage('Password must be between 8 and 128 characters'),
  body('phone').optional({ checkFalsy: true }).custom(val => phoneRegex.test(String(val).replace(/[\s-()]/g, ''))).withMessage('Phone must be 10 to 15 digits'),
  body('hostelId').optional({ checkFalsy: true }).custom(isValidObjectId).withMessage('hostelId must be a valid ObjectId'),
  body('blockId').optional({ checkFalsy: true }).custom(isValidObjectId).withMessage('blockId must be a valid ObjectId'),
  body('roomId').optional({ checkFalsy: true }).custom(isValidObjectId).withMessage('roomId must be a valid ObjectId'),
  handleValidationErrors,
];

const validateLogin = [
  body('email').trim().matches(rfcEmailRegex).withMessage('Must be a valid email address'),
  body('password').notEmpty().withMessage('Password is required'),
  handleValidationErrors,
];

const validateQRRegister = [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  body('email').trim().matches(rfcEmailRegex).withMessage('Must be a valid email address'),
  body('phone').trim().custom(val => phoneRegex.test(String(val).replace(/[\s-()]/g, ''))).withMessage('Phone must be 10 to 15 digits'),
  body('hostelId').custom(isValidObjectId).withMessage('hostelId must be a valid MongoDB ObjectId'),
  handleValidationErrors,
];

router.post('/register', registerLimiter, validateRegister, register);
router.post('/login', loginLimiter, validateLogin, login);
router.get('/me', protect, getMe);
router.post('/set-role', protect, setCurrentRole);

// QR-based student self-registration (public — rate limited to prevent spam)
router.post('/register-student-qr', registerLimiter, validateQRRegister, registerStudentViaQR);

// Change own password (any authenticated user)
router.put('/change-password', protect, changePassword);

module.exports = router;



