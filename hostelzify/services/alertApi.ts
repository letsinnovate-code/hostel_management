// Alert & Notification API service methods
// Add these to the main ApiService class in api.ts,
// or import this file directly.
import axios, { AxiosInstance } from 'axios';
import { API_BASE_URL, STORAGE_KEYS } from '../constants/config';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export interface AlertNotification {
  _id: string;
  type: string;
  category: string;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'active' | 'resolved' | 'expired';
  hostelId: string;
  studentId?: string;
  readBy?: { userId: string; readAt: string }[];
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

export interface CurfewViolation {
  _id: string;
  studentId: { _id: string; name: string; email: string; roomId?: string } | string;
  hostelId: string;
  violationDate: string;
  curfewTime: string;
  status: 'open' | 'resolved' | 'excused';
  alertId?: string;
  createdAt: string;
}

export interface LeaveViolation {
  _id: string;
  studentId: { _id: string; name: string; email: string } | string;
  hostelId: string;
  permissionId: string;
  expectedReturnDate: string;
  hoursOverdue: number;
  status: 'open' | 'resolved';
  escalatedToOwner: boolean;
  createdAt: string;
}

export interface DashboardStats {
  totalAlerts: number;
  unreadAlerts: number;
  activeCurfewViolations: number;
  activeLeaveViolations: number;
  currentOccupancy?: {
    inside: number;
    outside: number;
    total: number;
    percentage: number;
  };
  alertsByCategory?: Record<string, number>;
  alertsByPriority?: Record<string, number>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Alert API Service
// ─────────────────────────────────────────────────────────────────────────────
class AlertApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    });

    this.api.interceptors.request.use((config) => {
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        if (token) config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  // ── Notifications (all roles) ─────────────────────────────────────────────
  async getAlertNotifications(params?: {
    page?: number;
    limit?: number;
    status?: string;
    priority?: string;
    category?: string;
    hostelId?: string;
  }) {
    const response = await this.api.get('/alerts/notifications', { params });
    return response.data;
  }

  async getUnreadCount(hostelId?: string) {
    const response = await this.api.get('/alerts/notifications/unread-count', {
      params: hostelId ? { hostelId } : {},
    });
    return response.data;
  }

  async markNotificationRead(alertId: string) {
    const response = await this.api.put(`/alerts/notifications/${alertId}/read`);
    return response.data;
  }

  async markAllRead(hostelId?: string) {
    const response = await this.api.put('/alerts/notifications/read-all', { hostelId });
    return response.data;
  }

  // ── Alert resolution (warden+) ────────────────────────────────────────────
  async resolveAlert(alertId: string, notes?: string) {
    const response = await this.api.put(`/alerts/${alertId}/resolve`, { notes });
    return response.data;
  }

  // ── Curfew (warden+) ─────────────────────────────────────────────────────
  async getCurfewViolations(params?: {
    hostelId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const response = await this.api.get('/alerts/curfew', { params });
    return response.data;
  }

  async resolveCurfewViolation(violationId: string, notes?: string) {
    const response = await this.api.put(`/alerts/curfew/${violationId}/resolve`, { notes });
    return response.data;
  }

  async triggerCurfewCheck(hostelId: string) {
    const response = await this.api.post(`/alerts/curfew/trigger?hostelId=${hostelId}`);
    return response.data;
  }

  // ── Leave violations (warden+) ────────────────────────────────────────────
  async getLeaveViolations(params?: {
    hostelId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const response = await this.api.get('/alerts/leave-violations', { params });
    return response.data;
  }

  // ── Attendance alerts (warden+) ───────────────────────────────────────────
  async getAttendanceAlerts(params?: { hostelId?: string; page?: number; limit?: number }) {
    const response = await this.api.get('/alerts/attendance', { params });
    return response.data;
  }

  // ── Occupancy (warden+) ───────────────────────────────────────────────────
  async getOccupancy(hostelId: string) {
    const response = await this.api.get('/alerts/occupancy', { params: { hostelId } });
    return response.data;
  }

  // ── Dashboard stats (warden+) ─────────────────────────────────────────────
  async getDashboardStats(hostelId: string) {
    const response = await this.api.get('/alerts/dashboard-stats', { params: { hostelId } });
    return response.data;
  }

  // ── Emergency broadcast (owner+) ─────────────────────────────────────────
  async broadcastEmergency(data: {
    emergencyType: string;
    title: string;
    message: string;
    hostelId: string;
    scope?: string;
    floorNumber?: number;
  }) {
    const response = await this.api.post('/alerts/emergency/broadcast', data);
    return response.data;
  }

  // ── Send to all roles (warden/owner/superadmin) ───────────────────────────
  async sendToAllRoles(data: {
    title: string;
    message: string;
    hostelId?: string;
    type?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    targetRoles?: string[];
  }) {
    const response = await this.api.post('/alerts/send-to-all', data);
    return response.data;
  }
}

export const alertApi = new AlertApiService();
