/**
 * @file adapters/pushAdapter.js
 * @description Infrastructure adapter decoupling direct Firebase Admin Cloud Messaging and Expo push SDKs.
 */

'use strict';

const notificationService = require('../utils/notificationService');

class PushAdapter {
  static async sendPushNotification(pushToken, title, body, data = {}) {
    return await notificationService.sendPushNotification(pushToken, title, body, data);
  }

  static async sendMulticastNotification(pushTokens, title, body, data = {}) {
    return await notificationService.sendMulticastNotification(pushTokens, title, body, data);
  }

  static async sendCurfewAlert(pushToken, studentName, curfewTime, lateByMinutes = 0, expoPushToken = null) {
    return await notificationService.sendCurfewAlert(pushToken, studentName, curfewTime, lateByMinutes, expoPushToken);
  }

  static async sendLeaveNotification(pushToken, title, body, approved = true, permissionId = null, expoPushToken = null) {
    return await notificationService.sendLeaveNotification(pushToken, title, body, approved, permissionId, expoPushToken);
  }

  static async getExpoReceipts(ids) {
    return await notificationService.getExpoReceipts(ids);
  }
}

module.exports = PushAdapter;
