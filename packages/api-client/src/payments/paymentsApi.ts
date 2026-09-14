import { BaseClient } from '../client/baseClient';
import { ApiResponse, PaginatedResponse, RequestOptions } from '../types/common';
import { Payment } from '../types/domain';

export interface CreateOrderInput {
  amount: number;
  type: string;
  hostelId?: string;
  planId?: string;
}

export interface VerifyPaymentInput {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export class PaymentsApi {
  constructor(private client: BaseClient) {}

  async getPayments(
    params?: Record<string, unknown>,
    options?: RequestOptions
  ): Promise<PaginatedResponse<Payment>> {
    return this.client.get<PaginatedResponse<Payment>>('/owner/payments', { ...options, params });
  }

  async getStudentPayments(
    options?: RequestOptions
  ): Promise<ApiResponse<Payment[]>> {
    return this.client.get<ApiResponse<Payment[]>>('/student/payments', options);
  }

  async createOrder(
    data: CreateOrderInput,
    options?: RequestOptions
  ): Promise<ApiResponse<{ orderId: string; amount: number; currency: string }>> {
    return this.client.post<ApiResponse<{ orderId: string; amount: number; currency: string }>>(
      '/student/payments/create-order',
      data,
      options
    );
  }

  async verifyPayment(
    data: VerifyPaymentInput,
    options?: RequestOptions
  ): Promise<ApiResponse<{ verified: boolean; payment: Payment }>> {
    return this.client.post<ApiResponse<{ verified: boolean; payment: Payment }>>(
      '/student/payments/verify',
      data,
      options
    );
  }

  async getFeeStructure(
    hostelId?: string,
    options?: RequestOptions
  ): Promise<ApiResponse<unknown>> {
    return this.client.get<ApiResponse<unknown>>('/owner/fee-structure', {
      ...options,
      params: { hostelId, ...options?.params },
    });
  }
}
