import { BaseClient } from '../client/baseClient';
import { ApiResponse, RequestOptions } from '../types/common';
import { Attendance } from '../types/domain';

export class AttendanceApi {
  constructor(private client: BaseClient) {}

  async checkIn(
    coordinates: { latitude: number; longitude: number; accuracy?: number },
    options?: RequestOptions
  ): Promise<ApiResponse<Attendance>> {
    return this.client.post<ApiResponse<Attendance>>('/student/check-in', coordinates, options);
  }

  async checkOut(
    coordinates: { latitude: number; longitude: number; accuracy?: number },
    options?: RequestOptions
  ): Promise<ApiResponse<Attendance>> {
    return this.client.post<ApiResponse<Attendance>>('/student/check-out', coordinates, options);
  }

  async getStudentStatus(
    options?: RequestOptions
  ): Promise<ApiResponse<{ status: string; lastAttendance?: Attendance; [key: string]: unknown }>> {
    return this.client.get<ApiResponse<{ status: string; lastAttendance?: Attendance }>>('/student/status', options);
  }

  async getAttendanceAnalytics(
    period: string = 'week',
    options?: RequestOptions
  ): Promise<ApiResponse<unknown>> {
    return this.client.get<ApiResponse<unknown>>('/student/attendance/analytics', {
      ...options,
      params: { period, ...options?.params },
    });
  }

  async getDailyAttendance(
    params?: { hostelId?: string; from?: string; to?: string },
    options?: RequestOptions
  ): Promise<ApiResponse<Attendance[]>> {
    return this.client.get<ApiResponse<Attendance[]>>('/owner/attendance/daily', {
      ...options,
      params: { ...params, ...options?.params },
    });
  }

  async getWardenAttendanceSheet(
    date?: string,
    options?: RequestOptions
  ): Promise<ApiResponse<unknown>> {
    return this.client.get<ApiResponse<unknown>>('/warden/attendance/sheet', {
      ...options,
      params: { date, ...options?.params },
    });
  }

  async triggerAttendanceCheck(
    hostelId: string,
    options?: RequestOptions
  ): Promise<ApiResponse<{ message: string; triggeredCount?: number }>> {
    return this.client.post<ApiResponse<{ message: string }>>('/owner/attendance/check', { hostelId }, options);
  }

  async markAttendance(
    data: { studentId: string; status: string; remarks?: string },
    options?: RequestOptions
  ): Promise<ApiResponse<Attendance>> {
    return this.client.post<ApiResponse<Attendance>>('/warden/attendance/mark', data, options);
  }
}
