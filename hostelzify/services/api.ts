import axios, { AxiosInstance, AxiosError } from 'axios';
import { API_BASE_URL, STORAGE_KEYS } from '../constants/config';

function saveReturnPath(path: string) {
  if (typeof window !== 'undefined' && path && path !== '/login' && path !== '/register') {
    try {
      sessionStorage.setItem(STORAGE_KEYS.RETURN_PATH, path);
    } catch (_) {}
  }
}

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add token
    this.api.interceptors.request.use(
      async (config) => {
        if (typeof window !== 'undefined') {
          const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 401 && typeof window !== 'undefined') {
          const isLoginRequest = error.config?.url?.includes('/auth/login');
          const hadAuthHeader = !!(error.config?.headers?.Authorization || (error.config?.headers as any)?.authorization);
          if (!isLoginRequest && hadAuthHeader) {
            const path = window.location.pathname || '';
            if (path !== '/login') {
              saveReturnPath(path);
              localStorage.removeItem(STORAGE_KEYS.TOKEN);
              localStorage.removeItem(STORAGE_KEYS.USER);
              document.cookie = 'hostel_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax';
              window.location.href = path.startsWith('/superadmin') ? '/superadmin/login' : '/login';
            }
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth APIs
  async login(email: string, password: string) {
    const response = await this.api.post('/auth/login', { email, password });
    return response.data;
  }

  async register(data: any) {
    const response = await this.api.post('/auth/register', data);
    return response.data;
  }

  async setCurrentRole(role: string) {
    const response = await this.api.post('/auth/set-role', { role });
    return response.data;
  }

  async getCurrentUser() {
    const response = await this.api.get('/auth/me');
    return response.data;
  }

  // QR-based student self-registration (no auth token attached)
  async registerStudentViaQR(data: any) {
    const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
    const resp = await fetch(`${backendBase}/auth/register-student-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await resp.json();
    if (!resp.ok || !result.success) {
      throw new Error(result.message || 'Registration failed');
    }
    return result;
  }

  // Change own password (authenticated)
  async changePassword(currentPassword: string, newPassword: string) {
    const response = await this.api.put('/auth/change-password', { currentPassword, newPassword });
    return response.data;
  }

  // Upload self-documents after QR registration using the student's own token
  async uploadSelfDocuments(studentId: string, files: { file: File; type: string; name: string }[], token: string) {
    const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
    const formData = new FormData();
    files.forEach((doc, i) => {
      formData.append('documents', doc.file);
      formData.append(`type_${i}`, doc.type);
      formData.append(`name_${i}`, doc.name);
    });
    const resp = await fetch(`${backendBase}/public/self-documents/${studentId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const result = await resp.json();
    if (!resp.ok || !result.success) {
      throw new Error(result.message || 'Document upload failed');
    }
    return result;
  }

  // Owner APIs
  async getHostels(params?: Record<string, unknown>) {
    const response = await this.api.get('/owner/hostels', { params });
    return response.data?.data ?? response.data ?? [];
  }

  async triggerAttendanceCheck(hostelId: string) {
    const response = await this.api.post('/owner/attendance/check', { hostelId });
    return response.data;
  }

  async getDailyAttendance(params?: { hostelId?: string; from?: string; to?: string }) {
    const response = await this.api.get('/owner/attendance/daily', { params });
    return response.data;
  }

  async getGateLogs(params?: { hostelId?: string; from?: string; to?: string; studentId?: string }) {
    const response = await this.api.get('/owner/gate-logs', { params });
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

  async deleteHostel(hostelId: string) {
    const response = await this.api.delete(`/owner/hostels/${hostelId}`);
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

  async updateHostelAmenities(hostelId: string, amenities: string[]) {
    const response = await this.api.put(`/owner/hostels/${hostelId}/amenities`, { amenities });
    return response.data;
  }

  async getUsers(params?: any) {
    const response = await this.api.get('/owner/users', { params });
    const data = response.data?.data ?? response.data;
    return Array.isArray(data) ? data : [];
  }

  async getStudentsWithAttendance(hostelId?: string) {
    const response = await this.api.get('/owner/students/with-attendance', { params: hostelId ? { hostelId } : {} });
    const body = response.data as { success?: boolean; data?: any[] };
    return body?.data ?? [];
  }

  async getStudentLocations(params?: { hostelId?: string; status?: string }) {
    const response = await this.api.get('/owner/students/locations', { params });
    const body = response.data as { success?: boolean; data?: any[] };
    return body?.data ?? [];
  }

  async getUser(userId: string) {
    const response = await this.api.get(`/owner/users/${userId}`);
    return response.data;
  }

  // QR Code APIs
  async generateRegistrationInviteQR(hostelId: string) {
    const response = await this.api.get('/owner/students/registration-invite-qr', { params: { hostelId } });
    return response.data;
  }

  async getStudentQR(studentId: string) {
    const response = await this.api.get(`/owner/students/${studentId}/qr`);
    return response.data;
  }

  async verifyInviteToken(token: string) {
    const response = await this.api.get(`/public/verify-invite/${token}`);
    return response.data;
  }

  async createUser(data: any) {
    const response = await this.api.post('/owner/users', data);
    return response.data;

  }

  async updateUser(userId: string, data: any) {
    const response = await this.api.put(`/owner/users/${userId}`, data);
    return response.data;
  }

  async getAnalytics(type: 'attendance' | 'violations' | 'discipline', params?: any) {
    const response = await this.api.get(`/owner/analytics/${type}`, { params });
    return response.data;
  }



  async getPayments(params?: any) {
    const response = await this.api.get('/owner/payments', { params });
    return response.data;
  }

  async createPayment(data: any) {
    const response = await this.api.post('/owner/payments', data);
    return response.data;
  }

  async updatePaymentStatus(paymentId: string, data: { status?: string; transactionId?: string; paymentMethod?: string }) {
    const response = await this.api.put(`/owner/payments/${paymentId}/status`, data);
    return response.data;
  }

  async deletePayment(paymentId: string) {
    const response = await this.api.delete(`/owner/payments/${paymentId}`);
    return response.data;
  }

  async getFeeStructures(hostelId: string) {
    const response = await this.api.get(`/owner/hostels/${hostelId}/fee-structure`);
    return response.data;
  }

  async getApplicableFeeForStudent(hostelId: string, studentId: string, type?: string) {
    const params = type ? { type } : {};
    const response = await this.api.get(`/owner/hostels/${hostelId}/students/${studentId}/applicable-fee`, { params });
    return response.data;
  }

  async getPlans(hostelId: string) {
    const response = await this.api.get(`/owner/hostels/${hostelId}/plans`);
    return response.data;
  }

  async seedPlans(hostelId: string) {
    const response = await this.api.post(`/owner/hostels/${hostelId}/plans/seed`);
    return response.data;
  }

  async updatePlan(planId: string, data: { name?: string; amount?: number; durationMonths?: number; isActive?: boolean }) {
    const response = await this.api.put(`/owner/plans/${planId}`, data);
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

  async getOwnerNotifications(hostelId: string, params?: any) {
    const response = await this.api.get(`/owner/hostels/${hostelId}/notifications`, { params });
    return response.data;
  }

  async getOwnerNotification(notificationId: string) {
    const response = await this.api.get(`/owner/notifications/${notificationId}`);
    return response.data;
  }

  async createNotification(data: any) {
    const response = await this.api.post('/owner/notifications', data);
    return response.data;
  }

  async updateNotification(notificationId: string, data: any) {
    const response = await this.api.put(`/owner/notifications/${notificationId}`, data);
    return response.data;
  }

  async deleteNotification(notificationId: string) {
    const response = await this.api.delete(`/owner/notifications/${notificationId}`);
    return response.data;
  }

  async sendNotificationReminder(notificationId: string) {
    const response = await this.api.post(`/owner/notifications/${notificationId}/send-reminder`);
    return response.data;
  }

  async getAuditLogs(params?: any) {
    const response = await this.api.get('/owner/audit-logs', { params });
    return response.data;
  }

  async exportOwnerData(params?: { hostelId?: string; format?: string; type?: string }) {
    const response = await this.api.get('/owner/export', {
      params,
      responseType: params?.format === 'csv' ? 'blob' : 'json',
    });
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

  async resendWelcomeEmail(studentId: string) {
    const response = await this.api.post(`/owner/students/${studentId}/resend-welcome-email`);
    return response.data;
  }

  async deleteUser(userId: string) {
    const response = await this.api.delete(`/owner/users/${userId}`);
    return response.data;
  }

  async uploadStudentProfileImage(studentId: string, image: File) {
    const formData = new FormData();
    formData.append('image', image);
    const response = await this.api.post(`/owner/students/${studentId}/profile-image`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async uploadStudentDocuments(studentId: string, documents: File[], documentType?: string, documentName?: string) {
    const formData = new FormData();
    documents.forEach((doc) => formData.append('documents', doc));
    if (documentType) formData.append('documentType', documentType);
    if (documentName) formData.append('documentName', documentName);
    const response = await this.api.post(`/owner/students/${studentId}/documents`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async deleteStudentDocument(studentId: string, documentId: string) {
    const response = await this.api.delete(`/owner/students/${studentId}/documents/${documentId}`);
    return response.data;
  }

  // Room Management
  async getRooms(params?: any) {
    const response = await this.api.get('/owner/rooms', { params });
    return response.data;
  }

  async getRoom(roomId: string) {
    const response = await this.api.get(`/owner/rooms/${roomId}`);
    return response.data;
  }

  async createRoom(data: any) {
    const response = await this.api.post('/owner/rooms', data);
    return response.data;
  }

  async updateRoom(roomId: string, data: any) {
    const response = await this.api.put(`/owner/rooms/${roomId}`, data);
    return response.data;
  }

  async deleteRoom(roomId: string) {
    const response = await this.api.delete(`/owner/rooms/${roomId}`);
    return response.data;
  }

  async uploadRoomImages(roomId: string, images: File[]) {
    const formData = new FormData();
    images.forEach((image) => {
      formData.append('images', image);
    });
    const response = await this.api.post(`/owner/rooms/${roomId}/images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async deleteRoomImage(roomId: string, imageUrl: string) {
    const response = await this.api.delete(`/owner/rooms/${roomId}/images/${encodeURIComponent(imageUrl)}`);
    return response.data;
  }

  async setRoomCoverImage(roomId: string, imageUrl: string) {
    const response = await this.api.put(`/owner/rooms/${roomId}/cover-image`, { imageUrl });
    return response.data;
  }

  async getBlocks(hostelId: string) {
    const response = await this.api.get(`/owner/hostels/${hostelId}/blocks`);
    return response.data;
  }

  // Amenity Management
  async getAmenities(params?: any) {
    const response = await this.api.get('/owner/amenities', { params });
    return response.data;
  }

  async getAmenity(amenityId: string) {
    const response = await this.api.get(`/owner/amenities/${amenityId}`);
    return response.data;
  }

  async createAmenity(data: any) {
    const response = await this.api.post('/owner/amenities', data);
    return response.data;
  }

  async updateAmenity(amenityId: string, data: any) {
    const response = await this.api.put(`/owner/amenities/${amenityId}`, data);
    return response.data;
  }

  async deleteAmenity(amenityId: string) {
    const response = await this.api.delete(`/owner/amenities/${amenityId}`);
    return response.data;
  }

  async uploadAmenityImages(amenityId: string, images: File[]) {
    const formData = new FormData();
    images.forEach((image) => {
      formData.append('images', image);
    });
    const response = await this.api.post(`/owner/amenities/${amenityId}/images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async deleteAmenityImage(amenityId: string, imageUrl: string) {
    const response = await this.api.delete(`/owner/amenities/${amenityId}/images/${encodeURIComponent(imageUrl)}`);
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

  async geocodeAddress(address: any) {
    const response = await this.api.post('/owner/geocode', { address });
    return response.data;
  }

  // Warden APIs
  async getDashboard(hostelId?: string) {
    const response = await this.api.get('/warden/dashboard', { params: { hostelId } });
    return response.data;
  }

  // Leave & Permission Management APIs
  async getWardenLeaves(params?: {
    search?: string;
    status?: string;
    permissionType?: string;
    startDate?: string;
    endDate?: string;
    floor?: string | number;
    room?: string;
    sortBy?: string;
    sortOrder?: string;
    page?: number;
    limit?: number;
    hostelId?: string;
  }) {
    const response = await this.api.get('/warden/leaves', { params });
    return response.data;
  }

  async getWardenCurrentlyAbsent(params?: { hostelId?: string }) {
    const response = await this.api.get('/warden/leaves/currently-absent', { params });
    return response.data;
  }

  async getWardenOverdueLeaves(params?: { hostelId?: string }) {
    const response = await this.api.get('/warden/leaves/overdue', { params });
    return response.data;
  }

  async approveWardenLeave(id: string, data?: { wardenRemarks?: string }) {
    const response = await this.api.post(`/warden/leaves/${id}/approve`, data);
    return response.data;
  }

  async rejectWardenLeave(id: string, data: { rejectionReason: string; wardenRemarks?: string }) {
    const response = await this.api.post(`/warden/leaves/${id}/reject`, data);
    return response.data;
  }

  async cancelWardenLeave(id: string, data: { cancellationReason: string }) {
    const response = await this.api.post(`/warden/leaves/${id}/cancel`, data);
    return response.data;
  }

  async recordWardenLeaveCheckOut(id: string, data?: { actualCheckOutTime?: string; remarks?: string }) {
    const response = await this.api.post(`/warden/leaves/${id}/checkout`, data);
    return response.data;
  }

  async recordWardenLeaveReturn(id: string, data?: { actualReturnTime?: string; remarks?: string }) {
    const response = await this.api.post(`/warden/leaves/${id}/return`, data);
    return response.data;
  }

  async getWardenStudentLeaveHistory(studentId: string, params?: { hostelId?: string }) {
    const response = await this.api.get(`/warden/leaves/student/${studentId}`, { params });
    return response.data;
  }

  async updateWardenLeaveRemarks(id: string, data: { wardenRemarks: string }) {
    const response = await this.api.put(`/warden/leaves/${id}/remarks`, data);
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

  async deletePermission(permissionId: string) {
    const response = await this.api.delete(`/warden/permissions/${permissionId}`);
    return response.data;
  }

  async getViolations(params?: any) {
    const response = await this.api.get('/warden/violations', { params });
    return response.data;
  }

  async getViolationDetails(id: string) {
    const response = await this.api.get(`/warden/violations/${id}`);
    return response.data;
  }

  async createViolation(data: any) {
    const response = await this.api.post('/warden/violations', data);
    return response.data;
  }

  async updateViolation(id: string, data: any) {
    const response = await this.api.put(`/warden/violations/${id}`, data);
    return response.data;
  }

  async recordDisciplinaryAction(id: string, data: { actionTaken: string; actionDetails?: string; warningLevel?: string; fineAmount?: number }) {
    const response = await this.api.post(`/warden/violations/${id}/action`, data);
    return response.data;
  }

  async recordParentNotification(id: string, data: { method: string; parentContactInfo?: string; notes?: string }) {
    const response = await this.api.post(`/warden/violations/${id}/parent-notify`, data);
    return response.data;
  }

  async addViolationRemark(id: string, data: { comment: string }) {
    const response = await this.api.post(`/warden/violations/${id}/remarks`, data);
    return response.data;
  }

  async resolveViolation(id: string, data: { resolutionNotes: string }) {
    const response = await this.api.post(`/warden/violations/${id}/resolve`, data);
    return response.data;
  }

  async escalateViolation(id: string, data: { escalateTo: string; reason?: string }) {
    const response = await this.api.post(`/warden/violations/${id}/escalate`, data);
    return response.data;
  }

  async deleteViolation(id: string) {
    const response = await this.api.delete(`/warden/violations/${id}`);
    return response.data;
  }

  async deleteCurfewViolation(id: string) {
    const response = await this.api.delete(`/warden/curfew/violations/${id}`);
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

  async deleteVisitor(visitorId: string) {
    const response = await this.api.delete(`/warden/visitors/${visitorId}`);
    return response.data;
  }

  async getActiveEmergencies() {
    const response = await this.api.get('/warden/emergencies');
    return response.data;
  }

  async acknowledgeEmergency(emergencyId: string) {
    const response = await this.api.post(`/warden/emergencies/${emergencyId}/acknowledge`);
    return response.data;
  }

  async markWardenAttendance(data: { studentId: string; status: string; notes?: string }) {
    const response = await this.api.post('/warden/attendance/mark', data);
    return response.data;
  }

  async getWardenHostelStudents() {
    const response = await this.api.get('/warden/students');
    return response.data;
  }

  async getWardenStudentsList(params?: {
    page?: number;
    limit?: number;
    search?: string;
    room?: string;
    floor?: string | number;
    course?: string;
    year?: string | number;
    status?: string;
    gender?: string;
    sortBy?: string;
    sortOrder?: string;
    hostelId?: string;
  }) {
    const response = await this.api.get('/warden/students/list', { params });
    return response.data;
  }

  async getWardenStudentDetails(studentId: string, params?: { hostelId?: string }) {
    const response = await this.api.get(`/warden/students/${studentId}`, { params });
    return response.data;
  }

  // Room & Bed Management APIs
  async getWardenRooms(params?: {
    floor?: number | string;
    block?: string;
    status?: string;
    category?: string;
    search?: string;
    hostelId?: string;
  }) {
    const response = await this.api.get('/warden/rooms', { params });
    return response.data;
  }

  async getWardenUnassignedStudents(params?: { hostelId?: string }) {
    const response = await this.api.get('/warden/rooms/unassigned-students', { params });
    return response.data;
  }

  async assignWardenBed(roomId: string, data: { studentId: string; reason?: string }) {
    const response = await this.api.post(`/warden/rooms/${roomId}/assign`, data);
    return response.data;
  }

  async transferWardenBed(data: {
    studentId: string;
    fromRoomId: string;
    toRoomId: string;
    reason?: string;
  }) {
    const response = await this.api.post('/warden/rooms/transfer', data);
    return response.data;
  }

  async vacateWardenBed(roomId: string, data: { studentId: string; reason?: string }) {
    const response = await this.api.post(`/warden/rooms/${roomId}/vacate`, data);
    return response.data;
  }

  async updateWardenRoomStatus(roomId: string, data: { status: string; reason?: string }) {
    const response = await this.api.put(`/warden/rooms/${roomId}/status`, data);
    return response.data;
  }

  async reportWardenRoomProblem(roomId: string, data: {
    title: string;
    description: string;
    priority?: string;
    complaintType?: string;
  }) {
    const response = await this.api.post(`/warden/rooms/${roomId}/report-problem`, data);
    return response.data;
  }

  async getWardenRoomAllocationHistory(params?: {
    roomId?: string;
    studentId?: string;
    page?: number;
    limit?: number;
    hostelId?: string;
  }) {
    const response = await this.api.get('/warden/rooms/allocation-history', { params });
    return response.data;
  }

  // Attendance Management APIs
  async getWardenAttendanceSheet(params?: {
    date?: string;
    search?: string;
    roomId?: string;
    floor?: number | string;
    course?: string;
    status?: string;
    page?: number;
    limit?: number;
    hostelId?: string;
  }) {
    const response = await this.api.get('/warden/attendance/sheet', { params });
    return response.data;
  }

  async markWardenSingleAttendance(data: {
    studentId: string;
    attendanceStatus: 'present' | 'absent' | 'late' | 'on-leave';
    isLate?: boolean;
    remarks?: string;
    date?: string;
    editReason?: string;
  }) {
    const response = await this.api.post('/warden/attendance/mark-single', data);
    return response.data;
  }

  async bulkMarkWardenAttendance(data: {
    records: Array<{
      studentId: string;
      attendanceStatus: 'present' | 'absent' | 'late' | 'on-leave';
      isLate?: boolean;
      remarks?: string;
    }>;
    date?: string;
    editReason?: string;
  }) {
    const response = await this.api.post('/warden/attendance/bulk-mark', data);
    return response.data;
  }

  async editWardenAttendanceRecord(
    attendanceId: string,
    data: {
      attendanceStatus?: 'present' | 'absent' | 'late' | 'on-leave';
      isLate?: boolean;
      remarks?: string;
      editReason: string;
    }
  ) {
    const response = await this.api.put(`/warden/attendance/${attendanceId}/edit`, data);
    return response.data;
  }

  async getWardenAttendanceAnalytics(params?: {
    days?: number;
    threshold?: number;
    lowPercentageThreshold?: number;
    hostelId?: string;
  }) {
    const response = await this.api.get('/warden/attendance/analytics', { params });
    return response.data;
  }

  async getWardenStudentAttendanceHistory(studentId: string, params?: {
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
    hostelId?: string;
  }) {
    const response = await this.api.get(`/warden/attendance/student/${studentId}`, { params });
    return response.data;
  }

  async exportWardenAttendanceCSV(params?: {
    date?: string;
    startDate?: string;
    endDate?: string;
    roomId?: string;
    floor?: number | string;
    course?: string;
    status?: string;
    hostelId?: string;
  }) {
    const response = await this.api.get('/warden/attendance/export', {
      params,
      responseType: 'blob',
    });
    return response.data;
  }

  async createWardenVisitor(data: {
    visitorName: string;
    visitorPhone: string;
    visitorIdProof?: string;
    visitingStudentId: string;
    purpose: string;
    visitDate?: string;
    autoApprove?: boolean;
  }) {
    const response = await this.api.post('/warden/visitors', data);
    return response.data;
  }

  async checkoutWardenVisitor(visitorId: string) {
    const response = await this.api.post(`/warden/visitors/${visitorId}/checkout`);
    return response.data;
  }

  async createWardenAnnouncement(data: {
    title: string;
    message: string;
    type?: string;
    targetAudience?: string;
    priority?: string;
  }) {
    const response = await this.api.post('/warden/announcements', data);
    return response.data;
  }

  async reportWardenMaintenance(data: {
    title: string;
    description: string;
    roomId?: string;
    priority?: string;
  }) {
    const response = await this.api.post('/warden/maintenance', data);
    return response.data;
  }

  async getWardenComplaints(params?: {
    status?: string;
    type?: string;
    category?: string;
    priority?: string;
    search?: string;
    isEscalated?: boolean | string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
    hostelId?: string;
  }) {
    const response = await this.api.get('/warden/complaints', { params });
    return response.data;
  }

  async getWardenComplaintDetails(id: string) {
    const response = await this.api.get(`/warden/complaints/${id}`);
    return response.data;
  }

  async assignWardenComplaint(
    id: string,
    data: {
      assignedTo?: string;
      assignedStaffName?: string;
      assignedStaffPhone?: string;
      assignedStaffRole?: string;
      remarks?: string;
    }
  ) {
    const response = await this.api.post(`/warden/complaints/${id}/assign`, data);
    return response.data;
  }

  async updateWardenComplaintStatus(
    id: string,
    data: {
      status?: string;
      resolutionNotes?: string;
      remarks?: string;
      assignedTo?: string;
    }
  ) {
    const response = await this.api.put(`/warden/complaints/${id}/status`, data);
    return response.data;
  }

  async resolveWardenComplaint(id: string, data: { resolutionNotes: string; remarks?: string }) {
    const response = await this.api.post(`/warden/complaints/${id}/resolve`, data);
    return response.data;
  }

  async reopenWardenComplaint(id: string, data: { reopenReason: string; remarks?: string }) {
    const response = await this.api.post(`/warden/complaints/${id}/reopen`, data);
    return response.data;
  }

  async addWardenComplaintRemark(id: string, data: { comment: string }) {
    const response = await this.api.post(`/warden/complaints/${id}/remarks`, data);
    return response.data;
  }

  async escalateWardenComplaint(id: string, data: { escalateTo?: string; escalationReason: string }) {
    const response = await this.api.post(`/warden/complaints/${id}/escalate`, data);
    return response.data;
  }

  async getWardenHostelStaff(params?: { hostelId?: string }) {
    const response = await this.api.get('/warden/complaints/staff', { params });
    return response.data;
  }

  async createWardenIncident(data: { title: string; description: string; roomId?: string; priority?: string }) {
    const response = await this.api.post('/warden/incidents', data);
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

  async getHostelBoundary() {
    const response = await this.api.get('/student/hostel-boundary');
    return response.data;
  }

  async updateLocation(location: { latitude: number; longitude: number; accuracy?: number; timestamp?: string | number }, accuracy?: number) {
    const acc = accuracy ?? location.accuracy;
    const ts = location.timestamp ? new Date(location.timestamp).toISOString() : new Date().toISOString();
    const response = await this.api.post('/student/location/update', {
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: acc,
        timestamp: ts,
      },
      accuracy: acc,
      timestamp: ts,
      source: 'web',
    });
    return response.data;
  }

  async checkIn(location?: { latitude: number; longitude: number; accuracy?: number; timestamp?: string | number }) {
    const payload = location ? {
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        timestamp: location.timestamp ? new Date(location.timestamp).toISOString() : new Date().toISOString(),
      },
      accuracy: location.accuracy,
      timestamp: location.timestamp ? new Date(location.timestamp).toISOString() : new Date().toISOString(),
      source: 'web',
    } : {};
    const response = await this.api.post('/student/check-in', payload);
    return response.data;
  }

  async checkOut(location?: { latitude: number; longitude: number; accuracy?: number; timestamp?: string | number }) {
    const payload = location ? {
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        timestamp: location.timestamp ? new Date(location.timestamp).toISOString() : new Date().toISOString(),
      },
      accuracy: location.accuracy,
      timestamp: location.timestamp ? new Date(location.timestamp).toISOString() : new Date().toISOString(),
      source: 'web',
    } : {};
    const response = await this.api.post('/student/check-out', payload);
    return response.data;
  }

  async getAttendanceAnalytics(period: 'daily' | 'week' | 'month' | 'year' = 'week') {
    const response = await this.api.get('/student/attendance/analytics', { params: { period } });
    return response.data;
  }

  // Security Guard APIs
  async getSecurityDashboardStats() {
    const response = await this.api.get('/security/dashboard/stats');
    return response.data;
  }

  async getSecurityStudentsStatus() {
    const response = await this.api.get('/security/students/status');
    return response.data;
  }

  async getSecurityCheckedInStudents() {
    const response = await this.api.get('/security/students/checked-in');
    return response.data;
  }

  async getSecurityCheckedOutStudents() {
    const response = await this.api.get('/security/students/checked-out');
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
    return body?.data ?? [];
  }

  async submitMessFeedback(data: any) {
    const response = await this.api.post('/student/mess/feedback', data);
    return response.data;
  }

  async requestCleaning(data: any) {
    const response = await this.api.post('/student/cleaning', data);
    return response.data;
  }

  // Student Fee & Payment APIs
  async getMyFeeStructure() {
    const response = await this.api.get('/student/fee-structure');
    return response.data;
  }

  async getMyPayments() {
    const response = await this.api.get('/student/payments');
    return response.data;
  }

  async createRazorpayOrder(amount: number, type?: string, periodStart?: string, periodEnd?: string) {
    const response = await this.api.post('/student/payments/create-order', { amount, type, periodStart, periodEnd });
    return response.data;
  }

  async createOrderForExistingPayment(paymentId: string) {
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

  async getAvailableCleaningRequests() {
    const response = await this.api.get('/cleaner/tasks/available');
    return response.data;
  }

  async acceptCleaningRequest(taskId: string) {
    const response = await this.api.put(`/cleaner/tasks/${taskId}/accept`);
    return response.data;
  }

  async getTask(taskId: string) {
    const response = await this.api.get(`/cleaner/tasks/${taskId}`);
    return response.data;
  }

  // Owner Analytics APIs
  async getAttendanceTrends(params?: any) {
    const response = await this.api.get('/owner/analytics/attendance', { params });
    return response.data;
  }

  async getViolationHeatmap(params?: any) {
    const response = await this.api.get('/owner/analytics/violations', { params });
    return response.data;
  }

  async getRecentViolations(hostelId?: string, limit?: number, from?: string, to?: string) {
    const params: Record<string, string | number> = {};
    if (hostelId) params.hostelId = hostelId;
    if (limit != null) params.limit = limit;
    if (from) params.from = from;
    if (to) params.to = to;
    const response = await this.api.get('/owner/violations/recent', { params });
    return response.data;
  }

  async getMonthlyDisciplineReport(params?: any) {
    const response = await this.api.get('/owner/analytics/discipline', { params });
    return response.data;
  }

  async getDashboardKPIs() {
    const response = await this.api.get('/owner/dashboard/kpis');
    return response.data;
  }

  async getStaffPerformance() {
    const response = await this.api.get('/owner/analytics/staff-performance');
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

  async getCleanerLeaveRequests() {
    const response = await this.api.get('/cleaner/leave');
    return response.data;
  }

  async createCleanerLeaveRequest(data: { type: string; startDate: string; endDate: string; reason: string }) {
    const response = await this.api.post('/cleaner/leave', data);
    return response.data;
  }

  // Rules Management APIs
  async getRules(params?: any) {
    const response = await this.api.get('/owner/rules', { params });
    return response.data;
  }

  async getRule(ruleId: string) {
    const response = await this.api.get(`/owner/rules/${ruleId}`);
    return response.data;
  }

  async createRule(data: any) {
    const response = await this.api.post('/owner/rules', data);
    return response.data;
  }

  async updateRule(ruleId: string, data: any) {
    const response = await this.api.put(`/owner/rules/${ruleId}`, data);
    return response.data;
  }

  async deleteRule(ruleId: string) {
    const response = await this.api.delete(`/owner/rules/${ruleId}`);
    return response.data;
  }

  async getOwnerHostels() {
    const response = await this.api.get('/owner/hostels');
    return response.data;
  }

  // Owner Mess Schedule
  async getMessSchedules(hostelId: string) {
    const response = await this.api.get(`/owner/hostels/${hostelId}/mess`);
    const body = response.data as { success?: boolean; data?: any[] };
    return body?.data ?? [];
  }

  async createMessSchedule(hostelId: string, data: {
    mealType: string;
    title?: string;
    items?: string[];
    startTime: string;
    endTime: string;
    dayOfWeek?: number | null;
    active?: boolean;
    order?: number;
  }) {
    const response = await this.api.post(`/owner/hostels/${hostelId}/mess`, data);
    return response.data;
  }

  async updateMessSchedule(hostelId: string, scheduleId: string, data: Partial<{
    mealType: string;
    title: string;
    items: string[];
    startTime: string;
    endTime: string;
    dayOfWeek: number | null;
    active: boolean;
    order: number;
  }>) {
    const response = await this.api.put(`/owner/hostels/${hostelId}/mess/${scheduleId}`, data);
    return response.data;
  }

  async deleteMessSchedule(hostelId: string, scheduleId: string) {
    const response = await this.api.delete(`/owner/hostels/${hostelId}/mess/${scheduleId}`);
    return response.data;
  }

  async seedMessSchedules(hostelId: string) {
    const response = await this.api.post(`/owner/hostels/${hostelId}/mess/seed`);
    return response.data;
  }

  async getMessFeedback(hostelId?: string, limit?: number) {
    const params: Record<string, string> = {};
    if (hostelId) params.hostelId = hostelId;
    if (limit) params.limit = String(limit);
    const response = await this.api.get('/owner/mess-feedback', { params });
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

  // SuperAdmin APIs
  async getSuperadminDashboard() {
    const response = await this.api.get('/superadmin/dashboard');
    return response.data;
  }

  async getSuperadminSupportTickets(params?: { status?: string; hostelId?: string }) {
    const response = await this.api.get('/superadmin/support-tickets', { params });
    return response.data;
  }

  async updateSuperadminSupportTicket(id: string, data: { status?: string; assignedTo?: string; message?: string }) {
    const response = await this.api.put(`/superadmin/support-tickets/${id}`, data);
    return response.data;
  }

  async getSuperadminHostels() {
    const response = await this.api.get('/superadmin/hostels');
    return response.data;
  }

  async getSuperadminOwners() {
    const response = await this.api.get('/superadmin/owners');
    return response.data;
  }

  async getSuperadminUsers(params?: { hostelId?: string; role?: string; search?: string }) {
    const response = await this.api.get('/superadmin/users', { params });
    return response.data;
  }

  async seedSuperadminDummyUsers() {
    const response = await this.api.post('/superadmin/seed-dummy-users');
    return response.data;
  }

  async createSuperadminOwner(data: { name: string; email: string; password: string; phone: string }) {
    const response = await this.api.post('/superadmin/create-owner', data);
    return response.data;
  }

  // ==========================================
  // STUDENT ONBOARDING APIS
  // ==========================================
  async getStudentOnboardingState() {
    const response = await this.api.get('/onboarding/state');
    return response.data;
  }

  async saveOnboardingProfile(data: any) {
    const response = await this.api.post('/onboarding/profile', data);
    return response.data;
  }

  async saveOnboardingContacts(data: any) {
    const response = await this.api.post('/onboarding/contacts', data);
    return response.data;
  }

  async uploadOnboardingDocument(formData: FormData) {
    const response = await this.api.post('/onboarding/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async resubmitOnboardingDocument(formData: FormData) {
    const response = await this.api.post('/onboarding/documents/resubmit', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async selectOnboardingHostel(hostelId: string) {
    const response = await this.api.post('/onboarding/hostel', { hostelId });
    return response.data;
  }

  async getAvailableRoomsForOnboarding(params?: { hostelId?: string; floor?: number; roomType?: string }) {
    const response = await this.api.get('/onboarding/available-rooms', { params });
    return response.data;
  }

  async getOnboardingFeeBreakdown() {
    const response = await this.api.get('/onboarding/fee-breakdown');
    return response.data;
  }

  async initiateOnboardingPayment(data: { method: string; amount?: number; notes?: string }) {
    const response = await this.api.post('/onboarding/payment/initiate', data);
    return response.data;
  }

  async verifyOnboardingPayment(data: { razorpay_order_id?: string; razorpay_payment_id?: string; razorpay_signature?: string; offlineReference?: string }) {
    const response = await this.api.post('/onboarding/payment/verify', data);
    return response.data;
  }

  async acceptHostelAgreement(data?: { agreementVersion?: string }) {
    const response = await this.api.post('/onboarding/agreement', data || {});
    return response.data;
  }

  async submitOnboardingFinalReview() {
    const response = await this.api.post('/onboarding/submit-review');
    return response.data;
  }

  // ==========================================
  // WARDEN & ADMIN ONBOARDING APIS
  // ==========================================
  async getWardenOnboardingApplications(params?: { status?: string; search?: string; page?: number; limit?: number }) {
    const response = await this.api.get('/onboarding/applications', { params });
    return response.data;
  }

  async getWardenOnboardingApplicationDetails(applicationId: string) {
    const response = await this.api.get(`/onboarding/applications/${applicationId}`);
    return response.data;
  }

  async verifyWardenDocument(applicationId: string, data: { documentType: string; status: 'approved' | 'rejected' | 'resubmission_required'; rejectionReason?: string; correctionInstructions?: string }) {
    const response = await this.api.post(`/onboarding/applications/${applicationId}/verify-document`, data);
    return response.data;
  }

  async allocateWardenOnboardingRoom(applicationId: string, data: { roomId: string; bedNumber: string }) {
    const response = await this.api.post(`/onboarding/applications/${applicationId}/allocate-room`, data);
    return response.data;
  }

  async confirmWardenOfflineFee(applicationId: string, data: { amountPaid: number; paymentMode?: string; referenceNumber?: string; notes?: string }) {
    const response = await this.api.post(`/onboarding/applications/${applicationId}/confirm-offline-fee`, data);
    return response.data;
  }

  async requestWardenCorrection(applicationId: string, data: { instructions: string; fields?: string[] }) {
    const response = await this.api.post(`/onboarding/applications/${applicationId}/request-correction`, data);
    return response.data;
  }

  async approveWardenOnboardingFinal(applicationId: string, data?: { notes?: string }) {
    const response = await this.api.post(`/onboarding/applications/${applicationId}/approve`, data || {});
    return response.data;
  }

  async rejectWardenOnboarding(applicationId: string, data: { reason: string }) {
    const response = await this.api.post(`/onboarding/applications/${applicationId}/reject`, data);
    return response.data;
  }

  async getOnboardingMetrics(hostelId?: string) {
    const response = await this.api.get('/onboarding/metrics', { params: hostelId ? { hostelId } : undefined });
    return response.data;
  }
}

export default new ApiService();

