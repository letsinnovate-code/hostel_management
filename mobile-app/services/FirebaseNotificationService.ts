import { Platform } from 'react-native';
import api from './api';

// Load native module only on mobile when available (fails in Expo Go / web / when not linked)
let messaging: { (): any; AuthorizationStatus?: any } | null = null;
if (Platform.OS !== 'web') {
  try {
    messaging = require('@react-native-firebase/messaging').default;
  } catch {
    // RNFBAppModule not available - Expo Go, web, or native build without Firebase
  }
}

/**
 * Firebase Cloud Messaging Service
 * Handles push notification registration and token management.
 * No-ops when native Firebase is not available (e.g. Expo Go, Web).
 */
export class FirebaseNotificationService {
  static get isAvailable(): boolean {
    return Platform.OS !== 'web' && messaging != null;
  }

  /**
   * Get FCM token only (permission + getToken). Does NOT register with backend.
   * Use this when you want to register the token yourself (e.g. from settings).
   */
  static async getTokenAsync(): Promise<string | null> {
    if (Platform.OS === 'web' || !messaging) return null;
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
    if (Platform.OS === 'web') return null;
    const token = await this.getTokenAsync();
    if (token && messaging) {
      await api.registerPushToken(token);
      try {
        messaging().onTokenRefresh(async (newToken: string) => {
          console.log('FCM Token refreshed:', newToken);
          await api.registerPushToken(newToken);
        });
      } catch {}
    }
    return token;
  }

  /**
   * Set up foreground notification handler
   */
  static setupForegroundHandler(callback: (notification: any) => void) {
    if (Platform.OS === 'web' || !messaging) return () => {};
    try {
      return messaging().onMessage(async (remoteMessage: any) => {
        console.log('Foreground notification:', remoteMessage);
        callback(remoteMessage);
      });
    } catch {
      return () => {};
    }
  }

  /**
   * Set up background notification handler
   */
  static setupBackgroundHandler() {
    if (Platform.OS === 'web' || !messaging) return;
    try {
      messaging().setBackgroundMessageHandler(async (remoteMessage: any) => {
        console.log('Background notification:', remoteMessage);
      });
    } catch {
      // Firebase not initialized
    }
  }

  /**
   * Handle notification opened from quit state
   */
  static async getInitialNotification() {
    if (Platform.OS === 'web' || !messaging) return null;
    try {
      const remoteMessage = await messaging().getInitialNotification();
      if (remoteMessage) {
        console.log('Notification caused app to open:', remoteMessage);
        return remoteMessage;
      }
    } catch {}
    return null;
  }

  /**
   * Handle notification opened from background
   */
  static onNotificationOpenedApp(callback: (notification: any) => void) {
    if (Platform.OS === 'web' || !messaging) return () => {};
    try {
      return messaging().onNotificationOpenedApp((remoteMessage: any) => {
        console.log('Notification opened app from background:', remoteMessage);
        callback(remoteMessage);
      });
    } catch {
      return () => {};
    }
  }
}

export default FirebaseNotificationService;
