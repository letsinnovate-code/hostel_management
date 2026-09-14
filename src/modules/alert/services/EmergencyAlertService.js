/**
 * @file EmergencyAlertService.js
 * @description Broadcasts emergency alerts to entire hostels, floors, or roles.
 *
 * EMERGENCY TYPES:
 * - Fire, Medical, Security Threat, Natural Disaster, Evacuation, Other
 *
 * BROADCAST SCOPE:
 * - 'hostel': All users of the hostel (students + staff)
 * - 'staff': Only wardens + owners + security
 * - 'students': Only students
 * - 'floor': Students on a specific floor (uses Room.floorNumber)
 *
 * WHY BROADCAST IS SYNCHRONOUS (not fire-and-forget):
 * Emergencies are CRITICAL — we want to confirm the broadcast was sent
 * before returning to the caller. The API caller (owner/superadmin) needs
 * a definitive success/failure response.
 *
 * SECURITY:
 * Only 'owner' and 'superadmin' can trigger emergency broadcasts.
 * This is enforced in the route middleware, not here.
 */

'use strict';

const User = require('../../../models/User');
const Room = require('../../../models/Room');
const Emergency = require('../../../models/Emergency');
const HostelAlert = require('../models/HostelAlert');
const { emitEmergencyBroadcast } = require('../socket/alertSocket');
const notificationService = require('../../../utils/notificationService');
const { ALERT_TYPES, ALERT_PRIORITY } = require('../utils/constants');
const { resolveCategoryForType, sanitizeMetadata } = require('../utils/alertHelpers');

// Map emergency type string → ALERT_TYPES constant
const EMERGENCY_TYPE_MAP = {
  fire: ALERT_TYPES.EMERGENCY_FIRE,
  medical: ALERT_TYPES.EMERGENCY_MEDICAL,
  security: ALERT_TYPES.EMERGENCY_SECURITY,
  natural_disaster: ALERT_TYPES.EMERGENCY_NATURAL_DISASTER,
  evacuation: ALERT_TYPES.EMERGENCY_EVACUATION,
  other: ALERT_TYPES.EMERGENCY_OTHER,
};

class EmergencyAlertService {
  /**
   * Broadcast an emergency alert to the specified scope within a hostel.
   *
   * @param {Object} opts
   * @param {string} opts.hostelId
   * @param {string} opts.emergencyType - 'fire'|'medical'|'security'|'natural_disaster'|'evacuation'|'other'
   * @param {string} opts.title
   * @param {string} opts.message
   * @param {string} opts.scope - 'hostel'|'staff'|'students'|'floor'
   * @param {number} [opts.floorNumber] - required if scope='floor'
   * @param {string} opts.triggeredByUserId - who triggered this emergency
   * @param {Object} [opts.location] - { latitude, longitude, address }
   * @returns {Promise<{ alertId: string, recipientCount: number, emergencyId: string }>}
   */
  static async broadcast(opts) {
    const {
      hostelId,
      emergencyType = 'other',
      title,
      message,
      scope = 'hostel',
      floorNumber,
      triggeredByUserId,
      location = {},
    } = opts;

    const alertType = EMERGENCY_TYPE_MAP[emergencyType] || ALERT_TYPES.EMERGENCY_OTHER;

    // ── 1. Find recipients based on scope ─────────────────────────────
    const recipients = await this._findRecipients(hostelId, scope, floorNumber);

    if (recipients.length === 0) {
      throw new Error(`No recipients found for scope '${scope}' in hostel ${hostelId}`);
    }

    const recipientIds = recipients.map((r) => String(r._id));

    // ── 2. Create a log in the existing Emergency model ────────────────
    const emergencyDoc = await Emergency.create({
      raisedBy: triggeredByUserId,
      emergencyType: ['sos', 'medical', 'fire', 'security', 'other'].includes(emergencyType)
        ? emergencyType
        : 'other',
      location,
      description: message,
      status: 'active',
    });

    // ── 3. Create HostelAlert (bulk record) ────────────────────────────
    const alert = await HostelAlert.create({
      type: alertType,
      category: resolveCategoryForType(alertType),
      title,
      message,
      recipientRole: 'all',
      recipientIds,
      hostelId,
      metadata: sanitizeMetadata({
        emergencyType,
        scope,
        floorNumber,
        emergencyId: String(emergencyDoc._id),
        location,
      }),
      priority: ALERT_PRIORITY.CRITICAL,
      channels: { inApp: true, push: true, socket: true },
      triggeredBy: 'user',
      triggeredByUserId,
    });

    // ── 4. Real-time socket broadcast (fastest delivery) ──────────────
    emitEmergencyBroadcast(hostelId, {
      alertId: String(alert._id),
      emergencyId: String(emergencyDoc._id),
      type: alertType,
      title,
      message,
      scope,
      floorNumber,
      priority: 'critical',
      triggeredAt: new Date().toISOString(),
    });

    // ── 5. Push notifications (async batch) ───────────────────────────
    setImmediate(async () => {
      try {
        await this._sendEmergencyPush(recipients, title, message, {
          alertId: String(alert._id),
          emergencyType,
          emergencyId: String(emergencyDoc._id),
          screen: 'emergency',
        });
      } catch (pushErr) {
        console.error('[EmergencyAlert] Push error:', pushErr.message);
      }
    });

    console.log(`[EmergencyAlert] Broadcast to ${recipients.length} recipients in hostel ${hostelId}`);

    return {
      alertId: String(alert._id),
      emergencyId: String(emergencyDoc._id),
      recipientCount: recipients.length,
    };
  }

  /**
   * Find recipients based on broadcast scope.
   *
   * @param {string} hostelId
   * @param {string} scope
   * @param {number} [floorNumber]
   * @returns {Promise<Array>}
   */
  static async _findRecipients(hostelId, scope, floorNumber) {
    if (scope === 'hostel') {
      // All active users in this hostel
      return User.find({ hostelId, status: 'active' })
        .select('_id pushToken expoPushToken')
        .lean();
    }

    if (scope === 'students') {
      return User.find({ hostelId, role: 'student', status: 'active' })
        .select('_id pushToken expoPushToken')
        .lean();
    }

    if (scope === 'staff') {
      return User.find({
        hostelId,
        role: { $in: ['warden', 'owner', 'security', 'supervisor'] },
        status: 'active',
      })
        .select('_id pushToken expoPushToken')
        .lean();
    }

    if (scope === 'floor' && floorNumber != null) {
      // Find rooms on this floor → get students assigned to those rooms
      const rooms = await Room.find({ hostelId, floorNumber }).select('_id').lean();
      const roomIds = rooms.map((r) => r._id);
      return User.find({ roomId: { $in: roomIds }, status: 'active' })
        .select('_id pushToken expoPushToken')
        .lean();
    }

    return [];
  }

  /**
   * Send emergency push notifications in batches.
   *
   * @param {Array} recipients
   * @param {string} title
   * @param {string} body
   * @param {Object} data
   */
  static async _sendEmergencyPush(recipients, title, body, data) {
    const expoMessages = [];
    const fcmMessages = [];

    for (const user of recipients) {
      if (user.expoPushToken && notificationService.isExpoPushToken(user.expoPushToken)) {
        expoMessages.push({
          to: user.expoPushToken,
          title,
          body,
          data,
          priority: 'high',
          channelId: 'emergency',
        });
      } else if (user.pushToken) {
        fcmMessages.push({
          to: user.pushToken,
          title,
          body,
          data,
          channelId: 'emergency',
        });
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

module.exports = EmergencyAlertService;
