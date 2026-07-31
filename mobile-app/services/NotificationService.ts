import Constants from 'expo-constants';

/**
 * Use real expo-notifications only in development builds.
 * In Expo Go (SDK 53+) push notifications are not supported, so we load a stub
 * to avoid the "expo-notifications was removed from Expo Go" crash.
 */
const isExpoGo = Constants.appOwnership === 'expo';

const NotificationServiceModule = isExpoGo
  ? require('./NotificationService.stub')
  : require('./NotificationService.impl');

export const NotificationService =
  NotificationServiceModule.NotificationService ?? NotificationServiceModule.default;
export default NotificationServiceModule.default ?? NotificationServiceModule.NotificationService;
