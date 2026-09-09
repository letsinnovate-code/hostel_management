'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import {
  alertApi,
  ActiveCurfewSessionResponse,
  CurfewConfigurationData,
  CurfewStudentMonitoringData,
  CurfewViolation,
} from '../../../services/alertApi';
import { useAlertSocket } from '../../../contexts/AlertSocketContext';
import { toastManager } from '../../../components/Toast';
import {
  Shield,
  ShieldAlert,
  Clock,
  AlertTriangle,
  Users,
  CheckCircle,
  Zap,
  Play,
  Square,
  RotateCcw,
  RefreshCw,
  Search,
  Filter,
  Calendar,
  ChevronRight,
  Radio,
  MapPin,
  Compass,
  Bell,
  Mail,
  Phone,
  Info,
  Check,
  X,
  History,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function fmtDate(d?: string | Date | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function fmtTime(d?: string | Date | null) {
  if (!d) return '—';
  return new Date(d).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function fmtCountdown(totalSecs: number) {
  if (!totalSecs || totalSecs <= 0) return '00:00:00';
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function fmtMinutesSeconds(totalSecs: number) {
  if (!totalSecs || totalSecs <= 0) return '00:00';
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDistance(m?: number) {
  if (m == null || isNaN(m)) return '—';
  if (m < 1000) return `${Math.round(m)}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

export default function WardenCurfewPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { connected, lastCurfewEvent, refreshKey, socket } = useAlertSocket();

  const hostelId = user?.hostelId as string | undefined;

  // ── State ──
  const [sessionData, setSessionData] = useState<ActiveCurfewSessionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [historySessions, setHistorySessions] = useState<any[]>([]);
  const [violations, setViolations] = useState<CurfewViolation[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Active view tab
  const [curfewTab, setCurfewTab] = useState<'control' | 'students' | 'map' | 'violations' | 'history'>('control');

  // Interactive Live Countdown
  const [remainingSecs, setRemainingSecs] = useState<number>(0);

  // Configuration Form State
  const [startDate, setStartDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState<string>('21:00');
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [endTime, setEndTime] = useState<string>('22:00');
  const [recurrenceType, setRecurrenceType] = useState<'one_time' | 'daily' | 'selected_days' | 'weekly' | 'monthly'>('daily');
  const [selectedDays, setSelectedDays] = useState<string[]>(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);
  const [gracePeriod, setGracePeriod] = useState<number>(15);
  const [escalationPeriod, setEscalationPeriod] = useState<number>(15);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSuccessModal, setConfigSuccessModal] = useState<any | null>(null);

  // Modals & Action Confirmation
  const [confirmManualStartModal, setConfirmManualStartModal] = useState(false);
  const [confirmManualEndModal, setConfirmManualEndModal] = useState(false);
  const [confirmResetModal, setConfirmResetModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Student Monitoring Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roomFilter, setRoomFilter] = useState('');
  const [blockFilter, setBlockFilter] = useState('');

  // Map Selected Student
  const [selectedStudentForMap, setSelectedStudentForMap] = useState<CurfewStudentMonitoringData | null>(null);

  // Calculate live duration from start & end form values
  const calculatedDuration = useMemo(() => {
    try {
      const startIso = `${startDate}T${startTime.length === 5 ? startTime : startTime.padStart(5, '0')}:00`;
      const endIso = `${endDate}T${endTime.length === 5 ? endTime : endTime.padStart(5, '0')}:00`;
      const sMs = new Date(startIso).getTime();
      const eMs = new Date(endIso).getTime();

      if (isNaN(sMs) || isNaN(eMs)) return { valid: false, display: 'Invalid date/time format' };
      if (eMs <= sMs) return { valid: false, display: 'End time must be after start time (choose next day for overnight curfews)' };

      const totalMins = Math.round((eMs - sMs) / (60 * 1000));
      const hrs = Math.floor(totalMins / 60);
      const mins = totalMins % 60;

      let display = '';
      if (hrs > 0 && mins > 0) display = `${hrs} hr ${mins} min`;
      else if (hrs > 0) display = `${hrs} hr${hrs > 1 ? 's' : ''}`;
      else display = `${mins} min${mins > 1 ? 's' : ''}`;

      return { valid: true, display, minutes: totalMins };
    } catch {
      return { valid: false, display: 'Calculation error' };
    }
  }, [startDate, startTime, endDate, endTime]);

  // ── Fetch Active Session & Summary ──
  const loadActiveCurfew = useCallback(async (isSilent = false) => {
    if (!hostelId) return;
    if (!isSilent) setLoading(true);
    try {
      const res = await alertApi.getActiveCurfewSession(hostelId);
      if (res.success && res.data) {
        setSessionData(res.data);
        setRemainingSecs(res.data.remainingSeconds || 0);

        if (res.data.configuration) {
          const cfg = res.data.configuration;
          if (cfg.startDate) setStartDate(cfg.startDate);
          if (cfg.startTime) setStartTime(cfg.startTime);
          if (cfg.endDate) setEndDate(cfg.endDate);
          if (cfg.endTime) setEndTime(cfg.endTime);
          if (cfg.recurrence?.type) setRecurrenceType(cfg.recurrence.type as any);
          if (cfg.recurrence?.selectedDays?.length) setSelectedDays(cfg.recurrence.selectedDays);
          if (cfg.gracePeriodMinutes) setGracePeriod(cfg.gracePeriodMinutes);
          if (cfg.escalationPeriodMinutes) setEscalationPeriod(cfg.escalationPeriodMinutes);
        }
      }
    } catch (e: any) {
      console.error('Failed to load active curfew session:', e);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [hostelId]);

  // ── Fetch History & Violations ──
  const loadHistoryAndViolations = useCallback(async (isSilent = false) => {
    if (!hostelId) return;
    if (!isSilent) setHistoryLoading(true);
    try {
      const [histRes, violRes] = await Promise.allSettled([
        alertApi.getCurfewHistory({ hostelId, limit: 30 }),
        alertApi.getCurfewViolations({ hostelId, limit: 50 }),
      ]);

      if (histRes.status === 'fulfilled' && histRes.value?.data) {
        setHistorySessions(histRes.value.data.sessions || []);
      }
      if (violRes.status === 'fulfilled') {
        const vList = violRes.value?.data?.violations || violRes.value?.data || [];
        setViolations(vList);
      }
    } catch (e) {
      console.error('Failed to load curfew history:', e);
    } finally {
      if (!isSilent) setHistoryLoading(false);
    }
  }, [hostelId]);

  useEffect(() => {
    if (!user || user.role !== 'warden') {
      router.replace('/login');
      return;
    }
    loadActiveCurfew();
    loadHistoryAndViolations();
  }, [user, loadActiveCurfew, loadHistoryAndViolations]);

  // ── Real-Time Socket Updates ──
  useEffect(() => {
    if (refreshKey > 0 || lastCurfewEvent) {
      loadActiveCurfew(true);
      loadHistoryAndViolations(true);
    }
  }, [refreshKey, lastCurfewEvent, loadActiveCurfew, loadHistoryAndViolations]);

  // ── Direct fine-grained socket listeners for instant updates ──
  useEffect(() => {
    if (!socket) return;

    const onCurfewEvent = () => {
      loadActiveCurfew(true);
      loadHistoryAndViolations(true);
    };

    socket.on('curfew:student_status_update', onCurfewEvent);
    socket.on('curfew:started', onCurfewEvent);
    socket.on('curfew:ended', onCurfewEvent);
    socket.on('curfew:reset', onCurfewEvent);
    socket.on('curfew:schedule_updated', onCurfewEvent);
    socket.on('curfew:violation', onCurfewEvent);
    socket.on('curfew:timer_terminated', onCurfewEvent);
    socket.on('curfew:escalated', onCurfewEvent);
    socket.on('curfew:escalation_alert', onCurfewEvent);
    socket.on('curfew:parent_notified', onCurfewEvent);

    return () => {
      socket.off('curfew:student_status_update', onCurfewEvent);
      socket.off('curfew:started', onCurfewEvent);
      socket.off('curfew:ended', onCurfewEvent);
      socket.off('curfew:reset', onCurfewEvent);
      socket.off('curfew:schedule_updated', onCurfewEvent);
      socket.off('curfew:violation', onCurfewEvent);
      socket.off('curfew:timer_terminated', onCurfewEvent);
      socket.off('curfew:escalated', onCurfewEvent);
      socket.off('curfew:escalation_alert', onCurfewEvent);
      socket.off('curfew:parent_notified', onCurfewEvent);
    };
  }, [socket, loadActiveCurfew, loadHistoryAndViolations]);

  // ── Periodic Background Polling & Tab Visibility Sync ──
  useEffect(() => {
    if (!user || user.role !== 'warden') return;

    const pollMs = sessionData?.status === 'ACTIVE' ? 5000 : 10000;
    const timer = setInterval(() => {
      loadActiveCurfew(true);
      loadHistoryAndViolations(true);
    }, pollMs);

    const onVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        loadActiveCurfew(true);
        loadHistoryAndViolations(true);
      }
    };

    window.addEventListener('visibilitychange', onVisibilityOrFocus);
    window.addEventListener('focus', onVisibilityOrFocus);

    return () => {
      clearInterval(timer);
      window.removeEventListener('visibilitychange', onVisibilityOrFocus);
      window.removeEventListener('focus', onVisibilityOrFocus);
    };
  }, [user, sessionData?.status, loadActiveCurfew, loadHistoryAndViolations]);

  // Authoritative 1-second countdown decrementer
  useEffect(() => {
    const timer = setInterval(() => {
      setRemainingSecs((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Day toggle handler
  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  // ── Actions ──
  const handleSaveCurfew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostelId) return;

    if (!calculatedDuration.valid) {
      toastManager.show(calculatedDuration.display, 'error');
      return;
    }

    if (recurrenceType === 'selected_days' && selectedDays.length === 0) {
      toastManager.show('Please select at least one day for recurring curfew schedule', 'error');
      return;
    }

    setSavingConfig(true);
    try {
      const payload = {
        startDate,
        startTime,
        endDate,
        endTime,
        recurrence: {
          type: recurrenceType,
          selectedDays,
        },
        gracePeriodMinutes: gracePeriod,
        escalationPeriodMinutes: escalationPeriod,
      };

      const res = await alertApi.setCurfewConfig(hostelId, payload);
      toastManager.show('Curfew schedule configured and armed successfully!', 'success', 5000);
      setConfigSuccessModal({
        startDate,
        startTime,
        endDate,
        endTime,
        duration: calculatedDuration.display,
        status: res.configuration?.status || 'Scheduled',
      });
      await loadActiveCurfew();
    } catch (err: any) {
      console.error('Error setting curfew schedule:', err);
      toastManager.show(err?.response?.data?.message || err.message || 'Failed to set curfew schedule', 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleManualStart = async () => {
    if (!hostelId) return;
    setActionLoading(true);
    try {
      await alertApi.startManualCurfew(hostelId);
      toastManager.show('Curfew started immediately! Student presence evaluated.', 'success', 5000);
      setConfirmManualStartModal(false);
      await loadActiveCurfew();
    } catch (err: any) {
      console.error('Manual start failed:', err);
      toastManager.show(err?.response?.data?.message || err.message || 'Failed to start curfew', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleManualEnd = async () => {
    if (!hostelId) return;
    setActionLoading(true);
    try {
      await alertApi.endCurfew(hostelId, 'warden_manual_end');
      toastManager.show('Active curfew terminated. Monitoring stopped and records preserved.', 'success', 5000);
      setConfirmManualEndModal(false);
      await loadActiveCurfew();
      await loadHistoryAndViolations();
    } catch (err: any) {
      console.error('Manual end failed:', err);
      toastManager.show(err?.response?.data?.message || err.message || 'Failed to end curfew', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReset = async () => {
    if (!hostelId) return;
    setActionLoading(true);
    try {
      await alertApi.resetCurfew(hostelId);
      toastManager.show('Curfew configuration reset. Upcoming sessions cancelled; historical records preserved.', 'success', 5000);
      setConfirmResetModal(false);
      await loadActiveCurfew();
    } catch (err: any) {
      console.error('Curfew reset failed:', err);
      toastManager.show(err?.response?.data?.message || err.message || 'Failed to reset curfew', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered Students
  const filteredStudents = useMemo(() => {
    if (!sessionData?.students) return [];
    return sessionData.students.filter((st) => {
      const sName = st.studentName || (typeof st.studentId === 'object' ? st.studentId.name : '') || '';
      const sId = st.studentRegId || (typeof st.studentId === 'object' ? st.studentId.studentId : '') || '';
      const rNum = st.roomNumber || '';
      const blk = st.block || '';

      const matchSearch =
        !searchQuery ||
        sName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rNum.toLowerCase().includes(searchQuery.toLowerCase());

      const matchRoom = !roomFilter || rNum.toLowerCase().includes(roomFilter.toLowerCase());
      const matchBlock = !blockFilter || blk.toLowerCase().includes(blockFilter.toLowerCase());

      let matchStatus = true;
      if (statusFilter === 'inside') matchStatus = st.status === 'INSIDE';
      else if (statusFilter === 'outside') matchStatus = ['OUTSIDE_GRACE', 'VIOLATION'].includes(st.status);
      else if (statusFilter === 'grace') matchStatus = st.status === 'OUTSIDE_GRACE';
      else if (statusFilter === 'late') matchStatus = st.status === 'LATE_COMER';
      else if (statusFilter === 'violation') matchStatus = st.status === 'VIOLATION';
      else if (statusFilter === 'resolved') matchStatus = st.status === 'VIOLATION_RESOLVED';
      else if (statusFilter === 'unavailable') {
        matchStatus = ['LOCATION_UNAVAILABLE', 'LOCATION_PERMISSION_DENIED', 'LOCATION_STALE', 'LOW_ACCURACY'].includes(st.status);
      }

      return matchSearch && matchRoom && matchBlock && matchStatus;
    });
  }, [sessionData?.students, searchQuery, statusFilter, roomFilter, blockFilter]);

  const activeStatus = sessionData?.status || 'INACTIVE';
  const summary = sessionData?.summary || {
    totalStudents: 0,
    presentCount: 0,
    outsideCount: 0,
    lateComersCount: 0,
    violationsCount: 0,
    resolvedCount: 0,
    parentAlertsCount: 0,
  };

  const DAYS = [
    { id: 'monday', label: 'Mon' },
    { id: 'tuesday', label: 'Tue' },
    { id: 'wednesday', label: 'Wed' },
    { id: 'thursday', label: 'Thu' },
    { id: 'friday', label: 'Fri' },
    { id: 'saturday', label: 'Sat' },
    { id: 'sunday', label: 'Sun' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/20 to-purple-50/20 p-4 sm:p-6 lg:p-8 space-y-8">
      {/* ─────────────────────────────────────────────────────────────────────────────
          SECTION 1: CURFEW CONTROL CENTER (Top Bar & Master Status)
      ───────────────────────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-6 lg:p-8 border border-slate-200/80 shadow-sm relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center text-white shadow-md shadow-indigo-200">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                  Curfew Control Center
                </h1>
                <p className="text-xs text-gray-500 font-medium">
                  Authoritative presence verification, geofence compliance, and automated 15-min escalations
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1 flex-wrap">
              {/* Master Status Badge */}
              <div
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black tracking-wider uppercase border shadow-sm ${
                  activeStatus === 'ACTIVE'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : activeStatus === 'SCHEDULED'
                    ? 'bg-amber-50 text-amber-700 border-amber-300'
                    : activeStatus === 'ENDED'
                    ? 'bg-blue-50 text-blue-700 border-blue-300'
                    : 'bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    activeStatus === 'ACTIVE'
                      ? 'bg-emerald-500 animate-ping'
                      : activeStatus === 'SCHEDULED'
                      ? 'bg-amber-500'
                      : 'bg-slate-400'
                  }`}
                />
                ● {activeStatus}
              </div>

              <span className="text-xs text-gray-400">•</span>
              <span className="text-xs text-gray-600">
                Hostel Timezone: <strong>{sessionData?.timezone || 'Asia/Kolkata'}</strong>
              </span>

              <span className="text-xs text-gray-400">•</span>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold ${
                  connected ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                {connected ? 'Socket Live' : 'Polling'}
              </span>
            </div>
          </div>

          {/* Master Actions Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap w-full lg:w-auto">
            <button
              onClick={() => loadActiveCurfew(false)}
              disabled={loading}
              className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl transition disabled:opacity-50"
              title="Refresh Curfew Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {activeStatus === 'ACTIVE' ? (
              <button
                onClick={() => setConfirmManualEndModal(true)}
                disabled={actionLoading}
                className="flex-1 sm:flex-initial px-5 py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-2xl font-bold text-xs sm:text-sm shadow-md shadow-red-200 transition flex items-center justify-center gap-2"
              >
                <Square className="w-4 h-4 fill-current" />
                END CURFEW NOW
              </button>
            ) : (
              <button
                onClick={() => setConfirmManualStartModal(true)}
                disabled={actionLoading}
                className="flex-1 sm:flex-initial px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl font-bold text-xs sm:text-sm shadow-md shadow-emerald-200 transition flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-current" />
                START CURFEW NOW
              </button>
            )}

            <button
              onClick={() => setConfirmResetModal(true)}
              disabled={actionLoading}
              className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-semibold text-xs transition flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4" />
              RESET CURFEW
            </button>
          </div>
        </div>

        {/* Dynamic Status Live Bar */}
        {activeStatus === 'ACTIVE' && sessionData?.session && (
          <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">Curfew Started</span>
              <p className="text-xl font-bold text-emerald-950 mt-0.5">
                {fmtTime(sessionData.session.actualStartAt || sessionData.session.scheduledStartAt)}
              </p>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                Trigger: {sessionData.session.triggerType || 'AUTOMATIC'}
              </p>
            </div>

            <div className="p-4 bg-purple-50/70 border border-purple-200/80 rounded-2xl">
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-800">Curfew Ends</span>
              <p className="text-xl font-bold text-purple-950 mt-0.5">
                {fmtTime(sessionData.session.scheduledEndAt)}
              </p>
              <p className="text-[11px] text-purple-700 mt-0.5">Automatic termination scheduled</p>
            </div>

            <div className="p-4 bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-2xl shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">Remaining Time</span>
                <p className="text-2xl font-black font-mono tracking-tight mt-0.5">
                  {fmtCountdown(remainingSecs)}
                </p>
                <p className="text-[11px] text-indigo-200/70">Continuous location sweep active</p>
              </div>
              <Clock className="w-8 h-8 text-indigo-400/40 animate-pulse" />
            </div>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          SECTION 32: CURFEW DASHBOARD SUMMARY CARDS
      ───────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">STATUS</span>
          <p className="text-lg font-black text-gray-900 mt-1">{activeStatus}</p>
          <span className="text-[10px] text-indigo-600 font-semibold mt-0.5 block">Hostel Master</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">REMAINING</span>
          <p className="text-lg font-black font-mono text-gray-900 mt-1">
            {activeStatus === 'ACTIVE' ? fmtCountdown(remainingSecs) : '—'}
          </p>
          <span className="text-[10px] text-gray-500 font-semibold mt-0.5 block">Server Time</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">TOTAL STUDENTS</span>
          <p className="text-lg font-black text-gray-900 mt-1">{summary.totalStudents}</p>
          <span className="text-[10px] text-gray-500 font-semibold mt-0.5 block">Assigned Hostel</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">INSIDE</span>
          <p className="text-lg font-black text-emerald-700 mt-1">{summary.presentCount}</p>
          <span className="text-[10px] text-emerald-600 font-semibold mt-0.5 block">Inside Geofence</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">OUTSIDE</span>
          <p className="text-lg font-black text-amber-700 mt-1">{summary.outsideCount}</p>
          <span className="text-[10px] text-amber-600 font-semibold mt-0.5 block">Grace / Breaches</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">LATE COMERS</span>
          <p className="text-lg font-black text-blue-700 mt-1">{summary.lateComersCount}</p>
          <span className="text-[10px] text-blue-600 font-semibold mt-0.5 block">Returned in Grace</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">VIOLATIONS</span>
          <p className="text-lg font-black text-rose-700 mt-1">{summary.violationsCount}</p>
          <span className="text-[10px] text-rose-600 font-semibold mt-0.5 block">Rules Breached</span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          SECTION NAVIGATION TABS
      ───────────────────────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto">
        {[
          { id: 'control', label: 'Curfew Configuration & Controls', icon: Clock },
          { id: 'students', label: `Student Monitoring (${filteredStudents.length})`, icon: Users },
          { id: 'map', label: 'Live Location Map', icon: Compass },
          { id: 'violations', label: `Violations (${violations.length})`, icon: AlertTriangle },
          { id: 'history', label: `Curfew History (${historySessions.length})`, icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = curfewTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setCurfewTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition flex items-center gap-2 whitespace-nowrap ${
                active
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          TAB 1: CURFEW CONFIGURATION & SET CURFEW FORM
      ───────────────────────────────────────────────────────────────────────────── */}
      {curfewTab === 'control' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Config Form */}
          <div className="lg:col-span-2 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
            <div>
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                Warden Scheduling Engine
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-gray-900 mt-2">
                Configure Curfew Schedule
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Customize any start date, start time, end date, and end time. Overnight curfews spanning midnight are automatically recognized and scheduled.
              </p>
            </div>

            <form onSubmit={handleSaveCurfew} className="space-y-6">
              {/* Date & Time Pickers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Start Date & Time */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                    <Calendar className="w-4 h-4 text-indigo-600" />
                    Start Date &amp; Time
                  </div>
                  <div className="space-y-2">
                    <div>
                      <label className="text-[11px] font-semibold text-gray-500 block mb-1">Start Date</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        required
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-gray-500 block mb-1">Start Time</label>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        required
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-gray-800 focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* End Date & Time */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                    <Clock className="w-4 h-4 text-indigo-600" />
                    End Date &amp; Time
                  </div>
                  <div className="space-y-2">
                    <div>
                      <label className="text-[11px] font-semibold text-gray-500 block mb-1">End Date</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        required
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-gray-500 block mb-1">End Time</label>
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        required
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-gray-800 focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Automatically Calculated Duration Badge */}
              <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200/70 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700">
                    Calculated Duration
                  </span>
                  <p className="text-base font-black text-indigo-950 mt-0.5">
                    {calculatedDuration.display}
                  </p>
                  <p className="text-[11px] text-indigo-700/80">
                    Computed authoritatively from start &amp; end timestamps
                  </p>
                </div>
                <div className="px-3 py-1.5 bg-white rounded-xl text-xs font-bold text-indigo-700 shadow-sm border border-indigo-100">
                  {calculatedDuration.valid ? 'Valid Timeframe' : 'Check Dates'}
                </div>
              </div>

              {/* Recurrence Schedule */}
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-700 block">
                  Repeat Curfew
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { id: 'one_time', label: 'One time' },
                    { id: 'daily', label: 'Every day' },
                    { id: 'selected_days', label: 'Selected days' },
                    { id: 'weekly', label: 'Weekly' },
                    { id: 'monthly', label: 'Monthly' },
                  ].map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRecurrenceType(r.id as any)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition border ${
                        recurrenceType === r.id
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>

                {/* Selected Days Checkboxes */}
                {recurrenceType === 'selected_days' && (
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 mt-2">
                    <span className="text-[11px] font-bold text-gray-600 block">Select active days:</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {DAYS.map((d) => {
                        const isChecked = selectedDays.includes(d.id);
                        return (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => toggleDay(d.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                              isChecked
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'bg-white text-gray-600 border border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {isChecked && <Check className="w-3 h-3" />}
                            {d.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Grace & Escalation Periods */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/70 space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-800">
                    Student Grace Period
                  </span>
                  <p className="text-lg font-black text-amber-950">15 Minutes</p>
                  <p className="text-[11px] text-amber-700">
                    Countdown starts immediately for outside students. If student returns in 15m, marked Late Comer.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-200/70 space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-rose-800">
                    Escalation Period
                  </span>
                  <p className="text-lg font-black text-rose-950">15 Minutes</p>
                  <p className="text-[11px] text-rose-700">
                    Second countdown (15-30m) leads to Warden + Owner alerts. Third period (30-45m) leads to Parent alert.
                  </p>
                </div>
              </div>

              {/* SET CURFEW BUTTON */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-4 flex-wrap">
                <button
                  type="submit"
                  disabled={savingConfig || !calculatedDuration.valid}
                  className="px-8 py-4 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 hover:opacity-95 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-200 transition-all flex items-center gap-3 disabled:opacity-50"
                >
                  <ShieldAlert className={`w-5 h-5 ${savingConfig ? 'animate-spin' : ''}`} />
                  {savingConfig ? 'Arming Curfew Engine…' : 'SET CURFEW'}
                </button>

                <p className="text-xs text-gray-500 font-medium">
                  Authoritative server scheduler will execute automatically at configured start time.
                </p>
              </div>
            </form>
          </div>

          {/* Side Explainer & Multi-Stage Visualizer */}
          <div className="space-y-6">
            {/* Multi-Stage Workflow Card */}
            <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 rounded-3xl p-6 text-white shadow-xl border border-indigo-500/20 space-y-4">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-indigo-400 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                  Automated Escalation Pipeline
                </span>
              </div>
              <h3 className="text-lg font-black text-white">How The 15-Minute Stages Work</h3>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
                  <div className="flex items-center justify-between font-bold text-amber-400">
                    <span>1. Grace Period (0 - 15m)</span>
                    <span>15m Countdown</span>
                  </div>
                  <p className="text-gray-300 text-[11px]">
                    Student outside receives warning. Returns? Marked <strong>LATE COMER</strong> &amp; escalation stops!
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
                  <div className="flex items-center justify-between font-bold text-orange-400">
                    <span>2. Rule Violation (15 - 30m)</span>
                    <span>Second 15m</span>
                  </div>
                  <p className="text-gray-300 text-[11px]">
                    Violation recorded. Returns? Marked <strong>VIOLATION RESOLVED</strong>.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
                  <div className="flex items-center justify-between font-bold text-rose-400">
                    <span>3. Warden &amp; Owner Alert (30m)</span>
                    <span>Staff Dispatched</span>
                  </div>
                  <p className="text-gray-300 text-[11px]">
                    Detailed alert sent to Warden and Owner with last location, room, and duration.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
                  <div className="flex items-center justify-between font-bold text-purple-400">
                    <span>4. Parent Emergency Alert (45m)</span>
                    <span>Absence Notice</span>
                  </div>
                  <p className="text-gray-300 text-[11px]">
                    Automated email/SMS sent to student&apos;s parent/guardian.
                  </p>
                </div>
              </div>
            </div>

            {/* Current Armed Configuration Card */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                Current Configuration
              </span>
              {sessionData?.configuration ? (
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-gray-500">Start:</span>
                    <span className="font-bold text-gray-900">
                      {sessionData.configuration.startDate} at {sessionData.configuration.startTime}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-gray-500">End:</span>
                    <span className="font-bold text-gray-900">
                      {sessionData.configuration.endDate} at {sessionData.configuration.endTime}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-gray-500">Duration:</span>
                    <span className="font-bold text-indigo-600">
                      {sessionData.configuration.durationDisplay}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-gray-500">Recurrence:</span>
                    <span className="font-bold capitalize text-gray-900">
                      {sessionData.configuration.recurrence?.type?.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500">Status:</span>
                    <span className="font-bold uppercase text-emerald-600">
                      {sessionData.configuration.status}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-500 italic py-2">
                  No custom curfew configured yet. Set a curfew schedule above to arm the automatic engine.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          TAB 2: STUDENT MONITORING TABLE WITH MULTI-FILTERS
      ───────────────────────────────────────────────────────────────────────────── */}
      {curfewTab === 'students' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-gray-900">Student Curfew Monitoring</h2>
              <p className="text-xs text-gray-500">
                Live geofence presence verification and countdown timers for active students
              </p>
            </div>

            {/* Filter controls */}
            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search student or ID…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-gray-800 focus:ring-2 focus:ring-indigo-500 w-full sm:w-48"
                />
              </div>

              <input
                type="text"
                placeholder="Room…"
                value={roomFilter}
                onChange={(e) => setRoomFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-gray-800 w-20"
              />

              <input
                type="text"
                placeholder="Block…"
                value={blockFilter}
                onChange={(e) => setBlockFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-gray-800 w-20"
              />
            </div>
          </div>

          {/* Status Filter Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: 'all', label: 'All Students' },
              { id: 'inside', label: '🟢 Inside (Present)' },
              { id: 'outside', label: '🟠 Outside Hostel' },
              { id: 'grace', label: '⏳ Grace Period' },
              { id: 'late', label: '🔵 Late Comers' },
              { id: 'violation', label: '🔴 Rule Violations' },
              { id: 'resolved', label: '🟣 Violation Resolved' },
              { id: 'unavailable', label: '⚪ Unavailable / Stale' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  statusFilter === f.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-slate-100 rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-3">Room / Block</th>
                  <th className="py-3 px-3">Location</th>
                  <th className="py-3 px-3 text-right">Distance</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Countdown</th>
                  <th className="py-3 px-3">Last Update</th>
                  <th className="py-3 px-4">Entry Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-gray-400">
                      {activeStatus !== 'ACTIVE'
                        ? 'No active curfew session running. Start or schedule a curfew to monitor students.'
                        : 'No student matches the selected filter.'}
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((st) => {
                    const isInside = st.status === 'INSIDE';
                    const isGrace = st.status === 'OUTSIDE_GRACE';
                    const isLate = st.status === 'LATE_COMER';
                    const isViolation = st.status === 'VIOLATION';
                    const isResolved = st.status === 'VIOLATION_RESOLVED';
                    const isLeave = st.status === 'ON_LEAVE';

                    let badgeClass = 'bg-slate-100 text-slate-700';
                    let label: string = st.status;

                    if (isInside) {
                      badgeClass = 'bg-emerald-100 text-emerald-800 border border-emerald-300';
                      label = 'Present';
                    } else if (isGrace) {
                      badgeClass = 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse';
                      label = 'Grace Period';
                    } else if (isLate) {
                      badgeClass = 'bg-blue-100 text-blue-800 border border-blue-300';
                      label = `Late Comer (${st.delayMinutes}m)`;
                    } else if (isViolation) {
                      badgeClass = 'bg-rose-100 text-rose-800 border border-rose-300 font-black animate-pulse';
                      label = 'Rule Violation';
                    } else if (isResolved) {
                      badgeClass = 'bg-purple-100 text-purple-800 border border-purple-300';
                      label = 'Resolved by Return';
                    } else if (isLeave) {
                      badgeClass = 'bg-teal-100 text-teal-800 border border-teal-300';
                      label = 'On Leave';
                    }

                    return (
                      <tr key={st._id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-semibold text-gray-900">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">
                              {(st.studentName || 'S')[0]}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900 leading-tight">{st.studentName}</p>
                              <p className="text-[10px] text-gray-400 font-mono">{st.studentRegId}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-semibold text-gray-700">
                          {st.roomNumber}
                          {st.block ? ` (${st.block})` : ''}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center gap-1 font-bold ${
                              isInside ? 'text-emerald-700' : 'text-amber-700'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isInside ? 'bg-emerald-500' : 'bg-amber-500'
                              }`}
                            />
                            {isInside ? 'Inside' : 'Outside'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-gray-800">
                          {formatDistance(st.distanceFromHostel)}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${badgeClass}`}>
                            {label}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold">
                          {isGrace && st.graceSecondsLeft ? (
                            <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                              {fmtMinutesSeconds(st.graceSecondsLeft)}
                            </span>
                          ) : isViolation && st.secondSecondsLeft ? (
                            <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                              {fmtMinutesSeconds(st.secondSecondsLeft)}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-3 px-3 text-gray-500">{fmtTime(st.lastLocationAt)}</td>
                        <td className="py-3 px-4 font-mono font-bold text-gray-800">
                          {st.entryTime ? fmtTime(st.entryTime) : '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          TAB 3: LIVE LOCATION MAP (Hostel Geofence & Student Pins)
      ───────────────────────────────────────────────────────────────────────────── */}
      {curfewTab === 'map' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Radar / Geofence Canvas */}
          <div className="lg:col-span-2 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 rounded-3xl p-6 border border-indigo-500/20 shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[500px]">
            {/* Top Toolbar */}
            <div className="flex items-center justify-between gap-4 z-10">
              <div className="space-y-1">
                <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1.5 w-fit">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Live Geofence Radar
                </span>
                <h3 className="text-lg font-black text-white">Campus Location Map</h3>
              </div>

              {/* Status Indicator Legend */}
              <div className="flex items-center gap-2 text-[10px] text-gray-300 font-semibold bg-white/10 px-3 py-1.5 rounded-xl backdrop-blur-md">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" /> Inside
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400" /> Grace
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-400" /> Late
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500" /> Violation
                </span>
              </div>
            </div>

            {/* Simulated Canvas Geofence Boundary */}
            <div className="relative my-8 flex items-center justify-center min-h-[360px]">
              {/* Concentric Radar Rings */}
              <div className="absolute w-80 h-80 rounded-full border border-indigo-500/20 animate-pulse" />
              <div className="absolute w-64 h-64 rounded-full border border-emerald-500/30 bg-emerald-500/5 backdrop-blur-[2px]" />
              <div className="absolute w-44 h-44 rounded-full border border-emerald-500/40 bg-emerald-500/10" />

              {/* Hostel Center Pin */}
              <div className="absolute z-20 flex flex-col items-center">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/50 border-2 border-white">
                  <Shield className="w-5 h-5" />
                </div>
                <span className="mt-1 px-2 py-0.5 rounded-md bg-slate-900/90 text-white font-bold text-[10px] border border-white/20 whitespace-nowrap">
                  {sessionData?.hostelName || 'Hostel Campus'} (500m Geofence)
                </span>
              </div>

              {/* Student Pins mapped relatively */}
              {sessionData?.students &&
                sessionData.students.map((st, idx) => {
                  const isInside = st.status === 'INSIDE';
                  const isGrace = st.status === 'OUTSIDE_GRACE';
                  const isLate = st.status === 'LATE_COMER';
                  const isViolation = st.status === 'VIOLATION';

                  let pinColor = 'bg-slate-400 border-white text-white';
                  if (isInside) pinColor = 'bg-emerald-500 border-emerald-200 text-white shadow-emerald-500/40';
                  else if (isGrace) pinColor = 'bg-amber-500 border-amber-200 text-white shadow-amber-500/50 animate-bounce';
                  else if (isLate) pinColor = 'bg-blue-500 border-blue-200 text-white shadow-blue-500/40';
                  else if (isViolation) pinColor = 'bg-rose-600 border-rose-200 text-white shadow-rose-600/50 animate-pulse';

                  // Spread pseudo-randomly for aesthetic demonstration
                  const angle = (idx * 360) / Math.max(1, sessionData.students.length);
                  const rad = (angle * Math.PI) / 180;
                  const distanceRadius = isInside ? 45 + (idx % 30) : 130 + (idx % 40);
                  const x = Math.cos(rad) * distanceRadius;
                  const y = Math.sin(rad) * distanceRadius;

                  return (
                    <button
                      key={st._id}
                      onClick={() => setSelectedStudentForMap(st)}
                      style={{ transform: `translate(${x}px, ${y}px)` }}
                      className={`absolute z-30 w-7 h-7 rounded-full border-2 shadow-md flex items-center justify-center text-[10px] font-black cursor-pointer transition transform hover:scale-125 ${pinColor}`}
                      title={`${st.studentName || 'Student'} (${st.status})`}
                    >
                      {(st.studentName || 'S')[0]}
                    </button>
                  );
                })}
            </div>

            {/* Bottom Legend / Note */}
            <div className="flex items-center justify-between text-[11px] text-gray-400 z-10">
              <span className="flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-indigo-400" />
                Click any student marker to inspect real-time coordinates, distance, and timestamps
              </span>
              <span>Total Pins: {sessionData?.students?.length || 0}</span>
            </div>
          </div>

          {/* Student Inspection Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                Selected Student Details
              </span>
              <h3 className="text-lg font-black text-gray-900 mt-1">Student Inspection</h3>
            </div>

            {selectedStudentForMap ? (
              <div className="space-y-4 text-xs">
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl">
                  <div className="w-10 h-10 rounded-full bg-indigo-600 text-white font-black flex items-center justify-center text-sm">
                    {(selectedStudentForMap.studentName || 'S')[0]}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{selectedStudentForMap.studentName}</p>
                    <p className="text-gray-500 font-mono text-[11px]">{selectedStudentForMap.studentRegId}</p>
                  </div>
                </div>

                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-gray-500">Room &amp; Block:</span>
                    <span className="font-bold text-gray-800">
                      {selectedStudentForMap.roomNumber}
                      {selectedStudentForMap.block ? ` (${selectedStudentForMap.block})` : ''}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-gray-500">Status:</span>
                    <span className="font-bold uppercase text-indigo-600">
                      {selectedStudentForMap.status}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-gray-500">Distance from Hostel:</span>
                    <span className="font-bold text-gray-900">
                      {formatDistance(selectedStudentForMap.distanceFromHostel)}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-gray-500">Last Location Fix:</span>
                    <span className="font-bold text-gray-700">
                      {fmtTime(selectedStudentForMap.lastLocationAt)}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-gray-500">GPS Accuracy:</span>
                    <span className="font-bold text-gray-700">
                      {selectedStudentForMap.currentAccuracy ? `${Math.round(selectedStudentForMap.currentAccuracy)}m` : '—'}
                    </span>
                  </div>

                  <div className="flex justify-between py-1">
                    <span className="text-gray-500">Outside Since:</span>
                    <span className="font-bold text-gray-700">
                      {selectedStudentForMap.outsideSince ? fmtTime(selectedStudentForMap.outsideSince) : '—'}
                    </span>
                  </div>
                </div>

                {selectedStudentForMap.studentPhone && (
                  <a
                    href={`tel:${selectedStudentForMap.studentPhone}`}
                    className="w-full py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl flex items-center justify-center gap-2 transition"
                  >
                    <Phone className="w-4 h-4" />
                    Call Student ({selectedStudentForMap.studentPhone})
                  </a>
                )}
              </div>
            ) : (
              <div className="py-12 text-center text-gray-400 space-y-2">
                <MapPin className="w-8 h-8 text-gray-300 mx-auto" />
                <p>Click on any student pin on the radar map to view complete live telemetry.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          TAB 4: CURFEW VIOLATIONS
      ───────────────────────────────────────────────────────────────────────────── */}
      {curfewTab === 'violations' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
          <div>
            <h2 className="text-xl font-black text-gray-900">Curfew Violations Audit</h2>
            <p className="text-xs text-gray-500">
              Persistent disciplinary record of confirmed curfew rule violations and multi-stage escalations
            </p>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-3">Room</th>
                  <th className="py-3 px-3">Curfew</th>
                  <th className="py-3 px-3">Violation Time</th>
                  <th className="py-3 px-3">Return Time</th>
                  <th className="py-3 px-3">Duration Outside</th>
                  <th className="py-3 px-3">Escalation Stage</th>
                  <th className="py-3 px-3">Parent Notified</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {violations.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-gray-400">
                      No curfew violations recorded. All students compliant.
                    </td>
                  </tr>
                ) : (
                  violations.map((v) => {
                    const sName = typeof v.studentId === 'object' ? v.studentId?.name : 'Student';
                    const isResolved = v.status === 'resolved';

                    return (
                      <tr key={v._id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-bold text-gray-900">{sName}</td>
                        <td className="py-3 px-3 font-semibold text-gray-700">
                          {typeof v.studentId === 'object' ? v.studentId?.roomId || 'N/A' : 'N/A'}
                        </td>
                        <td className="py-3 px-3 font-bold text-indigo-700">{v.curfewTime}</td>
                        <td className="py-3 px-3 text-gray-600">{fmtDate(v.violationDate)}</td>
                        <td className="py-3 px-3 font-mono text-gray-800">
                          {v.studentReturnedAt ? fmtTime(v.studentReturnedAt) : '—'}
                        </td>
                        <td className="py-3 px-3 font-bold text-gray-800">
                          {v.minutesMissing ? `${v.minutesMissing} mins` : '—'}
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800">
                            Stage {v.stage ?? 1}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          {v.parentNotified ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-800 flex items-center gap-1 w-fit">
                              <Mail className="w-3 h-3 text-purple-600" /> Yes
                            </span>
                          ) : (
                            <span className="text-gray-400 font-semibold">No</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${
                              isResolved
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800 animate-pulse'
                            }`}
                          >
                            {v.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          TAB 5: CURFEW HISTORY
      ───────────────────────────────────────────────────────────────────────────── */}
      {curfewTab === 'history' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-gray-900">Curfew Historical Sessions</h2>
              <p className="text-xs text-gray-500">
                Audit log of all past curfew executions, student metrics, and disciplinary escalations
              </p>
            </div>
            <button
              onClick={() => loadHistoryAndViolations(false)}
              disabled={historyLoading}
              className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 transition"
              title="Refresh History"
            >
              <RefreshCw className={`w-4 h-4 ${historyLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Session Date</th>
                  <th className="py-3 px-3">Start</th>
                  <th className="py-3 px-3">End</th>
                  <th className="py-3 px-3">Duration</th>
                  <th className="py-3 px-3">Started By</th>
                  <th className="py-3 px-3">Ended By</th>
                  <th className="py-3 px-3 text-right">Students Monitored</th>
                  <th className="py-3 px-3 text-right">Violations</th>
                  <th className="py-3 px-3 text-right">Parent Alerts</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historySessions.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-gray-400">
                      No historical curfew sessions on record yet.
                    </td>
                  </tr>
                ) : (
                  historySessions.map((s) => (
                    <tr key={s._id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-bold text-gray-900">{fmtDate(s.sessionDate)}</td>
                      <td className="py-3 px-3 font-semibold text-gray-700">
                        {fmtTime(s.actualStartAt || s.scheduledStartAt)}
                      </td>
                      <td className="py-3 px-3 font-semibold text-gray-700">
                        {fmtTime(s.actualEndAt || s.scheduledEndAt)}
                      </td>
                      <td className="py-3 px-3 font-bold text-indigo-700">{s.formattedDuration || '—'}</td>
                      <td className="py-3 px-3 text-gray-600">{s.startedByName}</td>
                      <td className="py-3 px-3 text-gray-600">{s.endedByName}</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-gray-800">
                        {s.summary?.totalStudents || 0}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-rose-600">
                        {s.summary?.violationsCount || 0}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-purple-600">
                        {s.summary?.parentAlertsCount || 0}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-slate-100 text-slate-800">
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          MODAL: CONFIRM MANUAL START
      ───────────────────────────────────────────────────────────────────────────── */}
      {confirmManualStartModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Play className="w-6 h-6 fill-current" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900">Start Curfew Immediately?</h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                This will trigger curfew right now regardless of the scheduled time. Real-time location checks will evaluate presence, initiate 15-minute grace countdowns for outside students, and log triggerType = MANUAL.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                onClick={() => setConfirmManualStartModal(false)}
                disabled={actionLoading}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleManualStart}
                disabled={actionLoading}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-200 transition"
              >
                {actionLoading ? 'Starting…' : 'Start Curfew Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          MODAL: CONFIRM MANUAL END
      ───────────────────────────────────────────────────────────────────────────── */}
      {confirmManualEndModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center">
              <Square className="w-6 h-6 fill-current" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900">End Active Curfew Now?</h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                This will conclude the active curfew session, terminate pending escalations, and stop continuous location tracking. All logged violations and entry records will be strictly preserved.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                onClick={() => setConfirmManualEndModal(false)}
                disabled={actionLoading}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleManualEnd}
                disabled={actionLoading}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-200 transition"
              >
                {actionLoading ? 'Ending…' : 'End Curfew Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          MODAL: CONFIRM RESET CURFEW
      ───────────────────────────────────────────────────────────────────────────── */}
      {confirmResetModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center">
              <RotateCcw className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900">Reset Curfew Configuration?</h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                This will reset the active curfew configuration and cancel future scheduled executions. Historical sessions, violations, attendance records, and notifications will NOT be deleted.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                onClick={() => setConfirmResetModal(false)}
                disabled={actionLoading}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                disabled={actionLoading}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-200 transition"
              >
                {actionLoading ? 'Resetting…' : 'RESET CURFEW'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          MODAL: CURFEW SET SUCCESS CONFIRMATION
      ───────────────────────────────────────────────────────────────────────────── */}
      {configSuccessModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle className="w-8 h-8" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 block">
                Armed Successfully
              </span>
              <h3 className="text-2xl font-black text-gray-900 mt-1">CURFEW SET SUCCESSFULLY</h3>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl text-xs text-left space-y-2 border border-slate-100">
              <div className="flex justify-between">
                <span className="text-gray-500">Start:</span>
                <span className="font-bold text-gray-900">
                  {configSuccessModal.startDate} — {configSuccessModal.startTime}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">End:</span>
                <span className="font-bold text-gray-900">
                  {configSuccessModal.endDate} — {configSuccessModal.endTime}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Duration:</span>
                <span className="font-bold text-indigo-700">{configSuccessModal.duration}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status:</span>
                <span className="font-bold uppercase text-emerald-600">{configSuccessModal.status}</span>
              </div>
            </div>

            <button
              onClick={() => setConfigSuccessModal(null)}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md transition"
            >
              Continue to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
