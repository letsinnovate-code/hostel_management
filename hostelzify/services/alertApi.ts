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
  studentId: { _id: string; name: string; email: string; roomId?: string; phone?: string } | string;
  hostelId: string;
  violationDate: string;
  curfewTime: string;
  status: 'open' | 'resolved' | 'excused' | 'pending_recheck' | 'acknowledged' | 'false_positive';
  stage?: number;
  graceExpiresAt?: string;
  parentNotified?: boolean;
  parentNotifiedAt?: string;
  parentEmail?: string;
  escalationLevel?: number;
  lastKnownActivity?: string;
  locationVerified?: boolean;
  locationMethod?: 'gps' | 'attendance' | 'manual' | 'none';
  resolutionNote?: string;
  studentReturnedAt?: string;
  minutesMissing?: number;
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

export interface CurfewTimerInfo {
  violationId: string;
  studentId: string;
  studentName: string;
  roomId: string;
  status: string;
  stage: number;
  timerStatus: 'grace_timer_running' | 'parent_timer_running' | 'terminated_returned' | 'parent_alert_executed' | 'in_grace';
  graceSecondsLeft: number;
  parentAlertSecondsLeft: number;
  graceExpiresAt?: string;
  parentAlertDeadline?: string;
  parentNotified: boolean;
  parentNotifiedAt?: string;
  studentReturnedAt?: string;
  resolvedAt?: string;
  resolutionNote?: string;
}

export interface ActiveTimersResponse {
  hostelId: string;
  hostelName: string;
  curfewTime: string;
  weekendCurfewTime?: string | null;
  gracePeriodMinutes: number;
  isCurfewActive: boolean;
  lastCurfewSweepDate?: string | null;
  activeTimersCount: number;
  terminatedCount: number;
  timers: CurfewTimerInfo[];
}

export interface CurfewConfigurationData {
  _id?: string;
  hostelId: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  durationMinutes: number;
  durationDisplay: string;
  recurrence: {
    type: 'one_time' | 'daily' | 'selected_days' | 'weekly' | 'monthly' | 'custom';
    selectedDays: string[];
  };
  gracePeriodMinutes: number;
  escalationPeriodMinutes: number;
  timezone: string;
  isActive: boolean;
  status: 'active' | 'inactive' | 'scheduled' | 'ended' | 'cancelled';
  configuredBy?: any;
  createdAt?: string;
  updatedAt?: string;
}

export interface CurfewStudentMonitoringData {
  _id: string;
  curfewSessionId: string;
  studentId: {
    _id: string;
    name: string;
    studentId?: string;
    roomId?: string;
    email?: string;
    phone?: string;
  } | string;
  studentName?: string;
  studentRegId?: string;
  studentPhone?: string;
  hostelId: string;
  roomNumber: string;
  block?: string;
  status:
    | 'INSIDE'
    | 'OUTSIDE_GRACE'
    | 'LATE_COMER'
    | 'VIOLATION'
    | 'VIOLATION_RESOLVED'
    | 'LOCATION_UNAVAILABLE'
    | 'LOCATION_PERMISSION_DENIED'
    | 'LOCATION_STALE'
    | 'LOW_ACCURACY'
    | 'ON_LEAVE';
  initialLocation?: { latitude: number; longitude: number; accuracy?: number; timestamp?: string };
  currentLocation?: { latitude: number; longitude: number; accuracy?: number; timestamp?: string };
  currentAccuracy?: number;
  lastLocationAt?: string;
  distanceFromHostel?: number;
  locationSource?: string;
  outsideSince?: string;
  graceDeadline?: string;
  secondCountdownDeadline?: string;
  thirdCountdownDeadline?: string;
  graceSecondsLeft?: number;
  secondSecondsLeft?: number;
  returnedAt?: string;
  entryTime?: string;
  entryLocation?: { latitude: number; longitude: number; accuracy?: number; distance?: number };
  delayMinutes?: number;
  totalTimeOutsideMinutes?: number;
  resolutionStatus?: 'NONE' | 'RETURNED_GRACE' | 'RETURNED_AFTER_VIOLATION' | 'MANUAL_RESOLVED';
  resolutionNote?: string;
}

