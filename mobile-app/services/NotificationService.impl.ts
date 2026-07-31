import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import api from './api';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export class NotificationService {
  static async registerForPushNotificationsAsync() {
    let token;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
      await Notifications.setNotificationChannelAsync('violations', {
        name: 'Violations',
        description: 'Violation alerts (e.g. left without checkout)',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 300, 200, 300],
        lightColor: '#FFB020',
        enableVibrate: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }

    if (Platform.OS === 'web') return;

    if (Constants.appOwnership === 'expo') {
      console.warn(
        'Push notifications are not supported in Expo Go (SDK 53+). Use a development build for full functionality.'
      );
      return;
    }

    try {
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
      token = (
        await Notifications.getExpoPushTokenAsync({
          projectId: projectId,
        })
      ).data;

      console.log('Push Token:', token);

      if (token) {
        await api.registerPushToken(token);
      }
    } catch (error) {
      console.error('Error getting push token:', error);
    }

    return token;
  }

  static async getExpoPushTokenOnly(): Promise<string | null> {
    if (Platform.OS === 'web') return null;
    if (Constants.appOwnership === 'expo') return null;
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') return null;
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
      const token = (
        await Notifications.getExpoPushTokenAsync({ projectId: projectId || undefined })
      ).data;
      return token || null;
    } catch {
      return null;
    }
  }

  static addNotificationListener(callback: (notification: Notifications.Notification) => void) {
    return Notifications.addNotificationReceivedListener(callback);
  }

  static addResponseListener(callback: (response: Notifications.NotificationResponse) => void) {
    return Notifications.addNotificationResponseReceivedListener(callback);
  }
}

export default NotificationService;
