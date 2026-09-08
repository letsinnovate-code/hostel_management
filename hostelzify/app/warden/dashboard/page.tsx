'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import { alertApi } from '../../../services/alertApi';
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
  XCircle,
  Trash2,
  RefreshCw,
  Search,
  Activity,
  Megaphone,
  Bell,
  Sliders,
  History,
  Calendar,
  Send,
  AlertOctagon,
  ArrowUpRight,
  Info,
  ChevronRight,
  SquareCheck,
  Check,
  X,
  Play,
  StopCircle,
} from 'lucide-react';

export default function WardenDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const { connected, lastCurfewEvent } = useAlertSocket();

  // ── Live Clock State ──────────────────────────────────────────────────────────
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  // ── Active Card Selection ───────────────────────────────────────────────────
  const [activeCard, setActiveCard] = useState<'permissions' | 'violations' | 'visitors' | 'curfew'>('permissions');

  // ── Dashboard Data State ────────────────────────────────────────────────────
  const [dashboard, setDashboard] = useState<any>(null);
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

  // ── Curfew Hub & Customization State ────────────────────────────────────────
  const [curfewHubTab, setCurfewHubTab] = useState<'control' | 'history'>('control');
  const [curfewConfig, setCurfewConfig] = useState({
    curfewTime: '21:00',
    curfewEndTime: '06:00',
    weekendCurfewTime: '22:00',
    gracePeriodMinutes: 15,
    recipients: {
      students: true,
      warden: true,
      owner: true,
      parents: true,
      guards: false,
    },
    timing: {
      preCurfewReminder: true,
      preCurfewReminderMinutes: 15,
      onCurfewStart: true,
      onTenMinuteWarning: true,
      onGraceExpiry: true,
      onParentEscalation: true,
      parentEscalationMinutes: 30,
    },
  });
  const [savingConfig, setSavingConfig] = useState(false);
  const [startingCurfew, setStartingCurfew] = useState(false);
  const [endingCurfew, setEndingCurfew] = useState(false);

  // ── Curfew History & Violation Audit Log ────────────────────────────────────
  const [historySubTab, setHistorySubTab] = useState<'sessions' | 'violations'>('sessions');
  const [curfewSessions, setCurfewSessions] = useState<any[]>([]);
  const [curfewViolationHistory, setCurfewViolationHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historyDateFilter, setHistoryDateFilter] = useState('');

  // ── Emergency Broadcast State ───────────────────────────────────────────────
  const [emergencyForm, setEmergencyForm] = useState({
    title: '',
    message: '',
    priority: 'high',
    targetRoles: { owner: true, warden: true, student: true },
  });
  const [broadcasting, setBroadcasting] = useState(false);

  // ── Modals State ────────────────────────────────────────────────────────────
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
  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.getDashboard();
      const d = response.data || {};
      setDashboard(d);
      setPermissions(d.permissions || []);
      setViolations(d.violations || []);
      setVisitors(d.visitors || []);

      if (d.curfewStatus) {
        setCurfewConfig((prev) => ({
          ...prev,
          curfewTime: d.curfewStatus.curfewTime || prev.curfewTime,
          curfewEndTime: d.curfewStatus.curfewEndTime || prev.curfewEndTime,
          weekendCurfewTime: d.curfewStatus.weekendCurfewTime || prev.weekendCurfewTime,
          gracePeriodMinutes: d.curfewStatus.gracePeriodMinutes || prev.gracePeriodMinutes,
          recipients: d.curfewStatus.curfewAlertConfig?.recipients || prev.recipients,
          timing: d.curfewStatus.curfewAlertConfig?.timing || prev.timing,
        }));
      }
    } catch (error: any) {
      console.error('Failed to load dashboard:', error);
      toast.error(error.message || 'Failed to refresh dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Load Curfew History ─────────────────────────────────────────────────────
  const loadCurfewHistory = useCallback(async () => {
    if (!user?.hostelId) return;
    setLoadingHistory(true);
    try {
      const res = await alertApi.getCurfewHistory(user.hostelId, {
        date: historyDateFilter || undefined,
        search: historySearch || undefined,
      });
      const data = res.data || {};
      setCurfewSessions(data.sessions || []);
      setCurfewViolationHistory(data.violations || []);
    } catch (error: any) {
      console.error('Failed to load curfew history:', error);
    } finally {
      setLoadingHistory(false);
    }
  }, [user?.hostelId, historyDateFilter, historySearch]);

  useEffect(() => {
    if (!user || user.role !== 'warden') {
      router.replace('/login');
      return;
    }
    loadDashboard();
  }, [user, router, loadDashboard]);

  // Refresh data on real-time curfew socket events
  useEffect(() => {
    if (lastCurfewEvent) {
      if (lastCurfewEvent.type === 'curfew:ended') {
        setDashboard((prev: any) => prev ? ({
          ...prev,
          curfewStatus: {
            ...prev.curfewStatus,
            isCurfewActive: false,
            isManualCurfewActive: false,
            manualCurfewEndedAt: lastCurfewEvent.data?.manualCurfewEndedAt || new Date().toISOString(),
          },
        }) : prev);
      } else if (lastCurfewEvent.type === 'curfew:sweep_completed') {
        setDashboard((prev: any) => prev ? ({
          ...prev,
          curfewStatus: {
            ...prev.curfewStatus,
            isCurfewActive: true,
            isManualCurfewActive: true,
            manualCurfewEndedAt: null,
          },
        }) : prev);
      }
      loadDashboard();
      if (activeCard === 'curfew') {
        loadCurfewHistory();
      }
    }
  }, [lastCurfewEvent, activeCard, loadDashboard, loadCurfewHistory]);

  useEffect(() => {
    if (activeCard === 'curfew') {
      loadCurfewHistory();
    }
  }, [activeCard, loadCurfewHistory]);

  // ── Permission Action Handlers ──────────────────────────────────────────────
  const handleApprovePermission = async (id: string) => {
    setActionLoading(id);
    try {
      await api.approvePermission(id);
      toast.success('Permission approved & student notified');
      setPermissions((prev) => prev.filter((p) => p._id !== id));
      if (dashboard) {
        setDashboard({ ...dashboard, pendingPermissions: Math.max(0, dashboard.pendingPermissions - 1) });
      }
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
        if (dashboard) {
          setDashboard({ ...dashboard, pendingPermissions: Math.max(0, dashboard.pendingPermissions - 1) });
        }
      } else {
        await api.rejectVisitor(rejectModal.id, rejectModal.reason.trim());
        toast.success('Visitor request rejected');
        setVisitors((prev) => prev.filter((v) => v._id !== rejectModal.id));
        if (dashboard) {
          setDashboard({ ...dashboard, pendingVisitors: Math.max(0, dashboard.pendingVisitors - 1) });
        }
      }
      setRejectModal({ open: false, type: 'permission', id: '', studentOrVisitorName: '', reason: '' });
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
        if (dashboard) {
          setDashboard({ ...dashboard, pendingPermissions: Math.max(0, dashboard.pendingPermissions - 1) });
        }
      } else if (type === 'violation') {
        await api.deleteViolation(id);
        toast.success('Violation record deleted');
        setViolations((prev) => prev.filter((v) => v._id !== id));
        if (dashboard) {
          setDashboard({ ...dashboard, activeViolations: Math.max(0, dashboard.activeViolations - 1) });
        }
      } else if (type === 'visitor') {
        await api.deleteVisitor(id);
        toast.success('Visitor entry deleted');
        setVisitors((prev) => prev.filter((v) => v._id !== id));
        if (dashboard) {
          setDashboard({ ...dashboard, pendingVisitors: Math.max(0, dashboard.pendingVisitors - 1) });
        }
      } else if (type === 'curfew') {
        await alertApi.deleteCurfewViolation(id);
        toast.success('Curfew record deleted from history');
        setCurfewViolationHistory((prev) => prev.filter((v) => v._id !== id));
      }
      setDeleteConfirmModal({ open: false, type: 'permission', id: '', description: '' });
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete record');
    } finally {
      setActionLoading(null);
    }
  };

  // ── Violation Action Handlers ───────────────────────────────────────────────
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
      if (dashboard) {
        setDashboard({ ...dashboard, activeViolations: Math.max(0, dashboard.activeViolations - 1) });
      }
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
      toast.success(`Escalated violation for ${escalateModal.studentName} to Owner`);
      setEscalateModal({ open: false, id: '', studentName: '', reason: '' });
      loadDashboard();
    } catch (error: any) {
      toast.error(error.message || 'Failed to escalate violation');
    } finally {
      setActionLoading(null);
    }
  };

  // ── Visitor Action Handlers ─────────────────────────────────────────────────
  const handleApproveVisitor = async (id: string) => {
    setActionLoading(id);
    try {
      await api.approveVisitor(id);
      toast.success('Visitor approved & checked in');
      setVisitors((prev) => prev.filter((v) => v._id !== id));
      if (dashboard) {
        setDashboard({ ...dashboard, pendingVisitors: Math.max(0, dashboard.pendingVisitors - 1) });
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to approve visitor');
    } finally {
      setActionLoading(null);
    }
  };

  // ── Curfew Operations Handlers ──────────────────────────────────────────────
  const handleStartCurfewNow = async () => {
    if (!user?.hostelId) return;
    setStartingCurfew(true);
    try {
      const res = await alertApi.startImmediateCurfew(user.hostelId);
      toast.success(res.message || 'Curfew sweep started immediately! Presence verification active.', { duration: 5000 });
      setDashboard((prev: any) => prev ? ({
        ...prev,
        curfewStatus: {
          ...prev.curfewStatus,
          isCurfewActive: true,
          isManualCurfewActive: true,
          manualCurfewEndedAt: null,
        },
      }) : prev);
      await loadDashboard();
      await loadCurfewHistory();
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || 'Failed to start curfew');
    } finally {
      setStartingCurfew(false);
    }
  };

  const handleEndCurfewNow = async () => {
    if (!user?.hostelId) return;
    setEndingCurfew(true);
    try {
      const res = await alertApi.endCurfew(user.hostelId, 'Ended manually by warden');
      toast.success(res.message || 'Curfew session concluded successfully.', { duration: 5000 });
      setDashboard((prev: any) => prev ? ({
        ...prev,
        curfewStatus: {
          ...prev.curfewStatus,
          isCurfewActive: false,
          isManualCurfewActive: false,
          manualCurfewEndedAt: new Date().toISOString(),
        },
      }) : prev);
      await loadDashboard();
      await loadCurfewHistory();
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || 'Failed to end curfew');
    } finally {
      setEndingCurfew(false);
    }
  };

  const handleSaveCurfewConfig = async () => {
    if (!user?.hostelId) return;
    setSavingConfig(true);
    try {
      const res = await alertApi.updateCurfewConfig(user.hostelId, curfewConfig);
      toast.success(res.message || 'Curfew schedule & alert rules saved successfully');
      await loadDashboard();
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || 'Failed to save configuration');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleBroadcastEmergency = async () => {
    if (!emergencyForm.title.trim() || !emergencyForm.message.trim()) {
      toast.error('Title and message are required');
      return;
    }
    const roles = Object.entries(emergencyForm.targetRoles)
      .filter(([, v]) => v)
      .map(([r]) => r);
    if (roles.length === 0) {
      toast.error('Select at least one recipient group');
      return;
    }
    if (!user?.hostelId) return;

    setBroadcasting(true);
    try {
      await alertApi.sendToAllRoles({
        title: emergencyForm.title,
        message: emergencyForm.message,
        priority: emergencyForm.priority as any,
        hostelId: user.hostelId,
        targetRoles: roles,
        type: 'ANNOUNCEMENT',
      });
      toast.success('Emergency alert dispatched to network');
      setEmergencyForm({
        title: '',
        message: '',
        priority: 'high',
        targetRoles: { owner: true, warden: true, student: true },
      });
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || 'Broadcast failed');
    } finally {
      setBroadcasting(false);
    }
  };

  // ── Filtered Datasets ───────────────────────────────────────────────────────
  const filteredPermissions = permissions.filter((p) => {
    const studentName = p.studentId?.name || '';
    const room = p.studentId?.roomId || '';
    const matchesSearch =
      studentName.toLowerCase().includes(permSearch.toLowerCase()) ||
      String(room).toLowerCase().includes(permSearch.toLowerCase()) ||
      (p.reason || '').toLowerCase().includes(permSearch.toLowerCase());
    const matchesType = permTypeFilter === 'all' || p.permissionType === permTypeFilter;
    return matchesSearch && matchesType;
  });

  const filteredViolations = violations.filter((v) => {
    const studentName = v.studentId?.name || '';
    const room = v.studentId?.roomId || v.roomNumber || '';
    const desc = v.description || v.violationType || '';
    const matchesSearch =
      studentName.toLowerCase().includes(violSearch.toLowerCase()) ||
      String(room).toLowerCase().includes(violSearch.toLowerCase()) ||
      desc.toLowerCase().includes(violSearch.toLowerCase());
    const matchesType =
      violTypeFilter === 'all' ||
      (violTypeFilter === 'curfew' && (v.isCurfew || v.violationType === 'curfew')) ||
      (violTypeFilter === 'disciplinary' && !v.isCurfew && v.violationType !== 'curfew');
    return matchesSearch && matchesType;
  });

  const filteredVisitors = visitors.filter((v) => {
    const visitorName = v.visitorName || '';
    const phone = v.visitorPhone || '';
    const studentName = v.visitingStudentId?.name || '';
    return (
      visitorName.toLowerCase().includes(visitorSearch.toLowerCase()) ||
      phone.includes(visitorSearch) ||
      studentName.toLowerCase().includes(visitorSearch.toLowerCase())
    );
  });

  const curfewStatus = dashboard?.curfewStatus;
  const isCurfewActive = Boolean(curfewStatus?.isCurfewActive || curfewStatus?.isManualCurfewActive);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── TOP HEADER WITH LIVE COMPLETE TIME ─────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          {/* Warden Identity */}
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-indigo-100">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">
                    Warden Control Dashboard
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Hostel Oversight
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                  Logged in as <span className="font-semibold text-gray-800">{user?.name || 'Warden'}</span> • Hostel ID: {user?.hostelId || 'Assigned'}
                </p>
              </div>
            </div>
          </div>

          {/* Complete Live Time Widget & Status */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Live Clock Card */}
            <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white px-4 py-2.5 rounded-xl shadow-sm border border-slate-800 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-indigo-300">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>
                    {currentTime
                      ? currentTime.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })
                      : 'Loading Date...'}
                  </span>
                </div>
                <div className="text-base sm:text-lg font-mono font-bold text-white tracking-wider">
                  {currentTime
                    ? currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
                    : '--:--:--'}
                </div>
              </div>
            </div>

            {/* Live Socket Network Indicator */}
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-2.5 rounded-xl">
              <span className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
              <div className="text-left">
                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Network</p>
                <p className="text-xs font-semibold text-gray-800">{connected ? 'Live Sync' : 'Reconnecting'}</p>
              </div>
            </div>

            {/* Refresh Button */}
            <button
              onClick={loadDashboard}
              disabled={loading}
              title="Refresh Dashboard Data"
              className="p-2.5 text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors flex items-center justify-center disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ── 4 PRIMARY CLICKABLE CARDS ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Card 1: Pending Permissions */}
        <button
          onClick={() => setActiveCard('permissions')}
          className={`text-left p-5 rounded-2xl border transition-all duration-200 relative overflow-hidden bg-white ${
            activeCard === 'permissions'
              ? 'border-amber-400 shadow-md ring-2 ring-amber-400/20 bg-amber-50/20'
              : 'border-gray-200/80 hover:border-amber-300 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">1. Pending Permissions</span>
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shadow-xs">
              <FileCheck className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-gray-900 mt-3">
            {dashboard?.pendingPermissions ?? (loading ? '...' : 0)}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-amber-700 font-medium">Leave & Outpass requests</span>
            <span className="font-semibold text-amber-800 flex items-center gap-0.5">
              Review <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </button>

        {/* Card 2: Active Violations */}
        <button
          onClick={() => setActiveCard('violations')}
          className={`text-left p-5 rounded-2xl border transition-all duration-200 relative overflow-hidden bg-white ${
            activeCard === 'violations'
              ? 'border-rose-400 shadow-md ring-2 ring-rose-400/20 bg-rose-50/20'
              : 'border-gray-200/80 hover:border-rose-300 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-700">2. Active Violations</span>
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shadow-xs">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-gray-900 mt-3">
            {dashboard?.activeViolations ?? (loading ? '...' : 0)}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-rose-700 font-medium">Curfew breaches & disciplinary</span>
            <span className="font-semibold text-rose-800 flex items-center gap-0.5">
              Manage <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </button>

        {/* Card 3: Pending Visitors */}
        <button
          onClick={() => setActiveCard('visitors')}
          className={`text-left p-5 rounded-2xl border transition-all duration-200 relative overflow-hidden bg-white ${
            activeCard === 'visitors'
              ? 'border-sky-400 shadow-md ring-2 ring-sky-400/20 bg-sky-50/20'
              : 'border-gray-200/80 hover:border-sky-300 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-700">3. Pending Visitors</span>
            <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shadow-xs">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-gray-900 mt-3">
            {dashboard?.pendingVisitors ?? (loading ? '...' : 0)}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-sky-700 font-medium">Gate entry approval passes</span>
            <span className="font-semibold text-sky-800 flex items-center gap-0.5">
              Check-In <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </button>

        {/* Card 4: Alert Networks & Curfew Hub */}
        <button
          onClick={() => setActiveCard('curfew')}
          className={`text-left p-5 rounded-2xl border transition-all duration-200 relative overflow-hidden ${
            activeCard === 'curfew'
              ? 'border-indigo-400 shadow-md ring-2 ring-indigo-400/20 bg-gradient-to-br from-indigo-900 to-slate-900 text-white'
              : 'bg-gradient-to-br from-indigo-800 to-purple-900 text-white hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-200">4. Alert Networks</span>
            <div className="w-10 h-10 rounded-xl bg-white/15 text-white flex items-center justify-center shadow-xs">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${isCurfewActive ? 'bg-rose-400 animate-ping' : 'bg-emerald-400'}`} />
            <p className="text-2xl font-black text-white">
              {isCurfewActive ? 'Curfew Active' : 'Curfew Standby'}
            </p>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-indigo-200">
            <span>{curfewConfig.curfewTime} - {curfewConfig.curfewEndTime}</span>
            <span className="font-semibold text-white flex items-center gap-0.5">
              Control <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </button>
      </div>

      {/* ── CARD 1 DETAIL VIEW: PENDING PERMISSIONS ────────────────────────── */}
      {activeCard === 'permissions' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-amber-600" />
                Pending Student Leave & Outpass Permissions
              </h2>
              <p className="text-xs text-gray-500">
                Warden approval or rejection notifies the student immediately via alert socket.
              </p>
            </div>
            {/* Search & Filter */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search student or room..."
                  value={permSearch}
                  onChange={(e) => setPermSearch(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
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

          {/* Permissions List */}
          {filteredPermissions.length === 0 ? (
            <div className="text-center py-12 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-semibold text-gray-800">No Pending Permissions Found</p>
              <p className="text-xs text-gray-500 mt-1">All student requests have been reviewed.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPermissions.map((perm) => (
                <div
                  key={perm._id}
                  className="p-4 rounded-xl border border-gray-100 bg-gradient-to-br from-white to-gray-50/50 shadow-xs hover:border-amber-200 transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 mb-1">
                        {perm.permissionType || 'Leave'}
                      </span>
                      <h3 className="font-bold text-gray-900 text-sm">{perm.studentId?.name || 'Student'}</h3>
                      <p className="text-xs text-gray-500">
                        Room: <span className="font-medium text-gray-700">{perm.studentId?.roomId || 'N/A'}</span> • Phone: {perm.studentId?.phone || 'N/A'}
                      </p>
                    </div>
                    <span className="text-[11px] text-gray-400 font-mono">
                      {new Date(perm.createdAt || Date.now()).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-gray-100 text-xs text-gray-600">
                    <p className="font-medium text-gray-800 mb-0.5">Reason: {perm.reason || 'Not specified'}</p>
                    {perm.requestedDate && (
                      <p className="text-gray-500">
                        Requested: {new Date(perm.requestedDate).toLocaleDateString('en-IN')}
                        {perm.returnDate && ` • Return: ${new Date(perm.returnDate).toLocaleDateString('en-IN')}`}
                      </p>
                    )}
                  </div>

                  {/* Actions: Approve, Reject, Delete */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 gap-2">
                    <button
                      onClick={() =>
                        setDeleteConfirmModal({
                          open: true,
                          type: 'permission',
                          id: perm._id,
                          description: `Permission request for ${perm.studentId?.name || 'student'}`,
                        })
                      }
                      title="Delete Request"
                      disabled={actionLoading === perm._id}
                      className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          setRejectModal({
                            open: true,
                            type: 'permission',
                            id: perm._id,
                            studentOrVisitorName: perm.studentId?.name || 'Student',
                            reason: '',
                          })
                        }
                        disabled={actionLoading === perm._id}
                        className="px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" /> Reject
                      </button>
                      <button
                        onClick={() => handleApprovePermission(perm._id)}
                        disabled={actionLoading === perm._id}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors flex items-center gap-1 disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" /> Approve
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── CARD 2 DETAIL VIEW: ACTIVE VIOLATIONS ──────────────────────────── */}
      {activeCard === 'violations' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                Active Violations & Incident Logs
              </h2>
              <p className="text-xs text-gray-500">
                Track open curfew breaches and disciplinary rule violations. Escalate critical items directly to Owner.
              </p>
            </div>
            {/* Search & Filter */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search student or violation..."
                  value={violSearch}
                  onChange={(e) => setViolSearch(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>
              <select
                value={violTypeFilter}
                onChange={(e) => setViolTypeFilter(e.target.value)}
                className="py-1.5 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none"
              >
                <option value="all">All Violations</option>
                <option value="curfew">Curfew Breaches Only</option>
                <option value="disciplinary">Disciplinary Only</option>
              </select>
            </div>
          </div>

          {/* Violations List */}
          {filteredViolations.length === 0 ? (
            <div className="text-center py-12 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-semibold text-gray-800">No Active Violations</p>
              <p className="text-xs text-gray-500 mt-1">Hostel premises are currently free of active violations.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredViolations.map((v) => (
                <div
                  key={v._id}
                  className="p-4 rounded-xl border border-gray-100 bg-gradient-to-br from-white to-gray-50/50 shadow-xs hover:border-rose-200 transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                            v.isCurfew || v.violationType === 'curfew'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-indigo-100 text-indigo-800'
                          }`}
                        >
                          {v.isCurfew || v.violationType === 'curfew' ? 'Curfew Breach' : v.violationType || 'Disciplinary'}
                        </span>
                        {v.status === 'pending_recheck' && (
                          <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded font-semibold">
                            Grace Period
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-gray-900 text-sm">{v.studentId?.name || 'Student'}</h3>
                      <p className="text-xs text-gray-500">
                        Room: <span className="font-medium text-gray-700">{v.studentId?.roomId || v.roomNumber || 'N/A'}</span>
                      </p>
                    </div>
                    <span className="text-[11px] text-gray-400 font-mono">
                      {new Date(v.violationDate || v.createdAt || Date.now()).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                      })}
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-gray-100 text-xs text-gray-600">
                    <p className="font-medium text-gray-800">{v.description || 'Violation logged by attendance or warden.'}</p>
                    {v.fineAmount ? <p className="text-rose-600 font-semibold mt-1">Fine assessed: ₹{v.fineAmount}</p> : null}
                  </div>

                  {/* Actions: Resolve, Escalate, Delete */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 gap-2">
                    <button
                      onClick={() =>
                        setDeleteConfirmModal({
                          open: true,
                          type: 'violation',
                          id: v._id,
                          description: `Violation for ${v.studentId?.name || 'student'} (${v.violationType || 'incident'})`,
                        })
                      }
                      title="Delete Record"
                      disabled={actionLoading === v._id}
                      className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          setEscalateModal({
                            open: true,
                            id: v._id,
                            studentName: v.studentId?.name || 'Student',
                            reason: '',
                          })
                        }
                        disabled={actionLoading === v._id}
                        className="px-2.5 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" /> Escalate
                      </button>
                      <button
                        onClick={() => handleResolveViolation(v)}
                        disabled={actionLoading === v._id}
                        className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" /> Resolve
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── CARD 3 DETAIL VIEW: PENDING VISITORS ───────────────────────────── */}
      {activeCard === 'visitors' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-sky-600" />
                Pending Visitor Passes & Gate Approvals
              </h2>
              <p className="text-xs text-gray-500">
                Grant gate check-in approval or reject visitor requests. All entries are archived in gate logs.
              </p>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search visitor or student..."
                value={visitorSearch}
                onChange={(e) => setVisitorSearch(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
              />
            </div>
          </div>

          {/* Visitors List */}
          {filteredVisitors.length === 0 ? (
            <div className="text-center py-12 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-semibold text-gray-800">No Pending Visitors</p>
              <p className="text-xs text-gray-500 mt-1">There are no pending gate entry passes to review.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredVisitors.map((vis) => (
                <div
                  key={vis._id}
                  className="p-4 rounded-xl border border-gray-100 bg-gradient-to-br from-white to-gray-50/50 shadow-xs hover:border-sky-200 transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-sky-100 text-sky-800 mb-1">
                        Visitor Pass
                      </span>
                      <h3 className="font-bold text-gray-900 text-sm">{vis.visitorName}</h3>
                      <p className="text-xs text-gray-500">
                        Phone: <span className="font-medium text-gray-700">{vis.visitorPhone || 'N/A'}</span>
                      </p>
                    </div>
                    <span className="text-[11px] text-gray-400 font-mono">
                      {new Date(vis.createdAt || Date.now()).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                      })}
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-gray-100 text-xs text-gray-600">
                    <p className="text-gray-800">
                      Visiting Student: <span className="font-bold">{vis.visitingStudentId?.name || 'Student'}</span> (Room{' '}
                      {vis.visitingStudentId?.roomId || 'N/A'})
                    </p>
                    <p className="text-gray-500 mt-0.5">Purpose: {vis.purpose || 'Personal Visit'}</p>
                  </div>

                  {/* Actions: Approve, Reject, Delete */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 gap-2">
                    <button
                      onClick={() =>
                        setDeleteConfirmModal({
                          open: true,
                          type: 'visitor',
                          id: vis._id,
                          description: `Visitor pass for ${vis.visitorName}`,
                        })
                      }
                      title="Delete Record"
                      disabled={actionLoading === vis._id}
                      className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          setRejectModal({
                            open: true,
                            type: 'visitor',
                            id: vis._id,
                            studentOrVisitorName: vis.visitorName,
                            reason: '',
                          })
                        }
                        disabled={actionLoading === vis._id}
                        className="px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" /> Reject
                      </button>
                      <button
                        onClick={() => handleApproveVisitor(vis._id)}
                        disabled={actionLoading === vis._id}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-xs transition-colors flex items-center gap-1 disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" /> Approve Entry
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── CARD 4 DETAIL VIEW: ALERT NETWORKS & CURFEW HUB ────────────────── */}
      {activeCard === 'curfew' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6 animate-in fade-in duration-200">
          {/* Top Tabs: Control vs History */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-indigo-600" />
                Curfew Automation & Alert Network Command
              </h2>
              <p className="text-xs text-gray-500">
                Customize curfew schedules, select alert targets & timing, manage live sweeps, and audit history.
              </p>
            </div>
            <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl">
              <button
                onClick={() => setCurfewHubTab('control')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  curfewHubTab === 'control' ? 'bg-white text-indigo-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" /> Curfew Control & Customization
              </button>
              <button
                onClick={() => setCurfewHubTab('history')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  curfewHubTab === 'history' ? 'bg-white text-indigo-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <History className="w-3.5 h-3.5" /> Curfew History & Violation Audit
              </button>
            </div>
          </div>

          {curfewHubTab === 'control' ? (
            <div className="space-y-6">
              {/* ── LIVE CURFEW STATUS BANNER WITH DIRECT ACTION BUTTONS ─── */}
              <div
                className={`p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  isCurfewActive
                    ? 'bg-gradient-to-r from-rose-50 via-rose-100/40 to-amber-50 border-rose-200'
                    : 'bg-gradient-to-r from-emerald-50 via-indigo-50/40 to-sky-50 border-emerald-200'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-3 h-3 rounded-full ${isCurfewActive ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'}`}
                    />
                    <h3 className="font-extrabold text-gray-900 text-base">
                      {isCurfewActive ? 'Curfew Sweep is ACTIVE' : 'Curfew is STANDBY (Daytime / Normal Hours)'}
                    </h3>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    Scheduled Hours: <span className="font-bold text-gray-900">{curfewConfig.curfewTime}</span> to{' '}
                    <span className="font-bold text-gray-900">{curfewConfig.curfewEndTime}</span> • Grace Period:{' '}
                    <span className="font-bold text-gray-900">{curfewConfig.gracePeriodMinutes} mins</span>
                  </p>
                </div>

                {/* Instant Actions: Start Sweep Now vs End Curfew Now */}
                <div className="flex items-center gap-3">
                  {!isCurfewActive ? (
                    <button
                      onClick={handleStartCurfewNow}
                      disabled={startingCurfew}
                      className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-100 flex items-center gap-2 disabled:opacity-50 transition-all cursor-pointer"
                    >
                      <Play className={`w-3.5 h-3.5 ${startingCurfew ? 'animate-spin' : ''}`} />
                      {startingCurfew ? 'Starting Curfew...' : (curfewStatus?.manualCurfewEndedAt ? 'Start Curfew Again' : 'Start Curfew Sweep Now')}
                    </button>
                  ) : (
                    <button
                      onClick={handleEndCurfewNow}
                      disabled={endingCurfew}
                      className="px-4 py-2.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-100 flex items-center gap-2 disabled:opacity-50 transition-all cursor-pointer"
                    >
                      <StopCircle className={`w-3.5 h-3.5 ${endingCurfew ? 'animate-spin' : ''}`} />
                      {endingCurfew ? 'Ending Curfew...' : 'End Curfew Session Now'}
                    </button>
                  )}
                </div>
              </div>

              {/* ── SCHEDULE & ALERT CUSTOMIZATION FORM ─── */}
              <div className="bg-gray-50/70 p-5 rounded-2xl border border-gray-200/80 space-y-5">
                <div className="border-b border-gray-200/80 pb-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-indigo-600" />
                    Curfew Schedule & Trigger Customization
                  </h3>
                  <span className="text-[11px] text-gray-500 font-medium">All settings customized by Warden</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {/* Start Time */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      1. Curfew Start Time (When curfew begins)
                    </label>
                    <input
                      type="time"
                      value={curfewConfig.curfewTime}
                      onChange={(e) => setCurfewConfig({ ...curfewConfig, curfewTime: e.target.value })}
                      className="w-full px-3 py-2 text-sm font-bold text-gray-900 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                    {/* Quick Presets */}
                    <div className="flex items-center gap-1.5 mt-2">
                      {['21:00', '21:30', '22:00', '22:30'].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setCurfewConfig({ ...curfewConfig, curfewTime: preset })}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            curfewConfig.curfewTime === preset
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* End Time */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      2. Curfew End Time (When curfew concludes)
                    </label>
                    <input
                      type="time"
                      value={curfewConfig.curfewEndTime}
                      onChange={(e) => setCurfewConfig({ ...curfewConfig, curfewEndTime: e.target.value })}
                      className="w-full px-3 py-2 text-sm font-bold text-gray-900 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                    {/* Quick Presets */}
                    <div className="flex items-center gap-1.5 mt-2">
                      {['05:30', '06:00', '06:30', '07:00'].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setCurfewConfig({ ...curfewConfig, curfewEndTime: preset })}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            curfewConfig.curfewEndTime === preset
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Grace Period */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      3. Grace Period Duration
                    </label>
                    <select
                      value={curfewConfig.gracePeriodMinutes}
                      onChange={(e) => setCurfewConfig({ ...curfewConfig, gracePeriodMinutes: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-sm font-bold text-gray-900 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    >
                      <option value={10}>10 Minutes Grace</option>
                      <option value={15}>15 Minutes (Standard)</option>
                      <option value={20}>20 Minutes Grace</option>
                      <option value={30}>30 Minutes Extended</option>
                    </select>
                    <p className="text-[11px] text-gray-400 mt-2">Time allowed before reporting confirmed breach.</p>
                  </div>
                </div>

                {/* Who To Send Alerts To */}
                <div className="pt-3 border-t border-gray-200">
                  <label className="block text-xs font-bold text-gray-800 mb-2">
                    Who to send alerts to (Recipient Networks):
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {[
                      { key: 'students', label: 'Students (Push + App)' },
                      { key: 'warden', label: 'Wardens (Alert Hub)' },
                      { key: 'owner', label: 'Hostel Owner' },
                      { key: 'parents', label: 'Parents (Emergency)' },
                      { key: 'guards', label: 'Gate Security' },
                    ].map(({ key, label }) => (
                      <label
                        key={key}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                          (curfewConfig.recipients as any)[key]
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-900'
                            : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={(curfewConfig.recipients as any)[key]}
                          onChange={(e) =>
                            setCurfewConfig({
                              ...curfewConfig,
                              recipients: {
                                ...curfewConfig.recipients,
                                [key]: e.target.checked,
                              },
                            })
                          }
                          className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* When To Send Alerts */}
                <div className="pt-3 border-t border-gray-200">
                  <label className="block text-xs font-bold text-gray-800 mb-2">
                    When to send alerts (Event Automation Timings):
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <label className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-gray-200 text-xs">
                      <input
                        type="checkbox"
                        checked={curfewConfig.timing.preCurfewReminder}
                        onChange={(e) =>
                          setCurfewConfig({
                            ...curfewConfig,
                            timing: { ...curfewConfig.timing, preCurfewReminder: e.target.checked },
                          })
                        }
                        className="mt-0.5 w-4 h-4 text-indigo-600 rounded"
                      />
                      <div>
                        <span className="font-bold text-gray-800">Pre-Curfew Reminder</span>
                        <p className="text-[11px] text-gray-500">15 mins before curfew to report inside.</p>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-gray-200 text-xs">
                      <input
                        type="checkbox"
                        checked={curfewConfig.timing.onCurfewStart}
                        onChange={(e) =>
                          setCurfewConfig({
                            ...curfewConfig,
                            timing: { ...curfewConfig.timing, onCurfewStart: e.target.checked },
                          })
                        }
                        className="mt-0.5 w-4 h-4 text-indigo-600 rounded"
                      />
                      <div>
                        <span className="font-bold text-gray-800">At Curfew Start (0 min)</span>
                        <p className="text-[11px] text-gray-500">Silent sweep & grace period warning.</p>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-gray-200 text-xs">
                      <input
                        type="checkbox"
                        checked={curfewConfig.timing.onTenMinuteWarning}
                        onChange={(e) =>
                          setCurfewConfig({
                            ...curfewConfig,
                            timing: { ...curfewConfig.timing, onTenMinuteWarning: e.target.checked },
                          })
                        }
                        className="mt-0.5 w-4 h-4 text-indigo-600 rounded"
                      />
                      <div>
                        <span className="font-bold text-gray-800">10-Minute Recheck</span>
                        <p className="text-[11px] text-gray-500">Final 5-minute grace warning to student.</p>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-gray-200 text-xs">
                      <input
                        type="checkbox"
                        checked={curfewConfig.timing.onGraceExpiry}
                        onChange={(e) =>
                          setCurfewConfig({
                            ...curfewConfig,
                            timing: { ...curfewConfig.timing, onGraceExpiry: e.target.checked },
                          })
                        }
                        className="mt-0.5 w-4 h-4 text-indigo-600 rounded"
                      />
                      <div>
                        <span className="font-bold text-gray-800">Grace Expiration (15 min)</span>
                        <p className="text-[11px] text-gray-500">Confirmed violation to Warden & Owner.</p>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-gray-200 text-xs">
                      <input
                        type="checkbox"
                        checked={curfewConfig.timing.onParentEscalation}
                        onChange={(e) =>
                          setCurfewConfig({
                            ...curfewConfig,
                            timing: { ...curfewConfig.timing, onParentEscalation: e.target.checked },
                          })
                        }
                        className="mt-0.5 w-4 h-4 text-indigo-600 rounded"
                      />
                      <div>
                        <span className="font-bold text-gray-800">Parent Escalation (30 min)</span>
                        <p className="text-[11px] text-gray-500">Emergency email dispatched to parent.</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Save Button */}
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleSaveCurfewConfig}
                    disabled={savingConfig}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    <CheckCircle2 className={`w-4 h-4 ${savingConfig ? 'animate-spin' : ''}`} />
                    {savingConfig ? 'Saving Settings...' : 'Save Curfew Configuration'}
                  </button>
                </div>
              </div>

              {/* ── QUICK EMERGENCY BROADCAST ─── */}
              <div className="bg-white rounded-xl border border-rose-100 p-5 space-y-4">
                <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
                  <Megaphone className="w-4 h-4" />
                  Quick Emergency Broadcast to Network
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Broadcast title (e.g. Unscheduled Security Curfew)"
                    value={emergencyForm.title}
                    onChange={(e) => setEmergencyForm({ ...emergencyForm, title: e.target.value })}
                    className="px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  />
                  <input
                    type="text"
                    placeholder="Brief message details..."
                    value={emergencyForm.message}
                    onChange={(e) => setEmergencyForm({ ...emergencyForm, message: e.target.value })}
                    className="px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs font-medium text-gray-600">
                    <span>Target:</span>
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={emergencyForm.targetRoles.student}
                        onChange={(e) =>
                          setEmergencyForm({
                            ...emergencyForm,
                            targetRoles: { ...emergencyForm.targetRoles, student: e.target.checked },
                          })
                        }
                      />
                      Students
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={emergencyForm.targetRoles.owner}
                        onChange={(e) =>
                          setEmergencyForm({
                            ...emergencyForm,
                            targetRoles: { ...emergencyForm.targetRoles, owner: e.target.checked },
                          })
                        }
                      />
                      Owner
                    </label>
                  </div>
                  <button
                    onClick={handleBroadcastEmergency}
                    disabled={broadcasting}
                    className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {broadcasting ? 'Sending...' : 'Broadcast Alert'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ── CURFEW HISTORY & VIOLATION AUDIT LOG ─── */
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setHistorySubTab('sessions')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      historySubTab === 'sessions'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Past Curfew Sessions ({curfewSessions.length})
                  </button>
                  <button
                    onClick={() => setHistorySubTab('violations')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      historySubTab === 'violations'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Student Violation Audit Records ({curfewViolationHistory.length})
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={historyDateFilter}
                    onChange={(e) => setHistoryDateFilter(e.target.value)}
                    className="px-2.5 py-1 text-xs bg-gray-50 border border-gray-200 rounded-lg"
                  />
                  <button
                    onClick={loadCurfewHistory}
                    className="p-1.5 text-gray-500 hover:text-indigo-600 rounded-lg hover:bg-gray-100"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingHistory ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {historySubTab === 'sessions' ? (
                /* Curfew Sessions History Table */
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 text-gray-400 uppercase font-bold">
                        <th className="py-2.5 px-3">Session Date</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Start Time</th>
                        <th className="py-2.5 px-3">End Time</th>
                        <th className="py-2.5 px-3">Present</th>
                        <th className="py-2.5 px-3">Violations</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                      {curfewSessions.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-gray-400">
                            No past curfew session history found for this hostel.
                          </td>
                        </tr>
                      ) : (
                        curfewSessions.map((sess) => (
                          <tr key={sess._id} className="hover:bg-gray-50/50">
                            <td className="py-3 px-3 font-semibold text-gray-900">
                              {new Date(sess.sessionDate || sess.createdAt).toLocaleDateString('en-IN')}
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  sess.sessionType === 'manual'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-indigo-100 text-indigo-800'
                                }`}
                              >
                                {sess.sessionType}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              {sess.startTime
                                ? new Date(sess.startTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                                : sess.curfewStartTime || '--'}
                            </td>
                            <td className="py-3 px-3">
                              {sess.endTime
                                ? new Date(sess.endTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                                : sess.curfewEndTime || '--'}
                            </td>
                            <td className="py-3 px-3 text-emerald-600 font-bold">{sess.summary?.presentCount || 0}</td>
                            <td className="py-3 px-3 text-rose-600 font-bold">{sess.summary?.violationsCount || 0}</td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  sess.status === 'active'
                                    ? 'bg-rose-100 text-rose-700'
                                    : 'bg-emerald-100 text-emerald-700'
                                }`}
                              >
                                {sess.status === 'ended_by_warden' ? 'Ended by Warden' : sess.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* Student Violation Audit Log Table */
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 text-gray-400 uppercase font-bold">
                        <th className="py-2.5 px-3">Student</th>
                        <th className="py-2.5 px-3">Room</th>
                        <th className="py-2.5 px-3">Violation Date</th>
                        <th className="py-2.5 px-3">Curfew Time</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Resolution</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                      {curfewViolationHistory.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-gray-400">
                            No student violation audit records found.
                          </td>
                        </tr>
                      ) : (
                        curfewViolationHistory.map((rec) => (
                          <tr key={rec._id} className="hover:bg-gray-50/50">
                            <td className="py-3 px-3 font-semibold text-gray-900">{rec.studentId?.name || 'Student'}</td>
                            <td className="py-3 px-3">{rec.studentId?.roomId || rec.roomNumber || 'N/A'}</td>
                            <td className="py-3 px-3">
                              {new Date(rec.violationDate || rec.createdAt).toLocaleString('en-IN', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                            <td className="py-3 px-3 font-mono">{rec.curfewTime}</td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  rec.status === 'resolved'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : rec.status === 'pending_recheck'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-rose-100 text-rose-700'
                                }`}
                              >
                                {rec.status}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-gray-500 max-w-xs truncate">
                              {rec.resolutionNote || (rec.studentReturnedAt ? 'Student Returned' : 'Pending')}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button
                                onClick={() =>
                                  setDeleteConfirmModal({
                                    open: true,
                                    type: 'curfew',
                                    id: rec._id,
                                    description: `Curfew record for ${rec.studentId?.name || 'student'}`,
                                  })
                                }
                                className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                                title="Delete from history"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── REJECTION MODAL ────────────────────────────────────────────────── */}
      {rejectModal.open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-900 text-base">
                Reject {rejectModal.type === 'permission' ? 'Permission Request' : 'Visitor Pass'}
              </h3>
              <button
                onClick={() =>
                  setRejectModal({ open: false, type: 'permission', id: '', studentOrVisitorName: '', reason: '' })
                }
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-600">
              Please provide the official reason for rejecting{' '}
              <span className="font-semibold text-gray-900">{rejectModal.studentOrVisitorName}</span>:
            </p>
            <textarea
              rows={3}
              value={rejectModal.reason}
              onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
              placeholder="e.g., Prior disciplinary action, incomplete parent authorization, curfew restriction..."
              className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() =>
                  setRejectModal({ open: false, type: 'permission', id: '', studentOrVisitorName: '', reason: '' })
                }
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={actionLoading === rejectModal.id}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors disabled:opacity-50"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ESCALATION MODAL ──────────────────────────────────────────────── */}
      {escalateModal.open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-900 text-base">Escalate Violation to Owner</h3>
              <button
                onClick={() => setEscalateModal({ open: false, id: '', studentName: '', reason: '' })}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-600">
              Escalating violation for <span className="font-semibold text-gray-900">{escalateModal.studentName}</span>.
              This dispatches an immediate high-priority alert and notification to the hostel owner.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setEscalateModal({ open: false, id: '', studentName: '', reason: '' })}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmEscalate}
                disabled={actionLoading === escalateModal.id}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors disabled:opacity-50"
              >
                Confirm Escalation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRMATION MODAL ──────────────────────────────────────── */}
      {deleteConfirmModal.open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-gray-100 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div className="text-center">
              <h3 className="font-bold text-gray-900 text-base">Confirm Delete Record</h3>
              <p className="text-xs text-gray-500 mt-1">
                Are you sure you want to permanently delete:
                <br />
                <span className="font-semibold text-gray-800">{deleteConfirmModal.description}</span>?
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmModal({ open: false, type: 'permission', id: '', description: '' })}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={actionLoading === deleteConfirmModal.id}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors disabled:opacity-50"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
