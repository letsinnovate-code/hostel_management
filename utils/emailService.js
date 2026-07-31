const nodemailer = require('nodemailer');

// Create transporter
const createTransporter = () => {
  const port = parseInt(process.env.SMTP_PORT || "465");
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.hostinger.com",
    port: port,
    secure: port === 465 || process.env.SMTP_SECURE === "true", // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

// Welcome email template
const getWelcomeEmailTemplate = (studentName, hostelName, loginCredentials) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to ${hostelName}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px;
          text-align: center;
          border-radius: 10px 10px 0 0;
        }
        .content {
          background: #f9f9f9;
          padding: 30px;
          border-radius: 0 0 10px 10px;
        }
        .credentials {
          background: white;
          padding: 20px;
          border-radius: 5px;
          margin: 20px 0;
          border-left: 4px solid #667eea;
        }
        .credentials-item {
          margin: 10px 0;
        }
        .credentials-label {
          font-weight: bold;
          color: #667eea;
        }
        .button {
          display: inline-block;
          padding: 12px 30px;
          background: #667eea;
          color: white;
          text-decoration: none;
          border-radius: 5px;
          margin: 20px 0;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          color: #666;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Welcome to ${hostelName}!</h1>
        <p>Your Hostel Management Portal</p>
      </div>
      <div class="content">
        <h2>Dear ${studentName},</h2>
        <p>We are delighted to welcome you to <strong>${hostelName}</strong>! Your onboarding has been completed successfully.</p>
        
        <p>Your account has been created and you can now access the hostel management system using the following credentials:</p>
        
        <div class="credentials">
          <div class="credentials-item">
            <span class="credentials-label">Email:</span> ${loginCredentials.email}
          </div>
          <div class="credentials-item">
            <span class="credentials-label">Password:</span> ${loginCredentials.password}
          </div>
        </div>
        
        <p><strong>Important:</strong> Please change your password after your first login for security purposes.</p>
        
        <p>You can now:</p>
        <ul>
          <li>Access your dashboard</li>
          <li>View your room details</li>
          <li>Check hostel announcements</li>
          <li>Submit complaints and requests</li>
          <li>View your attendance and payment history</li>
        </ul>
        
        <p>If you have any questions or need assistance, please don't hesitate to contact the hostel administration.</p>
        
        <p>Once again, welcome to ${hostelName}! We look forward to providing you with a comfortable and safe living environment.</p>
        
        <p>Best regards,<br>
        <strong>${hostelName} Administration Team</strong></p>
      </div>
      <div class="footer">
        <p>This is an automated email. Please do not reply to this message.</p>
        <p>&copy; ${new Date().getFullYear()} Hostel Management System</p>
      </div>
    </body>
    </html>
  `;
};

// Send welcome email
const sendWelcomeEmail = async (studentEmail, studentName, hostelName, loginCredentials) => {
  try {
    // Check if email is configured
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('Email service not configured. Skipping welcome email.');
      return { success: false, message: 'Email service not configured' };
    }

    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"${hostelName}" <${process.env.SMTP_USER}>`,
      to: studentEmail,
      subject: `Welcome to ${hostelName}! - Your Account Details`,
      html: getWelcomeEmailTemplate(studentName, hostelName, loginCredentials),
      text: `
        Welcome to ${hostelName}!
        
        Dear ${studentName},
        
        We are delighted to welcome you to ${hostelName}! Your onboarding has been completed successfully.
        
        Your account credentials:
        Email: ${loginCredentials.email}
        Password: ${loginCredentials.password}
        
        Please change your password after your first login.
        
        Best regards,
        ${hostelName} Administration Team
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Welcome email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return { success: false, error: error.message };
  }
};

// Staff welcome email template
const getStaffWelcomeEmailTemplate = (staffName, hostelName, loginCredentials, roles) => {
  const rolesList = Array.isArray(roles) ? roles.join(', ') : roles;
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to ${hostelName} Staff Portal</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px;
          text-align: center;
          border-radius: 10px 10px 0 0;
        }
        .content {
          background: #f9f9f9;
          padding: 30px;
          border-radius: 0 0 10px 10px;
        }
        .credentials {
          background: white;
          padding: 20px;
          border-radius: 5px;
          margin: 20px 0;
          border-left: 4px solid #667eea;
        }
        .credentials-item {
          margin: 10px 0;
        }
        .credentials-label {
          font-weight: bold;
          color: #667eea;
        }
        .roles-badge {
          display: inline-block;
          padding: 4px 12px;
          margin: 4px;
          background: #667eea;
          color: white;
          border-radius: 15px;
          font-size: 12px;
          font-weight: bold;
        }
        .button {
          display: inline-block;
          padding: 12px 30px;
          background: #667eea;
          color: white;
          text-decoration: none;
          border-radius: 5px;
          margin: 20px 0;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          color: #666;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Welcome to ${hostelName}!</h1>
        <p>Staff Portal Access</p>
      </div>
      <div class="content">
        <h2>Dear ${staffName},</h2>
        <p>We are delighted to welcome you as a staff member at <strong>${hostelName}</strong>! Your account has been created successfully.</p>
        
        <p>Your account credentials:</p>
        
        <div class="credentials">
          <div class="credentials-item">
            <span class="credentials-label">Email:</span> ${loginCredentials.email}
          </div>
          <div class="credentials-item">
            <span class="credentials-label">Password:</span> ${loginCredentials.password}
          </div>
          <div class="credentials-item">
            <span class="credentials-label">Assigned Roles:</span>
            <div style="margin-top: 8px;">
              ${Array.isArray(roles) ? roles.map(role => `<span class="roles-badge">${role.charAt(0).toUpperCase() + role.slice(1)}</span>`).join('') : `<span class="roles-badge">${roles}</span>`}
            </div>
          </div>
        </div>
        
        <p><strong>Important:</strong> Please change your password after your first login for security purposes.</p>
        
        <p>You can now access the hostel management system and perform your assigned duties.</p>
        
        <p>If you have any questions or need assistance, please don't hesitate to contact the administration.</p>
        
        <p>Best regards,<br>
        <strong>${hostelName} Administration Team</strong></p>
      </div>
      <div class="footer">
        <p>This is an automated email. Please do not reply to this message.</p>
        <p>&copy; ${new Date().getFullYear()} Hostel Management System</p>
      </div>
    </body>
    </html>
  `;
};

