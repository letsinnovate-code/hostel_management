'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import { alertApi, AlertNotification } from '../../../services/alertApi';
import { useAlertSocket } from '../../../contexts/AlertSocketContext';
import StudentLayout from '../../../components/StudentLayout';
import {
  Bell,
  BellOff,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Info,
  Clock,
  Filter,
  RefreshCw,
  CheckCheck,
  Shield,
  LogIn,
  FileText,
  Zap,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const PRIORITY_CONFIG = {
  urgent: {
    border: 'border-l-red-500',
    badge: 'bg-red-100 text-red-700 ring-1 ring-red-300',
    icon: <AlertCircle className="w-5 h-5 text-red-500" />,
  },
  high: {
    border: 'border-l-orange-400',
    badge: 'bg-orange-100 text-orange-700 ring-1 ring-orange-300',
    icon: <AlertTriangle className="w-5 h-5 text-orange-500" />,
  },
  medium: {
    border: 'border-l-yellow-400',
    badge: 'bg-yellow-100 text-yellow-700 ring-1 ring-yellow-300',
    icon: <Info className="w-5 h-5 text-yellow-500" />,
  },
  low: {
    border: 'border-l-blue-400',
    badge: 'bg-blue-100 text-blue-700 ring-1 ring-blue-300',
    icon: <Info className="w-5 h-5 text-blue-500" />,
  },
} as const;

const TYPE_ICON: Record<string, React.ReactElement> = {
  CURFEW_VIOLATION: <Shield className="w-4 h-4" />,
  LEAVE_APPROVED: <CheckCircle className="w-4 h-4 text-green-600" />,
  LEAVE_REJECTED: <AlertCircle className="w-4 h-4 text-red-500" />,
  LEAVE_REQUESTED: <FileText className="w-4 h-4 text-blue-500" />,
  CHECKIN: <LogIn className="w-4 h-4 text-green-500" />,
  CHECKOUT: <LogIn className="w-4 h-4 text-orange-500 rotate-180" />,
  EMERGENCY: <Zap className="w-4 h-4 text-red-600" />,
};

function fmtDate(d: string) {
  return new Date(d).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function StudentAlertsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { setUnreadCount, decrementUnread } = useAlertSocket();

  const [alerts, setAlerts] = useState<AlertNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState({ priority: '', category: '', status: '' });

  useEffect(() => {
    if (!user || user.role !== 'student') { router.replace('/login'); return; }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, page, filter]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await alertApi.getAlertNotifications({
        page,
        limit: 15,
        priority: filter.priority || undefined,
        category: filter.category || undefined,
        status: filter.status || undefined,
      });
      setAlerts(res.data?.alerts ?? res.data ?? []);
      const total = res.data?.totalPages ?? res.totalPages ?? 1;
      setTotalPages(total);
      // Sync badge from server
      const countRes = await alertApi.getUnreadCount(user?.hostelId);
      setUnreadCount(countRes?.data?.count ?? countRes?.count ?? 0);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page, filter, user?.hostelId, setUnreadCount]);

  const markRead = async (id: string) => {
    try {
      await alertApi.markNotificationRead(id);
      setAlerts((prev) =>
        prev.map((a) => a._id === id ? { ...a, status: 'resolved' as const } : a)
      );
      decrementUnread();
    } catch (e) { console.error(e); }
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await alertApi.markAllRead(user?.hostelId);
      await load();
    } catch (e) { console.error(e); }
    finally { setMarkingAll(false); }
  };

  const isUnread = (alert: AlertNotification) => {
    const readBy = alert.readBy ?? [];
    return !readBy.some((r) => r.userId === user?.id);
  };

  const unreadLocal = alerts.filter(isUnread).length;

  return (
    <StudentLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
        <div className="max-w-4xl mx-auto px-4 py-8">

          {/* ── Header ──────────────────────────────────────────── */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg">
                  <Bell className="w-5 h-5 text-white" />
                </div>
                My Alerts
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Real-time notifications from hostel automation
                {unreadLocal > 0 && (
                  <span className="ml-2 px-2.5 py-0.5 rounded-full bg-red-500 text-white text-xs font-semibold">
                    {unreadLocal} unread
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={load}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors shadow-sm"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              {unreadLocal > 0 && (
                <button
                  onClick={markAllRead}
                  disabled={markingAll}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-indigo-600 bg-indigo-50 rounded-lg border border-indigo-200 hover:bg-indigo-100 transition-colors font-medium"
                >
                  <CheckCheck className="w-4 h-4" />
                  {markingAll ? 'Marking…' : 'Mark all read'}
                </button>
              )}
            </div>
          </div>

          {/* ── Filters ─────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6 flex flex-wrap gap-3 items-center">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filter.priority}
              onChange={(e) => { setPage(1); setFilter({ ...filter, priority: e.target.value }); }}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
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
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Categories</option>
              <option value="curfew">Curfew</option>
              <option value="leave">Leave</option>
              <option value="attendance">Attendance</option>
              <option value="emergency">Emergency</option>
              <option value="gate">Gate</option>
            </select>
            <select
              value={filter.status}
              onChange={(e) => { setPage(1); setFilter({ ...filter, status: e.target.value }); }}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All</option>
              <option value="active">Unresolved</option>
              <option value="resolved">Resolved</option>
            </select>
            {(filter.priority || filter.category || filter.status) && (
              <button
                onClick={() => { setPage(1); setFilter({ priority: '', category: '', status: '' }); }}
                className="text-xs text-gray-500 underline hover:text-gray-700"
              >
                Clear
              </button>
            )}
          </div>

          {/* ── Alert list ──────────────────────────────────────── */}
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl h-24 animate-pulse border border-gray-100" />
              ))}
            </div>
          ) : alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <BellOff className="w-10 h-10 text-gray-300" />
              </div>
              <p className="text-lg font-semibold text-gray-700">No alerts found</p>
              <p className="text-sm text-gray-400 mt-1">You're all caught up! 🎉</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => {
                const unread = isUnread(alert);
                const pc = PRIORITY_CONFIG[alert.priority] ?? PRIORITY_CONFIG.low;
                return (
                  <div
                    key={alert._id}
                    className={`bg-white rounded-2xl border border-gray-100 border-l-4 ${pc.border} shadow-sm hover:shadow-md transition-all duration-200 p-5 ${unread ? 'ring-1 ring-indigo-100' : 'opacity-90'}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {/* Icon */}
                        <div className="mt-0.5 flex-shrink-0">
                          {pc.icon}
                        </div>
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center flex-wrap gap-2 mb-1">
                            <h3 className={`text-base font-semibold text-gray-900 ${unread ? '' : 'text-gray-600'}`}>
                              {alert.title}
                            </h3>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${pc.badge}`}>
                              {alert.priority}
                            </span>
                            {alert.type && TYPE_ICON[alert.type] && (
                              <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                {TYPE_ICON[alert.type]}
                                {alert.type.replace(/_/g, ' ')}
                              </span>
                            )}
                            {unread && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-600 text-white">
                                NEW
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 leading-relaxed mb-2">
                            {alert.message}
                          </p>
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <Clock className="w-3 h-3" />
                            {fmtDate(alert.createdAt)}
                          </div>
                        </div>
                      </div>
                      {/* Action */}
                      {unread && (
                        <button
                          onClick={() => markRead(alert._id)}
                          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs text-indigo-600 bg-indigo-50 rounded-lg border border-indigo-200 hover:bg-indigo-100 transition-colors font-medium"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Pagination ──────────────────────────────────────── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Prev
              </button>
              <span className="text-sm text-gray-600 px-4">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          )}

        </div>
      </div>
    </StudentLayout>
  );
}
