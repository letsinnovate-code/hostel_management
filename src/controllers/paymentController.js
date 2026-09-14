/**
 * @file controllers/paymentController.js
 * @description Controller for web/mobile Razorpay checkout page and redirect callback handling.
 */

'use strict';

const Payment = require('../models/Payment');
const Plan = require('../models/Plan');
const { verifyPaymentSignature } = require('../utils/razorpay');
const { setPeriodFromPlan } = require('../utils/paymentPeriod');
const asyncHandler = require('../utils/asyncHandler');

function sendSuccessHtml(res) {
  const html = `<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:sans-serif; padding:24px; text-align:center;">
  <h2 style="color:#059669;">Payment successful</h2>
  <p>You can close this window and return to the app.</p>
  <script>
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ success: true }));
    }
  </script>
</body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}

// Razorpay checkout page (for mobile WebView – uses callback_url + redirect for WebView compatibility)
exports.renderRazorpayCheckout = (req, res) => {
  const orderId = (req.query.order_id || '').toString().trim();
  const keyId = (req.query.key_id || '').toString().trim();
  const amountINR = Number(req.query.amount) || 0;
  const name = (req.query.name || 'Hostel Payment').toString().replace(/[<>"']/g, '');
  const description = (req.query.description || 'Payment').toString().replace(/[<>"']/g, '');
  const callbackUrl = (req.query.callback_url || '').toString().trim();

  if (!orderId || !keyId || amountINR < 1) {
    return res.status(400).send('<html><body><p>Missing or invalid parameters (order_id, key_id, amount required).</p></body></html>');
  }
  if (!callbackUrl) {
    return res.status(400).send('<html><body><p>Missing callback_url (required for WebView).</p></body></html>');
  }

  const amountPaise = Math.round(amountINR * 100);
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
</head>
<body>
  <p id="msg">Opening payment...</p>
  <button id="btn" style="display:none; padding:12px 24px; font-size:16px; background:#0c2458; color:#fff; border:none; border-radius:8px; cursor:pointer;">Pay ₹${amountINR.toLocaleString()}</button>
  <script>
    (function() {
      var orderId = ${JSON.stringify(orderId)};
      var keyId = ${JSON.stringify(keyId)};
      var amountPaise = ${amountPaise};
      var name = ${JSON.stringify(name)};
      var description = ${JSON.stringify(description)};
      var callbackUrl = ${JSON.stringify(callbackUrl)};
      var options = {
        key: keyId,
        amount: amountPaise,
        currency: 'INR',
        order_id: orderId,
        name: name,
        description: description,
        callback_url: callbackUrl,
        redirect: true
      };
      function openCheckout() {
        try {
          var rzp = new Razorpay(options);
          rzp.open();
        } catch (e) {
          document.getElementById('msg').textContent = 'Error: ' + (e.message || 'Could not open payment');
          document.getElementById('btn').style.display = 'block';
          document.getElementById('btn').onclick = function() { openCheckout(); };
        }
      }
      if (window.Razorpay) {
        openCheckout();
      } else {
        document.getElementById('msg').textContent = 'Loading Razorpay...';
        document.getElementById('btn').style.display = 'block';
        document.getElementById('btn').onclick = function() {
          if (window.Razorpay) openCheckout();
          else document.getElementById('msg').textContent = 'Failed to load. Use "Pay in browser" from the app.';
        };
        setTimeout(function() { if (window.Razorpay) openCheckout(); }, 1500);
      }
    })();
  </script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
};

// Razorpay callback (POST from Razorpay redirect – used when redirect:true in checkout)
exports.handleRazorpayCallback = asyncHandler(async (req, res) => {
  const razorpay_order_id = (req.body && req.body.razorpay_order_id) || (req.query && req.query.razorpay_order_id);
  const razorpay_payment_id = (req.body && req.body.razorpay_payment_id) || (req.query && req.query.razorpay_payment_id);
  const razorpay_signature = (req.body && req.body.razorpay_signature) || (req.query && req.query.razorpay_signature);

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).set('Content-Type', 'text/html').send(
      '<!DOCTYPE html><html><body><p>Missing payment details.</p></body></html>'
    );
  }

  const valid = verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
  if (!valid) {
    return res.status(400).set('Content-Type', 'text/html').send(
      '<!DOCTYPE html><html><body><p>Invalid signature.</p></body></html>'
    );
  }

  const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
  if (!payment) {
    return res.status(404).set('Content-Type', 'text/html').send(
      '<!DOCTYPE html><html><body><p>Payment not found.</p></body></html>'
    );
  }

  if (payment.status === 'paid') {
    return sendSuccessHtml(res);
  }

  payment.status = 'paid';
  payment.transactionId = razorpay_payment_id;
  payment.paymentMethod = 'upi';
  payment.paidDate = new Date();

  if (payment.planId) {
    const plan = await Plan.findById(payment.planId).select('durationMonths').lean();
    if (plan && plan.durationMonths) setPeriodFromPlan(payment, payment.paidDate, plan.durationMonths);
  }

  await payment.save();
  return sendSuccessHtml(res);
});
