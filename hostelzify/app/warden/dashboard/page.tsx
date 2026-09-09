'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import { alertApi, CurfewConfigurationData } from '../../../services/alertApi';
import { useAlertSocket } from '../../../contexts/AlertSocketContext';
import toast from 'react-hot-toast';
import {
  Shield,
  ShieldAlert,
  FileCheck,
  AlertTriangle,
  Users,
  Clock,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Search,
  Megaphone,
  AlertOctagon,
  ChevronRight,
  X,
  Play,
  StopCircle,
  BedDouble,
  Wrench,
  MessageSquare,
  Plus,
  AlertCircle,
  UserCheck,
  Building,
  Radio,
} from 'lucide-react';

export default function WardenDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const { connected, lastCurfewEvent, lastOperationalEvent, refreshKey } = useAlertSocket();

  // ── Live Clock State ──────────────────────────────────────────────────────────
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  // ── Active Navigation Tab ───────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'overview' | 'permissions' | 'violations' | 'visitors' | 'complaints'>('overview');

  // ── Dashboard & Auxiliary Data State ────────────────────────────────────────
  const [dashboard, setDashboard] = useState<any>(null);
  const [hostelStudents, setHostelStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ── Card Lists & Filters ────────────────────────────────────────────────────
  const [permissions, setPermissions] = useState<any[]>([]);
  const [permSearch, setPermSearch] = useState('');
  const [permTypeFilter, setPermTypeFilter] = useState('all');

  const [violations, setViolations] = useState<any[]>([]);
  const [violSearch, setViolSearch] = useState('');
  const [violTypeFilter, setViolTypeFilter] = useState('all');

  const [visitors, setVisitors] = useState<any[]>([]);
  const [visitorSearch, setVisitorSearch] = useState('');

  const [complaintsList, setComplaintsList] = useState<any[]>([]);
  const [complaintTypeFilter, setComplaintTypeFilter] = useState('all');
  const [complaintStatusFilter, setComplaintStatusFilter] = useState('all');

  // ── Scheduled Curfew State ──────────────────────────────────────────────────
  const [curfewConfigData, setCurfewConfigData] = useState<CurfewConfigurationData | null>(null);
  const [activeCurfewSession, setActiveCurfewSession] = useState<any>(null);
  const [loadingCurfewSchedule, setLoadingCurfewSchedule] = useState(false);
  const [curfewConfig, setCurfewConfig] = useState({
    curfewTime: '21:00',
    curfewEndTime: '06:00',
    weekendCurfewTime: '22:00',
    gracePeriodMinutes: 15,
  });

  // ── Quick Action Modals State ────────────────────────────────────────────────
  const [markAttendanceModal, setMarkAttendanceModal] = useState({
    open: false,
    studentId: '',
    status: 'inside',
    notes: '',
  });

  const [addVisitorModal, setAddVisitorModal] = useState({
    open: false,
    visitorName: '',
    visitorPhone: '',
    visitorIdProof: '',
    visitingStudentId: '',
    purpose: '',
    autoApprove: true,
  });

  const [announcementModal, setAnnouncementModal] = useState({
    open: false,
    title: '',
    message: '',
    targetAudience: 'all',
    priority: 'medium',
  });

  const [maintenanceModal, setMaintenanceModal] = useState({
    open: false,
    title: '',
    description: '',
    roomId: '',
    priority: 'medium',
  });

  const [incidentModal, setIncidentModal] = useState({
    open: false,
    studentId: '',
    violationType: 'late-entry',
    description: '',
    warningLevel: 'warning',
    fineAmount: 0,
  });

  const [complaintResolveModal, setComplaintResolveModal] = useState({
    open: false,
    complaintId: '',
    title: '',
    status: 'resolved',
    resolutionNotes: '',
  });

  // ── Detail & Confirmation Modals State ───────────────────────────────────────
  const [rejectModal, setRejectModal] = useState<{
    open: boolean;
    type: 'permission' | 'visitor';
    id: string;
    studentOrVisitorName: string;
    reason: string;
  }>({ open: false, type: 'permission', id: '', studentOrVisitorName: '', reason: '' });

  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    open: boolean;
    type: 'permission' | 'violation' | 'visitor' | 'curfew';
    id: string;
    description: string;
  }>({ open: false, type: 'permission', id: '', description: '' });

  const [escalateModal, setEscalateModal] = useState<{
    open: boolean;
    id: string;
    studentName: string;
    reason: string;
  }>({ open: false, id: '', studentName: '', reason: '' });

  // ── Ticking Live Clock ──────────────────────────────────────────────────────
  useEffect(() => {
    setCurrentTime(new Date());
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Load Dashboard Data ─────────────────────────────────────────────────────
  const loadDashboard = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const response = await api.getDashboard();
      const d = response.data || {};
      setDashboard(d);
      setPermissions(d.permissions || d.leaveOverview?.pendingList || []);
      setViolations(d.violations || d.disciplineOverview?.recentIncidents || []);
      setVisitors(d.visitors || d.visitorOverview?.recentVisitors || []);

      if (d.curfewStatus) {
        setCurfewConfig((prev) => ({
          ...prev,
          curfewTime: d.curfewStatus.curfewTime || prev.curfewTime,
          curfewEndTime: d.curfewStatus.curfewEndTime || prev.curfewEndTime,
          weekendCurfewTime: d.curfewStatus.weekendCurfewTime || prev.weekendCurfewTime,
          gracePeriodMinutes: d.curfewStatus.gracePeriodMinutes || prev.gracePeriodMinutes,
        }));
      }
    } catch (error: any) {
      console.error('Failed to load dashboard:', error);
      if (!isSilent) toast.error(error.message || 'Failed to refresh dashboard');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  // ── Load Hostel Students (for Quick Action Selectors) ───────────────────────
  const loadStudents = useCallback(async () => {
    try {
      const res = await api.getWardenHostelStudents();
      if (res?.data) {
        setHostelStudents(res.data);
      }
    } catch (err) {
      console.warn('Could not load hostel students list:', err);
    }
  }, []);

  // ── Load Complaints ─────────────────────────────────────────────────────────
  const loadComplaints = useCallback(async () => {
    try {
      const res = await api.getWardenComplaints({
        type: complaintTypeFilter !== 'all' ? complaintTypeFilter : undefined,
        status: complaintStatusFilter !== 'all' ? complaintStatusFilter : undefined,
      });
      if (res?.data) {
        setComplaintsList(res.data);
      }
    } catch (err) {
      console.warn('Failed to load complaints:', err);
    }
  }, [complaintTypeFilter, complaintStatusFilter]);

  // ── Load Scheduled Curfew ───────────────────────────────────────────────────
  const loadCurfewSchedule = useCallback(async (isSilent = false) => {
    const effectiveHostelId = dashboard?.hostel?.id || user?.hostelId;
    if (!effectiveHostelId) return;
    if (!isSilent) setLoadingCurfewSchedule(true);
    try {
      const res = await alertApi.getActiveCurfewSession(effectiveHostelId);
      if (res?.success && res?.data) {
        setCurfewConfigData(res.data.configuration || null);
        setActiveCurfewSession(res.data.session || null);
        if (res.data.configuration) {
          setCurfewConfig((prev) => ({
            ...prev,
            curfewTime: res.data.configuration?.startTime || prev.curfewTime,
            curfewEndTime: res.data.configuration?.endTime || prev.curfewEndTime,
            gracePeriodMinutes: res.data.configuration?.gracePeriodMinutes || prev.gracePeriodMinutes,
          }));
        }
      }
    } catch (err) {
      console.warn('Could not load active curfew session:', err);
    } finally {
      if (!isSilent) setLoadingCurfewSchedule(false);
    }
  }, [dashboard?.hostel?.id, user?.hostelId]);

  useEffect(() => {
    if (!user || user.role !== 'warden') {
      router.replace('/login');
      return;
    }
    loadDashboard();
    loadStudents();
  }, [user, router, loadDashboard, loadStudents]);

  useEffect(() => {
    if (user?.hostelId || dashboard?.hostel?.id) {
      loadCurfewSchedule();
    }
  }, [user?.hostelId, dashboard?.hostel?.id, loadCurfewSchedule]);

  useEffect(() => {
    if (activeTab === 'complaints') {
      loadComplaints();
    }
  }, [activeTab, loadComplaints]);

  // ── Real-Time Reactive Socket Event Updates ─────────────────────────────────
  // Whenever any socket event arrives (curfew, gate, attendance, leave, violation, complaint):
  useEffect(() => {
    if (!user || user.role !== 'warden') return;
    if (refreshKey > 0) {
      loadDashboard(true);
      loadCurfewSchedule(true);
      if (activeTab === 'complaints') loadComplaints();
    }
  }, [refreshKey, lastCurfewEvent, lastOperationalEvent, user, activeTab, loadDashboard, loadCurfewSchedule, loadComplaints]);

  // ── Real-Time Polling & Tab Visibility Synchronization ──────────────────────
  // Guarantees all dashboard metrics update in real-time without manual page refresh
  useEffect(() => {
    if (!user || user.role !== 'warden') return;

    const interval = setInterval(() => {
      loadDashboard(true);
      loadCurfewSchedule(true);
      if (activeTab === 'complaints') loadComplaints();
    }, 8000);

    const onVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        loadDashboard(true);
        loadCurfewSchedule(true);
        if (activeTab === 'complaints') loadComplaints();
      }
    };

    window.addEventListener('visibilitychange', onVisibilityOrFocus);
    window.addEventListener('focus', onVisibilityOrFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', onVisibilityOrFocus);
      window.removeEventListener('focus', onVisibilityOrFocus);
    };
  }, [user, activeTab, loadDashboard, loadCurfewSchedule, loadComplaints]);

  // Refresh on socket curfew events
  useEffect(() => {
    if (lastCurfewEvent) {
      loadDashboard();
      loadCurfewSchedule();
    }
  }, [lastCurfewEvent, loadDashboard, loadCurfewSchedule]);

  // ── Permission Actions ──────────────────────────────────────────────────────
  const handleApprovePermission = async (id: string) => {
    setActionLoading(id);
    try {
      await api.approvePermission(id);
      toast.success('Permission approved & student notified');
      setPermissions((prev) => prev.filter((p) => p._id !== id));
      loadDashboard();
    } catch (error: any) {
      toast.error(error.message || 'Failed to approve permission');
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectModal.id) return;
    if (!rejectModal.reason.trim()) {
      toast.error('Please specify a rejection reason');
      return;
    }

    setActionLoading(rejectModal.id);
    try {
      if (rejectModal.type === 'permission') {
        await api.rejectPermission(rejectModal.id, rejectModal.reason.trim());
        toast.success('Permission rejected & student notified');
        setPermissions((prev) => prev.filter((p) => p._id !== rejectModal.id));
      } else {
        await api.rejectVisitor(rejectModal.id, rejectModal.reason.trim());
        toast.success('Visitor request rejected');
        setVisitors((prev) => prev.filter((v) => v._id !== rejectModal.id));
      }
      setRejectModal({ open: false, type: 'permission', id: '', studentOrVisitorName: '', reason: '' });
      loadDashboard();
    } catch (error: any) {
      toast.error(error.message || 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmDelete = async () => {
    const { id, type } = deleteConfirmModal;
    if (!id) return;

    setActionLoading(id);
    try {
      if (type === 'permission') {
        await api.deletePermission(id);
        toast.success('Permission request deleted');
        setPermissions((prev) => prev.filter((p) => p._id !== id));
      } else if (type === 'violation') {
        await api.deleteViolation(id);
        toast.success('Violation record deleted');
        setViolations((prev) => prev.filter((v) => v._id !== id));
      } else if (type === 'visitor') {
        await api.deleteVisitor(id);
        toast.success('Visitor entry deleted');
        setVisitors((prev) => prev.filter((v) => v._id !== id));
      } else if (type === 'curfew') {
        await alertApi.deleteCurfewViolation(id);
        toast.success('Curfew record deleted');
      }
      setDeleteConfirmModal({ open: false, type: 'permission', id: '', description: '' });
      loadDashboard();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete record');
    } finally {
      setActionLoading(null);
    }
  };

  // ── Visitor Actions ─────────────────────────────────────────────────────────
  const handleApproveVisitor = async (id: string) => {
    setActionLoading(id);
    try {
      await api.approveVisitor(id);
      toast.success('Visitor entry approved & checked in');
      loadDashboard();
    } catch (error: any) {
      toast.error(error.message || 'Failed to approve visitor');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCheckoutVisitor = async (id: string) => {
    setActionLoading(id);
    try {
      await api.checkoutWardenVisitor(id);
      toast.success('Visitor successfully checked out');
      loadDashboard();
    } catch (error: any) {
      toast.error(error.message || 'Failed to checkout visitor');
    } finally {
      setActionLoading(null);
    }
  };

  // ── Emergency Actions ───────────────────────────────────────────────────────
  const handleAcknowledgeEmergency = async (id: string) => {
    setActionLoading(id);
    try {
      await api.acknowledgeEmergency(id);
      toast.success('Emergency alert acknowledged');
      loadDashboard();
    } catch (error: any) {
      toast.error(error.message || 'Failed to acknowledge emergency');
    } finally {
      setActionLoading(null);
    }
  };

  // ── Violation Actions ───────────────────────────────────────────────────────
  const handleResolveViolation = async (violation: any) => {
    setActionLoading(violation._id);
    try {
      if (violation.isCurfew || violation.curfewTime) {
        await alertApi.resolveCurfewViolation(violation._id, 'Resolved by warden from dashboard');
      } else {
        await api.updateViolation(violation._id, { status: 'resolved' });
      }
      toast.success('Violation resolved successfully');
      setViolations((prev) => prev.filter((v) => v._id !== violation._id));
      loadDashboard();
    } catch (error: any) {
      toast.error(error.message || 'Failed to resolve violation');
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmEscalate = async () => {
    if (!escalateModal.id) return;
    setActionLoading(escalateModal.id);
    try {
      await api.escalateViolation(escalateModal.id, { escalateTo: 'owner' });
      toast.success('Violation escalated to Management');
      setEscalateModal({ open: false, id: '', studentName: '', reason: '' });
      loadDashboard();
    } catch (error: any) {
      toast.error(error.message || 'Failed to escalate violation');
    } finally {
      setActionLoading(null);
    }
  };

  // ── Quick Action Submit Handlers ────────────────────────────────────────────
  const handleMarkAttendanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!markAttendanceModal.studentId) {
      toast.error('Please select a student');
      return;
    }
    setActionLoading('markAttendance');
    try {
      await api.markWardenAttendance({
        studentId: markAttendanceModal.studentId,
        status: markAttendanceModal.status,
        notes: markAttendanceModal.notes,
      });
      toast.success('Student attendance updated successfully');
      setMarkAttendanceModal({ open: false, studentId: '', status: 'inside', notes: '' });
      loadDashboard();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update attendance');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddVisitorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { visitorName, visitorPhone, visitingStudentId, purpose } = addVisitorModal;
    if (!visitorName.trim() || !visitorPhone.trim() || !visitingStudentId || !purpose.trim()) {
      toast.error('Please complete all required fields');
      return;
    }
    setActionLoading('addVisitor');
    try {
      await api.createWardenVisitor(addVisitorModal);
      toast.success(addVisitorModal.autoApprove ? 'Visitor added & checked in' : 'Visitor pass created');
      setAddVisitorModal({
        open: false,
        visitorName: '',
        visitorPhone: '',
        visitorIdProof: '',
        visitingStudentId: '',
        purpose: '',
        autoApprove: true,
      });
      loadDashboard();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add visitor');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAnnouncementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { title, message } = announcementModal;
    if (!title.trim() || !message.trim()) {
      toast.error('Please provide announcement title and message');
      return;
    }
    setActionLoading('announcement');
    try {
      await api.createWardenAnnouncement(announcementModal);
      toast.success('Announcement broadcasted to hostel');
      setAnnouncementModal({ open: false, title: '', message: '', targetAudience: 'all', priority: 'medium' });
      loadDashboard();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create announcement');
    } finally {
      setActionLoading(null);
    }
  };

  const handleMaintenanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { title, description } = maintenanceModal;
    if (!title.trim() || !description.trim()) {
      toast.error('Please provide maintenance title and description');
      return;
    }
    setActionLoading('maintenance');
    try {
      await api.reportWardenMaintenance({
        title,
        description,
        roomId: maintenanceModal.roomId || undefined,
        priority: maintenanceModal.priority,
      });
      toast.success('Maintenance ticket submitted successfully');
      setMaintenanceModal({ open: false, title: '', description: '', roomId: '', priority: 'medium' });
      loadDashboard();
    } catch (err: any) {
      toast.error(err.message || 'Failed to report maintenance');
    } finally {
      setActionLoading(null);
    }
  };

  const handleIncidentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { studentId, violationType, description } = incidentModal;
    if (!studentId || !description.trim()) {
      toast.error('Please select a student and provide a description');
      return;
    }
    setActionLoading('incident');
    try {
      await api.createViolation({
        studentId,
        violationType,
        description,
        warningLevel: incidentModal.warningLevel,
        fineAmount: Number(incidentModal.fineAmount) || 0,
      });
      toast.success('Disciplinary incident recorded');
      setIncidentModal({
        open: false,
        studentId: '',
        violationType: 'late-entry',
        description: '',
        warningLevel: 'warning',
        fineAmount: 0,
      });
      loadDashboard();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record incident');
    } finally {
      setActionLoading(null);
    }
  };

  const handleComplaintResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading('resolveComplaint');
    try {
      await api.updateWardenComplaintStatus(complaintResolveModal.complaintId, {
        status: complaintResolveModal.status,
        resolutionNotes: complaintResolveModal.resolutionNotes,
      });
      toast.success('Complaint status updated');
      setComplaintResolveModal({ open: false, complaintId: '', title: '', status: 'resolved', resolutionNotes: '' });
      loadDashboard();
      if (activeTab === 'complaints') loadComplaints();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update complaint');
    } finally {
      setActionLoading(null);
    }
  };

  // ── Curfew Status ───────────────────────────────────────────────────────────
  const isCurfewActive = Boolean(
    activeCurfewSession?.status === 'ACTIVE' || dashboard?.curfewStatus?.isCurfewActive
  );

  // ── Filters & Search ────────────────────────────────────────────────────────
  const filteredPermissions = permissions.filter((p) => {
    const matchSearch =
      !permSearch ||
      p.studentId?.name?.toLowerCase().includes(permSearch.toLowerCase()) ||
      p.studentId?.roomId?.toLowerCase().includes(permSearch.toLowerCase()) ||
      p.reason?.toLowerCase().includes(permSearch.toLowerCase());
    const matchType = permTypeFilter === 'all' || p.permissionType === permTypeFilter;
    return matchSearch && matchType;
  });

  const filteredViolations = violations.filter((v) => {
    const matchSearch =
      !violSearch ||
      v.studentId?.name?.toLowerCase().includes(violSearch.toLowerCase()) ||
      v.studentId?.roomId?.toLowerCase().includes(violSearch.toLowerCase()) ||
      v.description?.toLowerCase().includes(violSearch.toLowerCase());
    const matchType = violTypeFilter === 'all' || (violTypeFilter === 'curfew' ? v.isCurfew : !v.isCurfew);
    return matchSearch && matchType;
  });

  const filteredVisitors = visitors.filter((v) => {
    return (
      !visitorSearch ||
      v.visitorName?.toLowerCase().includes(visitorSearch.toLowerCase()) ||
      v.visitorPhone?.includes(visitorSearch) ||
      v.visitingStudentId?.name?.toLowerCase().includes(visitorSearch.toLowerCase()) ||
      v.purpose?.toLowerCase().includes(visitorSearch.toLowerCase())
    );
  });

  const studentStats = dashboard?.studentStats || { total: 0, active: 0, onLeave: 0, absent: 0 };
  const roomStats = dashboard?.roomStats || { totalRooms: 0, occupiedRooms: 0, partiallyOccupiedRooms: 0, vacantRooms: 0, maintenanceRooms: 0, totalCapacity: 0, totalOccupancy: 0, occupancyRate: 0 };
  const attendanceOverview = dashboard?.attendanceOverview || { presentToday: 0, absentToday: 0, lateArrivals: 0, attendancePercentage: 0 };
  const leaveOverview = dashboard?.leaveOverview || { pendingApplications: 0, approvedLeaves: 0, studentsOutside: 0, overdueReturns: 0 };
  const complaintOverview = dashboard?.complaintOverview || { newComplaints: 0, pendingComplaints: 0, inProgressComplaints: 0, resolvedComplaints: 0, highPriorityComplaints: 0 };
  const maintenanceOverview = dashboard?.maintenanceOverview || { newRequests: 0, pendingRequests: 0, inProgressRepairs: 0, completedRepairs: 0, emergencyMaintenance: 0 };
  const visitorOverview = dashboard?.visitorOverview || { todayVisitors: 0, currentInside: 0, pendingRequests: 0 };
  const disciplineOverview = dashboard?.disciplineOverview || { recentIncidents: [], studentsWithIssues: 0, pendingDisciplinaryActions: 0, curfewViolationsCount: 0 };
  const emergencyOverview = dashboard?.emergencyOverview || { activeEmergencies: [], hasActiveEmergency: false, recentIncidents: [] };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* ── 1. EXECUTIVE COMMAND HEADER ────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Title & Hostel Badge */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200/60 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                Warden Operations Center
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-gray-500" />
                {dashboard?.hostel?.name || user?.hostelName || 'Main Campus Hostel'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
              Hostel Overview & Control
            </h1>
            <p className="text-xs sm:text-sm text-gray-500">
              Real-time operational monitoring for student attendance, rooms, safety, leaves, and discipline.
            </p>
          </div>

          {/* Clock, Live Socket & Refresh */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Live Clock Card */}
            <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white px-4 py-2 rounded-xl shadow-xs border border-slate-800 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-indigo-300">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] font-medium text-slate-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>
                    {currentTime
                      ? currentTime.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
                      : 'Syncing date...'}
                  </span>
                </div>
                <div className="text-base font-mono font-bold text-white tracking-wider">
                  {currentTime
                    ? currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
                    : '--:--:--'}
                </div>
              </div>
            </div>

            {/* Network Indicator */}
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-2 rounded-xl">
              <span className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
              <div className="text-left">
                <p className="text-[10px] uppercase font-bold text-gray-400">Network</p>
                <p className="text-xs font-semibold text-gray-800">{connected ? 'Live Sync' : 'Connecting'}</p>
              </div>
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => {
                loadDashboard();
                loadStudents();
                toast.success('Dashboard refreshed');
              }}
              disabled={loading}
              title="Refresh Dashboard Data"
              className="p-2.5 text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors flex items-center justify-center disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* ── QUICK ACTION BAR (Requirement 10) ────────────────────────────────── */}
        <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between gap-2 overflow-x-auto pb-1">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-400 shrink-0 hidden sm:inline">
            Quick Actions:
          </span>
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <button
              onClick={() => setMarkAttendanceModal({ ...markAttendanceModal, open: true })}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors flex items-center gap-1.5 shrink-0"
            >
              <UserCheck className="w-3.5 h-3.5" />
              Mark Attendance
            </button>

            <button
              onClick={() => setActiveTab('permissions')}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors flex items-center gap-1.5 shrink-0"
            >
              <FileCheck className="w-3.5 h-3.5" />
              Approve Leave {leaveOverview.pendingApplications > 0 && `(${leaveOverview.pendingApplications})`}
            </button>

            <button
              onClick={() => setAddVisitorModal({ ...addVisitorModal, open: true })}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 transition-colors flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Visitor
            </button>

            <button
              onClick={() => setAnnouncementModal({ ...announcementModal, open: true })}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors flex items-center gap-1.5 shrink-0"
            >
              <Megaphone className="w-3.5 h-3.5" />
              Announcement
            </button>

            <button
              onClick={() => setMaintenanceModal({ ...maintenanceModal, open: true })}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors flex items-center gap-1.5 shrink-0"
            >
              <Wrench className="w-3.5 h-3.5" />
              Report Maintenance
            </button>

            <button
              onClick={() => setIncidentModal({ ...incidentModal, open: true })}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors flex items-center gap-1.5 shrink-0"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Record Incident
            </button>

            <button
              onClick={() => setActiveTab('complaints')}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors flex items-center gap-1.5 shrink-0"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              View Complaints
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. ACTIVE EMERGENCY & CRITICAL NOTIFICATION BANNER (Requirement 9) ── */}
      {emergencyOverview.hasActiveEmergency && (
        <div className="bg-gradient-to-r from-rose-600 to-red-700 text-white p-4 rounded-2xl shadow-md animate-pulse flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <AlertOctagon className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-rose-100">CRITICAL SAFETY ALERT</p>
              <p className="text-sm sm:text-base font-bold">
                {emergencyOverview.activeEmergencies.length} Active Emergency Alert(s) Detected! Immediate response required.
              </p>
              <p className="text-xs text-rose-100 mt-0.5">
                {emergencyOverview.activeEmergencies[0]?.raisedBy?.name} (Room {emergencyOverview.activeEmergencies[0]?.raisedBy?.roomId?.roomNumber || '—'}) - {emergencyOverview.activeEmergencies[0]?.description || 'SOS triggered'}
              </p>
            </div>
          </div>
          <button
            onClick={() => handleAcknowledgeEmergency(emergencyOverview.activeEmergencies[0]._id)}
            disabled={actionLoading === emergencyOverview.activeEmergencies[0]._id}
            className="px-4 py-2 bg-white text-rose-700 rounded-xl text-xs font-bold hover:bg-rose-50 transition-colors shrink-0 shadow-sm"
          >
            {actionLoading === emergencyOverview.activeEmergencies[0]._id ? 'Acknowledging...' : 'Acknowledge Now'}
          </button>
        </div>
      )}

      {/* Overdue Returns Alert Banner */}
      {leaveOverview.overdueReturns > 0 && (
        <div className="bg-amber-50 border border-amber-300/80 rounded-2xl p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-xs font-bold uppercase text-amber-800">Leave Return Overdue</p>
              <p className="text-sm font-semibold text-amber-900">
                {leaveOverview.overdueReturns} student(s) have not checked in after their approved leave return time.
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('violations')}
            className="px-3 py-1.5 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 transition-colors shrink-0"
          >
            Check Violations
          </button>
        </div>
      )}

      {/* ── NAVIGATION TABS ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-gray-200 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === 'overview'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Operational Overview
        </button>

        <button
          onClick={() => setActiveTab('permissions')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
            activeTab === 'permissions'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Leave & Permissions
          {leaveOverview.pendingApplications > 0 && (
            <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-amber-400 text-amber-950 font-black">
              {leaveOverview.pendingApplications}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('violations')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
            activeTab === 'violations'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Discipline & Violations
          {violations.length > 0 && (
            <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-rose-500 text-white font-black">
              {violations.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('visitors')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
            activeTab === 'visitors'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Visitor Registry
          {visitorOverview.currentInside > 0 && (
            <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-emerald-500 text-white font-black">
              {visitorOverview.currentInside} in
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('complaints')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
            activeTab === 'complaints'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Complaints & Maintenance
          {complaintOverview.newComplaints > 0 && (
            <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-indigo-200 text-indigo-900 font-black">
              {complaintOverview.newComplaints}
            </span>
          )}
        </button>
      </div>

      {/* ── TAB 1: OPERATIONAL OVERVIEW (10 DOMAINS) ────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* ── ROW 1: PRIMARY 4 OPERATIONAL TILES ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {/* DOMAIN 1: Student Statistics */}
            <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">1. Student Statistics</span>
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-3xl font-black text-gray-900 mt-2">{studentStats.total}</p>
                <p className="text-xs text-gray-500">Total registered students</p>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 grid grid-cols-3 gap-1 text-center">
                <div className="bg-emerald-50 rounded-lg py-1 px-1">
                  <p className="text-xs font-bold text-emerald-700">{studentStats.active}</p>
                  <p className="text-[10px] text-emerald-600">Active</p>
                </div>
                <div className="bg-amber-50 rounded-lg py-1 px-1">
                  <p className="text-xs font-bold text-amber-700">{studentStats.onLeave}</p>
                  <p className="text-[10px] text-amber-600">On Leave</p>
                </div>
                <div className="bg-rose-50 rounded-lg py-1 px-1">
                  <p className="text-xs font-bold text-rose-700">{studentStats.absent}</p>
                  <p className="text-[10px] text-rose-600">Absent</p>
                </div>
              </div>
            </div>

            {/* DOMAIN 2: Room Statistics */}
            <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-sky-700">2. Room Capacity</span>
                  <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                    <BedDouble className="w-5 h-5" />
                  </div>
                </div>
                <div className="flex items-baseline gap-2 mt-2">
                  <p className="text-3xl font-black text-gray-900">{roomStats.totalRooms}</p>
                  <span className="text-xs text-gray-500">Rooms ({roomStats.totalCapacity} beds)</span>
                </div>
                {/* Occupancy bar */}
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-[11px] text-gray-600 font-medium">
                    <span>Occupancy Rate</span>
                    <span className="font-bold text-gray-900">{roomStats.occupancyRate}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-sky-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, roomStats.occupancyRate)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-gray-100 grid grid-cols-4 gap-1 text-center text-[10px]">
                <div className="bg-gray-50 rounded p-1">
                  <p className="font-bold text-gray-900">{roomStats.occupiedRooms}</p>
                  <p className="text-gray-500">Full</p>
                </div>
                <div className="bg-sky-50 rounded p-1">
                  <p className="font-bold text-sky-700">{roomStats.partiallyOccupiedRooms}</p>
                  <p className="text-sky-600">Partial</p>
                </div>
                <div className="bg-emerald-50 rounded p-1">
                  <p className="font-bold text-emerald-700">{roomStats.vacantRooms}</p>
                  <p className="text-emerald-600">Vacant</p>
                </div>
                <div className="bg-amber-50 rounded p-1">
                  <p className="font-bold text-amber-700">{roomStats.maintenanceRooms}</p>
                  <p className="text-amber-600">Maint.</p>
                </div>
              </div>
            </div>

            {/* DOMAIN 3: Attendance Overview */}
            <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">3. Attendance Today</span>
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                </div>
                <div className="flex items-baseline gap-2 mt-2">
                  <p className="text-3xl font-black text-gray-900">{attendanceOverview.attendancePercentage}%</p>
                  <span className="text-xs text-emerald-700 font-medium">{attendanceOverview.presentToday} present inside</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Based on today's gate & verified check-ins</p>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 grid grid-cols-3 gap-1 text-center">
                <div className="bg-emerald-50 rounded-lg py-1 px-1">
                  <p className="text-xs font-bold text-emerald-700">{attendanceOverview.presentToday}</p>
                  <p className="text-[10px] text-emerald-600">Present</p>
                </div>
                <div className="bg-rose-50 rounded-lg py-1 px-1">
                  <p className="text-xs font-bold text-rose-700">{attendanceOverview.absentToday}</p>
                  <p className="text-[10px] text-rose-600">Absent</p>
                </div>
                <div className="bg-amber-50 rounded-lg py-1 px-1">
                  <p className="text-xs font-bold text-amber-700">{attendanceOverview.lateArrivals}</p>
                  <p className="text-[10px] text-amber-600">Late</p>
                </div>
              </div>
            </div>

            {/* DOMAIN 4: Leave Overview */}
            <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-700">4. Leave & Outpass</span>
                  <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <FileCheck className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-3xl font-black text-gray-900 mt-2">{leaveOverview.pendingApplications}</p>
                <p className="text-xs text-gray-500">Pending warden review</p>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 grid grid-cols-3 gap-1 text-center">
                <div className="bg-gray-50 rounded-lg py-1 px-1">
                  <p className="text-xs font-bold text-gray-800">{leaveOverview.approvedLeaves}</p>
                  <p className="text-[10px] text-gray-500">Approved</p>
                </div>
                <div className="bg-sky-50 rounded-lg py-1 px-1">
                  <p className="text-xs font-bold text-sky-700">{leaveOverview.studentsOutside}</p>
                  <p className="text-[10px] text-sky-600">Outside</p>
                </div>
                <div className="bg-rose-50 rounded-lg py-1 px-1">
                  <p className="text-xs font-bold text-rose-700">{leaveOverview.overdueReturns}</p>
                  <p className="text-[10px] text-rose-600">Overdue</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── ROW 2: SECONDARY 4 OPERATIONAL TILES ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {/* DOMAIN 5: Complaints Overview */}
            <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-700">5. Complaints</span>
                  <button
                    onClick={() => setActiveTab('complaints')}
                    className="text-xs text-purple-600 font-semibold hover:underline flex items-center gap-0.5"
                  >
                    View <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-3xl font-black text-gray-900 mt-2">
                  {complaintOverview.newComplaints + complaintOverview.inProgressComplaints}
                </p>
                <p className="text-xs text-gray-500">Active unresolved tickets</p>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">New / Unassigned:</span>
                  <span className="font-bold text-purple-700">{complaintOverview.newComplaints}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">In Progress:</span>
                  <span className="font-bold text-sky-700">{complaintOverview.inProgressComplaints}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">High Priority / Urgent:</span>
                  <span className="font-bold text-rose-600">{complaintOverview.highPriorityComplaints}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Resolved Today:</span>
                  <span className="font-bold text-emerald-600">{complaintOverview.resolvedComplaints}</span>
                </div>
              </div>
            </div>

            {/* DOMAIN 6: Maintenance Overview */}
            <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-700">6. Maintenance</span>
                  <button
                    onClick={() => setMaintenanceModal({ ...maintenanceModal, open: true })}
                    className="p-1 rounded-md bg-amber-50 text-amber-700 hover:bg-amber-100"
                    title="Report Maintenance Ticket"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-3xl font-black text-gray-900 mt-2">
                  {maintenanceOverview.newRequests + maintenanceOverview.inProgressRepairs}
                </p>
                <p className="text-xs text-gray-500">Open repair tickets</p>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">New Requests:</span>
                  <span className="font-bold text-amber-700">{maintenanceOverview.newRequests}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">In-Progress Repairs:</span>
                  <span className="font-bold text-sky-700">{maintenanceOverview.inProgressRepairs}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Completed:</span>
                  <span className="font-bold text-emerald-600">{maintenanceOverview.completedRepairs}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Emergency Maintenance:</span>
                  <span className="font-bold text-rose-600">{maintenanceOverview.emergencyMaintenance}</span>
                </div>
              </div>
            </div>

            {/* DOMAIN 7: Visitor Overview */}
            <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-teal-700">7. Visitor Registry</span>
                  <button
                    onClick={() => setAddVisitorModal({ ...addVisitorModal, open: true })}
                    className="p-1 rounded-md bg-teal-50 text-teal-700 hover:bg-teal-100"
                    title="Add Visitor Pass"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-baseline gap-2 mt-2">
                  <p className="text-3xl font-black text-gray-900">{visitorOverview.currentInside}</p>
                  <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    inside now
                  </span>
                </div>
                <p className="text-xs text-gray-500">Hostel guests & visitors</p>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Today's Total Visitors:</span>
                  <span className="font-bold text-gray-900">{visitorOverview.todayVisitors}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Currently Inside:</span>
                  <span className="font-bold text-emerald-600">{visitorOverview.currentInside}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Pending Passes:</span>
                  <span className="font-bold text-amber-600">{visitorOverview.pendingRequests}</span>
                </div>
              </div>
            </div>

            {/* DOMAIN 8: Discipline & Curfew */}
            <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-700">8. Discipline & Curfew</span>
                  <Link
                    href="/warden/curfew"
                    className="text-xs text-rose-600 font-semibold hover:underline flex items-center gap-0.5"
                  >
                    Curfew Center <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                <div className="flex items-baseline gap-2 mt-2">
                  <p className="text-3xl font-black text-gray-900">{disciplineOverview.studentsWithIssues}</p>
                  <span className="text-xs text-rose-700">students flagged</span>
                </div>
                <p className="text-xs text-gray-500">Curfew breaches & violations</p>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Pending Actions:</span>
                  <span className="font-bold text-rose-600">{disciplineOverview.pendingDisciplinaryActions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Active Curfew Breaches:</span>
                  <span className="font-bold text-rose-600">{disciplineOverview.curfewViolationsCount}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Scheduled Curfew:</span>
                  <span className="font-semibold text-gray-800 text-[11px]">
                    {curfewConfigData?.startTime ? `${curfewConfigData.startTime} - ${curfewConfigData.endTime}` : `${curfewConfig.curfewTime} - ${curfewConfig.curfewEndTime}`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── ROW 3: RECENT INCIDENTS & SAFETY FEED (DOMAIN 9) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Safety & Emergency Log */}
            <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-gray-900">Safety & Incident Feed</h2>
                    <p className="text-[11px] text-gray-500">Recent security, medical, and emergency notifications</p>
                  </div>
                </div>
                <button
                  onClick={() => setIncidentModal({ ...incidentModal, open: true })}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100"
                >
                  + Log Incident
                </button>
              </div>

              {emergencyOverview.recentIncidents.length === 0 ? (
                <div className="text-center py-8 bg-gray-50/60 rounded-xl border border-dashed border-gray-200">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1.5 opacity-80" />
                  <p className="text-xs font-semibold text-gray-700">No Security Incidents</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">The hostel perimeter and campus are secure.</p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {emergencyOverview.recentIncidents.map((inc: any) => (
                    <div
                      key={inc._id}
                      className={`p-3 rounded-xl border flex items-start justify-between gap-3 text-xs ${
                        inc.type === 'emergency'
                          ? 'bg-rose-50/60 border-rose-200'
                          : 'bg-gray-50/80 border-gray-200/70'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                              inc.type === 'emergency' ? 'bg-rose-600 text-white' : 'bg-gray-200 text-gray-700'
                            }`}
                          >
                            {inc.type}
                          </span>
                          <span className="font-bold text-gray-900">{inc.title}</span>
                        </div>
                        <p className="text-gray-600">{inc.description}</p>
                        <p className="text-[10px] text-gray-400">
                          Student: {inc.studentName || '—'} | Room: {inc.roomNumber || '—'} | {new Date(inc.createdAt).toLocaleString()}
                        </p>
                      </div>
                      {inc.status === 'active' && (
                        <button
                          onClick={() => handleAcknowledgeEmergency(inc._id)}
                          className="px-2 py-1 rounded bg-rose-600 text-white text-[10px] font-bold shrink-0 hover:bg-rose-700"
                        >
                          Acknowledge
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── DOMAIN 10: SCHEDULED CURFEW & AUTOMATED MONITORING ── */}
            <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4 border border-indigo-900/40">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center border border-indigo-500/30">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-white tracking-wide">Scheduled Curfew</h2>
                      <p className="text-[11px] text-indigo-300">Automated student presence & location monitoring</p>
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                      activeCurfewSession?.status === 'ACTIVE' || isCurfewActive
                        ? 'bg-rose-500 text-white animate-pulse'
                        : curfewConfigData?.isActive || activeCurfewSession?.status === 'SCHEDULED'
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        activeCurfewSession?.status === 'ACTIVE' || isCurfewActive
                          ? 'bg-white animate-ping'
                          : curfewConfigData?.isActive || activeCurfewSession?.status === 'SCHEDULED'
                          ? 'bg-indigo-400'
                          : 'bg-slate-500'
                      }`}
                    />
                    {activeCurfewSession?.status === 'ACTIVE' || isCurfewActive
                      ? 'Curfew In Progress'
                      : curfewConfigData?.isActive || activeCurfewSession?.status === 'SCHEDULED'
                      ? 'Scheduled'
                      : 'Inactive / Standby'}
                  </span>
                </div>
              </div>

              {/* Curfew Details Matrix */}
              <div className="grid grid-cols-2 gap-3 bg-white/5 p-3.5 rounded-xl border border-white/10 text-xs">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-indigo-300 font-semibold">Curfew Window</p>
                  <p className="font-bold text-white mt-0.5 text-sm font-mono">
                    {curfewConfigData?.startTime || curfewConfig.curfewTime} — {curfewConfigData?.endTime || curfewConfig.curfewEndTime}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {curfewConfigData?.startDate ? `${curfewConfigData.startDate} → ${curfewConfigData.endDate || curfewConfigData.startDate}` : 'Daily Schedule'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-indigo-300 font-semibold">Duration & Cycle</p>
                  <p className="font-bold text-white mt-0.5 text-sm">
                    {curfewConfigData?.durationDisplay || '9 hours'}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5 capitalize">
                    {curfewConfigData?.recurrence?.type === 'daily'
                      ? 'Every Day'
                      : curfewConfigData?.recurrence?.type === 'selected_days'
                      ? `Days: ${curfewConfigData.recurrence.selectedDays?.join(', ') || 'Selected'}`
                      : curfewConfigData?.recurrence?.type === 'one_time'
                      ? 'One-Time Curfew'
                      : 'Recurring Schedule'}
                  </p>
                </div>
              </div>

              {/* Protocol Parameters */}
              <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-950/40 p-2.5 rounded-xl border border-white/5">
                <div className="flex items-center gap-1.5 text-slate-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span>Grace Period: <strong className="text-white">{curfewConfigData?.gracePeriodMinutes || 15}m</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                  <span>Escalation: <strong className="text-white">{curfewConfigData?.escalationPeriodMinutes || 15}m</strong></span>
                </div>
              </div>

              {/* Action Button: Navigate to Dedicated Control Center */}
              <Link
                href="/warden/curfew"
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-xs flex items-center justify-center gap-2 group"
              >
                <span>Curfew Control & Live Monitoring Center</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: PERMISSIONS & LEAVE MANAGEMENT ───────────────────────────── */}
      {activeTab === 'permissions' && (
        <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-amber-600" />
                Student Leave & Outpass Applications
              </h2>
              <p className="text-xs text-gray-500">Review pending outpasses, overnight leaves, and emergency requests.</p>
            </div>
            {/* Search & Filter */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search student or room..."
                  value={permSearch}
                  onChange={(e) => setPermSearch(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
              <select
                value={permTypeFilter}
                onChange={(e) => setPermTypeFilter(e.target.value)}
                className="py-1.5 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none"
              >
                <option value="all">All Types</option>
                <option value="leave">Leave</option>
                <option value="late-entry">Late Entry</option>
                <option value="overnight">Overnight</option>
                <option value="multi-day">Multi-day</option>
              </select>
            </div>
          </div>

          {filteredPermissions.length === 0 ? (
            <div className="text-center py-12 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-semibold text-gray-800">No Pending Permissions</p>
              <p className="text-xs text-gray-500 mt-1">All student requests have been reviewed.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-600">
                <thead className="bg-gray-50 text-gray-700 uppercase font-semibold border-b border-gray-200">
                  <tr>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Room</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Requested Date</th>
                    <th className="py-3 px-4">Return Date</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredPermissions.map((p) => (
                    <tr key={p._id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3 px-4 font-semibold text-gray-900">
                        {p.studentId?.name || 'Unknown'}
                        <span className="block text-[10px] text-gray-400 font-normal">{p.studentId?.phone || p.studentId?.studentId}</span>
                      </td>
                      <td className="py-3 px-4">{p.studentId?.roomId || '—'}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-800">
                          {p.permissionType}
                        </span>
                      </td>
                      <td className="py-3 px-4">{new Date(p.requestedDate).toLocaleDateString()}</td>
                      <td className="py-3 px-4">{p.returnDate ? new Date(p.returnDate).toLocaleDateString() : '—'}</td>
                      <td className="py-3 px-4 max-w-xs truncate" title={p.reason}>{p.reason}</td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          onClick={() => handleApprovePermission(p._id)}
                          disabled={actionLoading === p._id}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => setRejectModal({
                            open: true,
                            type: 'permission',
                            id: p._id,
                            studentOrVisitorName: p.studentId?.name || 'Student',
                            reason: '',
                          })}
                          disabled={actionLoading === p._id}
                          className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 font-bold hover:bg-rose-100"
                        >
                          Reject
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: VIOLATIONS & DISCIPLINARY LOG ─────────────────────────────── */}
      {activeTab === 'violations' && (
        <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                Disciplinary & Curfew Breaches
              </h2>
              <p className="text-xs text-gray-500">Resolve warnings, escalate serious infractions, or log disciplinary fines.</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search student or description..."
                  value={violSearch}
                  onChange={(e) => setViolSearch(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none"
                />
              </div>
              <button
                onClick={() => setIncidentModal({ ...incidentModal, open: true })}
                className="px-3 py-1.5 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-700"
              >
                + Record Incident
              </button>
            </div>
          </div>

          {filteredViolations.length === 0 ? (
            <div className="text-center py-12 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-semibold text-gray-800">No Open Violations</p>
              <p className="text-xs text-gray-500 mt-1">Hostel rules compliance is at 100%.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-600">
                <thead className="bg-gray-50 text-gray-700 uppercase font-semibold border-b border-gray-200">
                  <tr>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Room</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredViolations.map((v) => (
                    <tr key={v._id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3 px-4 font-semibold text-gray-900">
                        {v.studentId?.name || 'Unknown'}
                        <span className="block text-[10px] text-gray-400">{v.studentId?.phone}</span>
                      </td>
                      <td className="py-3 px-4">{v.studentId?.roomId || '—'}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-100 text-rose-800">
                          {v.violationType || 'Breach'}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-sm truncate" title={v.description}>{v.description}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800">
                          {v.status || 'Pending'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          onClick={() => handleResolveViolation(v)}
                          disabled={actionLoading === v._id}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Resolve
                        </button>
                        <button
                          onClick={() => setEscalateModal({
                            open: true,
                            id: v._id,
                            studentName: v.studentId?.name || 'Student',
                            reason: '',
                          })}
                          disabled={actionLoading === v._id}
                          className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 font-bold hover:bg-amber-100"
                        >
                          Escalate
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 4: VISITOR REGISTRY ─────────────────────────────────────────── */}
      {activeTab === 'visitors' && (
        <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-sky-600" />
                Hostel Visitor Gate Registry
              </h2>
              <p className="text-xs text-gray-500">Track entries, issue visitor passes, and checkout visitors leaving campus.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search visitor or student..."
                  value={visitorSearch}
                  onChange={(e) => setVisitorSearch(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none"
                />
              </div>
              <button
                onClick={() => setAddVisitorModal({ ...addVisitorModal, open: true })}
                className="px-3 py-1.5 bg-sky-600 text-white text-xs font-bold rounded-xl hover:bg-sky-700 flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Visitor
              </button>
            </div>
          </div>

          {filteredVisitors.length === 0 ? (
            <div className="text-center py-12 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
              <Users className="w-10 h-10 text-gray-400 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-semibold text-gray-800">No Visitors Recorded</p>
              <p className="text-xs text-gray-500 mt-1">No active or pending visitors for this hostel.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-600">
                <thead className="bg-gray-50 text-gray-700 uppercase font-semibold border-b border-gray-200">
                  <tr>
                    <th className="py-3 px-4">Visitor</th>
                    <th className="py-3 px-4">Phone</th>
                    <th className="py-3 px-4">Visiting Student</th>
                    <th className="py-3 px-4">Purpose</th>
                    <th className="py-3 px-4">Entry Time</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredVisitors.map((v) => {
                    const isInside = v.entryTime != null && v.exitTime == null && v.status === 'approved';
                    return (
                      <tr key={v._id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="py-3 px-4 font-semibold text-gray-900">{v.visitorName}</td>
                        <td className="py-3 px-4">{v.visitorPhone}</td>
                        <td className="py-3 px-4">
                          {v.visitingStudentId?.name || '—'}
                          <span className="block text-[10px] text-gray-400">Room {v.visitingStudentId?.roomId || '—'}</span>
                        </td>
                        <td className="py-3 px-4">{v.purpose}</td>
                        <td className="py-3 px-4">{v.entryTime ? new Date(v.entryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                        <td className="py-3 px-4">
                          {isInside ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1 w-fit">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Inside
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-gray-100 text-gray-700">
                              {v.status}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          {v.status === 'pending' && (
                            <button
                              onClick={() => handleApproveVisitor(v._id)}
                              disabled={actionLoading === v._id}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50"
                            >
                              Check-In
                            </button>
                          )}
                          {isInside && (
                            <button
                              onClick={() => handleCheckoutVisitor(v._id)}
                              disabled={actionLoading === v._id}
                              className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-bold hover:bg-indigo-100 disabled:opacity-50"
                            >
                              Checkout
                            </button>
                          )}
                          <button
                            onClick={() => setDeleteConfirmModal({
                              open: true,
                              type: 'visitor',
                              id: v._id,
                              description: `Visitor: ${v.visitorName}`,
                            })}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 5: COMPLAINTS & MAINTENANCE ─────────────────────────────────── */}
      {activeTab === 'complaints' && (
        <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Wrench className="w-5 h-5 text-indigo-600" />
                Hostel Complaints & Maintenance Tickets
              </h2>
              <p className="text-xs text-gray-500">Monitor repairs, safety issues, food feedback, and sanitation requests.</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <select
                value={complaintTypeFilter}
                onChange={(e) => setComplaintTypeFilter(e.target.value)}
                className="py-1.5 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl"
              >
                <option value="all">All Categories</option>
                <option value="maintenance">Maintenance</option>
                <option value="cleaning">Cleaning</option>
                <option value="safety">Safety</option>
                <option value="food">Food</option>
                <option value="other">Other</option>
              </select>

              <select
                value={complaintStatusFilter}
                onChange={(e) => setComplaintStatusFilter(e.target.value)}
                className="py-1.5 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl"
              >
                <option value="all">All Statuses</option>
                <option value="open">Open</option>
                <option value="in-progress">In Progress</option>
                <option value="resolved">Resolved</option>
              </select>

              <button
                onClick={() => setMaintenanceModal({ ...maintenanceModal, open: true })}
                className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Report Ticket
              </button>
            </div>
          </div>

          {complaintsList.length === 0 ? (
            <div className="text-center py-12 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-semibold text-gray-800">No Complaints Found</p>
              <p className="text-xs text-gray-500 mt-1">No open issues matching selected filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {complaintsList.map((c) => (
                <div key={c._id} className="p-4 rounded-xl border border-gray-200/80 bg-gray-50/40 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-100 text-indigo-800">
                          {c.complaintType}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            c.priority === 'urgent' || c.priority === 'high'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-gray-200 text-gray-700'
                          }`}
                        >
                          {c.priority}
                        </span>
                      </div>
                      <h3 className="font-bold text-gray-900 mt-1 text-sm">{c.title}</h3>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        c.status === 'resolved' || c.status === 'closed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : c.status === 'in-progress'
                          ? 'bg-sky-100 text-sky-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>

                  <p className="text-xs text-gray-600">{c.description}</p>

                  <div className="text-[11px] text-gray-500 flex items-center justify-between pt-2 border-t border-gray-200/60">
                    <span>By: {c.raisedBy?.name || 'Staff'} (Room {c.roomId?.roomNumber || '—'})</span>
                    <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      onClick={() => setComplaintResolveModal({
                        open: true,
                        complaintId: c._id,
                        title: c.title,
                        status: c.status === 'open' ? 'in-progress' : 'resolved',
                        resolutionNotes: c.resolutionNotes || '',
                      })}
                      className="px-3 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold"
                    >
                      Update Status
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}



      {/* ── MODAL 1: MARK ATTENDANCE (Quick Action) ─────────────────────────── */}
      {markAttendanceModal.open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-900 flex items-center gap-2 text-base">
                <UserCheck className="w-5 h-5 text-indigo-600" />
                Mark Student Attendance
              </h3>
              <button
                onClick={() => setMarkAttendanceModal({ ...markAttendanceModal, open: false })}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleMarkAttendanceSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Select Student *</label>
                <select
                  value={markAttendanceModal.studentId}
                  onChange={(e) => setMarkAttendanceModal({ ...markAttendanceModal, studentId: e.target.value })}
                  required
                  className="w-full py-2 px-3 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="">-- Choose student --</option>
                  {hostelStudents.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} (Room {s.roomId?.roomNumber || '—'}) {s.studentId ? `[${s.studentId}]` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Attendance Status *</label>
                <select
                  value={markAttendanceModal.status}
                  onChange={(e) => setMarkAttendanceModal({ ...markAttendanceModal, status: e.target.value })}
                  className="w-full py-2 px-3 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none"
                >
                  <option value="inside">Present (Inside Hostel)</option>
                  <option value="outside">Outside Hostel</option>
                  <option value="on-leave">On Approved Leave</option>
                  <option value="pending">Pending Verification</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Remarks / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Manual gate entry verified by warden"
                  value={markAttendanceModal.notes}
                  onChange={(e) => setMarkAttendanceModal({ ...markAttendanceModal, notes: e.target.value })}
                  className="w-full py-2 px-3 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMarkAttendanceModal({ ...markAttendanceModal, open: false })}
                  className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'markAttendance'}
                  className="flex-1 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 disabled:opacity-50"
                >
                  {actionLoading === 'markAttendance' ? 'Saving...' : 'Save Attendance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: ADD VISITOR (Quick Action) ─────────────────────────────── */}
      {addVisitorModal.open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-900 flex items-center gap-2 text-base">
                <Plus className="w-5 h-5 text-sky-600" />
                Register Visitor Pass
              </h3>
              <button
                onClick={() => setAddVisitorModal({ ...addVisitorModal, open: false })}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddVisitorSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Visitor Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rajesh Kumar"
                  value={addVisitorModal.visitorName}
                  onChange={(e) => setAddVisitorModal({ ...addVisitorModal, visitorName: e.target.value })}
                  className="w-full py-2 px-3 bg-gray-50 border border-gray-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Visitor Phone Number *</label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9876543210"
                  value={addVisitorModal.visitorPhone}
                  onChange={(e) => setAddVisitorModal({ ...addVisitorModal, visitorPhone: e.target.value })}
                  className="w-full py-2 px-3 bg-gray-50 border border-gray-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Visiting Student *</label>
                <select
                  value={addVisitorModal.visitingStudentId}
                  onChange={(e) => setAddVisitorModal({ ...addVisitorModal, visitingStudentId: e.target.value })}
                  required
                  className="w-full py-2 px-3 bg-gray-50 border border-gray-300 rounded-xl"
                >
                  <option value="">-- Choose student --</option>
                  {hostelStudents.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} (Room {s.roomId?.roomNumber || '—'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Purpose of Visit *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Parent meeting, book delivery"
                  value={addVisitorModal.purpose}
                  onChange={(e) => setAddVisitorModal({ ...addVisitorModal, purpose: e.target.value })}
                  className="w-full py-2 px-3 bg-gray-50 border border-gray-300 rounded-xl"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="autoApprove"
                  checked={addVisitorModal.autoApprove}
                  onChange={(e) => setAddVisitorModal({ ...addVisitorModal, autoApprove: e.target.checked })}
                  className="rounded text-sky-600"
                />
                <label htmlFor="autoApprove" className="text-gray-700 font-medium">
                  Approve and check-in immediately at gate
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddVisitorModal({ ...addVisitorModal, open: false })}
                  className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'addVisitor'}
                  className="flex-1 py-2 rounded-xl bg-sky-600 text-white font-bold hover:bg-sky-700 disabled:opacity-50"
                >
                  {actionLoading === 'addVisitor' ? 'Adding...' : 'Register Visitor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 3: ANNOUNCEMENT (Quick Action) ────────────────────────────── */}
      {announcementModal.open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-900 flex items-center gap-2 text-base">
                <Megaphone className="w-5 h-5 text-purple-600" />
                Broadcast Announcement
              </h3>
              <button
                onClick={() => setAnnouncementModal({ ...announcementModal, open: false })}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAnnouncementSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Announcement Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Water Supply Maintenance Notice"
                  value={announcementModal.title}
                  onChange={(e) => setAnnouncementModal({ ...announcementModal, title: e.target.value })}
                  className="w-full py-2 px-3 bg-gray-50 border border-gray-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Message Content *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Write message details for hostel occupants..."
                  value={announcementModal.message}
                  onChange={(e) => setAnnouncementModal({ ...announcementModal, message: e.target.value })}
                  className="w-full py-2 px-3 bg-gray-50 border border-gray-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Audience</label>
                  <select
                    value={announcementModal.targetAudience}
                    onChange={(e) => setAnnouncementModal({ ...announcementModal, targetAudience: e.target.value })}
                    className="w-full py-2 px-3 bg-gray-50 border border-gray-300 rounded-xl"
                  >
                    <option value="all">Everyone in Hostel</option>
                    <option value="students">Students Only</option>
                    <option value="staff">Hostel Staff Only</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Priority</label>
                  <select
                    value={announcementModal.priority}
                    onChange={(e) => setAnnouncementModal({ ...announcementModal, priority: e.target.value })}
                    className="w-full py-2 px-3 bg-gray-50 border border-gray-300 rounded-xl"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAnnouncementModal({ ...announcementModal, open: false })}
                  className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'announcement'}
                  className="flex-1 py-2 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-700 disabled:opacity-50"
                >
                  {actionLoading === 'announcement' ? 'Sending...' : 'Broadcast'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 4: REPORT MAINTENANCE (Quick Action) ──────────────────────── */}
      {maintenanceModal.open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-900 flex items-center gap-2 text-base">
                <Wrench className="w-5 h-5 text-emerald-600" />
                Submit Maintenance Ticket
              </h3>
              <button
                onClick={() => setMaintenanceModal({ ...maintenanceModal, open: false })}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleMaintenanceSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Issue Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Geyser leakage in 2nd floor bathroom"
                  value={maintenanceModal.title}
                  onChange={(e) => setMaintenanceModal({ ...maintenanceModal, title: e.target.value })}
                  className="w-full py-2 px-3 bg-gray-50 border border-gray-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Description *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe repair requirements..."
                  value={maintenanceModal.description}
                  onChange={(e) => setMaintenanceModal({ ...maintenanceModal, description: e.target.value })}
                  className="w-full py-2 px-3 bg-gray-50 border border-gray-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Room (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. 204 or Block A"
                    value={maintenanceModal.roomId}
                    onChange={(e) => setMaintenanceModal({ ...maintenanceModal, roomId: e.target.value })}
                    className="w-full py-2 px-3 bg-gray-50 border border-gray-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Priority</label>
                  <select
                    value={maintenanceModal.priority}
                    onChange={(e) => setMaintenanceModal({ ...maintenanceModal, priority: e.target.value })}
                    className="w-full py-2 px-3 bg-gray-50 border border-gray-300 rounded-xl"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent / Emergency</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMaintenanceModal({ ...maintenanceModal, open: false })}
                  className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'maintenance'}
                  className="flex-1 py-2 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50"
                >
                  {actionLoading === 'maintenance' ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 5: RECORD DISCIPLINARY INCIDENT (Quick Action) ─────────────── */}
      {incidentModal.open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-900 flex items-center gap-2 text-base">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                Record Disciplinary Incident
              </h3>
              <button
                onClick={() => setIncidentModal({ ...incidentModal, open: false })}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleIncidentSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Student Involved *</label>
                <select
                  value={incidentModal.studentId}
                  onChange={(e) => setIncidentModal({ ...incidentModal, studentId: e.target.value })}
                  required
                  className="w-full py-2 px-3 bg-gray-50 border border-gray-300 rounded-xl"
                >
                  <option value="">-- Select student --</option>
                  {hostelStudents.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} (Room {s.roomId?.roomNumber || '—'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Violation Type</label>
                  <select
                    value={incidentModal.violationType}
                    onChange={(e) => setIncidentModal({ ...incidentModal, violationType: e.target.value })}
                    className="w-full py-2 px-3 bg-gray-50 border border-gray-300 rounded-xl"
                  >
                    <option value="late-entry">Late Entry</option>
                    <option value="curfew">Curfew Breach</option>
                    <option value="unauthorized-visitor">Unauthorized Visitor</option>
                    <option value="noise">Noise Disruption</option>
                    <option value="damage">Hostel Property Damage</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Warning Level</label>
                  <select
                    value={incidentModal.warningLevel}
                    onChange={(e) => setIncidentModal({ ...incidentModal, warningLevel: e.target.value })}
                    className="w-full py-2 px-3 bg-gray-50 border border-gray-300 rounded-xl"
                  >
                    <option value="warning">First Warning</option>
                    <option value="first">Formal First Strike</option>
                    <option value="second">Second Strike</option>
                    <option value="final">Final Warning</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Incident Description *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Details of the event, location, witnesses..."
                  value={incidentModal.description}
                  onChange={(e) => setIncidentModal({ ...incidentModal, description: e.target.value })}
                  className="w-full py-2 px-3 bg-gray-50 border border-gray-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Fine Amount (₹ optional)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={incidentModal.fineAmount}
                  onChange={(e) => setIncidentModal({ ...incidentModal, fineAmount: Number(e.target.value) })}
                  className="w-full py-2 px-3 bg-gray-50 border border-gray-300 rounded-xl"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIncidentModal({ ...incidentModal, open: false })}
                  className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'incident'}
                  className="flex-1 py-2 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700 disabled:opacity-50"
                >
                  {actionLoading === 'incident' ? 'Recording...' : 'Record Violation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 6: UPDATE COMPLAINT STATUS ─────────────────────────────────── */}
      {complaintResolveModal.open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-900 text-base">Update Complaint Status</h3>
              <button
                onClick={() => setComplaintResolveModal({ ...complaintResolveModal, open: false })}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleComplaintResolveSubmit} className="space-y-3.5 text-xs">
              <p className="font-semibold text-gray-800">{complaintResolveModal.title}</p>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Status *</label>
                <select
                  value={complaintResolveModal.status}
                  onChange={(e) => setComplaintResolveModal({ ...complaintResolveModal, status: e.target.value })}
                  className="w-full py-2 px-3 bg-gray-50 border border-gray-300 rounded-xl"
                >
                  <option value="open">Open</option>
                  <option value="in-progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Resolution Remarks</label>
                <textarea
                  rows={3}
                  placeholder="Notes on how the issue was addressed..."
                  value={complaintResolveModal.resolutionNotes}
                  onChange={(e) => setComplaintResolveModal({ ...complaintResolveModal, resolutionNotes: e.target.value })}
                  className="w-full py-2 px-3 bg-gray-50 border border-gray-300 rounded-xl"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setComplaintResolveModal({ ...complaintResolveModal, open: false })}
                  className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'resolveComplaint'}
                  className="flex-1 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 disabled:opacity-50"
                >
                  {actionLoading === 'resolveComplaint' ? 'Saving...' : 'Save Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 7: REJECT PERMISSION / VISITOR ─────────────────────────────── */}
      {rejectModal.open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-gray-900 text-base">
              Reject Request for {rejectModal.studentOrVisitorName}
            </h3>
            <p className="text-xs text-gray-500">
              Please specify why this request is being denied. The applicant will be notified immediately.
            </p>
            <textarea
              rows={3}
              placeholder="Reason for rejection..."
              value={rejectModal.reason}
              onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
              className="w-full text-xs p-3 bg-gray-50 border border-gray-300 rounded-xl"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setRejectModal({ open: false, type: 'permission', id: '', studentOrVisitorName: '', reason: '' })}
                className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-700 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={actionLoading === rejectModal.id}
                className="flex-1 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 disabled:opacity-50"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 8: ESCALATE VIOLATION ──────────────────────────────────────── */}
      {escalateModal.open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-gray-900 text-base">Escalate to Management</h3>
            <p className="text-xs text-gray-500">
              Escalate infraction of <span className="font-semibold text-gray-800">{escalateModal.studentName}</span> directly to hostel owners.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setEscalateModal({ open: false, id: '', studentName: '', reason: '' })}
                className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-700 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmEscalate}
                disabled={actionLoading === escalateModal.id}
                className="flex-1 py-2 rounded-xl bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 disabled:opacity-50"
              >
                Confirm Escalation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 9: DELETE CONFIRMATION ─────────────────────────────────────── */}
      {deleteConfirmModal.open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-gray-900 text-base">Confirm Deletion</h3>
            <p className="text-xs text-gray-500">
              Are you sure you want to permanently delete this record? This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirmModal({ open: false, type: 'permission', id: '', description: '' })}
                className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-700 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={actionLoading === deleteConfirmModal.id}
                className="flex-1 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 disabled:opacity-50"
              >
                Delete Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
