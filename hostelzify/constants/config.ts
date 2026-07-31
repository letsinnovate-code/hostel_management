// API Base URL Configuration
const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    // Client-side: use localhost or environment variable
    return process.env.NEXT_PUBLIC_API_URL || 'https://apihostel-zack.vercel.app/api';
  }
  // Server-side: use localhost
  return process.env.API_URL || 'https://apihostel-zack.vercel.app/api';
};

export const API_BASE_URL = getApiUrl();

export const STORAGE_KEYS = {
  TOKEN: '@hostel_app_token',
  USER: '@hostel_app_user',
  RETURN_PATH: '@hostel_app_return_path',
  OWNER_SELECTED_HOSTEL: '@hostel_app_owner_selected_hostel',
};

