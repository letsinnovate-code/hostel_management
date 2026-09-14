import { BaseClient } from '../client/baseClient';
import { ApiResponse, RequestOptions } from '../types/common';
import {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  ChangePasswordRequest,
  AuthUser,
} from '../types/auth';

export class AuthApi {
  constructor(private client: BaseClient) {}

  async login(credentials: LoginRequest, options?: RequestOptions): Promise<ApiResponse<LoginResponse>> {
    return this.client.post<ApiResponse<LoginResponse>>('/auth/login', credentials, options);
  }

  async register(
    data: RegisterRequest,
    options?: RequestOptions
  ): Promise<ApiResponse<RegisterResponse>> {
    return this.client.post<ApiResponse<RegisterResponse>>('/auth/register', data, options);
  }

  async getCurrentUser(options?: RequestOptions): Promise<ApiResponse<AuthUser>> {
    return this.client.get<ApiResponse<AuthUser>>('/auth/me', options);
  }

  async setCurrentRole(role: string, options?: RequestOptions): Promise<ApiResponse<{ currentRole: string }>> {
    return this.client.post<ApiResponse<{ currentRole: string }>>('/auth/set-role', { role }, options);
  }

  async changePassword(
    data: ChangePasswordRequest,
    options?: RequestOptions
  ): Promise<ApiResponse<{ message: string }>> {
    return this.client.put<ApiResponse<{ message: string }>>('/auth/change-password', data, options);
  }

  async registerStudentViaQR(
    data: Record<string, unknown>,
    options?: RequestOptions
  ): Promise<ApiResponse<unknown>> {
    return this.client.post<ApiResponse<unknown>>('/auth/register-student-qr', data, options);
  }
}
