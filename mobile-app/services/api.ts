import axios, { AxiosInstance, AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, STORAGE_KEYS } from '../constants/config';

/** Extract a user-friendly message from an API error (backend message, network, or fallback). */
export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const msg = error.response?.data?.message;
    if (typeof msg === 'string' && msg.trim()) return msg;
    if (error.response?.status === 500) return 'Server error. Please try again later.';
    if (error.response?.status === 404) return 'Not found.';
    if (error.response?.status === 401) return 'Invalid email or password.';
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) return 'Request timed out.';
    if (error.code === 'ERR_NETWORK' || !error.response) return 'Network error. Check your connection.';
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong. Please try again.';
}

class ApiService {
  private api: AxiosInstance;
  private tokenCache: string | null = null;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor: use cached token when possible for faster requests
    this.api.interceptors.request.use(
      async (config) => {
        let token = this.tokenCache;
        if (token == null) {
          token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
          if (token) this.tokenCache = token;
        }
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        // Ngrok free tier shows a browser warning page; this header skips it so we get the API response
        const base = config.baseURL ?? this.api.defaults.baseURL ?? '';
        if (typeof base === 'string' && base.includes('ngrok')) {
          config.headers['ngrok-skip-browser-warning'] = 'true';
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor: clear auth and cache on 401
    this.api.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 401) {
          this.tokenCache = null;
          await AsyncStorage.removeItem(STORAGE_KEYS.TOKEN);
          await AsyncStorage.removeItem(STORAGE_KEYS.USER);
        }
        const message = getApiErrorMessage(error);
        return Promise.reject(new Error(message));
      }
    );
  }

  /** Call after login so subsequent requests use the new token without reading storage. */
  setToken(token: string | null) {
    this.tokenCache = token;
  }

  // Auth APIs – backend returns { success, data: { id, name, email, role, token, ... } }
  async login(email: string, password: string) {
    const response = await this.api.post<{ success: boolean; data: any }>('/auth/login', { email, password });
    const body = response.data;
    if (!body?.success || !body?.data) throw new Error('Invalid login response');
    return body;
  }

  async register(data: any) {
    const response = await this.api.post<{ success: boolean; data: any }>('/auth/register', data);
    const body = response.data;
    if (!body?.success || !body?.data) throw new Error('Invalid register response');
    return body;
  }

  async getCurrentUser() {
    const response = await this.api.get('/auth/me');
    return response.data;
  }

  // Owner APIs
  async getHostels() {
    const response = await this.api.get('/owner/hostels');
    return response.data;
  }

  async createHostel(data: any) {
    const response = await this.api.post('/owner/hostels', data);
    return response.data;
  }

  async getHostel(hostelId: string) {
    const response = await this.api.get(`/owner/hostels/${hostelId}`);
    return response.data;
  }

  async updateHostel(hostelId: string, data: any) {
    const response = await this.api.put(`/owner/hostels/${hostelId}`, data);
    return response.data;
  }

  async uploadHostelImages(hostelId: string, images: FormData) {
    const response = await this.api.post(`/owner/hostels/${hostelId}/images`, images, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async deleteHostelImage(hostelId: string, imageUrl: string) {
    const response = await this.api.delete(
      `/owner/hostels/${hostelId}/images/${encodeURIComponent(imageUrl)}`
    );
    return response.data;
  }

  async setCoverImage(hostelId: string, imageUrl: string) {
    const response = await this.api.put(`/owner/hostels/${hostelId}/cover-image`, { imageUrl });
    return response.data;
  }

  async createBlock(data: any) {
    const response = await this.api.post('/owner/blocks', data);
    return response.data;
  }

  async getBlocks(hostelId: string) {
    const response = await this.api.get(`/owner/hostels/${hostelId}/blocks`);
    const body = response.data as { data?: any[] };
    return body?.data ?? response.data ?? [];
  }

  async getRooms(params?: { hostelId?: string; blockId?: string; status?: string; category?: string }) {
    const response = await this.api.get('/owner/rooms', { params });
    const body = response.data as { data?: any[] };
    return body?.data ?? response.data ?? [];
  }

  async getRoom(roomId: string) {
    const response = await this.api.get(`/owner/rooms/${roomId}`);
    const body = response.data as { data?: any };
    return body?.data ?? response.data;
  }

  async createRoom(data: any) {
    const response = await this.api.post('/owner/rooms', data);
    const body = response.data as { data?: any };
    return body?.data ?? response.data;
  }

  async updateRoom(roomId: string, data: any) {
    const response = await this.api.put(`/owner/rooms/${roomId}`, data);
    const body = response.data as { data?: any };
    return body?.data ?? response.data;
  }

  async deleteRoom(roomId: string) {
    await this.api.delete(`/owner/rooms/${roomId}`);
  }

  async uploadRoomImages(roomId: string, formData: FormData) {
    const response = await this.api.post(`/owner/rooms/${roomId}/images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async deleteRoomImage(roomId: string, imageUrl: string) {
    await this.api.delete(
      `/owner/rooms/${roomId}/images/${encodeURIComponent(imageUrl)}`
    );
  }

  async setRoomCoverImage(roomId: string, imageUrl: string) {
    const response = await this.api.put(`/owner/rooms/${roomId}/cover-image`, {
      imageUrl,
    });
    return response.data;
  }

  async updateHostelAmenities(hostelId: string, amenities: string[]) {
    const response = await this.api.put(`/owner/hostels/${hostelId}/amenities`, { amenities });
    return response.data;
  }

  async getUsers(params?: any) {
    const response = await this.api.get('/owner/users', { params });
    return response.data;
  }

  async createUser(data: any) {
    const response = await this.api.post('/owner/users', data);
    return response.data;
  }

  async getUser(userId: string) {
    const response = await this.api.get(`/owner/users/${userId}`);
    return response.data;
  }

  async updateUser(userId: string, data: any) {
    const response = await this.api.put(`/owner/users/${userId}`, data);
    return response.data;
  }

  async deleteUser(userId: string) {
    await this.api.delete(`/owner/users/${userId}`);
  }

  async getAnalytics(type: 'attendance' | 'violations' | 'discipline', params?: any) {
    const response = await this.api.get(`/owner/analytics/${type}`, { params });
    return response.data;
  }

  async getDashboardKPIs(params?: any) {
    const response = await this.api.get('/owner/dashboard/kpis', { params });
    return response.data;
  }

  async getStaffPerformance(params?: any) {
    const response = await this.api.get('/owner/analytics/staff-performance', { params });
    return response.data;
  }

  async getOccupancyReport(params?: any) {
    const response = await this.api.get('/owner/analytics/occupancy', { params });
    return response.data;
  }

  async getFinancialReport(params?: any) {
    const response = await this.api.get('/owner/analytics/financial', { params });
    return response.data;
  }

  async getRecentViolations(hostelId?: string, limit?: number, from?: string, to?: string) {
    const params: any = {};
    if (hostelId) params.hostelId = hostelId;
    if (limit != null) params.limit = limit;
    if (from) params.from = from;
    if (to) params.to = to;
    const response = await this.api.get('/owner/violations/recent', { params });
    const body = response.data as { success?: boolean; data?: any[] };
    return body?.data ?? [];
  }

  async getGateLogs(params?: { hostelId?: string; from?: string; to?: string; studentId?: string }) {
    const response = await this.api.get('/owner/gate-logs', { params });
    const body = response.data as { success?: boolean; data?: { events?: any[] } };
    return body?.data?.events ?? [];
  }

  async getMessFeedback(hostelId?: string, limit?: number) {
    const params: any = {};
    if (hostelId) params.hostelId = hostelId;
    if (limit != null) params.limit = limit;
    const response = await this.api.get('/owner/mess-feedback', { params });
    const body = response.data as { success?: boolean; data?: any[] };
    return body?.data ?? [];
  }

  async getPayments(params?: any) {
    const response = await this.api.get('/owner/payments', { params });
    return response.data;
  }

  async createPayment(data: any) {
    const response = await this.api.post('/owner/payments', data);
    return response.data;
  }

  async getFeeStructures(hostelId: string) {
    const response = await this.api.get(`/owner/hostels/${hostelId}/fee-structure`);
    return response.data;
  }

  async getGeoFences(hostelId: string) {
    const response = await this.api.get(`/owner/hostels/${hostelId}/geo-fence`);
    return response.data;
  }

  async getTemplates(hostelId: string) {
    const response = await this.api.get(`/owner/hostels/${hostelId}/templates`);
    return response.data;
  }

  async getOwnerNotifications(hostelId: string) {
    const response = await this.api.get(`/owner/hostels/${hostelId}/notifications`);
    return response.data;
  }

  async getOwnerVisitorRequests() {
    const response = await this.api.get('/owner/visitors');
    const body = response.data as { success?: boolean; data?: any[] };
    return body?.data ?? [];
  }

  async approveOwnerVisitorRequest(visitorId: string) {
    const response = await this.api.post(`/owner/visitors/${visitorId}/approve`);
    return response.data;
  }

  async rejectOwnerVisitorRequest(visitorId: string, rejectionReason: string) {
    const response = await this.api.post(`/owner/visitors/${visitorId}/reject`, { rejectionReason });
    return response.data;
  }

  async getMessSchedules(hostelId: string) {
    const response = await this.api.get(`/owner/hostels/${hostelId}/mess`);
    const body = response.data as { success?: boolean; data?: any[] };
    if (!body?.success) throw new Error('Failed to load mess schedules');
    return body.data ?? [];
  }

  async createMessSchedule(hostelId: string, data: { mealType: string; title?: string; items?: string[]; startTime: string; endTime: string; dayOfWeek?: number | null; active?: boolean; order?: number }) {
    const response = await this.api.post(`/owner/hostels/${hostelId}/mess`, data);
    return response.data;
  }

  async updateMessSchedule(hostelId: string, scheduleId: string, data: Partial<{ mealType: string; title: string; items: string[]; startTime: string; endTime: string; dayOfWeek: number | null; active: boolean; order: number }>) {
    const response = await this.api.put(`/owner/hostels/${hostelId}/mess/${scheduleId}`, data);
    return response.data;
  }

  async deleteMessSchedule(hostelId: string, scheduleId: string) {
    const response = await this.api.delete(`/owner/hostels/${hostelId}/mess/${scheduleId}`);
    return response.data;
  }

  async getAuditLogs(params?: any) {
    const response = await this.api.get('/owner/audit-logs', { params });
    return response.data;
  }

  async getSupportTickets() {
    const response = await this.api.get('/owner/support-tickets');
    return response.data;
  }

  async createSupportTicket(data: any) {
    const response = await this.api.post('/owner/support-tickets', data);
    return response.data;
  }

  // Additional Owner APIs
  async setRoomPricing(data: any) {
    const response = await this.api.put('/owner/rooms/pricing', data);
    return response.data;
  }

  async approveStudentOnboarding(studentId: string) {
    const response = await this.api.post(`/owner/students/${studentId}/approve`);
    return response.data;
  }

  async updateStudentStatus(studentId: string, status: string) {
    const response = await this.api.put(`/owner/students/${studentId}/status`, { status });
    return response.data;
  }

  async createCurfewRule(data: any) {
    const response = await this.api.post('/owner/rules/curfew', data);
    return response.data;
  }

  async createLateEntryRule(data: any) {
    const response = await this.api.post('/owner/rules/late-entry', data);
    return response.data;
  }

  async createLeavePolicy(data: any) {
    const response = await this.api.post('/owner/rules/leave-policy', data);
    return response.data;
  }

  async createGeoFence(data: any) {
    const response = await this.api.post('/owner/geo-fence', data);
    return response.data;
  }

  async createFeeStructure(data: any) {
    const response = await this.api.post('/owner/fee-structure', data);
    return response.data;
  }

  async createTemplate(data: any) {
    const response = await this.api.post('/owner/templates', data);
    return response.data;
  }

  async sendBroadcast(data: any) {
    const response = await this.api.post('/owner/notifications', data);
    return response.data;
  }

  async triggerAttendanceCheck(hostelId: string) {
    const response = await this.api.post('/owner/attendance/check', { hostelId });
    return response.data;
  }

  async getStudentLocations(params?: any) {
    const response = await this.api.get('/owner/students/locations', { params });
    return response.data;
  }

  async getLocationPermissionStatus(hostelId?: string) {
    const response = await this.api.get('/owner/students/location-permissions', { params: { hostelId } });
    return response.data;
  }

  async getStudentsWithAttendance(hostelId?: string) {
    const params = hostelId ? { hostelId } : {};
    const response = await this.api.get('/owner/students/with-attendance', { params });
    const body = response.data as { success?: boolean; data?: any[] };
    return body?.data ?? [];
  }

  async getDailyAttendance(params?: { hostelId?: string; from?: string; to?: string }) {
    const response = await this.api.get('/owner/attendance/daily', { params });
    const body = response.data as { success?: boolean; data?: any[] };
    return body?.data ?? [];
  }

  async getLeaveRequests(hostelId?: string, status?: string) {
    const params: Record<string, string> = {};
    if (hostelId) params.hostelId = hostelId;
    if (status) params.status = status;
    const response = await this.api.get('/owner/leave-requests', { params });
    const body = response.data as { success?: boolean; data?: any[] };
    return body?.data ?? [];
  }

  async approveLeaveRequest(permissionId: string) {
    const response = await this.api.post(`/owner/leave-requests/${permissionId}/approve`);
    return response.data;
  }

  async rejectLeaveRequest(permissionId: string, rejectionReason?: string) {
    const response = await this.api.post(`/owner/leave-requests/${permissionId}/reject`, { rejectionReason });
    return response.data;
  }

  async getMaintenanceComplaints(hostelId?: string, status?: string) {
    const params: Record<string, string> = {};
    if (hostelId) params.hostelId = hostelId;
    if (status) params.status = status;
    const response = await this.api.get('/owner/maintenance', { params });
    const body = response.data as { success?: boolean; data?: any[] };
    return body?.data ?? [];
  }

  async updateComplaintStatus(complaintId: string, status: string, resolutionNotes?: string) {
    const response = await this.api.put(`/owner/complaints/${complaintId}/status`, { status, resolutionNotes });
    return response.data;
  }

  // Warden APIs
  async getDashboard(hostelId?: string) {
    const response = await this.api.get('/warden/dashboard', { params: { hostelId } });
    return response.data;
  }

  async getPendingPermissions() {
    const response = await this.api.get('/warden/permissions/pending');
    return response.data;
  }

  async approvePermission(permissionId: string) {
    const response = await this.api.post(`/warden/permissions/${permissionId}/approve`);
    return response.data;
  }

  async rejectPermission(permissionId: string, reason: string) {
    const response = await this.api.post(`/warden/permissions/${permissionId}/reject`, { rejectionReason: reason });
    return response.data;
  }

  async getViolations() {
    const response = await this.api.get('/warden/violations');
    return response.data;
  }

  async createViolation(data: any) {
    const response = await this.api.post('/warden/violations', data);
    return response.data;
  }

  async getVisitors() {
    const response = await this.api.get('/warden/visitors');
    return response.data;
  }

  async approveVisitor(visitorId: string) {
    const response = await this.api.post(`/warden/visitors/${visitorId}/approve`);
    return response.data;
  }

  async rejectVisitor(visitorId: string, reason: string) {
    const response = await this.api.post(`/warden/visitors/${visitorId}/reject`, { rejectionReason: reason });
    return response.data;
  }

  async getActiveEmergencies() {
    const response = await this.api.get('/warden/emergencies');
    return response.data;
  }

  // Student APIs
  async getProfile() {
    const response = await this.api.get('/student/profile');
    return response.data;
  }

  async updateProfile(data: any) {
    const response = await this.api.put('/student/profile', data);
    return response.data;
  }

  async getStatus() {
    const response = await this.api.get('/student/status');
    return response.data;
  }

  async checkIn(location: { latitude: number; longitude: number }, autoCheckIn?: boolean) {
    const response = await this.api.post('/student/check-in', { location, autoCheckIn: !!autoCheckIn });
    return response.data;
  }

  async checkOut(location: { latitude: number; longitude: number }) {
    const response = await this.api.post('/student/check-out', { location });
    return response.data;
  }

  async getAttendanceAnalytics(period: 'daily' | 'week' | 'month' | 'year' = 'week') {
    const response = await this.api.get('/student/attendance/analytics', {
      params: { period },
      timeout: 15000,
    });
    const body = response.data as { success?: boolean; data?: any };
    if (!body?.success || body.data == null) throw new Error('Failed to load attendance analytics');
    return body.data;
  }

  async getHostelBoundary() {
    const response = await this.api.get('/student/hostel-boundary');
    const body = response.data as { success?: boolean; data?: any };
    if (!body?.success || !body?.data) throw new Error('Failed to load hostel boundary');
    return body.data;
  }

  async updateLocation(location: any, accuracy?: number) {
    const response = await this.api.post('/student/location/update', { location, accuracy });
    return response.data;
  }

  async updateLocationPermission(status: 'granted' | 'denied' | 'not_requested') {
    const response = await this.api.put('/student/location/permission', { status });
    return response.data;
  }

  async registerPushToken(pushToken: string) {
    const response = await this.api.post('/student/push-token', { pushToken });
    return response.data;
  }

  async clearPushToken() {
    const response = await this.api.delete('/student/push-token');
    return response.data;
  }

  async registerExpoPushToken(expoPushToken: string) {
    const response = await this.api.post('/student/expo-push-token', { expoPushToken });
    return response.data;
  }

  async getPermissionRequests() {
    const response = await this.api.get('/student/permissions');
    return response.data;
  }

  async createPermissionRequest(data: any) {
    const response = await this.api.post('/student/permissions', data);
    return response.data;
  }

  async cancelPermissionRequest(permissionId: string) {
    const response = await this.api.post(`/student/permissions/${permissionId}/cancel`);
    return response.data;
  }

  async getViolationHistory() {
    const response = await this.api.get('/student/violations');
    return response.data;
  }

  async getComplaints() {
    const response = await this.api.get('/student/complaints');
    return response.data;
  }

  async createComplaint(data: any) {
    const response = await this.api.post('/student/complaints', data);
    return response.data;
  }

  async createEmergency(data: any) {
    const response = await this.api.post('/student/emergency', data);
    return response.data;
  }

  async getEmergencyHistory() {
    const response = await this.api.get('/student/emergency');
    return response.data;
  }

  async getNotifications() {
    const response = await this.api.get('/student/notifications');
    return response.data;
  }

  async markNotificationRead(notificationId: string) {
    const response = await this.api.post(`/student/notifications/${notificationId}/read`);
    return response.data;
  }

  async dismissNotification(notificationId: string) {
    const response = await this.api.post(`/student/notifications/${notificationId}/dismiss`);
    return response.data;
  }

  async getVisitorRequests() {
    const response = await this.api.get('/student/visitors');
    return response.data;
  }

  async createVisitorRequest(data: any) {
    const response = await this.api.post('/student/visitors', data);
    return response.data;
  }

  async getMessSchedule() {
    const response = await this.api.get('/student/mess');
    const body = response.data as { success?: boolean; data?: any[] };
    if (!body?.success) throw new Error('Failed to load mess schedule');
    return body.data ?? [];
  }

  async submitMessFeedback(data: any) {
    const response = await this.api.post('/student/mess/feedback', data);
    return response.data;
  }

  async getStudentSupportTickets() {
    const response = await this.api.get('/student/support-tickets');
    return response.data;
  }

  async createStudentSupportTicket(data: any) {
    const response = await this.api.post('/student/support-tickets', data);
    return response.data;
  }

  async getMyFeeStructure() {
    const response = await this.api.get('/student/fee-structure');
    const body = response.data as { success?: boolean; data?: any[] };
    return body?.data ?? [];
  }

  async getMyPayments() {
    const response = await this.api.get('/student/payments');
    const body = response.data as { success?: boolean; data?: any[] };
    return body?.data ?? [];
  }

  async createRazorpayOrder(data: { amount: number; type?: string; feeStructureId?: string }) {
    const response = await this.api.post('/student/payments/create-order', data);
    return response.data;
  }

  /** Create Razorpay order for an existing pending payment (owner-created). */
  async createRazorpayOrderForPayment(paymentId: string) {
    const response = await this.api.post(`/student/payments/${paymentId}/create-order`);
    return response.data;
  }

  async verifyRazorpayPayment(data: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
    const response = await this.api.post('/student/payments/verify', data);
    return response.data;
  }

  // Cleaner APIs
  async getTasks(params?: any) {
    const response = await this.api.get('/cleaner/tasks', { params });
    return response.data;
  }

  async getTask(taskId: string) {
    const response = await this.api.get(`/cleaner/tasks/${taskId}`);
    return response.data;
  }

  async updateTaskStatus(taskId: string, status: string) {
    const response = await this.api.put(`/cleaner/tasks/${taskId}/status`, { status });
    return response.data;
  }

  async completeTask(taskId: string, data: any) {
    const response = await this.api.post(`/cleaner/tasks/${taskId}/complete`, data);
    return response.data;
  }

  async getAssignedComplaints() {
    const response = await this.api.get('/cleaner/complaints');
    return response.data;
  }

  async updateComplaintStatus(complaintId: string, status: string, notes?: string) {
    const response = await this.api.put(`/cleaner/complaints/${complaintId}/status`, { status, resolutionNotes: notes });
    return response.data;
  }

  async clockIn() {
    const response = await this.api.post('/cleaner/attendance/clock-in');
    return response.data;
  }

  async clockOut() {
    const response = await this.api.post('/cleaner/attendance/clock-out');
    return response.data;
  }

  async getShiftSchedule() {
    const response = await this.api.get('/cleaner/schedule');
    return response.data;
  }
}

export default new ApiService();

