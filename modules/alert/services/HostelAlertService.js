/**
 * @file HostelAlertService.js
 * @description The CORE service of the Alert Module. The single entry point
 * for creating and sending any type of hostel alert.
 *
 * USAGE EXAMPLE (from anywhere in the app):
 * ```js
 * const HostelAlertService = require('./modules/alert/services/HostelAlertService');
 *
 * await HostelAlertService.send({
 *   recipientRole: 'warden',
 *   type: 'CURFEW_VIOLATION',
 *   title: 'Student Outside Hostel',
 *   message: 'Rahul Sharma (Room A-203) has not returned before curfew.',
 *   hostelId,
 *   studentId,
 *   metadata: { roomNumber: 'A-203', lastCheckOut: '08:45 PM' },
 * });
 * ```
 *
 * FLOW:
 * send() → find recipients → save HostelAlert → emit socket → send push → log HostelEvent
 *
 * WHY ALL STEPS ARE FIRE-AND-FORGET AFTER DB SAVE:
 * Socket and push can fail (client offline, FCM quota) without affecting
 * the core alert record. The alert is considered "sent" once it's in MongoDB.
 * Real-time delivery is best-effort.
 */

'use strict';

const HostelAlert = require('../models/HostelAlert');
const HostelEvent = require('../models/HostelEvent');
const {
  ALERT_TYPES,
  ALERT_STATUS,
  SOCKET_EVENTS,
  HOSTEL_MANAGER_ROLES,
  ROLES,
} = require('../utils/constants');
const {
  resolveCategoryForType,
  resolvePriorityForType,
  sanitizeMetadata,
  getUsersByRoleInHostel,
  getSuperAdmins,
  extractUserIds,
} = require('../utils/alertHelpers');
const { emitNewAlert, emitToSuperAdmins, emitToRole } = require('../socket/alertSocket');
const notificationService = require('../../../utils/notificationService');
const Hostel = require('../../../models/Hostel');
const User = require('../../../models/User');
const Notification = require('../../../models/Notification');

