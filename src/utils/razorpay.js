const crypto = require('crypto');

let Razorpay;
try {
  Razorpay = require('razorpay');
} catch (e) {
  Razorpay = null;
}

function getInstance() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  if (!Razorpay) return null;
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

/**
 * Create a Razorpay order. Amount in INR (will be converted to paise).
 * @param {number} amountINR - amount in rupees
 * @param {string} receipt - receipt id (e.g. payment _id)
 * @param {object} notes - optional notes
 * @returns {Promise<{ orderId, amount, currency, keyId } | null>}
 */
async function createOrder(amountINR, receipt, notes = {}) {
  const instance = getInstance();
  if (!instance) return null;
  const amountPaise = Math.round(Number(amountINR) * 100);
  if (amountPaise < 100) return null;
  return new Promise((resolve, reject) => {
    instance.orders.create(
      {
        amount: amountPaise,
        currency: 'INR',
        receipt: String(receipt).slice(0, 40),
        notes,
      },
      (err, order) => {
        if (err) return reject(err);
        resolve({
          orderId: order.id,
          amount: amountPaise,
          currency: 'INR',
          keyId: process.env.RAZORPAY_KEY_ID,
        });
      }
    );
  });
}

/**
 * Verify Razorpay payment signature.
 * @param {string} orderId - razorpay_order_id
 * @param {string} paymentId - razorpay_payment_id
 * @param {string} signature - razorpay_signature
 * @returns {boolean}
 */
function verifyPaymentSignature(orderId, paymentId, signature) {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret || !orderId || !paymentId || !signature) return false;
  try {
    const body = `${orderId}|${paymentId}`;
    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
    const expectedBuf = Buffer.from(expected, 'utf8');
    const signatureBuf = Buffer.from(String(signature), 'utf8');
    if (expectedBuf.length !== signatureBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, signatureBuf);
  } catch (err) {
    return false;
  }
}

module.exports = { getInstance, createOrder, verifyPaymentSignature };
