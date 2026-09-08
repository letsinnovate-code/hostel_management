import Constants from 'expo-constants';
import { Platform } from 'react-native';

const PRODUCTION_API_URL = 'https://hostel-management-yjox.vercel.app/api';

const getApiUrl = (): string => {
  // 1. Environment variable override (.env)
  if (process.env.EXPO_PUBLIC_API_URL && process.env.EXPO_PUBLIC_API_URL.trim()) {
    const envUrl = process.env.EXPO_PUBLIC_API_URL.trim();
    if (envUrl !== 'local') {
      return envUrl.replace(/\/+$/, '');
    }
  }

  // 2. Extra config from app.json
  const fromExtra = Constants.expoConfig?.extra?.apiUrl;
  if (typeof fromExtra === 'string' && fromExtra.trim()) {
    return fromExtra.trim().replace(/\/+$/, '');
  }

  // 3. Fallback to production Vercel URL
  return PRODUCTION_API_URL;
};

export const API_BASE_URL = getApiUrl();

export const STORAGE_KEYS = {
  TOKEN: '@hostel_app_token',
  USER: '@hostel_app_user',
  NOTIFICATIONS_ENABLED: '@hostel_app_notifications_enabled',
};
