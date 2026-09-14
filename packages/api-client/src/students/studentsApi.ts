import { BaseClient } from '../client/baseClient';
import { ApiResponse, PaginatedResponse, RequestOptions } from '../types/common';
import { Student } from '../types/domain';
import { StudentProfile } from '../types/auth';

export class StudentsApi {
  constructor(private client: BaseClient) {}

  async getStudents(
    params?: Record<string, unknown>,
    options?: RequestOptions
  ): Promise<PaginatedResponse<Student>> {
    return this.client.get<PaginatedResponse<Student>>('/owner/students', { ...options, params });
  }

  async getWardenStudents(
    params?: Record<string, unknown>,
    options?: RequestOptions
  ): Promise<PaginatedResponse<Student>> {
    return this.client.get<PaginatedResponse<Student>>('/warden/students', { ...options, params });
  }

  async getStudentById(
    studentId: string,
    options?: RequestOptions
  ): Promise<ApiResponse<StudentProfile>> {
    return this.client.get<ApiResponse<StudentProfile>>(`/owner/students/${studentId}`, options);
  }

  async getStudentProfile(options?: RequestOptions): Promise<ApiResponse<StudentProfile>> {
    return this.client.get<ApiResponse<StudentProfile>>('/student/profile', options);
  }

  async updateStudentProfile(
    studentId: string,
    data: Partial<StudentProfile>,
    options?: RequestOptions
  ): Promise<ApiResponse<StudentProfile>> {
    return this.client.put<ApiResponse<StudentProfile>>(`/owner/students/${studentId}`, data, options);
  }

  async updateStudentStatus(
    studentId: string,
    status: string,
    options?: RequestOptions
  ): Promise<ApiResponse<Student>> {
    return this.client.put<ApiResponse<Student>>(`/owner/students/${studentId}/status`, { status }, options);
  }

  async getStudentOnboardingState(options?: RequestOptions): Promise<ApiResponse<unknown>> {
    return this.client.get<ApiResponse<unknown>>('/student/onboarding', options);
  }

  async uploadStudentDocuments(
    studentId: string,
    formData: FormData,
    options?: RequestOptions
  ): Promise<ApiResponse<unknown>> {
    return this.client.post<ApiResponse<unknown>>(
      `/owner/students/${studentId}/documents`,
      formData,
      {
        ...options,
        headers: {
          'Content-Type': 'multipart/form-data',
          ...options?.headers,
        },
      }
    );
  }
}
