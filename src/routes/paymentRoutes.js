/**
 * @file routes/paymentRoutes.js
 * @description Dedicated routes for Razorpay checkout and redirect callback handling.
 */

'use strict';

const express = require('express');
const router = express.Router();
const {
  renderRazorpayCheckout,
  handleRazorpayCallback,
} = require('../controllers/paymentController');

// Razorpay checkout page (GET /api/razorpay-checkout)
router.get('/razorpay-checkout', renderRazorpayCheckout);

// Razorpay callback (POST and GET /api/razorpay-callback)
router.post('/razorpay-callback', handleRazorpayCallback);
router.get('/razorpay-callback', handleRazorpayCallback);

module.exports = router;
