/**
 * @hostelzify/api-client
 * Shared strongly-typed API client and domain types for Hostelzify
 */

import { BaseClient, ClientConfig, TokenProvider, OnUnauthorizedHandler } from './client/baseClient';
import { AuthApi } from './auth/authApi';
import { StudentsApi } from './students/studentsApi';
import { AttendanceApi } from './attendance/attendanceApi';
import { ComplaintsApi } from './complaints/complaintsApi';
import { RoomsApi } from './rooms/roomsApi';
import { VisitorsApi } from './visitors/visitorsApi';
import { PaymentsApi } from './payments/paymentsApi';

// Re-export all types
export * from './types';

// Re-export client classes and utilities
export * from './client/baseClient';
export * from './client/error';

// Re-export domain API modules
export * from './auth/authApi';
export * from './students/studentsApi';
export * from './attendance/attendanceApi';
export * from './complaints/complaintsApi';
export * from './rooms/roomsApi';
export * from './visitors/visitorsApi';
export * from './payments/paymentsApi';

/**
 * Unified ApiClient aggregating all domain-specific APIs
 */
export class ApiClient {
  public readonly client: BaseClient;
  public readonly auth: AuthApi;
  public readonly students: StudentsApi;
  public readonly attendance: AttendanceApi;
  public readonly complaints: ComplaintsApi;
  public readonly rooms: RoomsApi;
  public readonly visitors: VisitorsApi;
  public readonly payments: PaymentsApi;

  constructor(config: ClientConfig) {
    this.client = new BaseClient(config);
    this.auth = new AuthApi(this.client);
    this.students = new StudentsApi(this.client);
    this.attendance = new AttendanceApi(this.client);
    this.complaints = new ComplaintsApi(this.client);
    this.rooms = new RoomsApi(this.client);
    this.visitors = new VisitorsApi(this.client);
    this.payments = new PaymentsApi(this.client);
  }

  public setTokenProvider(provider: TokenProvider): void {
    this.client.setTokenProvider(provider);
  }

  public setUnauthorizedHandler(handler: OnUnauthorizedHandler): void {
    this.client.setUnauthorizedHandler(handler);
  }
}

/**
 * Factory function to instantiate an ApiClient
 */
export function createApiClient(config: ClientConfig): ApiClient {
  return new ApiClient(config);
}