export interface ActiveCurfewSessionResponse {
  hostelId: string;
  hostelName: string;
  hostelAddress?: any;
  timezone: string;
  status: 'ACTIVE' | 'SCHEDULED' | 'INACTIVE' | 'ENDED' | 'CANCELLED';
  session?: {
    _id: string;
    hostelId: string;
    scheduledStartAt?: string;
    actualStartAt?: string;
    scheduledEndAt?: string;
    actualEndAt?: string;
    curfewStartTime?: string;
    curfewEndTime?: string;
    status: string;
    triggerType: string;
    summary: {
      totalStudents: number;
      presentCount: number;
      outsideCount: number;
      lateComersCount: number;
      onLeaveCount: number;
      violationsCount: number;
      resolvedCount: number;
      parentAlertsCount: number;
    };
    notes?: string;
  } | null;
  configuration?: CurfewConfigurationData | null;
  remainingSeconds: number;
  summary: {
    totalStudents: number;
    presentCount: number;
    outsideCount: number;
    lateComersCount: number;
    onLeaveCount: number;
    violationsCount: number;
    resolvedCount: number;
    parentAlertsCount: number;
  };
  students: CurfewStudentMonitoringData[];
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

  async startImmediateCurfew(hostelId: string) {
    const response = await this.api.post(`/alerts/curfew/start-immediate?hostelId=${hostelId}`);
    return response.data;
  }

  async simulateCurfewTimeline(hostelId: string, stage: '10min' | '15min' | '30min' | 'all') {
    const response = await this.api.post('/alerts/curfew/simulate-timeline', { hostelId, stage });
    return response.data;
  }

  async escalateCurfewViolation(violationId: string, reason?: string) {
    const response = await this.api.post(`/alerts/curfew/${violationId}/escalate`, { reason });
    return response.data;
  }

  async setCurfewTime(hostelId: string, curfewTime: string, options?: { weekendCurfewTime?: string; gracePeriodMinutes?: number }) {
    const response = await this.api.post('/alerts/curfew/set-time', {
      hostelId,
      curfewTime,
      ...options,
    });
    return response.data;
  }

  async deleteCurfewViolation(violationId: string) {
    const response = await this.api.delete(`/alerts/curfew/${violationId}`);
    return response.data;
  }

  async getActiveCurfewTimers(hostelId: string) {
    const response = await this.api.get('/alerts/curfew/active-timers', { params: { hostelId } });
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

  // ── Modern Curfew Control Center & Live Presence Engine ───────────────────
  async getCurfewConfig(hostelId?: string) {
    const response = await this.api.get('/alerts/curfew/config', { params: { hostelId } });
    return response.data;
  }

  async setCurfewConfig(hostelId: string, payload: any) {
    const response = await this.api.post('/alerts/curfew/config', { ...payload, hostelId });
    return response.data;
  }

  async resetCurfew(hostelId: string) {
    const response = await this.api.post('/alerts/curfew/reset', { hostelId });
    return response.data;
  }

  async startManualCurfew(hostelId: string) {
    const response = await this.api.post('/alerts/curfew/start-manual', { hostelId });
    return response.data;
  }

  async endCurfew(hostelId: string, reason = 'warden_manual') {
    const response = await this.api.post('/alerts/curfew/end', { hostelId, reason });
    return response.data;
  }

  async getActiveCurfewSession(hostelId: string): Promise<{ success: boolean; data: ActiveCurfewSessionResponse }> {
    const response = await this.api.get('/alerts/curfew/active-session', { params: { hostelId } });
    return response.data;
  }

  async getCurfewStudents(params: {
    hostelId?: string;
    status?: string;
    room?: string;
    block?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const response = await this.api.get('/alerts/curfew/students', { params });
    return response.data;
  }

  async getCurfewHistory(hostelIdOrParams?: string | any, queryParams?: any) {
    let params: any = {};
    if (typeof hostelIdOrParams === 'string') {
      params = { hostelId: hostelIdOrParams, ...(queryParams || {}) };
    } else if (hostelIdOrParams && typeof hostelIdOrParams === 'object') {
      params = { ...hostelIdOrParams, ...(queryParams || {}) };
    }
    const response = await this.api.get('/alerts/curfew/history', { params });
    return response.data;
  }

  async submitStudentCurfewLocation(location: { latitude: number; longitude: number; accuracy?: number; timestamp?: string }) {
    const response = await this.api.post('/alerts/curfew/location-update', { location });
    return response.data;
  }
}

export const alertApi = new AlertApiService();
