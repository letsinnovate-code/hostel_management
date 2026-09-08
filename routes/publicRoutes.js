const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const multer = require('multer');
const {
  getPublicHostels,
  getPublicHostel,
  createEnquiry,
  createCallbackRequest,
  uploadSelfDocuments,
} = require('../controllers/publicController');

const storage = multer.memoryStorage();
const upload = multer({ storage });

// Public hostel routes (no authentication required)
router.get('/hostels', getPublicHostels);
router.get('/hostels/:id', getPublicHostel);

// Enquiry and callback routes
router.post('/enquiries', createEnquiry);
router.post('/callbacks', createCallbackRequest);

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
router.post('/self-documents/:studentId', upload.array('documents', 10), uploadSelfDocuments);

module.exports = router;




