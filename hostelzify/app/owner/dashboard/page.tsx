'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, isOwnerUser } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import Link from 'next/link';
import {
  Users,
  Home,
  DollarSign,
  TrendingUp,
  AlertCircle,
  BarChart3,
  Calendar,
  CreditCard,
  Building2,
  MessageSquare,
  MapPin,
  User,
  ChevronRight,
  ExternalLink,
  UtensilsCrossed,
  Star,
} from 'lucide-react';

function formatViolationType(type: string) {
  const labels: Record<string, string> = {
    'improper-checkout': 'Left without checking out',
    'curfew': 'Curfew breach',
    'late-entry': 'Late entry',
    'unauthorized-visitor': 'Unauthorized visitor',
    'noise': 'Noise',
    'damage': 'Damage',
    'other': 'Other',
  };
  return labels[type] || type?.replace(/-/g, ' ') || 'Violation';
}

function formatViolationDate(date: string | Date) {
  if (!date) return '—';
  const d = new Date(date);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getStudentId(v: any): string | null {
  if (!v?.studentId) return null;
  return typeof v.studentId === 'object' ? v.studentId._id : v.studentId;
}

function getStudentName(v: any): string {
  if (!v?.studentId) return 'Unknown';
  return typeof v.studentId === 'object' ? v.studentId.name : 'Student';
}

/** Deduplicate violations: one entry per (student, type) — keep only the most recent. */
function dedupeViolations(violations: any[]): any[] {
  const byKey = new Map<string, any>();
  const sorted = [...violations].sort((a, b) => {
    const ta = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });
  for (const v of sorted) {
    const studentId = getStudentId(v) ?? '';
    const type = v?.violationType ?? '';
    const key = `${studentId}|${type}`;
    if (!byKey.has(key)) byKey.set(key, v);
  }
  return Array.from(byKey.values()).sort((a, b) => {
    const ta = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });
}

export default function OwnerDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [kpis, setKpis] = useState<any>(null);
  const [occupancy, setOccupancy] = useState<any>(null);
  const [financial, setFinancial] = useState<any>(null);
  const [recentViolations, setRecentViolations] = useState<any[]>([]);
  const [messFeedback, setMessFeedback] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || !isOwnerUser(user)) {
      router.replace('/login');
      return;
    }
    loadDashboardData();
  }, [user, router]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [kpisRes, occupancyRes, financialRes, violationsRes] = await Promise.all([
        api.getDashboardKPIs().catch(() => ({ data: null })),
        api.getOccupancyReport().catch(() => ({ data: null })),
        api.getFinancialReport().catch(() => ({ data: null })),
        api.getRecentViolations().catch(() => ({ data: [] })),
      ]);
      setKpis(kpisRes?.data ?? kpisRes ?? null);
      setOccupancy(occupancyRes?.data ?? occupancyRes ?? null);
      setFinancial(financialRes?.data ?? financialRes ?? null);
      const raw = Array.isArray(violationsRes?.data) ? violationsRes.data : [];
      setRecentViolations(dedupeViolations(raw));
      const feedbackRes = await api.getMessFeedback(undefined, 10).catch(() => []);
      setMessFeedback(Array.isArray(feedbackRes) ? feedbackRes : []);
    } catch (error: any) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    {
      label: 'Check Attendance',
      href: '/owner/attendance',
      icon: MapPin,
      color: 'bg-teal-100 text-teal-600',
    },
    {
      label: 'Manage Hostels',
      href: '/owner/hostels',
      icon: Building2,
      color: 'bg-blue-100 text-blue-600',
    },
    {
      label: 'Rooms',
      href: '/owner/rooms',
      icon: Home,
      color: 'bg-green-100 text-green-600',
    },
    {
      label: 'Students',
      href: '/owner/students/presence',
      icon: Users,
      color: 'bg-purple-100 text-purple-600',
    },
    {
      label: 'Payments',
      href: '/owner/payments',
      icon: CreditCard,
      color: 'bg-emerald-100 text-emerald-600',
    },
    {
      label: 'Broadcast',
      href: '/owner/broadcast',
      icon: MessageSquare,
      color: 'bg-indigo-100 text-indigo-600',
    },
    {
      label: 'Analytics',
      href: '/owner/analytics',
      icon: BarChart3,
      color: 'bg-orange-100 text-orange-600',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
        <div className="p-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-600 mt-1">Welcome back, {user?.name || 'Owner'}</p>
          </div>

          {/* Analytics Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* KPIs Cards */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                  <h2 className="text-lg font-semibold text-gray-900">Key Metrics</h2>
                </div>
                {kpis ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="w-4 h-4 text-blue-600" />
                        <span className="text-xs font-medium text-blue-700">Total Students</span>
                      </div>
                      <div className="text-2xl font-bold text-gray-900">{kpis.totalStudents || 0}</div>
                      {kpis.activeStudents !== undefined && (
                        <div className="text-xs text-gray-600 mt-1">{kpis.activeStudents} active</div>
                      )}
                    </div>
                    <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Home className="w-4 h-4 text-green-600" />
                        <span className="text-xs font-medium text-green-700">Occupancy</span>
                      </div>
                      <div className="text-2xl font-bold text-gray-900">
                        {kpis.totalOccupied !== undefined ? kpis.totalOccupied : kpis.occupiedRooms || 0}
                        {kpis.totalCapacity !== undefined && (
                          <span className="text-sm font-normal text-gray-600"> / {kpis.totalCapacity}</span>
                        )}
                      </div>
                      {kpis.overallOccupancyRate !== undefined && (
                        <div className="text-xs text-gray-600 mt-1">
                          {kpis.overallOccupancyRate}% occupied
                        </div>
                      )}
                      {kpis.partiallyOccupiedRooms !== undefined && kpis.partiallyOccupiedRooms > 0 && (
                        <div className="text-xs text-orange-600 mt-1">
                          {kpis.partiallyOccupiedRooms} partial
                        </div>
                      )}
                    </div>
                    <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="w-4 h-4 text-purple-600" />
                        <span className="text-xs font-medium text-purple-700">Revenue</span>
                      </div>
                      <div className="text-2xl font-bold text-gray-900">
                        ₹{kpis.totalRevenue?.toLocaleString() || 0}
                      </div>
                      {kpis.pendingPayments !== undefined && kpis.pendingPayments > 0 && (
                        <div className="text-xs text-gray-600 mt-1">{kpis.pendingPayments} due</div>
                      )}
                    </div>
                    <div className="p-4 bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg border border-amber-200">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        <span className="text-xs font-medium text-amber-700">Violations</span>
                      </div>
                      <div className="text-2xl font-bold text-gray-900">{kpis.totalViolations || 0}</div>
                      {kpis.pendingViolations !== undefined && kpis.pendingViolations > 0 && (
                        <div className="text-xs text-gray-600 mt-1">{kpis.pendingViolations} to review</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">Loading metrics...</div>
                )}

              {/* Occupancy Analytics */}
              {(occupancy || kpis) && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    <h2 className="text-lg font-semibold text-gray-900">Occupancy Overview</h2>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <div className="text-sm text-gray-600">Total Rooms</div>
                      <div className="text-xl font-bold text-gray-900 mt-1">
                        {occupancy?.totalRooms || kpis?.totalRooms || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Fully Occupied</div>
                      <div className="text-xl font-bold text-green-600 mt-1">
                        {kpis?.fullyOccupiedRooms || occupancy?.occupiedRooms || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Partially Occupied</div>
                      <div className="text-xl font-bold text-orange-600 mt-1">
                        {kpis?.partiallyOccupiedRooms || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Available</div>
                      <div className="text-xl font-bold text-blue-600 mt-1">
                        {kpis?.emptyRooms || occupancy?.availableRooms || 0}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200">
                    <div>
                      <div className="text-sm text-gray-600">Total Capacity</div>
                      <div className="text-lg font-bold text-gray-900 mt-1">
                        {kpis?.totalCapacity || 0} beds
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Occupied Beds</div>
                      <div className="text-lg font-bold text-green-600 mt-1">
                        {kpis?.totalOccupied || 0} beds
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Overall Occupancy</div>
                      <div className="text-lg font-bold text-purple-600 mt-1">
                        {kpis?.overallOccupancyRate || occupancy?.occupancyRate || 0}%
                      </div>
                    </div>
                  </div>
                  {occupancy.byCategory && Object.keys(occupancy.byCategory).length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="text-sm font-medium text-gray-700 mb-2">By Category</div>
                      <div className="space-y-2">
                        {Object.entries(occupancy.byCategory).map(([category, data]: [string, any]) => (
                          <div key={category} className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">{category}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-gray-900">
                                {data.occupied || 0}/{data.total || 0}
                              </span>
                              <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-blue-600"
                                  style={{
                                    width: `${data.total > 0 ? (data.occupied / data.total) * 100 : 0}%`,
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {/* Recent violations: top 3, deduped; link to all violations */}
              {kpis && recentViolations.length > 0 && (
                <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50/50">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-amber-600" />
                      <h2 className="text-lg font-semibold text-gray-900">Recent Violations</h2>
                    </div>
                    <div className="flex items-center gap-3">
                      <Link
                        href="/owner/analytics"
                        className="text-sm font-medium text-gray-600 hover:text-gray-800 flex items-center gap-1"
                      >
                        View analytics
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                      <Link
                        href="/owner/violations"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
                      >
                        All violations
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                  <ul className="divide-y divide-gray-200">
                    {recentViolations.slice(0, 3).map((v: any) => {
                      const studentId = getStudentId(v);
                      const studentName = getStudentName(v);
                      const description = v.description?.trim() || '—';
                      const content = (
                        <>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                                {formatViolationType(v.violationType)}
                              </span>
                              <span className="text-xs text-gray-500">
                                {formatViolationDate(v.createdAt)}
                              </span>
                            </div>
                            {description && description !== '—' && (
                              <p className="text-sm text-gray-600 mt-1 line-clamp-2">{description}</p>
                            )}
                            <div className="mt-2 flex items-center gap-2 text-sm">
                              <User className="w-4 h-4 text-gray-400 shrink-0" />
                              <span className={`font-medium truncate ${studentId ? 'text-gray-900 group-hover:text-blue-600' : 'text-gray-700'}`}>
                                {studentName}
                              </span>
                              {studentId && (
                                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 shrink-0" />
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {studentId && (
                              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded border border-blue-200">
                                View student
                              </span>
                            )}
                          </div>
                        </>
                      );
                      return (
                        <li key={v._id}>
                          {studentId ? (
                            <Link
                              href={`/owner/students/${studentId}`}
                              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 hover:bg-gray-50 transition-colors group"
                            >
                              {content}
                            </Link>
                          ) : (
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4">
                              {content}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {recentViolations.length > 3 && (
                    <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex justify-center">
                      <Link
                        href="/owner/violations"
                        className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                      >
                        View all {recentViolations.length} violations
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {/* Mess feedback from students */}
              {messFeedback.length > 0 && (
                <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-orange-50/50">
                    <div className="flex items-center gap-2">
                      <UtensilsCrossed className="w-5 h-5 text-orange-600" />
                      <h2 className="text-lg font-semibold text-gray-900">Mess Feedback</h2>
                    </div>
                    <Link
                      href="/owner/mess-feedback"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-orange-100 text-orange-800 border border-orange-200 hover:bg-orange-200 transition-colors"
                    >
                      View all
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                  <ul className="divide-y divide-gray-200">
                    {messFeedback.slice(0, 5).map((f: any) => {
                      const studentName = f.raisedBy?.name ?? 'Student';
                      const dateStr = f.createdAt
                        ? new Date(f.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : '—';
                      const meal = f.mealType || (f.title && f.title.replace('Mess Feedback (', '').replace(')', '')) || '—';
                      return (
                        <li key={f._id} className="p-4 hover:bg-gray-50">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                {f.rating != null && (
                                  <span className="inline-flex items-center gap-0.5 text-amber-600">
                                    {[1, 2, 3, 4, 5].map((i) => (
                                      <Star key={i} className={`w-4 h-4 ${i <= f.rating ? 'fill-current' : 'opacity-30'}`} />
                                    ))}
                                  </span>
                                )}
                                <span className="text-xs text-gray-500">{dateStr}</span>
                                {meal && meal !== '—' && (
                                  <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">{meal}</span>
                                )}
                              </div>
                              {f.description && f.description !== 'No comment' && (
                                <p className="text-sm text-gray-600 mt-1 line-clamp-2">{f.description}</p>
                              )}
                              <div className="mt-2 flex items-center gap-2 text-sm">
                                <User className="w-4 h-4 text-gray-400 shrink-0" />
                                <span className="font-medium text-gray-900">{studentName}</span>
                              </div>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  {messFeedback.length > 5 && (
                    <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex justify-center">
                      <Link href="/owner/mess-feedback" className="text-sm font-medium text-orange-600 hover:text-orange-700 flex items-center gap-1">
                        View all {messFeedback.length} feedback entries
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  )}
                </div>
              )}
              </div>
            </div>

            {/* Quick Actions Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-sm p-6 sticky top-6">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
                </div>
                <div className="space-y-2">
                  {quickActions.map((action, index) => {
                    const IconComponent = action.icon;
                    return (
                      <Link
                        key={index}
                        href={action.href}
                        className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-blue-300 transition-all group"
                      >
                        <div className={`p-2 rounded-lg ${action.color}`}>
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <span className="font-medium text-gray-900 flex-1">{action.label}</span>
                        <span className="text-gray-400 group-hover:text-blue-600">→</span>
                      </Link>
                    );
                  })}
                </div>
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <Link
                    href="/owner/analytics"
                    className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    <BarChart3 className="w-4 h-4" />
                    View Full Analytics
                  </Link>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
  );
}
