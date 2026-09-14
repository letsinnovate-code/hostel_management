import { BaseClient } from '../client/baseClient';
import { ApiResponse, PaginatedResponse, RequestOptions } from '../types/common';
import { Visitor } from '../types/domain';

export interface CreateVisitorInput {
  visitorName: string;
  visitorPhone: string;
  visitorIdProof?: string;
  purpose: string;
  visitDate?: string | Date;
  visitingStudentId?: string;
}

export class VisitorsApi {
  constructor(private client: BaseClient) {}

  async getVisitors(
    params?: Record<string, unknown>,
    options?: RequestOptions
  ): Promise<PaginatedResponse<Visitor>> {
    return this.client.get<PaginatedResponse<Visitor>>('/owner/visitors', { ...options, params });
  }

  async getWardenVisitors(
    params?: Record<string, unknown>,
    options?: RequestOptions
  ): Promise<PaginatedResponse<Visitor>> {
    return this.client.get<PaginatedResponse<Visitor>>('/warden/visitors', { ...options, params });
  }

  async getStudentVisitors(
    options?: RequestOptions
  ): Promise<ApiResponse<Visitor[]>> {
    return this.client.get<ApiResponse<Visitor[]>>('/student/visitors', options);
  }

  async createVisitor(
    data: CreateVisitorInput,
    options?: RequestOptions
  ): Promise<ApiResponse<Visitor>> {
    return this.client.post<ApiResponse<Visitor>>('/student/visitors', data, options);
  }

  async approveVisitor(
    visitorId: string,
    options?: RequestOptions
  ): Promise<ApiResponse<Visitor>> {
    return this.client.post<ApiResponse<Visitor>>(`/warden/visitors/${visitorId}/approve`, {}, options);
  }

  async rejectVisitor(
    visitorId: string,
    rejectionReason?: string,
    options?: RequestOptions
  ): Promise<ApiResponse<Visitor>> {
    return this.client.post<ApiResponse<Visitor>>(
      `/warden/visitors/${visitorId}/reject`,
      { rejectionReason },
      options
    );
  }

  async checkoutVisitor(
    visitorId: string,
    options?: RequestOptions
  ): Promise<ApiResponse<Visitor>> {
    return this.client.post<ApiResponse<Visitor>>(`/warden/visitors/${visitorId}/checkout`, {}, options);
  }
}
