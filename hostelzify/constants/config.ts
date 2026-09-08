// API Base URL Configuration
const DEFAULT_API_URL = 'https://hostel-management-yjox.vercel.app/api';

const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    // Client-side: use environment variable or production backend
    return process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL;
  }
  // Server-side: use localhost or environment variable
  return process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL;
};

export const API_BASE_URL = getApiUrl();

export const STORAGE_KEYS = {
  TOKEN: '@hostel_app_token',
  USER: '@hostel_app_user',
  RETURN_PATH: '@hostel_app_return_path',
  OWNER_SELECTED_HOSTEL: '@hostel_app_owner_selected_hostel',
};

