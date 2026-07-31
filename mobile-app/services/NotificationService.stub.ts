/**
 * Stub implementation for Expo Go where expo-notifications is not available (SDK 53+).
 * Use a development build for full push notification support.
 */

const noopSubscription = { remove: () => {} };

export class NotificationService {
  static async registerForPushNotificationsAsync(): Promise<string | undefined> {
    if (__DEV__) {
      console.warn(
        'Push notifications are not supported in Expo Go (SDK 53+). Use a development build for full functionality.'
      );
    }
    return undefined;
  }

  static async getExpoPushTokenOnly(): Promise<string | null> {
    return null;
  }

  static addNotificationListener(_callback: (notification: any) => void) {
    return noopSubscription;
  }

  static addResponseListener(_callback: (response: any) => void) {
    return noopSubscription;
  }
}

export default NotificationService;
