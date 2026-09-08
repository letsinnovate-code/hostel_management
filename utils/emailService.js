/**
 * @file emailService.js
 * @description Facade and backward-compatible entry point for the centralized Email Service.
 * Delegates all operations to services/email.service.js.
 */

'use strict';

const emailService = require('../services/email.service');
const { getWelcomeHtmlTemplate, renderWelcomeEmail } = require('../emails/templates/welcome.template');

module.exports = {
  // Centralized service methods
  sendEmail: emailService.sendEmail,
  sendWelcomeEmail: emailService.sendWelcomeEmail,
  sendStaffWelcomeEmail: emailService.sendStaffWelcomeEmail,
  sendApprovalEmail: emailService.sendApprovalEmail,
  sendNoticeEmail: emailService.sendNoticeEmail,
  sendBulkNoticeEmails: emailService.sendBulkNoticeEmails,
  sendParentEmergencyEmail: emailService.sendParentEmergencyEmail,

  // Template utilities & helpers
  getWelcomeEmailTemplate: (studentName, hostelName, loginCredentials) => {
    return renderWelcomeEmail({
      userName: studentName,
      userEmail: loginCredentials?.email || '',
      credentials: loginCredentials,
      appName: hostelName || process.env.EMAIL_FROM_NAME || 'Hostelzify',
    }).html;
  },
  renderWelcomeEmail,
  getWelcomeHtmlTemplate,
  getDefaultFrom: emailService.getDefaultFrom,
  getAppUrl: emailService.getAppUrl,
  getDashboardUrlForRole: emailService.getDashboardUrlForRole,
};
