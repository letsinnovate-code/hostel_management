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
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function fmtDate(d: string) {
  return new Date(d).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
  });
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
  const { connected } = useAlertSocket();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [curfewViolations, setCurfewViolations] = useState<CurfewViolation[]>([]);
  const [leaveViolations, setLeaveViolations] = useState<LeaveViolation[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [triggeringCurfew, setTriggeringCurfew] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'curfew' | 'leave' | 'notifications' | 'send'>('overview');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  // Send alert form state
  const [sendForm, setSendForm] = useState({ title: '', message: '', priority: 'medium', targetRoles: { owner: true, warden: true, student: true } });
  const [sending, setSending] = useState(false);
  const [lastSendResult, setLastSendResult] = useState<string | null>(null);

  const hostelId = user?.hostelId as string | undefined;

  useEffect(() => {
    if (!user || user.role !== 'warden') { router.replace('/login'); return; }
    loadAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadAll = useCallback(async () => {
    if (!hostelId) return;
    setLoading(true);
    try {
      const [statsRes, curfewRes, leaveRes, alertsRes] = await Promise.allSettled([
        alertApi.getDashboardStats(hostelId),
        alertApi.getCurfewViolations({ hostelId, status: 'open', limit: 30 }),
        alertApi.getLeaveViolations({ hostelId, status: 'open', limit: 30 }),
        alertApi.getAlertNotifications({ hostelId, limit: 20 }),
      ]);

      if (statsRes.status === 'fulfilled') setStats(statsRes.value?.data ?? statsRes.value);
      if (curfewRes.status === 'fulfilled') setCurfewViolations(curfewRes.value?.data?.violations ?? curfewRes.value?.data ?? []);
      if (leaveRes.status === 'fulfilled') setLeaveViolations(leaveRes.value?.data?.violations ?? leaveRes.value?.data ?? []);
      if (alertsRes.status === 'fulfilled') setAlerts(alertsRes.value?.data?.alerts ?? alertsRes.value?.data ?? []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [hostelId]);

  const triggerCurfew = async () => {
    if (!hostelId) return;
    setTriggeringCurfew(true);
    try {
      await alertApi.triggerCurfewCheck(hostelId);
      setTimeout(loadAll, 1500);
    } catch (e: any) {
      console.error('Curfew trigger error:', e.message);
    } finally {
      setTriggeringCurfew(false);
    }
  };

  const resolveCurfew = async (id: string) => {
    setResolvingId(id);
    try {
      await alertApi.resolveCurfewViolation(id, 'Resolved by warden');
      setCurfewViolations((prev) => prev.filter((v) => v._id !== id));
    } catch (e) { console.error(e); }
    finally { setResolvingId(null); }
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
          <div className="space-y-3">
            {curfewViolations.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-sm">
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">No open curfew violations 🎉</p>
              </div>
            ) : (
              curfewViolations.map((v) => (
                <div key={v._id} className="bg-white rounded-2xl border-l-4 border-l-red-400 border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <p className="font-semibold text-gray-900">{getStudentName(v.studentId)}</p>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 flex-wrap">
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Curfew: {v.curfewTime}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {fmtDate(v.violationDate)}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${v.status === 'open' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                          {v.status}
                        </span>
                      </div>
                    </div>
                    {v.status === 'open' && (
                      <button
                        onClick={() => resolveCurfew(v._id)}
                        disabled={resolvingId === v._id}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition font-medium"
                      >
                        <CheckCircle className="w-4 h-4" />
                        {resolvingId === v._id ? 'Resolving…' : 'Resolve'}
                      </button>
                    )}
                  </div>
                </div>
              ))
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

