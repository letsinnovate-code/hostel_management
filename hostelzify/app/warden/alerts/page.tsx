'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import { alertApi, CurfewViolation, LeaveViolation, DashboardStats } from '../../../services/alertApi';
import { useAlertSocket } from '../../../contexts/AlertSocketContext';
import { toastManager } from '../../../components/Toast';
import {
  Bell,
  ShieldAlert,
  Clock,
  AlertTriangle,
  Users,
  CalendarX,
  Activity,
  RefreshCw,
  CheckCircle,
  Zap,
  TrendingUp,
  UserX,
  ChevronDown,
  ChevronRight,
  Send,
  Megaphone,
  GraduationCap,
  UserCheck,
  Info,
  MapPin,
  Shield,
  Play,
  FastForward,
  Navigation,
  Radio,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function fmtDate(d: string) {
  return new Date(d).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function fmtCountdown(seconds: number) {
  if (!seconds || seconds <= 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: any; color: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4`}>
      <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center flex-shrink-0`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function WardenAlertsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { connected, lastCurfewEvent } = useAlertSocket();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [curfewViolations, setCurfewViolations] = useState<CurfewViolation[]>([]);
  const [curfewFilter, setCurfewFilter] = useState<'all' | 'pending_recheck' | 'open' | 'resolved'>('all');
  const [leaveViolations, setLeaveViolations] = useState<LeaveViolation[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [triggeringCurfew, setTriggeringCurfew] = useState(false);
  const [startingImmediateCurfew, setStartingImmediateCurfew] = useState(false);
  const [simulatingStage, setSimulatingStage] = useState<string | null>(null);
  const [sweepSummary, setSweepSummary] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'curfew' | 'leave' | 'notifications' | 'send'>('overview');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [escalatingId, setEscalatingId] = useState<string | null>(null);
  // Curfew schedule & real-time automated timers
  const [curfewSchedule, setCurfewSchedule] = useState<{
    curfewTime: string;
    isCurfewActive: boolean;
    gracePeriodMinutes: number;
    lastCurfewSweepDate?: string | null;
  } | null>(null);
  const [curfewTimeInput, setCurfewTimeInput] = useState<string>('21:00');
  const [savingCurfewTime, setSavingCurfewTime] = useState<boolean>(false);
  const [activeTimers, setActiveTimers] = useState<any[]>([]);

  // Send alert form state
  const [sendForm, setSendForm] = useState({ title: '', message: '', priority: 'medium', targetRoles: { owner: true, warden: true, student: true } });
  const [sending, setSending] = useState(false);
  const [lastSendResult, setLastSendResult] = useState<string | null>(null);

  const hostelId = user?.hostelId as string | undefined;

  const loadAll = useCallback(async () => {
    if (!hostelId) return;
    setLoading(true);
    try {
      const [statsRes, curfewRes, leaveRes, alertsRes, timersRes] = await Promise.allSettled([
        alertApi.getDashboardStats(hostelId),
        alertApi.getCurfewViolations({
          hostelId,
          status: curfewFilter === 'all' ? undefined : curfewFilter,
          limit: 50,
        }),
        alertApi.getLeaveViolations({ hostelId, status: 'open', limit: 30 }),
        alertApi.getAlertNotifications({ hostelId, limit: 20 }),
        alertApi.getActiveCurfewTimers(hostelId),
      ]);

      if (statsRes.status === 'fulfilled') setStats(statsRes.value?.data ?? statsRes.value);
      if (curfewRes.status === 'fulfilled') setCurfewViolations(curfewRes.value?.data?.violations ?? curfewRes.value?.data ?? []);
      if (leaveRes.status === 'fulfilled') setLeaveViolations(leaveRes.value?.data?.violations ?? leaveRes.value?.data ?? []);
      if (alertsRes.status === 'fulfilled') setAlerts(alertsRes.value?.data?.alerts ?? alertsRes.value?.data ?? []);
      if (timersRes.status === 'fulfilled' && timersRes.value?.data) {
        const tData = timersRes.value.data;
        setCurfewSchedule({
          curfewTime: tData.curfewTime,
          isCurfewActive: tData.isCurfewActive,
          gracePeriodMinutes: tData.gracePeriodMinutes || 15,
          lastCurfewSweepDate: tData.lastCurfewSweepDate,
        });
        if (tData.curfewTime) {
          setCurfewTimeInput(tData.curfewTime);
        }
        setActiveTimers(tData.timers || []);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [hostelId, curfewFilter]);

  useEffect(() => {
    if (!user || user.role !== 'warden') { router.replace('/login'); return; }
    loadAll();
  }, [user, loadAll]);

  // Automatically refresh live timers and dashboard on real-time curfew socket events
  useEffect(() => {
    if (lastCurfewEvent) {
      loadAll();
    }
  }, [lastCurfewEvent, loadAll]);

  // Smooth client-side countdown timer for active grace and parent countdowns
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveTimers((prev) =>
        prev.map((t) => {
          let updatedGrace = t.graceSecondsLeft;
          let updatedParent = t.parentAlertSecondsLeft;
          if (t.timerStatus === 'grace_timer_running' && updatedGrace > 0) {
            updatedGrace = Math.max(0, updatedGrace - 1);
          }
          if (t.timerStatus === 'parent_timer_running' && updatedParent > 0) {
            updatedParent = Math.max(0, updatedParent - 1);
          }
          return {
            ...t,
            graceSecondsLeft: updatedGrace,
            parentAlertSecondsLeft: updatedParent,
          };
        })
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSaveCurfewTime = async () => {
    if (!hostelId || !curfewTimeInput) return;
    setSavingCurfewTime(true);
    try {
      const res = await alertApi.setCurfewTime(hostelId, curfewTimeInput);
      toastManager.show(res.message || `Curfew start time set to ${curfewTimeInput}`, 'success', 5000);
      await loadAll();
    } catch (e: any) {
      console.error('Error saving curfew time:', e);
      toastManager.show(e?.response?.data?.message || e.message || 'Failed to save curfew time', 'error');
    } finally {
      setSavingCurfewTime(false);
    }
  };

  const startImmediateCurfew = async () => {
    if (!hostelId) return;
    setStartingImmediateCurfew(true);
    try {
      const res = await alertApi.startImmediateCurfew(hostelId);
      setSweepSummary(res.data?.results || res.data);
      toastManager.show(res.message || 'Curfew started immediately! Student presence verified.', 'success', 6000);
      await loadAll();
    } catch (e: any) {
      console.error('Immediate Curfew error:', e.message);
      toastManager.show(e?.response?.data?.message || e.message || 'Curfew trigger failed', 'error');
    } finally {
      setStartingImmediateCurfew(false);
    }
  };

  const simulateTimeline = async (stage: '10min' | '15min' | '30min' | 'all') => {
    if (!hostelId) return;
    setSimulatingStage(stage);
    try {
      const res = await alertApi.simulateCurfewTimeline(hostelId, stage);
      toastManager.show(res.message || `Simulation stage ${stage} completed!`, 'success', 5000);
      await loadAll();
    } catch (e: any) {
      console.error('Simulation error:', e.message);
      toastManager.show(e?.response?.data?.message || e.message || 'Simulation error', 'error');
    } finally {
      setSimulatingStage(null);
    }
  };

  const triggerCurfew = async () => {
    if (!hostelId) return;
    setTriggeringCurfew(true);
    try {
      await alertApi.triggerCurfewCheck(hostelId);
      toastManager.show('Silent presence check started with 15-minute grace period.', 'success');
      setTimeout(loadAll, 1500);
    } catch (e: any) {
      console.error('Curfew trigger error:', e.message);
      toastManager.show(e.message || 'Curfew trigger failed', 'error');
    } finally {
      setTriggeringCurfew(false);
    }
  };

  const resolveCurfew = async (id: string) => {
    setResolvingId(id);
    try {
      await alertApi.resolveCurfewViolation(id, 'Resolved by warden');
      setCurfewViolations((prev) => prev.filter((v) => v._id !== id));
      toastManager.show('Curfew record updated.', 'success');
    } catch (e) { console.error(e); }
    finally { setResolvingId(null); }
  };

  const handleEscalateCurfew = async (id: string) => {
    setEscalatingId(id);
    try {
      const res = await alertApi.escalateCurfewViolation(id, 'Warden manual escalation to Owner');
      toastManager.show(res.message || 'Curfew violation escalated to Owner successfully.', 'success', 5000);
      await loadAll();
    } catch (e: any) {
      console.error('Escalation error:', e);
      toastManager.show(e?.response?.data?.message || e.message || 'Failed to escalate curfew violation', 'error');
    } finally {
      setEscalatingId(null);
    }
  };

  const resolveAlert = async (id: string) => {
    setResolvingId(id);
    try {
      await alertApi.resolveAlert(id);
      setAlerts((prev) => prev.filter((a) => a._id !== id));
    } catch (e) { console.error(e); }
    finally { setResolvingId(null); }
  };

  const getStudentName = (s: any) => typeof s === 'object' ? (s?.name ?? 'Unknown') : 'Student';

  const sendAlertToAll = async () => {
    if (!sendForm.title.trim() || !sendForm.message.trim()) {
      toastManager.show('Title and message are required', 'error'); return;
    }
    const roles = Object.entries(sendForm.targetRoles).filter(([, v]) => v).map(([r]) => r);
    if (roles.length === 0) { toastManager.show('Select at least one role', 'error'); return; }
    if (!hostelId) { toastManager.show('No hostelId found for your account', 'error'); return; }
    setSending(true); setLastSendResult(null);
    try {
      const res = await alertApi.sendToAllRoles({ title: sendForm.title, message: sendForm.message, priority: sendForm.priority as any, hostelId, targetRoles: roles, type: 'ANNOUNCEMENT' });
      const msg = res.message ?? 'Alert sent!';
      setLastSendResult(msg);
      toastManager.show(msg, 'success', 5000);
      setSendForm({ title: '', message: '', priority: 'medium', targetRoles: { owner: true, warden: true, student: true } });
      setTimeout(loadAll, 1200);
    } catch (e: any) {
      toastManager.show(e?.response?.data?.message ?? e.message ?? 'Failed', 'error');
    } finally { setSending(false); }
  };

  // ── Tabs ─────────────────────────────────────────────────────────────────
  const TABS = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'curfew', label: `Curfew (${curfewViolations.length})`, icon: ShieldAlert },
    { id: 'leave', label: `Leave Violations (${leaveViolations.length})`, icon: CalendarX },
    { id: 'notifications', label: `Alerts (${alerts.length})`, icon: Bell },
    { id: 'send', label: 'Send Alert', icon: Megaphone },
  ] as const;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/20 to-purple-50/10">
      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg">
                <ShieldAlert className="w-5 h-5 text-white" />
              </div>
              Alert Dashboard
            </h1>
            <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
              Automated monitoring for your hostel
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                {connected ? 'Live' : 'Offline'}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadAll}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-white text-gray-600 rounded-lg border border-gray-200 hover:bg-gray-50 shadow-sm transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={triggerCurfew}
              disabled={triggeringCurfew}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg shadow-sm hover:opacity-90 transition font-medium"
            >
              <Zap className="w-4 h-4" />
              {triggeringCurfew ? 'Checking…' : 'Run Curfew Check'}
            </button>
          </div>
        </div>

        {/* ── Stat Cards ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Alerts" value={stats?.totalAlerts ?? '—'} icon={Bell} color="bg-indigo-500" />
          <StatCard label="Unread" value={stats?.unreadAlerts ?? '—'} icon={TrendingUp} color="bg-orange-500" />
          <StatCard label="Curfew Violations" value={stats?.activeCurfewViolations ?? curfewViolations.length} icon={ShieldAlert} color="bg-red-500" />
          <StatCard label="Leave Violations" value={stats?.activeLeaveViolations ?? leaveViolations.length} icon={UserX} color="bg-purple-500" />
        </div>

        {/* ── Occupancy Widget ─────────────────────────────────────── */}
        {stats?.currentOccupancy && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-500" /> Live Occupancy
              </h2>
              <span className="text-sm text-gray-500">
                {stats.currentOccupancy.inside} inside / {stats.currentOccupancy.total} total
              </span>
            </div>
            <div className="relative w-full h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, stats.currentOccupancy.percentage ?? 0)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {(stats.currentOccupancy.percentage ?? 0).toFixed(1)}% occupancy
            </p>
          </div>
        )}

        {/* ── Tabs ───────────────────────────────────────────────── */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm rounded-lg font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-white shadow text-indigo-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ── Tab: Curfew ─────────────────────────────────────────── */}
        {activeTab === 'curfew' && (
          <div className="space-y-6">
            {/* ── Warden Curfew Schedule & Fully Automatic Engine Controller ── */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm relative overflow-hidden">
              <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-600" />
                      Autonomous Curfew Engine
                    </span>
                    {curfewSchedule?.isCurfewActive ? (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                        Curfew Active Now (1-Min Automation Running)
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-amber-600" />
                        Scheduled for {curfewSchedule?.curfewTime || curfewTimeInput}
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Curfew Start Time &amp; Automatic Alerts</h3>
                  <p className="text-xs text-gray-500 mt-1 max-w-2xl">
                    Configure the exact curfew start time. When reached, the system automatically sweeps student presence via geofence, initiates a 15-minute grace period timer for outside students, automatically executes escalations to Warden &amp; Owner when times up, and dispatches parent alerts at 30 minutes. If a student returns inside beforehand, their timer automatically terminates.
                  </p>
                </div>

                {/* Time Setter Form */}
                <div className="flex items-center gap-3 bg-gray-50 p-2.5 rounded-2xl border border-gray-200">
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Curfew Start Time</label>
                    <input
                      type="time"
                      value={curfewTimeInput}
                      onChange={(e) => setCurfewTimeInput(e.target.value)}
                      className="bg-white border border-gray-300 text-gray-800 text-sm font-bold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <button
                    onClick={handleSaveCurfewTime}
                    disabled={savingCurfewTime || !curfewTimeInput}
                    className="self-end px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition disabled:opacity-50 flex items-center gap-2"
                  >
                    <Clock className={`w-3.5 h-3.5 ${savingCurfewTime ? 'animate-spin' : ''}`} />
                    {savingCurfewTime ? 'Saving…' : 'Save Curfew Time'}
                  </button>
                </div>
              </div>

              {/* Automatic Pipeline Flow */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-3 border-t border-gray-100">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                  <span className="text-[10px] font-extrabold text-indigo-600 uppercase">1. Auto Curfew Start</span>
                  <p className="text-xs font-bold text-gray-800 mt-0.5">{curfewSchedule?.curfewTime || curfewTimeInput}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Automated silent presence scan runs at this exact time daily.</p>
                </div>
                <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/60">
                  <span className="text-[10px] font-extrabold text-amber-700 uppercase">2. 15m Grace Period</span>
                  <p className="text-xs font-bold text-amber-900 mt-0.5">0 - 15 Minutes</p>
                  <p className="text-[11px] text-amber-700/80 mt-0.5">Timer starts automatically for outside students. Warning sent.</p>
                </div>
                <div className="p-3 bg-orange-50/70 rounded-xl border border-orange-200/60">
                  <span className="text-[10px] font-extrabold text-orange-700 uppercase">3. Auto Escalation</span>
                  <p className="text-xs font-bold text-orange-900 mt-0.5">15 Minutes</p>
                  <p className="text-[11px] text-orange-700/80 mt-0.5">Alerts automatically sent to Warden, Student, and Owner.</p>
                </div>
                <div className="p-3 bg-rose-50/70 rounded-xl border border-rose-200/60">
                  <span className="text-[10px] font-extrabold text-rose-700 uppercase">4. Auto Parent Alert</span>
                  <p className="text-xs font-bold text-rose-900 mt-0.5">30 Minutes</p>
                  <p className="text-[11px] text-rose-700/80 mt-0.5">Emergency alert to parents dispatches. Terminated if student returns!</p>
                </div>
              </div>
            </div>

            {/* ── Live Countdown Timers & Auto-Termination Monitor ── */}
            {activeTimers.length > 0 && (
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-red-500 flex items-center justify-center text-white shadow-md">
                      <Clock className="w-5 h-5 animate-spin" style={{ animationDuration: '6s' }} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Live Curfew Countdown Timers</h3>
                      <p className="text-xs text-gray-500">
                        Real-time countdowns for grace periods and parent alerts. Timers automatically terminate upon student arrival.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-bold border border-amber-200">
                      ⏳ Grace Active: {activeTimers.filter((t) => t.timerStatus === 'grace_timer_running').length}
                    </span>
                    <span className="px-3 py-1 bg-red-50 text-red-700 rounded-full text-xs font-bold border border-red-200">
                      🚨 Parent Queue: {activeTimers.filter((t) => t.timerStatus === 'parent_timer_running').length}
                    </span>
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold border border-emerald-200">
                      ✅ Auto-Terminated: {activeTimers.filter((t) => t.timerStatus === 'terminated_returned').length}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                  {activeTimers.map((timer) => {
                    const isGrace = timer.timerStatus === 'grace_timer_running';
                    const isParentWaiting = timer.timerStatus === 'parent_timer_running';
                    const isTerminated = timer.timerStatus === 'terminated_returned';
                    const isParentNotified = timer.parentNotified || timer.timerStatus === 'parent_alert_executed';

                    return (
                      <div
                        key={timer.violationId}
                        className={`rounded-2xl p-4 border transition-all ${
                          isGrace
                            ? 'bg-gradient-to-br from-amber-50/60 to-yellow-50/30 border-amber-200 shadow-sm'
                            : isParentWaiting
                            ? 'bg-gradient-to-br from-red-50/60 to-rose-50/30 border-red-200 shadow-sm'
                            : isTerminated
                            ? 'bg-gradient-to-br from-emerald-50/60 to-teal-50/30 border-emerald-200'
                            : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <p className="font-bold text-gray-900 text-sm">{timer.studentName}</p>
                            <p className="text-[11px] text-gray-500">Room: {timer.roomId}</p>
                          </div>

                          {isGrace && (
                            <div className="flex flex-col items-end">
                              <span className="px-2.5 py-1 rounded-xl bg-amber-500 text-white font-mono text-xs font-black shadow-sm flex items-center gap-1">
                                <Clock className="w-3 h-3 animate-pulse" />
                                {fmtCountdown(timer.graceSecondsLeft)}
                              </span>
                              <span className="text-[10px] text-amber-700 font-semibold mt-0.5">15m Grace</span>
                            </div>
                          )}

                          {isParentWaiting && (
                            <div className="flex flex-col items-end">
                              <span className="px-2.5 py-1 rounded-xl bg-red-600 text-white font-mono text-xs font-black shadow-sm flex items-center gap-1 animate-pulse">
                                <AlertTriangle className="w-3 h-3" />
                                {fmtCountdown(timer.parentAlertSecondsLeft)}
                              </span>
                              <span className="text-[10px] text-red-700 font-semibold mt-0.5">Parent Alert In</span>
                            </div>
                          )}

                          {isTerminated && (
                            <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-300 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3 text-emerald-600" />
                              Terminated
                            </span>
                          )}

                          {isParentNotified && !isTerminated && (
                            <span className="px-2 py-0.5 rounded-lg bg-purple-100 text-purple-800 text-[11px] font-bold border border-purple-300 flex items-center gap-1">
                              <ShieldAlert className="w-3 h-3 text-purple-600" />
                              Parent Alerted
                            </span>
                          )}
                        </div>

                        {/* Status message */}
                        <div className="text-xs mt-2 pt-2 border-t border-black/5">
                          {isGrace && (
                            <p className="text-amber-800 text-[11px]">
                              ⚠️ Student is outside. Alerts escalate to Warden &amp; Owner when timer expires.
                            </p>
                          )}
                          {isParentWaiting && (
                            <p className="text-red-800 text-[11px] font-medium">
                              🚨 15m grace expired. Alerting parent when countdown reaches 00:00 unless student returns.
                            </p>
                          )}
                          {isTerminated && (
                            <p className="text-emerald-800 text-[11px] font-medium">
                              ✅ Student returned inside geofence! Pending alert timers automatically cancelled.
                            </p>
                          )}
                          {isParentNotified && !isTerminated && (
                            <p className="text-purple-800 text-[11px]">
                              🚨 30-minute escalation reached: Emergency notification sent to parents.
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Event-Based Curfew & Geofence Presence Command Center ── */}
            <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 rounded-3xl p-6 text-white shadow-xl border border-indigo-500/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="relative z-10 space-y-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 flex items-center gap-1.5">
                        <Radio className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                        Live Event-Based Presence Hub
                      </span>
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                        Device Geofence: 23.2505° N, 77.4065° E (500m Active Radius)
                      </span>
                    </div>
                    <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                      Night Curfew & Morning Attendance
                    </h2>
                    <p className="text-sm text-indigo-200/80 max-w-2xl mt-1">
                      Warden-initiated presence verification. Inside students marked <strong>Present</strong>, approved leaves marked <strong>On Leave</strong>, and outside students trigger a <strong>15-minute grace period</strong> with multi-stage automated escalations.
                    </p>
                  </div>

                  {/* Primary Trigger Button */}
                  <button
                    onClick={startImmediateCurfew}
                    disabled={startingImmediateCurfew}
                    className="px-6 py-3.5 bg-gradient-to-r from-red-600 via-rose-600 to-orange-500 hover:from-red-500 hover:to-orange-400 text-white rounded-2xl font-bold text-sm shadow-lg shadow-red-500/30 transition-all flex items-center gap-3 disabled:opacity-50 transform hover:-translate-y-0.5 active:translate-y-0"
                  >
                    <Play className={`w-5 h-5 ${startingImmediateCurfew ? 'animate-spin' : 'fill-current'}`} />
                    {startingImmediateCurfew ? 'Verifying Presence & Sweeping Geofence…' : 'Start Curfew Immediately'}
                  </button>
                </div>

                {/* Multi-Stage Workflow Explainer */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
                  <div className="bg-white/5 backdrop-blur-md rounded-xl p-3 border border-white/10">
                    <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">Stage 0 • 0 Min</span>
                    <p className="text-xs font-semibold text-white mt-0.5">Initial Check & Warning</p>
                    <p className="text-[11px] text-gray-300 mt-1">Immediate warning sent to outside student. 15-min grace started.</p>
                  </div>
                  <div className="bg-white/5 backdrop-blur-md rounded-xl p-3 border border-white/10">
                    <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider block">Stage 1 • 10 Min</span>
                    <p className="text-xs font-semibold text-white mt-0.5">GPS & Gate Recheck</p>
                    <p className="text-[11px] text-gray-300 mt-1">Auto-resolves if returned. Sends 5-min final grace warning if outside.</p>
                  </div>
                  <div className="bg-white/5 backdrop-blur-md rounded-xl p-3 border border-white/10">
                    <span className="text-[11px] font-bold text-orange-400 uppercase tracking-wider block">Stage 2 • 15 Min</span>
                    <p className="text-xs font-semibold text-white mt-0.5">Warden & Owner Alert</p>
                    <p className="text-[11px] text-gray-300 mt-1">Grace expires. Violation confirmed. Alert sent to Warden, Student, & Owner.</p>
                  </div>
                  <div className="bg-white/5 backdrop-blur-md rounded-xl p-3 border border-white/10">
                    <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider block">Stage 3 • 30 Min</span>
                    <p className="text-xs font-semibold text-white mt-0.5">Parent Escalation</p>
                    <p className="text-[11px] text-gray-300 mt-1">Emergency email/SMS sent to Parent. Urgent alert sent to Owner.</p>
                  </div>
                </div>

                {/* Fast-Forward Simulation Controls */}
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <FastForward className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Simulation & Demo Fast-Forward:
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => simulateTimeline('10min')}
                      disabled={simulatingStage !== null}
                      className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 border border-blue-400/30 rounded-xl text-xs font-semibold transition disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {simulatingStage === '10min' ? 'Processing…' : '⏱️ Test 10m Recheck'}
                    </button>
                    <button
                      onClick={() => simulateTimeline('15min')}
                      disabled={simulatingStage !== null}
                      className="px-3 py-1.5 bg-orange-500/20 hover:bg-orange-500/30 text-orange-200 border border-orange-400/30 rounded-xl text-xs font-semibold transition disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {simulatingStage === '15min' ? 'Processing…' : '⚠️ Test 15m Escalation (Warden & Owner)'}
                    </button>
                    <button
                      onClick={() => simulateTimeline('30min')}
                      disabled={simulatingStage !== null}
                      className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-400/30 rounded-xl text-xs font-semibold transition disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {simulatingStage === '30min' ? 'Processing…' : '🚨 Test 30m Parent Alert'}
                    </button>
                    <button
                      onClick={() => simulateTimeline('all')}
                      disabled={simulatingStage !== null}
                      className="px-3 py-1.5 bg-purple-500/30 hover:bg-purple-500/40 text-purple-100 border border-purple-400/40 rounded-xl text-xs font-bold transition disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {simulatingStage === 'all' ? 'Running…' : '⚡ Run All Stages'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Sweep Summary Banner (if active) */}
            {sweepSummary && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-emerald-900">Curfew Presence Verification Sweep Completed</p>
                    <p className="text-xs text-emerald-700">
                      Inside students confirmed Present, approved leaves exempted, and outside students issued 0m grace warning.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold">
                    🟢 Present: {sweepSummary.present?.length ?? sweepSummary.present ?? 0}
                  </span>
                  <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg text-xs font-bold">
                    🟡 On Leave: {sweepSummary.onLeave?.length ?? sweepSummary.onLeave ?? 0}
                  </span>
                  <span className="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-lg text-xs font-bold">
                    🟠 In Grace: {sweepSummary.outside?.length ?? sweepSummary.initiated ?? 0}
                  </span>
                </div>
              </div>
            )}

            {/* Filter Pills & Manual Trigger */}
            <div className="flex items-center justify-between gap-3 flex-wrap bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { id: 'all', label: 'All Records' },
                  { id: 'pending_recheck', label: '⏳ 15m Grace Period (Stage 0)' },
                  { id: 'open', label: '🚨 Confirmed Breaches (Stage 1 & 2)' },
                  { id: 'resolved', label: '✅ Resolved & Present' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setCurfewFilter(f.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      curfewFilter === f.id
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <button
                onClick={triggerCurfew}
                disabled={triggeringCurfew}
                className="flex items-center gap-2 px-3.5 py-1.5 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg font-semibold transition disabled:opacity-50"
              >
                <Zap className={`w-3.5 h-3.5 ${triggeringCurfew ? 'animate-spin' : 'text-indigo-600'}`} />
                {triggeringCurfew ? 'Verifying Presence…' : 'Quick Geofence Re-Check'}
              </button>
            </div>

            {curfewViolations.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-sm">
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">No curfew records matching this filter 🎉</p>
                <p className="text-xs text-gray-400 mt-1">Students are compliant or have approved leave passes.</p>
              </div>
            ) : (
              curfewViolations.map((v) => {
                const isGrace = v.status === 'pending_recheck';
                const isOpen = v.status === 'open';
                const isResolved = v.status === 'resolved';

                const borderColor = isGrace
                  ? 'border-l-amber-500'
                  : isOpen
                  ? (v.parentNotified || (v.escalationLevel ?? 0) >= 1 ? 'border-l-red-600' : 'border-l-red-400')
                  : 'border-l-green-500';

                return (
                  <div key={v._id} className={`bg-white rounded-2xl border-l-4 ${borderColor} border border-gray-100 shadow-sm p-5`}>
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="space-y-1.5 flex-1 min-w-[240px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900 text-base">{getStudentName(v.studentId)}</p>
                          {isGrace && (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-amber-600" />
                              Grace Period (0-15 Min • Stage 0)
                            </span>
                          )}
                          {isOpen && !v.parentNotified && (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-900 border border-red-300 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-red-600" />
                              Warden &amp; Owner Alerted (15+ Min • Stage 1)
                            </span>
                          )}
                          {v.parentNotified && (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-900 border border-purple-300 flex items-center gap-1">
                              <ShieldAlert className="w-3 h-3 text-purple-700" />
                              🚨 Parent Alert Dispatched (30+ Min • Stage 2)
                            </span>
                          )}
                          {isResolved && (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3 text-emerald-600" />
                              Present &amp; Resolved
                            </span>
                          )}
                          {v.locationMethod && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-gray-100 text-gray-600 uppercase">
                              {v.locationMethod === 'gps' ? '📍 GPS Verified' : '🚪 Gate Check'}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-gray-400" /> Curfew: <strong>{v.curfewTime}</strong>
                          </span>
                          <span>•</span>
                          <span>Triggered: {fmtDate(v.violationDate)}</span>
                          {v.graceExpiresAt && isGrace && (
                            <>
                              <span>•</span>
                              <span className="text-amber-700 font-medium">
                                Grace expires: {fmtDate(v.graceExpiresAt)}
                              </span>
                            </>
                          )}
                        </div>

                        {v.lastKnownActivity && (
                          <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded-lg border border-gray-100 mt-1">
                            {v.lastKnownActivity}
                          </p>
                        )}
                        {v.resolutionNote && (
                          <p className="text-xs text-green-700 bg-green-50 p-2 rounded-lg border border-green-100 mt-1">
                            Resolution: {v.resolutionNote}
                          </p>
                        )}
                      </div>

                      {(isOpen || isGrace) && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => handleEscalateCurfew(v._id)}
                            disabled={escalatingId === v._id}
                            className="flex items-center gap-1.5 px-3 py-2 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition font-semibold disabled:opacity-50"
                          >
                            <ShieldAlert className="w-4 h-4 text-red-600" />
                            {escalatingId === v._id ? 'Escalating…' : 'Escalate to Owner'}
                          </button>
                          <button
                            onClick={() => resolveCurfew(v._id)}
                            disabled={resolvingId === v._id}
                            className="flex items-center gap-2 px-3.5 py-2 text-xs bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition font-semibold disabled:opacity-50"
                          >
                            <CheckCircle className="w-4 h-4" />
                            {resolvingId === v._id ? 'Resolving…' : 'Acknowledge / Resolve'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── Tab: Leave ──────────────────────────────────────────── */}
        {activeTab === 'leave' && (
          <div className="space-y-3">
            {leaveViolations.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-sm">
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">No leave violations 🎉</p>
              </div>
            ) : (
              leaveViolations.map((v) => (
                <div
                  key={v._id}
                  className={`bg-white rounded-2xl border-l-4 ${v.escalatedToOwner ? 'border-l-red-600' : 'border-l-orange-400'} border border-gray-100 shadow-sm p-5`}
                >
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900">{getStudentName(v.studentId)}</p>
                        {v.escalatedToOwner && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                            ESCALATED
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                          Overdue by {v.hoursOverdue}h
                        </span>
                        <span>Expected: {fmtDate(v.expectedReturnDate)}</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-700 font-medium">
                      {v.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Tab: Notifications ──────────────────────────────────── */}
        {activeTab === 'notifications' && (
          <div className="space-y-3">
            {alerts.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-sm">
                <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No alerts yet</p>
              </div>
            ) : (
              alerts.map((alert) => (
                <div key={alert._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-semibold text-gray-900">{alert.title}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          alert.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                          alert.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                          'bg-blue-100 text-blue-700'}`}>
                          {alert.priority}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{alert.message}</p>
                      <p className="text-xs text-gray-400 mt-1">{fmtDate(alert.createdAt)}</p>
                    </div>
                    {alert.status === 'active' && (
                      <button
                        onClick={() => resolveAlert(alert._id)}
                        disabled={resolvingId === alert._id}
                        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        {resolvingId === alert._id ? 'Resolving…' : 'Resolve'}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Tab: Overview ──────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Curfew */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-500" /> Recent Curfew Violations
                </h3>
                <button onClick={() => setActiveTab('curfew')} className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                  View all <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                {curfewViolations.slice(0, 4).map((v) => (
                  <div key={v._id} className="flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-100">
                    <ShieldAlert className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{getStudentName(v.studentId)}</p>
                      <p className="text-xs text-gray-500">{fmtDate(v.violationDate)}</p>
                    </div>
                  </div>
                ))}
                {curfewViolations.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">No open violations</p>
                )}
              </div>
            </div>

            {/* Recent Leave Violations */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <CalendarX className="w-4 h-4 text-orange-500" /> Leave Violations
                </h3>
                <button onClick={() => setActiveTab('leave')} className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                  View all <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                {leaveViolations.slice(0, 4).map((v) => (
                  <div key={v._id} className={`flex items-center gap-3 p-3 rounded-xl ${v.escalatedToOwner ? 'bg-red-50 border border-red-100' : 'bg-orange-50 border border-orange-100'}`}>
                    <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${v.escalatedToOwner ? 'text-red-500' : 'text-orange-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{getStudentName(v.studentId)}</p>
                      <p className="text-xs text-gray-500">Overdue {v.hoursOverdue}h</p>
                    </div>
                    {v.escalatedToOwner && (
                      <span className="text-xs font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">ESC</span>
                    )}
                  </div>
                ))}
                {leaveViolations.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">No leave violations</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Send Alert ─────────────────────────────────────── */}
        {activeTab === 'send' && (
          <div className="max-w-xl mx-auto">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Panel header */}
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-5">
                <h2 className="text-white font-bold text-lg flex items-center gap-2">
                  <Megaphone className="w-5 h-5" />
                  Send Alert to Roles
                </h2>
                <p className="text-indigo-200 text-sm mt-0.5">
                  Deliver an instant notification to selected roles in your hostel
                </p>
              </div>

              <div className="p-6 space-y-5">
                {/* Title */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Alert Title *</label>
                  <input
                    type="text"
                    placeholder="e.g. Water supply off from 2–4 PM"
                    value={sendForm.title}
                    onChange={(e) => setSendForm({ ...sendForm, title: e.target.value })}
                    maxLength={120}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                {/* Message */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Message *</label>
                  <textarea
                    placeholder="Write the full notification message..."
                    value={sendForm.message}
                    onChange={(e) => setSendForm({ ...sendForm, message: e.target.value })}
                    rows={4}
                    maxLength={500}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                  />
                  <p className="text-right text-xs text-gray-400 mt-0.5">{sendForm.message.length}/500</p>
                </div>

                {/* Priority + Roles */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Priority</label>
                    <select
                      value={sendForm.priority}
                      onChange={(e) => setSendForm({ ...sendForm, priority: e.target.value })}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="low">🔵 Low</option>
                      <option value="medium">🟡 Medium</option>
                      <option value="high">🟠 High</option>
                      <option value="urgent">🔴 Urgent</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Send To</label>
                    <div className="flex flex-col gap-1.5">
                      {[
                        { key: 'owner', label: 'Owner', icon: <UserCheck className="w-3.5 h-3.5" />, color: 'bg-purple-100 text-purple-700' },
                        { key: 'warden', label: 'Warden', icon: <ShieldAlert className="w-3.5 h-3.5" />, color: 'bg-indigo-100 text-indigo-700' },
                        { key: 'student', label: 'Students', icon: <GraduationCap className="w-3.5 h-3.5" />, color: 'bg-green-100 text-green-700' },
                      ].map(({ key, label, icon, color }) => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={sendForm.targetRoles[key as keyof typeof sendForm.targetRoles]}
                            onChange={(e) => setSendForm({ ...sendForm, targetRoles: { ...sendForm.targetRoles, [key]: e.target.checked } })}
                            className="w-4 h-4 rounded accent-indigo-600"
                          />
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
                            {icon} {label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Success banner */}
                {lastSendResult && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    {lastSendResult}
                  </div>
                )}

                {/* Send button */}
                <button
                  onClick={sendAlertToAll}
                  disabled={sending}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold text-sm hover:opacity-90 disabled:opacity-60 shadow-md transition"
                >
                  {sending
                    ? <><RefreshCw className="w-4 h-4 animate-spin" /> Sending…</>
                    : <><Send className="w-4 h-4" /> Send Alert Now</>
                  }
                </button>

                <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-1">
                  <Info className="w-3.5 h-3.5" />
                  Recipients will see the alert instantly via in-app notification and real-time toast
                </p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

