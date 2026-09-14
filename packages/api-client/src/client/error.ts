import axios, { AxiosError } from 'axios';

export class ApiError extends Error {
  public statusCode?: number;
  public code?: string;
  public responseData?: unknown;

  constructor(message: string, statusCode?: number, code?: string, responseData?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.responseData = responseData;
  }
}

/**
 * Extract a user-friendly error message from any caught error.
 */
export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as Record<string, unknown> | undefined;
    const msg = data?.message || data?.error;
    if (typeof msg === 'string' && msg.trim()) return msg;

    if (error.response?.status === 500) return 'Server error. Please try again later.';
    if (error.response?.status === 404) return 'Resource not found.';
    if (error.response?.status === 403) return 'Access denied. You do not have permission.';
    if (error.response?.status === 401) return 'Unauthorized. Please login again.';
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) return 'Request timed out.';
    if (error.code === 'ERR_CANCELED') return 'Request was cancelled.';
    if (error.code === 'ERR_NETWORK' || !error.response) return 'Network error. Check your connection.';
  }

  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong. Please try again.';
}