class HostelAlertService {
  /**
   * Send an alert to a specific role within a hostel.
   *
   * @param {Object} opts
   * @param {string} opts.type           - ALERT_TYPES constant (required)
   * @param {string} opts.title          - Short title (required)
   * @param {string} opts.message        - Full message (required)
   * @param {string} opts.hostelId       - Hostel ObjectId string (required)
   * @param {string} [opts.recipientRole] - Role to notify (warden/owner/superadmin/student)
   * @param {string[]} [opts.recipientIds] - Specific user IDs to notify (overrides role lookup)
   * @param {string} [opts.studentId]    - Student this alert is about
   * @param {Object} [opts.metadata]     - Extra context (roomNumber, permissionId, etc.)
   * @param {string} [opts.priority]     - Override auto-resolved priority
   * @param {boolean} [opts.sendPush]    - Whether to send FCM/Expo push (default: true)
   * @param {string} [opts.triggeredByUserId] - If triggered by a user action
   * @returns {Promise<Object>} Saved HostelAlert document
   */
  static async send(opts) {
    const {
      type,
      title,
      message,
      hostelId: rawHostelId,
      recipientRole,
      recipientIds: explicitIds,
      studentId,
      metadata = {},
      priority,
      sendPush = true,
      triggeredByUserId = null,
    } = opts;

    try {
      // ── 1. SECURITY & TENANT ISOLATION: Student Enrolled Hostel Binding ──
      // If an alert is about a student, it MUST be bound to the student's enrolled hostel!
      let resolvedHostelId = rawHostelId;
      if (studentId) {
        try {
          const studentDoc = await User.findById(studentId).select('_id name hostelId').lean();
          if (studentDoc && studentDoc.hostelId) {
            const studentHostelId = String(studentDoc.hostelId);
            if (resolvedHostelId && String(resolvedHostelId) !== studentHostelId) {
              console.warn(`[HostelAlertService SECURITY] Alert hostel mismatch for student ${studentDoc.name} (${studentId}). Overriding hostel ${resolvedHostelId} -> ${studentHostelId}`);
            }
            resolvedHostelId = studentHostelId;
          }
        } catch (err) {
          console.error('[HostelAlertService] Student lookup error:', err.message);
        }
      }

      // ── 2. Resolve category and priority from type ──────────────────
      const category = resolveCategoryForType(type);
      const resolvedPriority = priority || resolvePriorityForType(type);
      const safeMetadata = sanitizeMetadata(metadata);

      // ── 3. Resolve recipient user IDs ───────────────────────────────
      let recipientDocs = [];

      if (recipientRole === 'owner' || recipientRole === ROLES.OWNER) {
        // OWNER ALERTS: STRICT TENANT ISOLATION
        // Only the owner of this specific hostel may ever receive owner alerts!
        if (resolvedHostelId) {
          try {
            const hDoc = await Hostel.findById(resolvedHostelId).select('ownerId').lean();
            if (hDoc?.ownerId) {
              const trueOwnerId = String(hDoc.ownerId);
              if (explicitIds && explicitIds.length > 0) {
                // Ensure only the true owner is accepted from explicitIds
                recipientDocs = explicitIds
                  .filter((id) => String(id) === trueOwnerId)
                  .map((id) => ({ _id: id }));
                if (recipientDocs.length === 0) {
                  recipientDocs = [{ _id: trueOwnerId }];
                }
              } else {
                recipientDocs = [{ _id: trueOwnerId }];
              }
            }
          } catch (e) {
            console.error('[HostelAlertService] Owner resolution error:', e.message);
          }
        }
      } else if (explicitIds && explicitIds.length > 0) {
        // Explicit list provided — no DB query needed
        recipientDocs = explicitIds.map((id) => ({ _id: id }));
      } else if (recipientRole === ROLES.SUPERADMIN) {
        recipientDocs = await getSuperAdmins();
      } else if (recipientRole === ROLES.STUDENT && studentId) {
        recipientDocs = [{ _id: studentId }];
      } else if (recipientRole && resolvedHostelId) {
        recipientDocs = await getUsersByRoleInHostel(resolvedHostelId, recipientRole);
        // Curfew/emergency alerts also always go to superadmins
        if (
          [ALERT_TYPES.CURFEW_VIOLATION, ALERT_TYPES.EMERGENCY_FIRE,
           ALERT_TYPES.EMERGENCY_MEDICAL, ALERT_TYPES.EMERGENCY_SECURITY].includes(type)
        ) {
          const admins = await getSuperAdmins();
          recipientDocs = [...recipientDocs, ...admins];
        }
      }

      const uniqueIds = [...new Set(extractUserIds(recipientDocs))];

      // ── 4. Save HostelAlert document ────────────────────────────────
      const alert = await HostelAlert.create({
        type,
        category,
        title,
        message,
        recipientRole,
        recipientIds: uniqueIds,
        hostelId: resolvedHostelId || undefined,
        studentId: studentId || undefined,
        metadata: safeMetadata,
        priority: resolvedPriority,
        status: ALERT_STATUS.UNREAD,
        channels: {
          inApp: true,
          push: sendPush,
          socket: true,
        },
        triggeredBy: triggeredByUserId ? 'user' : 'system',
        triggeredByUserId: triggeredByUserId || undefined,
      });

      const alertLean = alert.toObject();

      // ── 5. Emit Socket.IO events & create in-app Notification (fire-and-forget) ──────────────────
      setImmediate(async () => {
        try {
          for (const uid of uniqueIds) {
            emitNewAlert(uid, alertLean);
          }

          // Dual-write to Notification collection so navbar bell / notifications view display it
          if (uniqueIds.length > 0) {
            const targetAudience = recipientRole === 'owner'
              ? 'owner'
              : (recipientRole === 'student' ? 'students' : 'staff');

            await Notification.create({
              title,
              message,
              type: ['urgent', 'high'].includes(resolvedPriority) ? 'alert' : 'announcement',
              priority: resolvedPriority,
              hostelId: resolvedHostelId || undefined,
              targetAudience,
              recipients: uniqueIds,
              createdBy: triggeredByUserId || uniqueIds[0],
            });
          }
        } catch (socketErr) {
          console.error('[HostelAlertService] Socket/Notification emit error:', socketErr.message);
        }
      });

      // ── 5. Send push notifications (fire-and-forget) ─────────────────
      if (sendPush && recipientDocs.length > 0) {
        setImmediate(async () => {
          try {
            await this._sendPushToRecipients(recipientDocs, title, message, {
              alertId: String(alert._id),
              type,
              category,
            });
          } catch (pushErr) {
            console.error('[HostelAlertService] Push error:', pushErr.message);
          }
        });
      }

      // ── 6. Log HostelEvent for audit ────────────────────────────────
      setImmediate(async () => {
        try {
          await HostelEvent.create({
            eventType: type,
            hostelId: resolvedHostelId || undefined,
            studentId: studentId || undefined,
            triggeredBy: triggeredByUserId ? 'user' : 'system',
            triggeredByUserId: triggeredByUserId || undefined,
            payload: { ...safeMetadata, recipientRole, title, message },
            alertsGenerated: [alert._id],
            success: true,
          });
        } catch (logErr) {
          console.error('[HostelAlertService] Event log error:', logErr.message);
        }
      });

      return alertLean;
    } catch (err) {
      console.error('[HostelAlertService] send() failed:', err.message);
      // Log failure event
      try {
        await HostelEvent.create({
          eventType: type,
          hostelId: rawHostelId || undefined,
          studentId: studentId || undefined,
          payload: { error: err.message, ...sanitizeMetadata(metadata) },
          success: false,
          errorMessage: err.message,
        });
      } catch (_) {}
      throw err;
    }
  }

