// API Base URL Configuration
// Security: Never silently fall back to production.
// In development, default explicitly to local backend. In production, require explicit configuration (Fail Fast).
const isProduction = process.env.NODE_ENV === 'production';

const getApiUrl = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  if (isProduction) {
    throw new Error(
      '[Security Configuration Error] Missing required NEXT_PUBLIC_API_URL in production environment. Refusing to connect to an unverified endpoint.'
    );
  }

  // Explicit local development fallback
  return 'http://localhost:4000/api';
};

export const API_BASE_URL = getApiUrl();

export const STORAGE_KEYS = {
  TOKEN: '@hostel_app_token',
  USER: '@hostel_app_user',
  RETURN_PATH: '@hostel_app_return_path',
  OWNER_SELECTED_HOSTEL: '@hostel_app_owner_selected_hostel',
};

