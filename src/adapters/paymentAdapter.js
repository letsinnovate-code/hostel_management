/**
 * @file adapters/paymentAdapter.js
 * @description Infrastructure adapter decoupling direct Razorpay SDK usage from business logic.
 */

'use strict';

const razorpayUtils = require('../utils/razorpay');

class PaymentAdapter {
  /**
   * Create Razorpay order
   * @param {Object} params - { amount, currency, receipt, notes }
   */
  static async createOrder(params) {
    return await razorpayUtils.createOrder(params);
  }

  /**
   * Verify signature returned by Razorpay checkout
   */
  static verifyPaymentSignature(orderId, paymentId, signature) {
    return razorpayUtils.verifyPaymentSignature(orderId, paymentId, signature);
  }
}

module.exports = PaymentAdapter;
