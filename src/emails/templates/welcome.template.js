/**
 * @file welcome.template.js
 * @description Professional, modern, responsive HTML and plain-text welcome email templates.
 * Engineered for cross-client compatibility (Gmail, Outlook, Apple Mail, iOS, Android, Desktop).
 */

'use strict';

const { compileTemplate } = require('../../utils/emailSanitizer');

/**
 * Generates the responsive HTML email template for welcoming new users.
 * 
 * @returns {string} Raw HTML template with {{placeholders}}
 */
function getWelcomeHtmlTemplate() {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <title>Welcome to {{appName}}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    /* Reset & Client-Specific Styles */
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      height: 100% !important;
      width: 100% !important;
      background-color: #0F172A;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    table, td {
      border-collapse: collapse !important;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
      -ms-interpolation-mode: bicubic;
    }
    a {
      text-decoration: none;
      color: #6366F1;
    }
    /* Mobile Responsive Styles */
    @media screen and (max-width: 600px) {
      .email-container {
        width: 100% !important;
        max-width: 100% !important;
        margin: auto !important;
      }
      .mobile-padding {
        padding-left: 20px !important;
        padding-right: 20px !important;
      }
      .mobile-title {
        font-size: 26px !important;
        line-height: 32px !important;
      }
      .mobile-btn {
        display: block !important;
        width: 100% !important;
        text-align: center !important;
        box-sizing: border-box !important;
      }
      .feature-col {
        display: block !important;
        width: 100% !important;
        padding-right: 0 !important;
        padding-bottom: 12px !important;
      }
    }
    /* Dark Mode Meta Support */
    @media (prefers-color-scheme: dark) {
      .dark-bg { background-color: #0F172A !important; }
      .dark-card { background-color: #1E293B !important; }
      .dark-text-primary { color: #F8FAFC !important; }
      .dark-text-secondary { color: #94A3B8 !important; }
    }
  </style>
</head>
<body width="100%" style="margin: 0; padding: 0 !important; mso-line-height-rule: exactly; background-color: #0F172A;">
  <center style="width: 100%; background-color: #0F172A;">
    <!-- Preheader preview text (hidden from view, visible in inbox list) -->
    <div style="display: none; font-size: 1px; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all; font-family: sans-serif;">
      Welcome to {{appName}}! Your account has been created successfully. Explore your dashboard, room details, and campus updates.
      &#847; &zwnj; &nbsp; &#8199; &shy; &#847; &zwnj; &nbsp; &#8199; &shy;
    </div>

    <!-- Main Wrapper Table -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #0F172A;">
      <tr>
        <td align="center" style="padding: 40px 15px 40px 15px;">
          
          <!-- Outer Container (Max 600px) -->
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="email-container" style="max-width: 600px; width: 100%; background-color: #1E293B; border-radius: 16px; overflow: hidden; border: 1px solid #334155; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);">
            
            <!-- HEADER / BRAND BANNER -->
            <tr>
              <td style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #2563EB 100%); padding: 40px 40px 35px 40px; text-align: center;" class="mobile-padding">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                  <tr>
                    <td align="center">
                      <!-- Brand Logo / Badge -->
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td style="background-color: rgba(255, 255, 255, 0.2); border-radius: 14px; padding: 12px 20px; border: 1px solid rgba(255, 255, 255, 0.3);">
                            <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 22px; font-weight: 800; color: #FFFFFF; letter-spacing: 0.5px; text-shadow: 0 2px 4px rgba(0,0,0,0.15);">
                              ✨ {{appName}}
                            </span>
                          </td>
                        </tr>
                      </table>
                      <h1 class="mobile-title" style="margin: 24px 0 8px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 30px; line-height: 38px; color: #FFFFFF; font-weight: 800; letter-spacing: -0.5px;">
                        Welcome aboard, {{userName}}!
                      </h1>
                      <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; line-height: 24px; color: #E0E7FF; font-weight: 400;">
                        Your modern portal for hassle-free hostel living and management.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- MAIN BODY CONTENT -->
            <tr>
              <td style="padding: 40px 40px 30px 40px; background-color: #1E293B;" class="mobile-padding">
                
                <!-- Welcome Greeting -->
                <p style="margin: 0 0 18px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; line-height: 26px; color: #E2E8F0;">
                  Hi <strong style="color: #FFFFFF;">{{userName}}</strong>,
                </p>
                <p style="margin: 0 0 24px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; line-height: 25px; color: #94A3B8;">
                  We are excited to welcome you to <strong style="color: #CBD5E1;">{{appName}}</strong>! Your account has been verified and registered under <strong style="color: #818CF8;">{{userEmail}}</strong>. You now have full access to your personalized portal designed to make everyday accommodation management effortless, transparent, and secure.
                </p>

                <!-- OPTIONAL CREDENTIALS BOX (Rendered only if credentials provided) -->
                {{credentialsSection}}

                <!-- FEATURES HIGHLIGHT CARD -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 28px 0; background-color: #0F172A; border-radius: 12px; border: 1px solid #334155; overflow: hidden;">
                  <tr>
                    <td style="padding: 24px;">
                      <p style="margin: 0 0 16px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; font-weight: 700; color: #818CF8; text-transform: uppercase; letter-spacing: 1px;">
                        What you can do now
                      </p>
                      
                      <!-- Feature 1 & 2 Row -->
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                        <tr>
                          <td width="50%" valign="top" class="feature-col" style="padding-right: 12px; padding-bottom: 14px;">
                            <div style="font-size: 14px; font-weight: 600; color: #F1F5F9; margin-bottom: 4px;">
                              🛏️ Room &amp; Bed Details
                            </div>
                            <div style="font-size: 13px; line-height: 18px; color: #64748B;">
                              View allocated rooms, amenities, and roommate information anytime.
                            </div>
                          </td>
                          <td width="50%" valign="top" class="feature-col" style="padding-bottom: 14px;">
                            <div style="font-size: 14px; font-weight: 600; color: #F1F5F9; margin-bottom: 4px;">
                              💳 Instant Digital Payments
                            </div>
                            <div style="font-size: 13px; line-height: 18px; color: #64748B;">
                              Pay hostel dues seamlessly with automated receipts and status tracking.
                            </div>
                          </td>
                        </tr>
                        <tr>
                          <td width="50%" valign="top" class="feature-col" style="padding-right: 12px;">
                            <div style="font-size: 14px; font-weight: 600; color: #F1F5F9; margin-bottom: 4px;">
                              📢 Smart Notice Board
                            </div>
                            <div style="font-size: 13px; line-height: 18px; color: #64748B;">
                              Stay informed with real-time hostel announcements and maintenance alerts.
                            </div>
                          </td>
                          <td width="50%" valign="top" class="feature-col">
                            <div style="font-size: 14px; font-weight: 600; color: #F1F5F9; margin-bottom: 4px;">
                              🛡️ Safety &amp; Emergency SOS
                            </div>
                            <div style="font-size: 13px; line-height: 18px; color: #64748B;">
                              24/7 student safety assistance, digital permissions, and attendance logs.
                            </div>
                          </td>
                        </tr>
                      </table>

                    </td>
                  </tr>
                </table>

                <!-- CALL TO ACTION BUTTON -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 32px 0 28px 0;">
                  <tr>
                    <td align="center">
                      <!-- Bulletproof Button (Outlook MSO + Modern HTML) -->
                      <!--[if mso]>
                      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{{dashboardUrl}}" style="height:52px;v-text-anchor:middle;width:260px;" arcsize="20%" strokecolor="#4F46E5" fillcolor="#4F46E5">
                        <w:anchorlock/>
                        <center style="color:#FFFFFF;font-family:sans-serif;font-size:16px;font-weight:bold;">
                          Go to Dashboard &rarr;
                        </center>
                      </v:roundrect>
                      <![endif]-->
                      <!--[if !mso]><!-- -->
                      <a href="{{dashboardUrl}}" class="mobile-btn" style="background: linear-gradient(135deg, #4F46E5 0%, #6366F1 100%); color: #FFFFFF; display: inline-block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; font-weight: 700; line-height: 52px; text-align: center; text-decoration: none; width: 260px; border-radius: 10px; box-shadow: 0 4px 14px 0 rgba(79, 70, 229, 0.45); letter-spacing: 0.3px;">
                        Go to Dashboard &rarr;
                      </a>
                      <!--<![endif]-->
                    </td>
                  </tr>
                </table>

                <!-- Direct link fallback -->
                <p style="margin: 0 0 24px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; line-height: 18px; color: #64748B; text-align: center;">
                  Button not working? Copy and paste this URL into your browser:<br>
                  <a href="{{dashboardUrl}}" style="color: #818CF8; word-break: break-all;">{{dashboardUrl}}</a>
                </p>

                <!-- DIVIDER -->
                <div style="border-top: 1px solid #334155; margin: 30px 0 24px 0;"></div>

                <!-- SUPPORT & CONTACT INFO -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                  <tr>
                    <td>
                      <p style="margin: 0 0 6px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 600; color: #E2E8F0;">
                        Need assistance getting started?
                      </p>
                      <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; line-height: 20px; color: #94A3B8;">
                        Our support team is always here for you. Simply write to us at <a href="mailto:{{supportEmail}}" style="color: #818CF8; font-weight: 500;">{{supportEmail}}</a> or visit our portal at <a href="{{appUrl}}" style="color: #818CF8; font-weight: 500;">{{appUrl}}</a>.
                      </p>
                    </td>
                  </tr>
                </table>

              </td>
            </tr>

            <!-- FOOTER -->
            <tr>
              <td style="padding: 30px 40px; background-color: #0F172A; text-align: center; border-top: 1px solid #334155;" class="mobile-padding">
                <p style="margin: 0 0 8px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; line-height: 18px; color: #64748B;">
                  This is an automated transactional notification regarding your account on <strong>{{appName}}</strong>.
                </p>
                <p style="margin: 0 0 12px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; line-height: 18px; color: #64748B;">
                  &copy; {{year}} {{appName}}. All rights reserved. | <a href="{{appUrl}}" style="color: #64748B; text-decoration: underline;">Portal</a> | <a href="mailto:{{supportEmail}}" style="color: #64748B; text-decoration: underline;">Support</a>
                </p>
                <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; line-height: 16px; color: #475569;">
                  You received this email because an account was registered with your address. If you did not create this account, please notify <a href="mailto:{{supportEmail}}" style="color: #64748B;">{{supportEmail}}</a> immediately.
                </p>
              </td>
            </tr>

          </table>
          <!-- End Outer Container -->

        </td>
      </tr>
    </table>
    <!-- End Main Wrapper -->
  </center>
</body>
</html>`;
}

/**
 * Generates the HTML fragment for temporary credentials if needed (e.g. for student QR registration or bulk upload).
 * 
 * @param {Object} creds
 * @param {string} creds.loginId
 * @param {string} creds.temporaryPassword
 * @param {string} [creds.hostelName]
 * @returns {string} Safe HTML fragment
 */
function getCredentialsHtmlSnippet(creds) {
  if (!creds || (!creds.temporaryPassword && !creds.loginId)) {
    return '';
  }

  const loginRow = creds.loginId ? `
    <tr style="border-bottom: 1px solid #334155;">
      <td style="padding: 10px 0; font-family: sans-serif; font-size: 13px; color: #94A3B8; font-weight: 600; width: 140px;">
        Username / ID:
      </td>
      <td style="padding: 10px 0; font-family: 'Courier New', Courier, monospace; font-size: 14px; color: #F8FAFC; font-weight: bold;">
        ${creds.loginId}
      </td>
    </tr>` : '';

  const passwordRow = creds.temporaryPassword ? `
    <tr>
      <td style="padding: 10px 0; font-family: sans-serif; font-size: 13px; color: #94A3B8; font-weight: 600; width: 140px;">
        Temporary Password:
      </td>
      <td style="padding: 10px 0; font-family: 'Courier New', Courier, monospace; font-size: 14px; color: #38BDF8; font-weight: bold; letter-spacing: 1px;">
        ${creds.temporaryPassword}
      </td>
    </tr>` : '';

  return `
    <!-- Temporary Credentials Card -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 20px 0; background-color: #0F172A; border-radius: 10px; border-left: 4px solid #38BDF8; border-top: 1px solid #334155; border-right: 1px solid #334155; border-bottom: 1px solid #334155; padding: 18px 20px;">
      <tr>
        <td>
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; font-weight: 700; color: #38BDF8; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
            🔐 Your Initial Account Credentials
          </div>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            ${loginRow}
            ${passwordRow}
          </table>
          <p style="margin: 12px 0 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; line-height: 18px; color: #F59E0B; font-weight: 500;">
            ⚠️ <strong>Security Note:</strong> Please sign in and change your password immediately in your account settings.
          </p>
        </td>
      </tr>
    </table>`;
}

/**
 * Generates the clean plain-text fallback for the welcome email.
 * 
 * @param {Object} variables
 * @param {Object} [creds]
 * @returns {string} Plain-text version
 */
function getWelcomePlainText(variables, creds = null) {
  const {
    userName = 'User',
    appName = 'Hostelzify',
    appUrl = 'http://localhost:3000',
    dashboardUrl = 'http://localhost:3000/login',
    supportEmail = 'support@hostelzify.com',
    year = new Date().getFullYear(),
  } = variables;

  let credentialsText = '';
  if (creds && (creds.temporaryPassword || creds.loginId)) {
    credentialsText = `
ACCOUNT CREDENTIALS:
${creds.loginId ? `Username / ID     : ${creds.loginId}\n` : ''}${creds.temporaryPassword ? `Temporary Password: ${creds.temporaryPassword}\n` : ''}
* IMPORTANT: Please change your password immediately after your first login.
`;
  }

  return `===========================================================
WELCOME TO ${appName.toUpperCase()}!
===========================================================

Hi ${userName},

We are delighted to welcome you to ${appName}! Your account has been successfully created.

You can now access your personalized portal to manage:
- Your allocated room, bed, and hostel amenities
- Instant digital fee payments, invoices, and payment history
- Real-time digital notice board announcements and circulars
- 24/7 security assistance, emergency SOS, and leave permissions
${credentialsText}
GET STARTED:
Log in to your dashboard here:
${dashboardUrl}

NEED HELP?
If you have questions or need assistance, contact our support team:
Email: ${supportEmail}
Website: ${appUrl}

-----------------------------------------------------------
This is an automated transactional email regarding your account.
© ${year} ${appName}. All rights reserved.
===========================================================`;
}

/**
 * Compiles the full welcome email (both HTML and Plain Text) with all variables and credentials.
 * 
 * @param {Object} data
 * @param {string} data.userName
 * @param {string} data.userEmail
 * @param {string} [data.appName]
 * @param {string} [data.appUrl]
 * @param {string} [data.dashboardUrl]
 * @param {string} [data.supportEmail]
 * @param {number} [data.year]
 * @param {Object} [data.credentials] - Optional { temporaryPassword, loginId, hostelName }
 * @returns {{ html: string, text: string, subject: string }}
 */
function renderWelcomeEmail(data) {
  const defaults = {
    appName: process.env.EMAIL_FROM_NAME || 'Hostelzify',
    appUrl: process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:3000',
    supportEmail: process.env.SUPPORT_EMAIL || 'support@hostelzify.com',
    year: new Date().getFullYear(),
    dashboardUrl: `${process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:3000'}/login`,
  };

  const variables = {
    ...defaults,
    ...data,
  };

  // Build credentials snippet if provided
  let credentialsSection = '';
  if (data.credentials && (data.credentials.temporaryPassword || data.credentials.loginId)) {
    credentialsSection = getCredentialsHtmlSnippet(data.credentials);
  }

  // Pre-insert credentials HTML into template
  const rawHtml = getWelcomeHtmlTemplate().replace('{{credentialsSection}}', credentialsSection);

  // Safely interpolate all remaining variables with XSS escaping and URL sanitization
  const html = compileTemplate(rawHtml, variables, {
    isHtml: true,
    urlFields: ['appUrl', 'dashboardUrl', 'unsubscribeUrl'],
  });

  const text = getWelcomePlainText(variables, data.credentials);
  const subject = `Welcome to ${variables.appName}, ${variables.userName}! 🎉`;

  return {
    subject,
    html,
    text,
  };
}

module.exports = {
  renderWelcomeEmail,
  getWelcomeHtmlTemplate,
  getWelcomePlainText,
};