  /**
   * Broadcast an alert to MULTIPLE roles simultaneously.
   * WHY: Emergency alerts go to students + wardens + owners at once.
   *
   * @param {Object} opts
   * @param {string} opts.hostelId
   * @param {string} opts.type
   * @param {string} opts.title
   * @param {string} opts.message
   * @param {string[]} opts.targetRoles - e.g. ['student', 'warden', 'owner']
   * @param {Object} [opts.metadata]
   * @param {string} [opts.priority]
   * @returns {Promise<Object[]>} Array of created alert documents
   */
  static async broadcast(opts) {
    const { hostelId, type, title, message, targetRoles = [], metadata = {}, priority } = opts;

    const promises = targetRoles.map((role) =>
      this.send({ type, title, message, hostelId, recipientRole: role, metadata, priority })
    );

    return Promise.allSettled(promises);
  }

  /**
   * Send an alert to a specific user by their ID.
   * WHY: Useful for targeted notifications ("your leave request was approved")
   *
   * @param {Object} opts
   * @param {string} opts.userId
   * @param {string} opts.type
   * @param {string} opts.title
   * @param {string} opts.message
   * @param {Object} [opts.metadata]
   * @param {string} [opts.hostelId]
   * @param {string} [opts.studentId]
   * @returns {Promise<Object>}
   */
  static async sendToUser(opts) {
    return this.send({
      ...opts,
      recipientIds: [opts.userId],
    });
  }

  /**
   * Internal: Send FCM/Expo push notifications to a list of user docs.
   * Queries the DB for fresh push tokens to avoid stale token issues.
   *
   * @param {Array} recipientDocs - user docs with _id
   * @param {string} title
   * @param {string} body
   * @param {Object} data
   */
  static async _sendPushToRecipients(recipientDocs, title, body, data) {
    const User = require('../../../models/User');
    const ids = recipientDocs.map((d) => d._id);
    const users = await User.find({ _id: { $in: ids } })
      .select('pushToken expoPushToken')
      .lean();

    const expoMessages = [];
    const fcmMessages = [];

    for (const u of users) {
      if (u.expoPushToken && notificationService.isExpoPushToken(u.expoPushToken)) {
        expoMessages.push({ to: u.expoPushToken, title, body, data, priority: 'high' });
      } else if (u.pushToken) {
        fcmMessages.push({ to: u.pushToken, title, body, data });
      }
    }

    if (expoMessages.length > 0) {
      await notificationService.sendExpoPushNotifications(expoMessages);
    }
    if (fcmMessages.length > 0) {
      await notificationService.sendPushNotifications(fcmMessages);
    }
  }
}

module.exports = HostelAlertService;
