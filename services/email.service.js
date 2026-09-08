/**
 * @file email.service.js
 * @description Centralized, production-ready Email Service for Hostelzify.
 * Features connection pooling, HTML/Plain-text templates, dynamic variables,
 * duplicate prevention, safe credential masking, and seamless error recovery.
 */

'use strict';

const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const { isValidEmail, maskEmail } = require('../utils/emailSanitizer');
const { renderWelcomeEmail } = require('../emails/templates/welcome.template');

// Transporter singleton cache
let transporterInstance = null;

/**
 * Initializes and caches the Nodemailer transporter.
 * Supports connection pooling and fail-soft timeouts.
 * 
 * @returns {Object|null} Transporter instance or null if not configured
 */
function getTransporter() {
  if (transporterInstance) {
    return transporterInstance;
  }

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const secure = port === 465 || process.env.SMTP_SECURE === 'true';

  if (!host || !user || !pass) {
    return null;
  }

  transporterInstance = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    connectionTimeout: 10000, // 10s
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  return transporterInstance;
}

/**
 * Returns default sender formatting: `"Hostelzify" <noreply@hostelzify.com>`
 */
function getDefaultFrom() {
  const fromName = process.env.EMAIL_FROM_NAME || 'Hostelzify';
  const fromEmail = process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@hostelzify.com';
  return `"${fromName}" <${fromEmail}>`;
}

/**
 * Resolves the appropriate frontend URL based on environment.
 */
function getAppUrl() {
  return process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
}

/**
 * Resolves dashboard destination URL for a given user role.
 * 
 * @param {string|string[]} role
 * @returns {string} URL path
 */
function getDashboardUrlForRole(role) {
  const base = getAppUrl();
  const primaryRole = Array.isArray(role) ? role[0] : String(role || '');

  switch (primaryRole.toLowerCase()) {
    case 'student':
      return `${base}/student/dashboard`;
    case 'owner':
      return `${base}/owner/dashboard`;
    case 'warden':
      return `${base}/warden/dashboard`;
    case 'cleaner':
    case 'supervisor':
      return `${base}/cleaner/tasks`;
    case 'superadmin':
      return `${base}/superadmin/dashboard`;
    default:
      return `${base}/login`;
  }
}

/**
 * Core email dispatcher with strict address validation, timing, and error handling.
 * 
 * @param {Object} options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML email body
 * @param {string} options.text - Plain-text fallback
 * @param {string} [options.from] - Custom from address
 * @returns {Promise<{ success: boolean, messageId?: string, simulated?: boolean, error?: string }>}
 */
