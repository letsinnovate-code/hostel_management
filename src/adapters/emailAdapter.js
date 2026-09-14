/**
 * @file adapters/emailAdapter.js
 * @description Infrastructure adapter decoupling direct Nodemailer/SMTP interaction from controllers and services.
 */

'use strict';

const emailService = require('../services/email.service');

class EmailAdapter {
  static async sendEmail(options) {
    return await emailService.sendEmail(options);
  }

  static async sendWelcomeEmail(user, rawPassword, options) {
    return await emailService.sendWelcomeEmail(user, rawPassword, options);
  }

  static async sendApprovalEmail(student, hostel, options) {
    return await emailService.sendApprovalEmail(student, hostel, options);
  }

  static async sendNoticeEmail(options) {
    return await emailService.sendNoticeEmail(options);
  }

  static async sendParentEmergencyEmail(options) {
    return await emailService.sendParentEmergencyEmail(options);
  }
}

module.exports = EmailAdapter;
