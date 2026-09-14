/**
 * @file controllers/owner/ownerNotificationController.js
 * @description Owner broadcast, notification, and template controller.
 */

'use strict';

const mongoose = require('mongoose');
const Notification = require('../../models/Notification');
const Template = require('../../models/Template');
const User = require('../../models/User');
const Hostel = require('../../models/Hostel');
const { assertOwnsHostel, getOwnerHostelIds, getScopedHostelIds } = require('./ownerHelper');
const { sendNoticeEmail, sendBulkNoticeEmails } = require('../../services/email.service');
const { emitToUser, emitToRole } = require('../../modules/alert/socket/alertSocket');
const notificationService = require('../../utils/notificationService');
const { sendPushNotifications, sendExpoPushNotifications, isExpoPushToken } = require('../../utils/notificationService');

exports.sendNotification = async (req, res) => {
  try {
    const { title, message, type, targetAudience, recipients, priority, expiresAt, sendEmail } = req.body;
    const hostelId = req.body.hostelId;

    await assertOwnsHostel(req, hostelId);
    // Get hostel info
    const hostel = await Hostel.findById(hostelId);
    if (!hostel) {
      return res.status(404).json({ success: false, message: 'Hostel not found' });
    }

    // Map UI targetAudience to DB role (e.g. "students" -> "student")
    const audienceToRole = {
      students: 'student',
      student: 'student',
      wardens: 'warden',
      warden: 'warden',
      staff: { $in: ['cleaner', 'supervisor', 'security'] },
      cleaners: 'cleaner',
    };
    const roleFilter = targetAudience ? (audienceToRole[targetAudience] || targetAudience) : null;

    // Get recipients
    let notificationRecipients = [];
    let emailRecipients = [];

    if (targetAudience === 'all') {
      const users = await User.find({ hostelId }).select('_id name email');
      notificationRecipients = users.map(u => u._id);
      emailRecipients = users.filter(u => u.email).map(u => ({ email: u.email, name: u.name }));
    } else if (roleFilter) {
      const roleQuery = typeof roleFilter === 'object' ? { role: roleFilter } : { role: roleFilter };
      const users = await User.find({ hostelId, ...roleQuery }).select('_id name email');
      notificationRecipients = users.map(u => u._id);
      emailRecipients = users.filter(u => u.email).map(u => ({ email: u.email, name: u.name }));
    } else if (recipients && recipients.length > 0) {
      notificationRecipients = recipients;
      const users = await User.find({ _id: { $in: recipients } }).select('_id name email');
      emailRecipients = users.filter(u => u.email).map(u => ({ email: u.email, name: u.name }));
    }

    // Create notification
    const notification = await Notification.create({
      title,
      message,
      type: type || 'announcement',
      targetAudience: targetAudience || 'all',
      recipients: notificationRecipients,
      createdBy: req.user.id,
      priority: priority || 'medium',
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      hostelId,
    });

    // Send emails if requested
    let emailResults = [];
    if (sendEmail && emailRecipients.length > 0) {
      try {
        emailResults = await sendBulkNoticeEmails(
          emailRecipients,
          title,
          message,
          type || 'announcement',
          hostel.name,
          priority || 'medium'
        );
      } catch (emailError) {
        console.error('Error sending notice emails:', emailError);
        // Don't fail the request if email fails
      }
    }

    // Send mobile push notifications to target audience (recipients with push tokens)
    let pushSent = 0;
    console.log('[Notice] Created notification', notification._id, 'targetAudience:', targetAudience, 'recipientCount:', notificationRecipients.length);
    if (notificationRecipients.length > 0) {
      try {
        const usersWithTokens = await User.find({
          _id: { $in: notificationRecipients },
          $or: [
            { pushToken: { $exists: true, $ne: null, $ne: '' } },
            { expoPushToken: { $exists: true, $ne: null, $ne: '' } },
          ],
        }).select('_id pushToken expoPushToken').lean();

        console.log('[Notice] Push: recipients with tokens:', usersWithTokens.length, 'of', notificationRecipients.length);

        const expoNotifications = [];
        const fcmNotifications = [];
        const body = (message || '').length > 120 ? (message || '').slice(0, 117) + '...' : (message || '');
        const payload = {
          title: title || 'Notice',
          body,
          data: { type: 'announcement', notificationId: notification._id.toString(), screen: 'notifications' },
        };

        usersWithTokens.forEach((u) => {
          const hasFcm = u.pushToken && !isExpoPushToken(u.pushToken);
          const hasExpo = u.expoPushToken && isExpoPushToken(u.expoPushToken);
          if (hasFcm) {
            fcmNotifications.push({ ...payload, to: u.pushToken });
          } else if (hasExpo) {
            expoNotifications.push({ ...payload, to: u.expoPushToken });
          }
        });

        if (expoNotifications.length > 0) {
          console.log('[Notice] Sending Expo push to', expoNotifications.length, 'device(s)');
          await sendExpoPushNotifications(expoNotifications);
          pushSent += expoNotifications.length;
          console.log('[Notice] Expo push sent:', expoNotifications.length);
        }
        if (fcmNotifications.length > 0) {
          console.log('[Notice] Sending FCM push to', fcmNotifications.length, 'device(s)');
          const fcmResults = await sendPushNotifications(fcmNotifications);
          pushSent += fcmNotifications.length;
          console.log('[Notice] FCM push sent:', fcmNotifications.length, 'results:', fcmResults?.length);
          const invalidTokens = Array.isArray(fcmResults) && fcmResults.invalidTokens?.length ? fcmResults.invalidTokens : [];
          if (invalidTokens.length > 0) {
            await User.updateMany(
              { pushToken: { $in: invalidTokens } },
              { $unset: { pushToken: 1 } }
            );
            console.log('[Notice] Removed', invalidTokens.length, 'invalid FCM token(s) from User records');
          }
        }
        if (pushSent === 0 && usersWithTokens.length > 0) {
          console.warn('[Notice] No push sent: tokens may be invalid (Expo/FCM format check failed for', usersWithTokens.length, 'users)');
        }
      } catch (pushError) {
        console.error('[Notice] Error sending push notifications:', pushError.message || pushError);
        // Don't fail the request if push fails
      }
    } else {
      console.log('[Notice] No recipients for targetAudience:', targetAudience, '(check audienceToRole mapping or hostel has no users for this role)');
    }

    res.status(201).json({
      success: true,
      data: notification,
      emailSent: sendEmail,
      emailsSent: emailResults.filter(r => r.success).length,
      emailsFailed: emailResults.filter(r => !r.success).length,
      pushSent,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Get Notifications

exports.getNotifications = async (req, res) => {
  try {
    const { hostelId } = req.params;
    await assertOwnsHostel(req, hostelId);
    const { type, priority, targetAudience, page = 1, limit = 50 } = req.query;

    const query = { hostelId };
    if (type) query.type = type;
    if (priority) query.priority = priority;
    if (targetAudience) query.targetAudience = targetAudience;

    // Check for expired notices
    query.$or = [
      { expiresAt: { $exists: false } },
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } },
    ];

    const notifications = await Notification.find(query)
      .populate('createdBy', 'name email')
      .populate('recipients', 'name email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Notification.countDocuments(query);

    res.status(200).json({
      success: true,
      data: notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Get Single Notification

exports.getNotification = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('recipients', 'name email')
      .populate('hostelId', 'name');

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    if (notification.hostelId) {
      const hId = notification.hostelId?._id || notification.hostelId;
      await assertOwnsHostel(req, hId);
    }

    res.status(200).json({ success: true, data: notification });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Resend push notification (reminder) for an existing notice — same audience and payload as create

exports.sendNotificationReminder = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id).lean();
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    if (notification.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to send reminder for this notification' });
    }
    if (notification.hostelId) {
      await assertOwnsHostel(req, notification.hostelId);
    }

    const hostelId = notification.hostelId?.toString ? notification.hostelId.toString() : notification.hostelId;
    const targetAudience = notification.targetAudience || 'all';
    const title = notification.title || 'Notice';
    const message = notification.message || '';

    const audienceToRole = {
      students: 'student',
      student: 'student',
      wardens: 'warden',
      warden: 'warden',
      staff: { $in: ['cleaner', 'supervisor', 'security'] },
      cleaners: 'cleaner',
    };
    const roleFilter = targetAudience ? (audienceToRole[targetAudience] || targetAudience) : null;

    let notificationRecipients = [];
    if (targetAudience === 'all') {
      const users = await User.find({ hostelId }).select('_id').lean();
      notificationRecipients = users.map(u => u._id);
    } else if (roleFilter) {
      const roleQuery = typeof roleFilter === 'object' ? { role: roleFilter } : { role: roleFilter };
      const users = await User.find({ hostelId, ...roleQuery }).select('_id').lean();
      notificationRecipients = users.map(u => u._id);
    } else if (notification.recipients && notification.recipients.length > 0) {
      notificationRecipients = notification.recipients.map(r => (r && r._id ? r._id : r));
    }

    let pushSent = 0;
    if (notificationRecipients.length === 0) {
      return res.status(200).json({ success: true, pushSent: 0, message: 'No recipients for this notice' });
    }

    const {
      sendPushNotifications,
      sendExpoPushNotifications,
      isExpoPushToken,
    } = require('../../utils/notificationService');

    const usersWithTokens = await User.find({
      _id: { $in: notificationRecipients },
      $or: [
        { pushToken: { $exists: true, $ne: null, $ne: '' } },
        { expoPushToken: { $exists: true, $ne: null, $ne: '' } },
      ],
    }).select('pushToken expoPushToken').lean();

    const body = (message || '').length > 120 ? (message || '').slice(0, 117) + '...' : (message || '');
    const payload = {
      title,
      body,
      data: { type: 'announcement', notificationId: notification._id.toString(), screen: 'notifications' },
    };

    const expoNotifications = [];
    const fcmNotifications = [];
    usersWithTokens.forEach((u) => {
      const hasFcm = u.pushToken && !isExpoPushToken(u.pushToken);
      const hasExpo = u.expoPushToken && isExpoPushToken(u.expoPushToken);
      if (hasFcm) fcmNotifications.push({ ...payload, to: u.pushToken });
      else if (hasExpo) expoNotifications.push({ ...payload, to: u.expoPushToken });
    });

    if (expoNotifications.length > 0) {
      await sendExpoPushNotifications(expoNotifications);
      pushSent += expoNotifications.length;
    }
    if (fcmNotifications.length > 0) {
      const fcmResults = await sendPushNotifications(fcmNotifications);
      pushSent += fcmNotifications.length;
      const invalidTokens = Array.isArray(fcmResults) && fcmResults.invalidTokens?.length ? fcmResults.invalidTokens : [];
      if (invalidTokens.length > 0) {
        await User.updateMany(
          { pushToken: { $in: invalidTokens } },
          { $unset: { pushToken: 1 } }
        );
        console.log('[Notice Reminder] Removed', invalidTokens.length, 'invalid FCM token(s)');
      }
    }

    console.log('[Notice Reminder] Sent to', pushSent, 'device(s) for notification', req.params.id);
    res.status(200).json({ success: true, pushSent });
  } catch (error) {
    console.error('[Notice Reminder] Error:', error.message);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Update Notification

exports.updateNotification = async (req, res) => {
  try {
    const { title, message, type, priority, expiresAt } = req.body;

    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    // Check if user created this notification
    if (notification.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this notification' });
    }
    if (notification.hostelId) {
      await assertOwnsHostel(req, notification.hostelId);
    }

    if (title) notification.title = title;
    if (message) notification.message = message;
    if (type) notification.type = type;
    if (priority) notification.priority = priority;
    if (expiresAt !== undefined) notification.expiresAt = expiresAt ? new Date(expiresAt) : null;

    await notification.save();

    res.status(200).json({ success: true, data: notification });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Delete Notification

exports.deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    // Check if user created this notification
    if (notification.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this notification' });
    }
    if (notification.hostelId) {
      await assertOwnsHostel(req, notification.hostelId);
    }

    await notification.deleteOne();

    res.status(200).json({ success: true, message: 'Notification deleted successfully' });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};



exports.createTemplate = async (req, res) => {
  try {
    const { name, type, category, subject, content, variables, hostelId, isActive } = req.body;
    if (!name || !type || !content) {
      return res.status(400).json({ success: false, message: 'name, type, and content are required' });
    }
    if (hostelId) {
      await assertOwnsHostel(req, hostelId);
    }
    const templateData = {
      name: String(name).trim().slice(0, 100),
      type: ['sms', 'email', 'push'].includes(type) ? type : 'push',
      category: ['notice', 'holiday', 'emergency', 'payment', 'violation', 'other'].includes(category) ? category : 'notice',
      subject: subject ? String(subject).trim().slice(0, 200) : undefined,
      content: String(content).trim().slice(0, 4000),
      variables: Array.isArray(variables) ? variables.map(String).slice(0, 20) : [],
      hostelId: hostelId || undefined,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    };
    const template = await Template.create(templateData);
    res.status(201).json({ success: true, data: template });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};


exports.getTemplates = async (req, res) => {
  try {
    await assertOwnsHostel(req, req.params.hostelId);
    const templates = await Template.find({ hostelId: req.params.hostelId });
    res.status(200).json({ success: true, data: templates });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};


exports.sendBroadcast = async (req, res) => {
  try {
    const { title, message, type, targetAudience, templateId, recipients, hostelId } = req.body;
    const targetHostelId = hostelId || req.body.hostelId;
    await assertOwnsHostel(req, targetHostelId);

    // If template is used, fetch and replace variables
    let finalMessage = message;
    if (templateId) {
      const template = await Template.findById(templateId);
      if (template) {
        finalMessage = template.content;
        // Replace variables if needed
        if (req.body.variables) {
          Object.keys(req.body.variables).forEach(key => {
            finalMessage = finalMessage.replace(`{${key}}`, req.body.variables[key]);
          });
        }
      }
    }

    const Notification = require('../../models/Notification');
    let notificationRecipients = [];

    if (targetAudience === 'all') {
      const users = await User.find({ hostelId: targetHostelId });
      notificationRecipients = users.map(u => u._id);
    } else if (targetAudience) {
      const users = await User.find({ hostelId: targetHostelId, role: targetAudience });
      notificationRecipients = users.map(u => u._id);
    } else if (recipients) {
      notificationRecipients = recipients;
    }

    const notification = await Notification.create({
      title,
      message,
      type,
      targetAudience,
      recipients: notificationRecipients,
      createdBy: req.user.id,
      hostelId: targetHostelId,
    });

    res.status(201).json({ success: true, data: notification });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// ============ GUEST VISIT (VISITOR) REQUESTS ============

// Get visitor requests for owner's hostels (students in owner's hostels)

exports.sendNotificationToAll = async (req, res) => {
  try {
    const { title, body, data, hostelId } = req.body;
    const scopedHostelIds = await getScopedHostelIds(req, hostelId);
    if (scopedHostelIds.length === 0) {
      return res.status(400).json({ success: false, message: 'No authorized hostels found' });
    }
    const User = require('../../models/User');
    const {
      sendPushNotifications,
      sendExpoPushNotifications,
      isExpoPushToken,
    } = require('../../utils/notificationService');

    const students = await User.find({
      role: 'student',
      hostelId: { $in: scopedHostelIds },
      $or: [
        { pushToken: { $exists: true, $ne: null, $ne: '' } },
        { expoPushToken: { $exists: true, $ne: null, $ne: '' } },
      ],
    }).select('pushToken expoPushToken');

    if (students.length === 0) {
      return res.status(404).json({ success: false, message: 'No students with push tokens found' });
    }

    const expoNotifications = [];
    const fcmNotifications = [];

    // Prefer FCM when we have a native FCM token (avoids Expo needing FCM credentials for Android)
    students.forEach((s) => {
      const payload = { title, body, data: data || {} };
      const hasFcm = s.pushToken && !isExpoPushToken(s.pushToken);
      const hasExpo = s.expoPushToken && isExpoPushToken(s.expoPushToken);
      if (hasFcm) {
        fcmNotifications.push({ ...payload, to: s.pushToken });
      } else if (hasExpo) {
        expoNotifications.push({ ...payload, to: s.expoPushToken });
      }
    });

    let receiptIds = [];
    let expoResults = [];
    if (expoNotifications.length > 0) {
      const expoOut = await sendExpoPushNotifications(expoNotifications);
      receiptIds = expoOut.receiptIds || [];
      expoResults = expoOut.responses || [];
    }

    let fcmResults = [];
    if (fcmNotifications.length > 0) {
      fcmResults = await sendPushNotifications(fcmNotifications);
      const invalidTokens = Array.isArray(fcmResults) && fcmResults.invalidTokens?.length ? fcmResults.invalidTokens : [];
      if (invalidTokens.length > 0) {
        await User.updateMany(
          { pushToken: { $in: invalidTokens } },
          { $unset: { pushToken: 1 } }
        );
        console.log('[Broadcast] Removed', invalidTokens.length, 'invalid FCM token(s) from User records');
      }
    }

    res.status(200).json({
      success: true,
      message: `Notification sent to ${expoNotifications.length + fcmNotifications.length} students`,
      receiptIds,
      expoCount: expoNotifications.length,
      fcmCount: fcmNotifications.length,
      results: { expo: expoResults, fcm: fcmResults },
    });
  } catch (error) {
    console.error('Broadcast notification error:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Get status of Expo push notification receipts (ok | error | DeviceNotRegistered | MessageTooBig)

exports.getNotificationReceipts = async (req, res) => {
  try {
    const ids = req.body?.ids || (typeof req.query.ids === 'string' ? req.query.ids.split(',') : []);
    if (!ids.length) {
      return res.status(400).json({ success: false, message: 'Receipt ids required (body.ids or query ids=id1,id2)' });
    }
    const { getExpoReceipts } = require('../../utils/notificationService');
    const receipts = await getExpoReceipts(ids);
    res.status(200).json({ success: true, data: receipts });
  } catch (error) {
    console.error('Get receipts error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ MESS SCHEDULE (Owner) ============
const MessSchedule = require('../../models/MessSchedule');