// Send staff welcome email
const sendStaffWelcomeEmail = async (staffEmail, staffName, hostelName, loginCredentials, roles) => {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('Email service not configured. Skipping staff welcome email.');
      return { success: false, message: 'Email service not configured' };
    }

    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"${hostelName}" <${process.env.SMTP_USER}>`,
      to: staffEmail,
      subject: `Welcome to ${hostelName} - Staff Portal Access`,
      html: getStaffWelcomeEmailTemplate(staffName, hostelName, loginCredentials, roles),
      text: `
        Welcome to ${hostelName}!
        
        Dear ${staffName},
        
        We are delighted to welcome you as a staff member at ${hostelName}! Your account has been created successfully.
        
        Your account credentials:
        Email: ${loginCredentials.email}
        Password: ${loginCredentials.password}
        Roles: ${Array.isArray(roles) ? roles.join(', ') : roles}
        
        Please change your password after your first login.
        
        Best regards,
        ${hostelName} Administration Team
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Staff welcome email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending staff welcome email:', error);
    return { success: false, error: error.message };
  }
};

// Send approval notification email
const sendApprovalEmail = async (studentEmail, studentName, hostelName) => {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('Email service not configured. Skipping approval email.');
      return { success: false, message: 'Email service not configured' };
    }

    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"${hostelName}" <${process.env.SMTP_USER}>`,
      to: studentEmail,
      subject: `Your Application to ${hostelName} has been Approved!`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Application Approved!</h1>
          </div>
          <div class="content">
            <h2>Dear ${studentName},</h2>
            <p>Great news! Your application to <strong>${hostelName}</strong> has been approved.</p>
            <p>Your account is now active and you can log in to access all hostel services.</p>
            <p>If you have any questions, please contact the hostel administration.</p>
            <p>Best regards,<br><strong>${hostelName} Administration Team</strong></p>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Approval email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending approval email:', error);
    return { success: false, error: error.message };
  }
};

// Notice board email template
const getNoticeEmailTemplate = (recipientName, noticeTitle, noticeMessage, noticeType, hostelName, priority) => {
  const priorityColors = {
    urgent: '#dc2626',
    high: '#ea580c',
    medium: '#f59e0b',
    low: '#3b82f6',
  };
  
  const typeLabels = {
    announcement: 'Announcement',
    alert: 'Alert',
    reminder: 'Reminder',
    emergency: 'Emergency',
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${noticeTitle} - ${hostelName}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .container {
          background: white;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px;
          text-align: center;
        }
        .priority-badge {
          display: inline-block;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: bold;
          text-transform: uppercase;
          margin-bottom: 10px;
          background-color: ${priorityColors[priority] || priorityColors.medium};
          color: white;
        }
        .type-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 15px;
          font-size: 11px;
          background-color: rgba(255,255,255,0.2);
          margin-left: 10px;
        }
        .content {
          padding: 30px;
        }
        .notice-title {
          font-size: 24px;
          font-weight: bold;
          color: #333;
          margin-bottom: 15px;
        }
        .notice-message {
          font-size: 16px;
          color: #555;
          line-height: 1.8;
          white-space: pre-wrap;
          margin: 20px 0;
        }
        .footer {
          background: #f9f9f9;
          padding: 20px;
          text-align: center;
          color: #666;
          font-size: 12px;
          border-top: 1px solid #eee;
        }
        .button {
          display: inline-block;
          padding: 12px 30px;
          background: #667eea;
          color: white;
          text-decoration: none;
          border-radius: 5px;
          margin: 20px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <span class="priority-badge">${priority || 'medium'}</span>
          <span class="type-badge">${typeLabels[noticeType] || 'Notice'}</span>
          <h1 style="margin: 15px 0 0 0;">${hostelName}</h1>
        </div>
        <div class="content">
          <h2 class="notice-title">${noticeTitle}</h2>
          <p>Dear ${recipientName},</p>
          <div class="notice-message">${noticeMessage}</div>
          <p style="margin-top: 30px;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/student/notifications" class="button">
              View in Portal
            </a>
          </p>
          <p style="margin-top: 20px; color: #666; font-size: 14px;">
            This is an automated notification from ${hostelName}. Please log in to your portal for more details.
          </p>
        </div>
        <div class="footer">
          <p>This is an automated email. Please do not reply to this message.</p>
          <p>&copy; ${new Date().getFullYear()} ${hostelName} - Hostel Management System</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Send notice board email
const sendNoticeEmail = async (recipientEmail, recipientName, noticeTitle, noticeMessage, noticeType, hostelName, priority) => {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('Email service not configured. Skipping notice email.');
      return { success: false, message: 'Email service not configured' };
    }

    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"${hostelName}" <${process.env.SMTP_USER}>`,
      to: recipientEmail,
      subject: `${noticeTitle} - ${hostelName}`,
      html: getNoticeEmailTemplate(recipientName, noticeTitle, noticeMessage, noticeType, hostelName, priority),
      text: `
        ${hostelName} - ${noticeTitle}
        
        Dear ${recipientName},
        
        ${noticeMessage}
        
        This is a ${priority || 'medium'} priority ${noticeType || 'announcement'}.
        
        Please log in to your portal for more details.
        
        Best regards,
        ${hostelName} Administration Team
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Notice email sent to ${recipientEmail}:`, info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`Error sending notice email to ${recipientEmail}:`, error);
    return { success: false, error: error.message };
  }
};

// Send bulk notice emails
const sendBulkNoticeEmails = async (recipients, noticeTitle, noticeMessage, noticeType, hostelName, priority) => {
  const results = [];
  for (const recipient of recipients) {
    if (recipient.email) {
      const result = await sendNoticeEmail(
        recipient.email,
        recipient.name || recipient.email,
        noticeTitle,
        noticeMessage,
        noticeType,
        hostelName,
        priority
      );
      results.push({ recipient: recipient.email, ...result });
      // Add small delay to avoid overwhelming email server
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  return results;
};

module.exports = {
  sendWelcomeEmail,
  sendStaffWelcomeEmail,
  sendApprovalEmail,
  sendNoticeEmail,
  sendBulkNoticeEmails,
};