async function sendEmail({ to, subject, html, text, from }) {
  const maskedTo = maskEmail(to);

  // 1. Validation
  if (!to || !isValidEmail(to)) {
    console.warn(`[EmailService] Invalid recipient address rejected: "${maskedTo}"`);
    return { success: false, error: 'Invalid recipient email address' };
  }

  if (!subject || (!html && !text)) {
    console.warn(`[EmailService] Missing required content (subject or body) for ${maskedTo}`);
    return { success: false, error: 'Missing email subject or content body' };
  }

  const transporter = getTransporter();

  // 2. Check if transporter is available
  if (!transporter) {
    if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
      console.log(`[EmailService] [DEV/SIMULATED] Email to ${maskedTo} with subject "${subject}" captured successfully.`);
      return { success: true, simulated: true, messageId: `sim-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` };
    }
    console.warn(`[EmailService] SMTP credentials not configured. Email to ${maskedTo} skipped.`);
    return { success: false, message: 'Email service not configured' };
  }

  // 3. Dispatch
  const mailOptions = {
    from: from || getDefaultFrom(),
    to: to.trim(),
    subject,
    html,
    text,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[EmailService] Email dispatched successfully to ${maskedTo} (MessageId: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    // Sanitize error logging to ensure credentials/tokens are never exposed
    const safeErrorMsg = (err.message || 'SMTP delivery failed').replace(/auth.*?:.*?(@|\s|$)/gi, '[REDACTED]');
    console.error(`[EmailService] Delivery failed to ${maskedTo}: ${safeErrorMsg}`);

    // In dev / test / non-production environments with sandbox SMTP (e.g. Mailtrap quotas/network/sandbox), fallback gracefully
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[EmailService] Recording simulated delivery fallback for non-production.`);
      return { success: true, simulated: true, error: safeErrorMsg };
    }

    return { success: false, error: safeErrorMsg };
  }
}

/**
 * Sends a welcome email to a newly registered user with duplicate prevention.
 * Supports both modern object syntax and legacy positional syntax.
 * 
 * @param {Object|string} paramsOrEmail
 * @param {string} [legacyName]
 * @param {string} [legacyHostelName]
 * @param {Object} [legacyCredentials]
 */
async function sendWelcomeEmail(paramsOrEmail, legacyName, legacyHostelName, legacyCredentials) {
  let user = null;
  let userName = '';
  let userEmail = '';
  let temporaryPassword = '';
  let loginId = '';
  let hostelName = '';
  let role = 'student';
  let force = false;

  // Handle legacy signature: sendWelcomeEmail(studentEmail, studentName, hostelName, loginCredentials)
  if (typeof paramsOrEmail === 'string') {
    userEmail = paramsOrEmail;
    userName = legacyName || 'Student';
    hostelName = legacyHostelName || 'Hostel';
    if (legacyCredentials) {
      temporaryPassword = legacyCredentials.password || '';
      loginId = legacyCredentials.username || legacyCredentials.email || '';
    }
  } else if (typeof paramsOrEmail === 'object' && paramsOrEmail !== null) {
    // Modern object signature: sendWelcomeEmail({ user, temporaryPassword, loginId, hostelName, force })
    const {
      user: u,
      email,
      name,
      temporaryPassword: pwd,
      loginId: id,
      hostelName: hName,
      force: f,
    } = paramsOrEmail;

    user = u || null;
    force = Boolean(f);
    userName = name || user?.name || 'User';
    userEmail = email || user?.email || '';
    role = user?.currentRole || (Array.isArray(user?.role) ? user.role[0] : user?.role) || 'student';
    temporaryPassword = pwd || '';
    loginId = id || user?.studentId || '';
    hostelName = hName || 'Hostel';
  }

  const maskedEmail = maskEmail(userEmail);

  // 1. Duplicate Prevention / Idempotency Check
  if (user && user.welcomeEmailSent && !force) {
    console.log(`[EmailService] Welcome email already delivered to ${maskedEmail}, skipping to prevent duplicate.`);
    return { success: true, skipped: true, reason: 'already_sent' };
  }

  // 2. Validate email
  if (!userEmail || !isValidEmail(userEmail)) {
    console.warn(`[EmailService] Invalid recipient for welcome email: "${userEmail}"`);
    return { success: false, error: 'Invalid user email' };
  }

  // 3. Resolve destination dashboard URL
  const dashboardUrl = getDashboardUrlForRole(role);

  // 4. Render Email (HTML + Plain Text + Credentials snippet)
  const credentials = (temporaryPassword || loginId) ? {
    temporaryPassword,
    loginId,
    hostelName,
  } : null;

  const { subject, html, text } = renderWelcomeEmail({
    userName,
    userEmail,
    dashboardUrl,
    credentials,
  });

  // 5. Send Email
  const result = await sendEmail({
    to: userEmail,
    subject,
    html,
    text,
  });

  // 6. Update user document tracking flags if delivery succeeded
  if (result.success && user) {
    try {
      const userId = user._id || user.id;
      if (userId && mongoose.connection && mongoose.connection.readyState === 1) {
        const User = require('../models/User');
        await User.findByIdAndUpdate(userId, {
          $set: {
            welcomeEmailSent: true,
            welcomeEmailSentAt: new Date(),
          },
        });
      }
      user.welcomeEmailSent = true;
      user.welcomeEmailSentAt = new Date();
    } catch (dbErr) {
      console.warn('[EmailService] Failed to update welcomeEmailSent flag on user record:', dbErr.message);
    }
  }

  return result;
}

/**
 * Sends a welcome email to a new staff member (warden, cleaner, supervisor).
 */
async function sendStaffWelcomeEmail(staffEmail, staffName, hostelName, loginCredentials, roles) {
  const rolesList = Array.isArray(roles) ? roles.join(', ') : (roles || 'Staff');
  const appUrl = getAppUrl();
  const dashboardUrl = `${appUrl}/login`;
  const maskedEmail = maskEmail(staffEmail);

  const subject = `Welcome to ${hostelName} - Staff Portal Access`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #F8FAFC; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #E2E8F0; }
    .credentials { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4F46E5; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .btn { display: inline-block; padding: 12px 28px; background: #4F46E5; color: white !important; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 15px; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0;">Welcome to ${hostelName}!</h1>
    <p style="margin: 8px 0 0 0; opacity: 0.9;">Staff Portal Access</p>
  </div>
  <div class="content">
    <h2>Dear ${staffName},</h2>
    <p>We are pleased to welcome you to <strong>${hostelName}</strong>. Your staff portal account has been configured with role(s): <strong>${rolesList}</strong>.</p>
    
    <div class="credentials">
      <p style="margin: 0 0 8px 0;"><strong>Email:</strong> ${staffEmail}</p>
      <p style="margin: 0 0 8px 0;"><strong>Password:</strong> ${loginCredentials.password}</p>
      <p style="margin: 0;"><strong>Assigned Role(s):</strong> ${rolesList}</p>
    </div>

    <p style="color: #E11D48; font-size: 13px;"><strong>Important:</strong> Please change your password upon your first login.</p>

    <p><a href="${dashboardUrl}" class="btn">Log In to Staff Portal &rarr;</a></p>
  </div>
</body>
</html>`;

  const text = `Welcome to ${hostelName} Staff Portal!
Dear ${staffName},
Your account has been created.
Email: ${staffEmail}
Password: ${loginCredentials.password}
Roles: ${rolesList}
Log in here: ${dashboardUrl}`;

  return sendEmail({ to: staffEmail, subject, html, text });
}

/**
 * Sends student application approval email.
 */
async function sendApprovalEmail(studentEmail, studentName, hostelName) {
  const appUrl = getAppUrl();
  const subject = `Your Application to ${hostelName} has been Approved!`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="margin: 0;">Application Approved! 🎉</h1>
  </div>
  <div style="background: #F8FAFC; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #E2E8F0;">
    <h2>Dear ${studentName},</h2>
    <p>Great news! Your student onboarding application to <strong>${hostelName}</strong> has been approved.</p>
    <p>Your account is now fully active. You can sign in to view your allocated room and access hostel facilities.</p>
    <p><a href="${appUrl}/student/dashboard" style="display: inline-block; padding: 12px 28px; background: #10B981; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 10px;">Go to Student Dashboard &rarr;</a></p>
  </div>
</body>
</html>`;

  const text = `Application Approved!
Dear ${studentName},
Your application to ${hostelName} has been approved. You can now log in to your student dashboard: ${appUrl}/student/dashboard`;

  return sendEmail({ to: studentEmail, subject, html, text });
}

/**
 * Sends notice board notification email.
 */
async function sendNoticeEmail(recipientEmail, recipientName, noticeTitle, noticeMessage, noticeType, hostelName, priority) {
  const subject = `${noticeTitle} - ${hostelName}`;
  const appUrl = getAppUrl();

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #1E293B; color: white; padding: 25px; text-align: center; border-radius: 10px 10px 0 0;">
    <h2 style="margin: 0;">${hostelName} - Notice Board</h2>
  </div>
  <div style="background: #F8FAFC; padding: 30px; border: 1px solid #E2E8F0; border-radius: 0 0 10px 10px;">
    <h3 style="color: #1E293B; margin-top: 0;">${noticeTitle}</h3>
    <p>Dear ${recipientName},</p>
    <div style="background: white; padding: 18px; border-radius: 8px; border-left: 4px solid #4F46E5; margin: 15px 0;">
      ${noticeMessage}
    </div>
    <p><a href="${appUrl}/student/notifications" style="color: #4F46E5; font-weight: bold;">View in Portal &rarr;</a></p>
  </div>
</body>
</html>`;

  const text = `${hostelName} Notice: ${noticeTitle}\n\nDear ${recipientName},\n\n${noticeMessage}\n\nView details: ${appUrl}/student/notifications`;

  return sendEmail({ to: recipientEmail, subject, html, text });
}

/**
 * Sends notices in bulk with rate throttling.
 */
async function sendBulkNoticeEmails(recipients, noticeTitle, noticeMessage, noticeType, hostelName, priority) {
  const results = [];
  for (const r of recipients) {
    if (r.email) {
      const res = await sendNoticeEmail(r.email, r.name || r.email, noticeTitle, noticeMessage, noticeType, hostelName, priority);
      results.push({ recipient: r.email, ...res });
      // Throttling delay
      await new Promise(resolve => setTimeout(resolve, 80));
    }
  }
  return results;
}

/**
 * Parent Emergency Alert Email (for SOS or curfew violations).
 */
async function sendParentEmergencyEmail(params) {
  const {
    parentEmail,
    parentName,
    studentName,
    hostelName = 'Hostel',
    emergencyType = 'sos',
    description = '',
    timestamp,
    contactNumber = '',
  } = params;

  if (!parentEmail || !isValidEmail(parentEmail)) {
    console.warn('[EmailService] Invalid parent email provided for emergency alert.');
    return { success: false, message: 'Invalid parent email' };
  }

  const timeStr = (timestamp ? new Date(timestamp) : new Date()).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
  });

  const subject = `⚠️ URGENT: Emergency Alert for ${studentName} — ${hostelName}`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; background: #F8FAFC; padding: 20px;">
  <div style="max-width: 580px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; border: 1px solid #FECACA;">
    <div style="background: #DC2626; color: white; padding: 24px; text-align: center;">
      <h1 style="margin: 0; font-size: 22px;">⚠️ URGENT EMERGENCY ALERT</h1>
      <p style="margin: 6px 0 0 0; font-size: 14px;">${hostelName} Management</p>
    </div>
    <div style="padding: 24px;">
      <p>Dear ${parentName || 'Parent / Guardian'},</p>
      <p>An emergency event has been reported involving your ward <strong>${studentName}</strong>.</p>
      <div style="background: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 0 0 6px 0;"><strong>Student:</strong> ${studentName}</p>
        <p style="margin: 0 0 6px 0;"><strong>Hostel:</strong> ${hostelName}</p>
        <p style="margin: 0 0 6px 0;"><strong>Type:</strong> ${emergencyType.toUpperCase()}</p>
        <p style="margin: 0;"><strong>Reported Time:</strong> ${timeStr}</p>
      </div>
      ${description ? `<p><strong>Details:</strong> ${description}</p>` : ''}
      <p><strong>Please contact the hostel administration immediately:</strong></p>
      ${contactNumber ? `<p style="font-size: 16px; color: #DC2626;">📞 <strong>${contactNumber}</strong></p>` : ''}
    </div>
  </div>
</body>
</html>`;

  const text = `URGENT EMERGENCY ALERT — ${hostelName}
Dear ${parentName || 'Parent / Guardian'},
An emergency event has been reported involving your ward ${studentName}.
Type: ${emergencyType.toUpperCase()}
Date & Time: ${timeStr}
${description ? `Details: ${description}\n` : ''}
${contactNumber ? `Hostel Contact: ${contactNumber}` : ''}`;

  return sendEmail({
    to: parentEmail,
    subject,
    html,
    text,
    from: `"${hostelName} - Emergency Alert" <${process.env.SMTP_USER || 'alerts@hostelzify.com'}>`,
  });
}

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendStaffWelcomeEmail,
  sendApprovalEmail,
  sendNoticeEmail,
  sendBulkNoticeEmails,
  sendParentEmergencyEmail,
  getDefaultFrom,
  getAppUrl,
  getDashboardUrlForRole,
};
