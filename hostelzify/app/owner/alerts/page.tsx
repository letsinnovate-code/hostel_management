'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import { alertApi, AlertNotification } from '../../../services/alertApi';
import api from '../../../services/api';
import { useAlertSocket } from '../../../contexts/AlertSocketContext';
import OwnerLayout from '../../../components/OwnerLayout';
import {
  Bell,
  Send,
  ShieldAlert,
  Users,
  UserCheck,
  Building2,
  GraduationCap,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Info,
  Clock,
  RefreshCw,
  CheckCheck,
  Zap,
  Activity,
  TrendingUp,
  ChevronRight,
  Megaphone,
} from 'lucide-react';
import { toastManager } from '../../../components/Toast';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
const PRIORITY_STYLES = {
  urgent: { border: 'border-l-red-500', badge: 'bg-red-100 text-red-700', icon: <AlertCircle className="w-4 h-4 text-red-500" /> },
  high:   { border: 'border-l-orange-400', badge: 'bg-orange-100 text-orange-700', icon: <AlertTriangle className="w-4 h-4 text-orange-500" /> },
  medium: { border: 'border-l-yellow-400', badge: 'bg-yellow-100 text-yellow-700', icon: <Info className="w-4 h-4 text-yellow-500" /> },
  low:    { border: 'border-l-blue-400', badge: 'bg-blue-100 text-blue-700', icon: <Info className="w-4 h-4 text-blue-400" /> },
} as const;

const ROLE_CONFIG = {
  owner:   { label: 'Owner', color: 'bg-purple-100 text-purple-700', icon: <UserCheck className="w-3.5 h-3.5" /> },
  warden:  { label: 'Warden', color: 'bg-indigo-100 text-indigo-700', icon: <ShieldAlert className="w-3.5 h-3.5" /> },
  student: { label: 'Students', color: 'bg-green-100 text-green-700', icon: <GraduationCap className="w-3.5 h-3.5" /> },
} as const;

