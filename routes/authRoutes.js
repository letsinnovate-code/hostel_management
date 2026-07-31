const express = require('express');
const router = express.Router();
const { register, login, getMe, setCurrentRole, registerStudentViaQR, changePassword } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.post('/set-role', protect, setCurrentRole);

// QR-based student self-registration (public — no auth required)
router.post('/register-student-qr', registerStudentViaQR);

// Change own password (any authenticated user)
router.put('/change-password', protect, changePassword);

module.exports = router;


