/**
 * Common API Response and Request Types
 */

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext?: boolean;
  hasPrev?: boolean;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T = unknown> {
  success: boolean;
  data: T[];
  pagination?: PaginationMeta;
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  message?: string;
  error?: string;
}

export interface RequestOptions {
  signal?: AbortSignal;
  headers?: Record<string, string>;
  params?: Record<string, unknown>;
}

export interface DateRangeParams {
  from?: string;
  to?: string;
  startDate?: string;
  endDate?: string;
  period?: 'daily' | 'week' | 'month' | 'custom' | string;
}
