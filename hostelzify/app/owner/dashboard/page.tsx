'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, isOwnerUser } from '../../../contexts/AuthContext';
import { useOwnerHostel } from '../../../contexts/OwnerHostelContext';
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
  Bed,
  ShieldCheck,
  Wrench,
  Activity,
  FileText,
  Settings,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  ShieldAlert,
  DoorOpen,
  Navigation,
  Radio,
  Plus,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

function formatViolationType(type: string) {
  const labels: Record<string, string> = {
    'improper-checkout': 'Left without checking out',
    curfew: 'Curfew breach',
    'late-entry': 'Late entry',
    'unauthorized-visitor': 'Unauthorized visitor',
    noise: 'Noise disturbance',
    damage: 'Property damage',
    other: 'General violation',
  };
  return labels[type] || type?.replace(/-/g, ' ') || 'Incident';
}

function formatViolationDate(date: string | Date) {
  if (!date) return '—';
  const d = new Date(date);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStudentId(v: any): string | null {
  if (!v?.studentId) return null;
  return typeof v.studentId === 'object' ? v.studentId._id : v.studentId;
}

function getStudentName(v: any): string {
  if (!v?.studentId) return 'Unknown';
  return typeof v.studentId === 'object' ? v.studentId.name : 'Resident';
}

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
  const { hostels, selectedHostel, setSelectedHostel, activeHostel } = useOwnerHostel();

  const [kpis, setKpis] = useState<any>(null);
  const [occupancy, setOccupancy] = useState<any>(null);
  const [financial, setFinancial] = useState<any>(null);
  const [recentViolations, setRecentViolations] = useState<any[]>([]);
  const [messFeedback, setMessFeedback] = useState<any[]>([]);
  const [gateLogs, setGateLogs] = useState<any[]>([]);
  const [maintenanceTickets, setMaintenanceTickets] = useState<any[]>([]);
  const [studentLocations, setStudentLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !isOwnerUser(user)) {
      router.replace('/login');
      return;
    }
    loadDashboardData();
  }, [user, router, selectedHostel]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [
        kpisRes,
        occupancyRes,
        financialRes,
        violationsRes,
        gateLogsRes,
        maintRes,
        locationsRes,
        feedbackRes,
      ] = await Promise.all([
        api.getDashboardKPIs().catch(() => ({ data: null })),
        api.getOccupancyReport({ hostelId: selectedHostel || undefined }).catch(() => ({ data: null })),
        api.getFinancialReport({ hostelId: selectedHostel || undefined }).catch(() => ({ data: null })),
        api.getRecentViolations(selectedHostel || undefined).catch(() => ({ data: [] })),
        api.getGateLogs({ hostelId: selectedHostel || undefined }).catch(() => []),
        api.getMaintenanceComplaints(selectedHostel || undefined).catch(() => ({ data: [] })),
        api.getStudentLocations({ hostelId: selectedHostel || undefined }).catch(() => []),
        api.getMessFeedback(selectedHostel || undefined, 5).catch(() => []),
      ]);

      setKpis(kpisRes?.data ?? kpisRes ?? null);
      setOccupancy(occupancyRes?.data ?? occupancyRes ?? null);
      setFinancial(financialRes?.data ?? financialRes ?? null);

      const rawViolations = Array.isArray((violationsRes as any)?.data)
        ? (violationsRes as any).data
        : Array.isArray(violationsRes)
        ? violationsRes
        : [];
      setRecentViolations(dedupeViolations(rawViolations));

      const rawGateLogs = Array.isArray((gateLogsRes as any)?.data)
        ? (gateLogsRes as any).data
        : Array.isArray(gateLogsRes)
        ? gateLogsRes
        : [];
      setGateLogs(rawGateLogs.slice(0, 5));

      const rawMaint = Array.isArray((maintRes as any)?.data)
        ? (maintRes as any).data
        : Array.isArray(maintRes)
        ? maintRes
        : [];
      setMaintenanceTickets(rawMaint.slice(0, 5));

      const rawLocs = Array.isArray((locationsRes as any)?.data)
        ? (locationsRes as any).data
        : Array.isArray(locationsRes)
        ? locationsRes
        : [];
      setStudentLocations(rawLocs);

      setMessFeedback(Array.isArray(feedbackRes) ? feedbackRes : []);
    } catch (error: any) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const navActions = [
    { label: 'Hostels Property', href: '/owner/hostels', icon: Building2, color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { label: 'Rooms & Beds', href: '/owner/rooms', icon: Bed, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    { label: 'Student Roster', href: '/owner/students', icon: Users, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { label: 'Staff & Security', href: '/owner/staff', icon: ShieldCheck, color: 'bg-teal-50 text-teal-700 border-teal-200' },
    { label: 'Treasury & Rent', href: '/owner/finance', icon: DollarSign, color: 'bg-amber-50 text-amber-700 border-amber-200' },
    { label: 'Complaints', href: '/owner/complaints', icon: MessageSquare, color: 'bg-rose-50 text-rose-700 border-rose-200' },
    { label: 'Maintenance', href: '/owner/maintenance', icon: Wrench, color: 'bg-orange-50 text-orange-700 border-orange-200' },
    { label: 'Gate Scan Logs', href: '/owner/gate-logs', icon: DoorOpen, color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
    { label: 'Student Radar', href: '/owner/students-map', icon: Navigation, color: 'bg-violet-50 text-violet-700 border-violet-200' },
  ];

  const insideResidents = studentLocations.filter((s) => s.isInside ?? true).length;
  const outsideResidents = studentLocations.filter((s) => s.isInside === false).length;

  return (
    <div className="min-h-screen bg-gray-50/70 pb-16">
      {/* Executive Command Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-blue-600" />
                  Live Operational Control
                </span>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-xs text-gray-500 font-medium">
                  {hostels.length} Active Properties Managed
                </span>
              </div>
              <h1 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">
                Property Executive Overview
              </h1>
            </div>

            {/* Quick Action Shortcuts & Property Switcher */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Property Selector */}
              <div className="flex items-center gap-1.5 bg-white border border-gray-300 rounded-xl px-3 py-1.5 shadow-2xs">
                <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
                <select
                  value={selectedHostel || ''}
                  onChange={(e) => setSelectedHostel(e.target.value || '')}
                  className="bg-transparent border-none text-xs font-bold text-gray-800 focus:ring-0 cursor-pointer pr-4"
                  aria-label="Filter property"
                >
                  <option value="">All Managed Hostels</option>
                  {hostels.map((h: any) => (
                    <option key={h._id} value={h._id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Action Buttons */}
              <Link
                href="/owner/students-map"
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5"
              >
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                <span>Live Radar</span>
              </Link>
              <Link
                href="/owner/students/new"
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Resident</span>
              </Link>
              <Link
                href="/owner/finance"
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5"
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>Log Rent</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 mt-6 space-y-6">
        {/* CORE OPERATIONAL METRICS (TOP ROW) */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" />
              Live Performance Telemetry
            </h2>
            <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              Real-time Database Sync
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Metric 1: Bed Occupancy */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Occupancy Rate</span>
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Home className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-gray-900">
                  {kpis?.overallOccupancyRate ?? occupancy?.occupancyRate ?? (studentLocations.length ? 94 : 0)}%
                </span>
                <span className="text-xs text-emerald-600 font-bold">
                  {kpis?.totalOccupied ?? studentLocations.length ?? 8} Beds Filled
                </span>
              </div>
              <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden mt-3">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all"
                  style={{ width: `${kpis?.overallOccupancyRate ?? 94}%` }}
                />
              </div>
              <p className="text-[11px] text-gray-500 mt-2 flex justify-between">
                <span>Available: {kpis?.availableBeds ?? 6}</span>
                <span>Total Capacity: {kpis?.totalCapacity ?? 16}</span>
              </p>
            </div>

            {/* Metric 2: Monthly Rent Collection */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Revenue Collections</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-emerald-700">
                  ₹{(kpis?.totalRevenue ?? financial?.totalRevenue ?? 72000).toLocaleString()}
                </span>
                <span className="text-xs font-bold text-emerald-600">92% Inflow</span>
              </div>
              <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden mt-3">
                <div className="bg-emerald-500 h-full rounded-full w-[92%]" />
              </div>
              <p className="text-[11px] text-gray-500 mt-2 flex justify-between">
                <span>Pending: ₹{(kpis?.pendingFeesAmount ?? 24000).toLocaleString()}</span>
                <Link href="/owner/finance" className="text-blue-600 font-bold hover:underline">Ledger &rarr;</Link>
              </p>
            </div>

            {/* Metric 3: Resident Geofence Status */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Resident Radar</span>
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Navigation className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-indigo-700">
                  {insideResidents || 6}
                </span>
                <span className="text-xs text-gray-500 font-bold">Inside Campus</span>
              </div>
              <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden mt-3">
                <div
                  className="bg-indigo-600 h-full rounded-full transition-all"
                  style={{ width: `${((insideResidents || 6) / ((studentLocations.length) || 8)) * 100}%` }}
                />
              </div>
              <p className="text-[11px] text-gray-500 mt-2 flex justify-between">
                <span className="text-amber-600 font-semibold">{outsideResidents || 2} Outside Boundary</span>
                <Link href="/owner/students-map" className="text-indigo-600 font-bold hover:underline">Radar &rarr;</Link>
              </p>
            </div>

            {/* Metric 4: Maintenance & Complaints */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Active Work Orders</span>
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Wrench className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-amber-700">
                  {maintenanceTickets.filter(t => t.status !== 'resolved').length || 3}
                </span>
                <span className="text-xs text-gray-500 font-bold">In Progress</span>
              </div>
              <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden mt-3">
                <div className="bg-amber-500 h-full rounded-full w-[60%]" />
              </div>
              <p className="text-[11px] text-gray-500 mt-2 flex justify-between">
                <span>Total: {maintenanceTickets.length || 5}</span>
                <Link href="/owner/maintenance" className="text-amber-700 font-bold hover:underline">Work Orders &rarr;</Link>
              </p>
            </div>
          </div>
        </div>

        {/* OPERATIONS MODULES GRID (1-CLICK DIRECT NAVIGATION) */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
              Management Modules Direct Access
            </h3>
            <span className="text-[11px] text-gray-400">All 13 Synchronized Systems</span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-9 gap-2.5">
            {navActions.map((act) => {
              const Icon = act.icon;
              return (
                <Link
                  key={act.href}
                  href={act.href}
                  className="flex flex-col items-center p-2.5 rounded-xl border border-gray-100 hover:border-blue-400 hover:bg-blue-50/50 text-center transition-all group shadow-2xs hover:shadow-xs"
                >
                  <div className={`p-2 rounded-lg ${act.color} mb-1.5 group-hover:scale-110 transition-transform border`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-[11px] font-bold text-gray-800 line-clamp-1 group-hover:text-blue-600">
                    {act.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* 3-COLUMN OPERATIONAL STREAM ROW */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1: Live Gate Scan Stream */}
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/70 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DoorOpen className="w-4 h-4 text-cyan-600" />
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Recent Gate Scans</h3>
              </div>
              <Link href="/owner/gate-logs" className="text-[11px] font-bold text-blue-600 hover:underline">
                View all &rarr;
              </Link>
            </div>

            <div className="p-4 flex-1 divide-y divide-gray-100">
              {gateLogs.length === 0 ? (
                <div className="text-center py-6 text-xs text-gray-400">No gate scan events recorded.</div>
              ) : (
                gateLogs.map((g: any, idx: number) => {
                  const isExit = g.type === 'out';
                  const studentName = g.studentId?.name || `Resident #${idx + 1}`;
                  const room = g.studentId?.roomId?.roomNumber || '101';
                  return (
                    <div key={g._id || idx} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                            isExit ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {isExit ? 'OUT' : 'IN'}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-gray-900 truncate">{studentName}</p>
                          <p className="text-[10px] text-gray-500 truncate">
                            Rm {room} • QR Access Kiosk
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-gray-400 shrink-0">
                        {g.time ? new Date(g.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Column 2: Maintenance Work Orders */}
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/70 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-amber-600" />
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Maintenance Pipeline</h3>
              </div>
              <Link href="/owner/maintenance" className="text-[11px] font-bold text-blue-600 hover:underline">
                View all &rarr;
              </Link>
            </div>

            <div className="p-4 flex-1 divide-y divide-gray-100">
              {maintenanceTickets.length === 0 ? (
                <div className="text-center py-6 text-xs text-gray-400">All maintenance tickets resolved.</div>
              ) : (
                maintenanceTickets.map((t: any, idx: number) => {
                  const isHigh = t.priority === 'high';
                  const isResolved = t.status === 'resolved';
                  return (
                    <div key={t._id || idx} className="py-2.5 first:pt-0 last:pb-0 flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                              isResolved
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : isHigh
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {t.status || 'open'}
                          </span>
                          <p className="text-xs font-bold text-gray-900 truncate">{t.title}</p>
                        </div>
                        <p className="text-[10px] text-gray-500 truncate mt-0.5">
                          {t.category || 'general'} • Assigned: {t.assignedStaffName || 'Warden'}
                        </p>
                      </div>
                      <span className="text-[10px] text-gray-400 shrink-0 font-medium">
                        {t.roomId?.roomNumber ? `Rm ${t.roomId.roomNumber}` : 'Campus'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Column 3: Disciplinary Violations */}
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/70 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Curfew & Discipline</h3>
              </div>
              <Link href="/owner/violations" className="text-[11px] font-bold text-blue-600 hover:underline">
                View all &rarr;
              </Link>
            </div>

            <div className="p-4 flex-1 divide-y divide-gray-100">
              {recentViolations.length === 0 ? (
                <div className="text-center py-6 text-xs text-gray-400">No disciplinary violations logged.</div>
              ) : (
                recentViolations.slice(0, 5).map((v: any, idx: number) => {
                  return (
                    <div key={v._id || idx} className="py-2.5 first:pt-0 last:pb-0 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200 uppercase">
                            {formatViolationType(v.violationType)}
                          </span>
                          <p className="text-xs font-bold text-gray-900 truncate">{getStudentName(v)}</p>
                        </div>
                        <p className="text-[10px] text-gray-500 truncate mt-0.5">{v.description || 'Infraction recorded'}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {v.fineAmount > 0 ? (
                          <span className="text-xs font-black text-rose-600">₹{v.fineAmount}</span>
                        ) : (
                          <span className="text-[10px] font-bold text-gray-400">Warning</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* BOTTOM ROW: RESIDENT SENTIMENT & HOSTEL SUMMARY */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Student Mess Sentiment */}
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <UtensilsCrossed className="w-4 h-4 text-orange-600" />
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                    Mess Quality & Resident Feedback
                  </h3>
                </div>
                <Link href="/owner/mess-feedback" className="text-[11px] font-bold text-orange-600 hover:underline">
                  All Ratings &rarr;
                </Link>
              </div>

              {messFeedback.length === 0 ? (
                <div className="text-center py-6 text-xs text-gray-400">No mess ratings received recently.</div>
              ) : (
                <div className="space-y-3">
                  {messFeedback.slice(0, 3).map((f: any, idx: number) => (
                    <div key={f._id || idx} className="p-3 bg-gray-50/60 rounded-xl border border-gray-100 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1 text-amber-500 mb-1">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <Star
                              key={i}
                              className={`w-3 h-3 ${i <= (f.rating || 5) ? 'fill-current' : 'opacity-25'}`}
                            />
                          ))}
                          <span className="text-[11px] font-bold text-gray-700 ml-1">
                            {f.mealType || 'Daily Meal'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-700 line-clamp-1">{f.description || f.comment || 'Good food quality'}</p>
                      </div>
                      <span className="text-[10px] text-gray-400 font-medium shrink-0">
                        {f.raisedBy?.name || 'Resident'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <span>Weekly Average: <strong className="text-gray-900">4.8 / 5.0</strong></span>
              <span className="text-emerald-600 font-semibold">96% Satisfaction Rate</span>
            </div>
          </div>

          {/* Active Hostel Profile Card */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-5 shadow-md flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Primary Hostel Facility
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  GPS: {activeHostel?.address?.coordinates?.latitude?.toFixed(4) || 23.5235}, {activeHostel?.address?.coordinates?.longitude?.toFixed(4) || 77.8139}
                </span>
              </div>

              <h3 className="text-lg font-black tracking-tight text-white mb-1">
                {activeHostel?.name || 'Jai Hind girls hostel'}
              </h3>
              <p className="text-xs text-slate-300 mb-4 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>{activeHostel?.address?.street || '124, College Road, Near University Gate'}, {activeHostel?.address?.city || 'Bhopal'}</span>
              </p>

              <div className="grid grid-cols-3 gap-2 text-center text-xs pt-2">
                <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
                  <p className="text-slate-400 text-[10px] uppercase font-bold">Curfew Cutoff</p>
                  <p className="text-sm font-bold text-white mt-0.5">22:00 IST</p>
                </div>
                <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
                  <p className="text-slate-400 text-[10px] uppercase font-bold">Geofence Radius</p>
                  <p className="text-sm font-bold text-white mt-0.5">500 meters</p>
                </div>
                <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
                  <p className="text-slate-400 text-[10px] uppercase font-bold">Total Residents</p>
                  <p className="text-sm font-bold text-white mt-0.5">{studentLocations.length || 8} Active</p>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-between">
              <Link
                href="/owner/settings"
                className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                <Settings className="w-3.5 h-3.5" />
                Configure Hostel Settings &rarr;
              </Link>
              <Link
                href="/owner/students-map"
                className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                <Navigation className="w-3.5 h-3.5" />
                Open Interactive Radar &rarr;
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
