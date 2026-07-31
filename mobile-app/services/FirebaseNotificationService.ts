import api from './api';

// Load native module only when available (fails in Expo Go / web / when not linked)
let messaging: { (): any; AuthorizationStatus?: any } | null = null;
try {
  messaging = require('@react-native-firebase/messaging').default;
} catch {
  // RNFBAppModule not available - Expo Go, web, or native build without Firebase
}

/**
 * Firebase Cloud Messaging Service
 * Handles push notification registration and token management.
 * No-ops when native Firebase is not available (e.g. Expo Go).
 */
export class FirebaseNotificationService {
  static get isAvailable(): boolean {
    return messaging != null;
  }

  /**
   * Get FCM token only (permission + getToken). Does NOT register with backend.
   * Use this when you want to register the token yourself (e.g. from settings).
   */
  static async getTokenAsync(): Promise<string | null> {
    if (!messaging) return null;
    try {
      const authStatus = await messaging().requestPermission();
      const Auth = (messaging as any).AuthorizationStatus;
      const enabled =
        authStatus === Auth?.AUTHORIZED || authStatus === Auth?.PROVISIONAL;
      if (!enabled) {
        console.log('Push notification permission denied');
        return null;
      }
      const token = await messaging().getToken();
      console.log('FCM Token:', token);
      return token || null;
    } catch (error) {
      console.error('Error getting FCM token:', error);
      return null;
    }
  }

  /**
   * Request notification permissions and get FCM token, then register with backend
   */
  static async registerForPushNotificationsAsync(): Promise<string | null> {
    const token = await this.getTokenAsync();
    if (token) {
      await api.registerPushToken(token);
      messaging?.().onTokenRefresh(async (newToken: string) => {
        console.log('FCM Token refreshed:', newToken);
        await api.registerPushToken(newToken);
      });
    }
    return token;
  }

  /**
   * Set up foreground notification handler
   */
  static setupForegroundHandler(callback: (notification: any) => void) {
    if (!messaging) return () => {};
    return messaging().onMessage(async (remoteMessage: any) => {
      console.log('Foreground notification:', remoteMessage);
      callback(remoteMessage);
    });
  }

  /**
   * Set up background notification handler
   */
  static setupBackgroundHandler() {
    if (!messaging) return;
    messaging().setBackgroundMessageHandler(async (remoteMessage: any) => {
      console.log('Background notification:', remoteMessage);
    });
  }

  /**
   * Handle notification opened from quit state
   */
  static async getInitialNotification() {
    if (!messaging) return null;
    const remoteMessage = await messaging().getInitialNotification();
    if (remoteMessage) {
      console.log('Notification caused app to open:', remoteMessage);
      return remoteMessage;
    }
    return null;
  }

  /**
   * Handle notification opened from background
   */
  static onNotificationOpenedApp(callback: (notification: any) => void) {
    if (!messaging) return () => {};
    return messaging().onNotificationOpenedApp((remoteMessage: any) => {
      console.log('Notification opened app from background:', remoteMessage);
      callback(remoteMessage);
    });
  }
}

export default FirebaseNotificationService;
