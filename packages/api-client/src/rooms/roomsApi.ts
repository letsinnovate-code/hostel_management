import { BaseClient } from '../client/baseClient';
import { ApiResponse, PaginatedResponse, RequestOptions } from '../types/common';
import { Room } from '../types/domain';

export interface AssignBedInput {
  studentId: string;
  bedNumber?: string;
}

export interface TransferBedInput {
  fromRoomId: string;
  toRoomId: string;
  studentId: string;
  newBedNumber?: string;
}

export class RoomsApi {
  constructor(private client: BaseClient) {}

  async getRooms(
    params?: Record<string, unknown>,
    options?: RequestOptions
  ): Promise<PaginatedResponse<Room>> {
    return this.client.get<PaginatedResponse<Room>>('/owner/rooms', { ...options, params });
  }

  async getWardenRooms(
    params?: Record<string, unknown>,
    options?: RequestOptions
  ): Promise<PaginatedResponse<Room>> {
    return this.client.get<PaginatedResponse<Room>>('/warden/rooms', { ...options, params });
  }

  async getRoomById(
    roomId: string,
    options?: RequestOptions
  ): Promise<ApiResponse<Room>> {
    return this.client.get<ApiResponse<Room>>(`/owner/rooms/${roomId}`, options);
  }

  async createRoom(
    data: Partial<Room>,
    options?: RequestOptions
  ): Promise<ApiResponse<Room>> {
    return this.client.post<ApiResponse<Room>>('/owner/rooms', data, options);
  }

  async updateRoom(
    roomId: string,
    data: Partial<Room>,
    options?: RequestOptions
  ): Promise<ApiResponse<Room>> {
    return this.client.put<ApiResponse<Room>>(`/owner/rooms/${roomId}`, data, options);
  }

  async deleteRoom(
    roomId: string,
    options?: RequestOptions
  ): Promise<ApiResponse<{ message: string }>> {
    return this.client.delete<ApiResponse<{ message: string }>>(`/owner/rooms/${roomId}`, options);
  }

  async assignBed(
    roomId: string,
    data: AssignBedInput,
    options?: RequestOptions
  ): Promise<ApiResponse<Room>> {
    return this.client.post<ApiResponse<Room>>(`/warden/rooms/${roomId}/assign`, data, options);
  }

  async vacateBed(
    roomId: string,
    studentId: string,
    options?: RequestOptions
  ): Promise<ApiResponse<Room>> {
    return this.client.post<ApiResponse<Room>>(`/warden/rooms/${roomId}/vacate`, { studentId }, options);
  }

  async transferBed(
    data: TransferBedInput,
    options?: RequestOptions
  ): Promise<ApiResponse<{ message: string }>> {
    return this.client.post<ApiResponse<{ message: string }>>('/warden/rooms/transfer', data, options);
  }
}
