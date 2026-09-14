import Constants from 'expo-constants';

// Security: Prevent local development from silently connecting to production.
// In development, explicitly default to local development backend.
// In production, require explicit configuration (Fail Fast).
const isDev = __DEV__ || process.env.NODE_ENV !== 'production';

const getApiUrl = (): string => {
  // 1. Explicit environment variable override (.env) takes highest precedence
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (envUrl && envUrl !== 'local') {
    return envUrl.replace(/\/+$/, '');
  }

  // 2. In local development: ALWAYS default to local development backend.
  // Never silently connect to production even if extra.apiUrl is present.
  if (isDev) {
    return 'http://localhost:4000/api';
  }

  // 3. In production: Read from app.json extra config if env var was not provided
  const fromExtra = Constants.expoConfig?.extra?.apiUrl;
  if (typeof fromExtra === 'string' && fromExtra.trim()) {
    return fromExtra.trim().replace(/\/+$/, '');
  }

  // 4. In production without config: FAIL FAST
  throw new Error(
    '[Security Configuration Error] Missing required EXPO_PUBLIC_API_URL in production build. Refusing to connect to an unverified endpoint.'
  );
};

export const API_BASE_URL = getApiUrl();

export const STORAGE_KEYS = {
  TOKEN: '@hostel_app_token',
  USER: '@hostel_app_user',
  NOTIFICATIONS_ENABLED: '@hostel_app_notifications_enabled',
};
