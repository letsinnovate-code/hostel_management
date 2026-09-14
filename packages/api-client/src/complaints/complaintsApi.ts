import { BaseClient } from '../client/baseClient';
import { ApiResponse, PaginatedResponse, RequestOptions } from '../types/common';
import { Complaint, ComplaintStatus } from '../types/domain';

export interface CreateComplaintInput {
  title: string;
  description: string;
  complaintType: string;
  hostelId?: string;
  roomId?: string;
  images?: string[];
  priority?: string;
}

export class ComplaintsApi {
  constructor(private client: BaseClient) {}

  async getComplaints(
    params?: Record<string, unknown>,
    options?: RequestOptions
  ): Promise<PaginatedResponse<Complaint>> {
    return this.client.get<PaginatedResponse<Complaint>>('/owner/complaints', { ...options, params });
  }

  async getStudentComplaints(
    options?: RequestOptions
  ): Promise<ApiResponse<Complaint[]>> {
    return this.client.get<ApiResponse<Complaint[]>>('/student/complaints', options);
  }

  async getWardenComplaints(
    params?: Record<string, unknown>,
    options?: RequestOptions
  ): Promise<PaginatedResponse<Complaint>> {
    return this.client.get<PaginatedResponse<Complaint>>('/warden/complaints', { ...options, params });
  }

  async getCleanerComplaints(
    options?: RequestOptions
  ): Promise<ApiResponse<Complaint[]>> {
    return this.client.get<ApiResponse<Complaint[]>>('/cleaner/complaints', options);
  }

  async createComplaint(
    data: CreateComplaintInput,
    options?: RequestOptions
  ): Promise<ApiResponse<Complaint>> {
    return this.client.post<ApiResponse<Complaint>>('/student/complaints', data, options);
  }

  async updateComplaintStatus(
    complaintId: string,
    status: ComplaintStatus,
    resolutionNotes?: string,
    options?: RequestOptions
  ): Promise<ApiResponse<Complaint>> {
    return this.client.put<ApiResponse<Complaint>>(
      `/warden/complaints/${complaintId}/status`,
      { status, resolutionNotes },
      options
    );
  }

  async resolveComplaint(
    complaintId: string,
    resolutionNotes: string,
    options?: RequestOptions
  ): Promise<ApiResponse<Complaint>> {
    return this.client.put<ApiResponse<Complaint>>(
      `/warden/complaints/${complaintId}/status`,
      { status: 'resolved', resolutionNotes },
      options
    );
  }

  async assignComplaint(
    complaintId: string,
    staffId: string,
    options?: RequestOptions
  ): Promise<ApiResponse<Complaint>> {
    return this.client.put<ApiResponse<Complaint>>(
      `/warden/complaints/${complaintId}/assign`,
      { assignedTo: staffId },
      options
    );
  }
}