function fmtDate(d: string) {
  return new Date(d).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Send Alert Panel
// ─────────────────────────────────────────────────────────────────────────────
function SendAlertPanel({ hostelId, onSent }: { hostelId: string; onSent: () => void }) {
  const [form, setForm] = useState({
    title: '',
    message: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    targetRoles: { owner: true, warden: true, student: true },
  });
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const handleSend = async () => {
    if (!form.title.trim() || !form.message.trim()) {
      toastManager.show('Title and message are required', 'error');
      return;
    }
    const roles = Object.entries(form.targetRoles)
      .filter(([, checked]) => checked)
      .map(([role]) => role);
    if (roles.length === 0) {
      toastManager.show('Select at least one recipient role', 'error');
      return;
    }

    setSending(true);
    setLastResult(null);
    try {
      const res = await alertApi.sendToAllRoles({
        title: form.title,
        message: form.message,
        priority: form.priority,
        hostelId,
        targetRoles: roles,
        type: 'ANNOUNCEMENT',
      });
      const msg = res.message ?? 'Alert sent successfully';
      setLastResult(msg);
      toastManager.show(msg, 'success', 5000);
      setForm({ title: '', message: '', priority: 'medium', targetRoles: { owner: true, warden: true, student: true } });
      onSent();
    } catch (e: any) {
      const errMsg = e?.response?.data?.message ?? e.message ?? 'Failed to send alert';
      toastManager.show(errMsg, 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-5">
        <h2 className="text-white font-bold text-lg flex items-center gap-2">
          <Megaphone className="w-5 h-5" />
          Send Alert to All Roles
        </h2>
        <p className="text-indigo-200 text-sm mt-0.5">
          Deliver an instant notification to owner, warden &amp; students simultaneously
        </p>
      </div>

      <div className="p-5 space-y-4">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Alert Title *</label>
          <input
            type="text"
            placeholder="e.g. Hostel Meeting Tomorrow at 6 PM"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            maxLength={120}
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
          />
        </div>

        {/* Message */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Message *</label>
          <textarea
            placeholder="Write the full notification message here..."
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            rows={4}
            maxLength={500}
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none transition"
          />
          <p className="text-right text-xs text-gray-400 mt-0.5">{form.message.length}/500</p>
        </div>

        {/* Priority + Target Roles in a row */}
        <div className="grid grid-cols-2 gap-4">
          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Priority</label>
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value as any })}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="low">🔵 Low</option>
              <option value="medium">🟡 Medium</option>
              <option value="high">🟠 High</option>
              <option value="urgent">🔴 Urgent</option>
            </select>
          </div>

          {/* Target Roles */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Send To</label>
            <div className="flex flex-col gap-1.5">
              {(['owner', 'warden', 'student'] as const).map((role) => {
                const cfg = ROLE_CONFIG[role];
                return (
                  <label key={role} className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={form.targetRoles[role]}
                      onChange={(e) => setForm({
                        ...form,
                        targetRoles: { ...form.targetRoles, [role]: e.target.checked },
                      })}
                      className="w-4 h-4 rounded accent-indigo-600"
                    />
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                      {cfg.icon} {cfg.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Success result */}
        {lastResult && (
          <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl border border-green-200 text-sm text-green-700">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            {lastResult}
          </div>
        )}

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={sending}
          className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold text-sm hover:opacity-90 transition disabled:opacity-60 shadow-md"
        >
          {sending
            ? <><RefreshCw className="w-4 h-4 animate-spin" /> Sending…</>
            : <><Send className="w-4 h-4" /> Send Alert Now</>}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function OwnerAlertsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { connected, setUnreadCount } = useAlertSocket();

  const [alerts, setAlerts] = useState<AlertNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [markingAll, setMarkingAll] = useState(false);
  const [filter, setFilter] = useState({ priority: '', category: '' });
  const [hostels, setHostels] = useState<any[]>([]);
  const [selectedHostelId, setSelectedHostelId] = useState<string>('');

  useEffect(() => {
    async function fetchHostels() {
      try {
        const res = await api.getHostels();
        const list = Array.isArray(res) ? res : res?.data || [];
        setHostels(list);
        if (list.length > 0 && !selectedHostelId) {
          setSelectedHostelId(list[0]._id);
        }
      } catch (err) {
        console.error('Failed to fetch owner hostels:', err);
      }
    }
    fetchHostels();
  }, []);

  const effectiveHostelId = selectedHostelId || (user as any)?.selectedHostelId || (user?.hostelId as string | undefined);

  useEffect(() => {
    if (!user) { router.replace('/login'); return; }
    const role = Array.isArray(user.role) ? user.role[0] : user.role;
    if (role !== 'owner' && role !== 'superadmin') { router.replace('/login'); return; }
    loadAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, page, filter, effectiveHostelId]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [alertsRes, statsRes, countRes] = await Promise.allSettled([
        alertApi.getAlertNotifications({
          hostelId: effectiveHostelId || undefined,
          page,
          limit: 15,
          priority: filter.priority || undefined,
          category: filter.category || undefined,
        }),
        effectiveHostelId ? alertApi.getDashboardStats(effectiveHostelId) : Promise.resolve(null),
        alertApi.getUnreadCount(effectiveHostelId || undefined),
      ]);

      if (alertsRes.status === 'fulfilled') {
        setAlerts(alertsRes.value?.data?.alerts ?? alertsRes.value?.data ?? []);
        setTotalPages(alertsRes.value?.data?.totalPages ?? alertsRes.value?.totalPages ?? 1);
      }
      if (statsRes.status === 'fulfilled') setStats(statsRes.value?.data ?? statsRes.value);
      if (countRes.status === 'fulfilled') setUnreadCount(countRes.value?.data?.count ?? countRes.value?.count ?? 0);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [effectiveHostelId, page, filter, setUnreadCount]);

  const markAllRead = async () => {
    setMarkingAll(true);
    try { await alertApi.markAllRead(effectiveHostelId || undefined); await loadAll(); }
    catch (e) { console.error(e); }
    finally { setMarkingAll(false); }
  };

  const resolveAlert = async (id: string) => {
    try { await alertApi.resolveAlert(id); setAlerts((p) => p.filter((a) => a._id !== id)); }
    catch (e) { console.error(e); }
  };

  const unreadLocal = alerts.filter((a) => {
    const readBy = (a as any).readBy ?? [];
    return !readBy.some((r: any) => r.userId === user?.id);
  }).length;

  return (
    <OwnerLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/20 to-purple-50/10 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">

          {/* ── Header ─────────────────────────────────────────────── */}
          <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg">
                  <Megaphone className="w-5 h-5 text-white" />
                </div>
                Alert Centre
              </h1>
              <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                Send &amp; monitor alerts across all roles
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                  {connected ? 'Live' : 'Offline'}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {hostels.length > 0 && (
                <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm text-sm">
                  <Building2 className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                  <select
                    value={selectedHostelId}
                    onChange={(e) => setSelectedHostelId(e.target.value)}
                    className="bg-transparent border-none text-gray-800 text-sm font-medium focus:ring-0 focus:outline-none cursor-pointer pr-2"
                  >
                    <option value="">All Hostels</option>
                    {hostels.map((h) => (
                      <option key={h._id} value={h._id}>{h.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <button onClick={loadAll} disabled={loading} className="flex items-center gap-2 px-3 py-2 text-sm bg-white text-gray-600 rounded-lg border border-gray-200 hover:bg-gray-50 shadow-sm transition">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              {unreadLocal > 0 && (
                <button onClick={markAllRead} disabled={markingAll} className="flex items-center gap-2 px-3 py-2 text-sm text-indigo-600 bg-indigo-50 rounded-lg border border-indigo-200 hover:bg-indigo-100 font-medium transition">
                  <CheckCheck className="w-4 h-4" />
                  {markingAll ? 'Marking…' : 'Mark all read'}
                </button>
              )}
            </div>
          </div>

          {/* ── Stat Cards ─────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Alerts', value: stats?.totalAlerts ?? alerts.length, icon: Bell, color: 'bg-indigo-500' },
              { label: 'Unread', value: stats?.unreadAlerts ?? unreadLocal, icon: TrendingUp, color: 'bg-orange-500' },
              { label: 'Curfew Violations', value: stats?.activeCurfewViolations ?? '—', icon: ShieldAlert, color: 'bg-red-500' },
              { label: 'Leave Violations', value: stats?.activeLeaveViolations ?? '—', icon: Activity, color: 'bg-purple-500' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center flex-shrink-0`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{value}</p>
                  <p className="text-sm text-gray-500">{label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Two-column layout ──────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

            {/* Left: Send panel (2/5) */}
            <div className="lg:col-span-2">
              {effectiveHostelId ? (
                <SendAlertPanel hostelId={effectiveHostelId} onSent={loadAll} />
              ) : (
                <div className="bg-white rounded-2xl border border-yellow-200 p-6 text-center">
                  <AlertTriangle className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Select a hostel above to send custom announcements</p>
                </div>
              )}

              {/* Occupancy */}
              {stats?.currentOccupancy && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mt-5">
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4 text-indigo-500" /> Live Occupancy
                  </h3>
                  <div className="relative w-full h-2.5 bg-gray-100 rounded-full overflow-hidden mb-1">
                    <div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, stats.currentOccupancy.percentage ?? 0)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    {stats.currentOccupancy.inside} inside / {stats.currentOccupancy.total} total ({(stats.currentOccupancy.percentage ?? 0).toFixed(1)}%)
                  </p>
                </div>
              )}
            </div>

            {/* Right: Alert feed (3/5) */}
            <div className="lg:col-span-3">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                {/* Toolbar */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100 flex-wrap gap-3">
                  <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                    <Bell className="w-4 h-4 text-indigo-500" />
                    Alert Feed
                    {unreadLocal > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-xs font-bold">{unreadLocal}</span>
                    )}
                  </h2>
                  <div className="flex items-center gap-2">
                    <select
                      value={filter.priority}
                      onChange={(e) => { setPage(1); setFilter({ ...filter, priority: e.target.value }); }}
                      className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none"
                    >
                      <option value="">All Priorities</option>
                      <option value="urgent">🔴 Urgent</option>
                      <option value="high">🟠 High</option>
                      <option value="medium">🟡 Medium</option>
                      <option value="low">🔵 Low</option>
                    </select>
                    <select
                      value={filter.category}
                      onChange={(e) => { setPage(1); setFilter({ ...filter, category: e.target.value }); }}
                      className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none"
                    >
                      <option value="">All Categories</option>
                      <option value="curfew">Curfew</option>
                      <option value="leave">Leave</option>
                      <option value="attendance">Attendance</option>
                      <option value="emergency">Emergency</option>
                      <option value="announcement">Announcement</option>
                    </select>
                  </div>
                </div>

                {/* Alert list */}
                <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
                  {loading ? (
                    [...Array(5)].map((_, i) => (
                      <div key={i} className="h-20 bg-gray-50 animate-pulse m-3 rounded-xl" />
                    ))
                  ) : alerts.length === 0 ? (
                    <div className="flex flex-col items-center py-16">
                      <Bell className="w-12 h-12 text-gray-200 mb-3" />
                      <p className="text-gray-500 text-sm">No alerts yet</p>
                    </div>
                  ) : (
                    alerts.map((alert) => {
                      const ps = PRIORITY_STYLES[alert.priority] ?? PRIORITY_STYLES.low;
                      const isUnread = !((alert as any).readBy ?? []).some((r: any) => r.userId === user?.id);
                      return (
                        <div
                          key={alert._id}
                          className={`flex items-start gap-3 p-4 border-l-4 ${ps.border} hover:bg-gray-50/50 transition-colors ${isUnread ? 'bg-indigo-50/30' : ''}`}
                        >
                          <div className="mt-0.5 flex-shrink-0">{ps.icon}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                              <p className="text-sm font-semibold text-gray-900 truncate">{alert.title}</p>
                              <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${ps.badge}`}>{alert.priority}</span>
                              {isUnread && <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-indigo-600 text-white">NEW</span>}
                            </div>
                            <p className="text-xs text-gray-600 mb-1 line-clamp-2">{alert.message}</p>
                            <p className="text-xs text-gray-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {fmtDate(alert.createdAt)}
                            </p>
                          </div>
                          {alert.status === 'active' && (
                            <button
                              onClick={() => resolveAlert(alert._id)}
                              className="flex-shrink-0 p-1.5 rounded-lg hover:bg-green-100 text-green-600 transition"
                              title="Resolve"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 p-4 border-t border-gray-100">
                    <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50 disabled:opacity-40">← Prev</button>
                    <span className="text-xs text-gray-500">Page {page} / {totalPages}</span>
                    <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50 disabled:opacity-40">Next →</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </OwnerLayout>
  );
}
