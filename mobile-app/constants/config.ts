import Constants from 'expo-constants';

// Single API base URL for both emulator and physical device (no localhost/10.0.2.2).
// Use ngrok so Expo Go on a real phone can reach the server.
const NGROK_API_BASE = 'https://lyndsay-supercivil-maurita.ngrok-free.dev/api';

const getApiUrl = () => {
  const fromExtra = Constants.expoConfig?.extra?.apiUrl;
  if (typeof fromExtra === 'string' && fromExtra.trim()) {
    return fromExtra.trim();
  }
  return NGROK_API_BASE;
};

export const API_BASE_URL = getApiUrl();

export const STORAGE_KEYS = {
  TOKEN: '@hostel_app_token',
  USER: '@hostel_app_user',
  NOTIFICATIONS_ENABLED: '@hostel_app_notifications_enabled',
};
