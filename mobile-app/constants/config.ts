import Constants from 'expo-constants';


// // Single API base URL for both emulator and physical device (no localhost/10.0.2.2).
// // Use ngrok so Expo Go on a real phone can reach the server.
// const NGROK_API_BASE = 'https://lyndsay-supercivil-maurita.ngrok-free.dev/api';

// const getApiUrl = () => {
//   const fromExtra = Constants.expoConfig?.extra?.apiUrl;
//   if (typeof fromExtra === 'string' && fromExtra.trim()) {
//     return fromExtra.trim();
import { Platform } from 'react-native';

/**
 * Localhost MongoDB Backend Configuration (Testing)
 * Points to the local Express + MongoDB server running on port 4000.
 */
const getLocalApiUrl = () => {
  // 1. Environment variable override
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.trim();
  }

  // 2. Web browser: localhost:4000
  if (Platform.OS === 'web') {
    return 'http://localhost:4000/api';
  }

  // 3. Physical device running on LAN via Expo Go / dev client:
  // Dynamically resolve host PC IP from Expo dev server
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const hostIp = hostUri.split(':')[0];
    if (hostIp && hostIp !== 'localhost' && hostIp !== '127.0.0.1') {
      return `http://${hostIp}:4000/api`;
    }
  }

  // 4. Android Emulator: 10.0.2.2 routes to the host PC localhost:4000
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:4000/api';
  }

  // return NGROK_API_BASE;

  // 5. Default fallback
  return 'http://localhost:4000/api';
};

// export const API_BASE_URL = getApiUrl();

export const API_BASE_URL = getLocalApiUrl();

export const STORAGE_KEYS = {
  TOKEN: '@hostel_app_token',
  USER: '@hostel_app_user',
  NOTIFICATIONS_ENABLED: '@hostel_app_notifications_enabled',
};
