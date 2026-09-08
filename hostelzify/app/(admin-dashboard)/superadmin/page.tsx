'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import { useToast } from '../../../components/Toast';
import {
  Shield,
  Ticket,
  Building2,
  LogOut,
  ChevronRight,
  UserPlus,
  Users,
  GraduationCap,
  UserCheck,
  Sparkles,
  ShieldCheck,
  Wallet,
  MessageSquare,
  LayoutGrid,
  RefreshCw,
  ArrowUpRight,
  Bed,
  CheckCircle2,
} from 'lucide-react';

type DashboardStats = {
  hostels?: number;
  supportTickets?: number;
  openTickets?: number;
  owners?: number;
  students?: number;
  wardens?: number;
  cleaners?: number;
  security?: number;
  totalUsers?: number;
  totalPayments?: number;
  totalComplaints?: number;
  totalRooms?: number;
  totalCapacity?: number;
  totalOccupancy?: number;
  occupancyRate?: number;
  recentHostels?: any[];
  recentOwners?: any[];
};

export default function SuperAdminPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { showToast } = useToast();

  const fetchStats = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await api.getSuperadminDashboard();
      if (res?.data) {
        setStats(res.data);
        setLastUpdated(new Date());
        if (isManual) showToast('Dashboard metrics refreshed in real-time', 'success');
      }
    } catch {
      if (isManual) showToast('Failed to refresh dashboard stats', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Real-time polling every 20 seconds
    const interval = setInterval(() => {
      fetchStats();
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  const handleSeedDummyUsers = async () => {
    setSeeding(true);
    try {
      const res = await api.seedSuperadminDummyUsers();
      if (res?.success) {
        showToast(res.message || 'Dummy users synced to all hostels in database!', 'success');
        await fetchStats(false);
      } else {
        showToast(res?.message || 'Unable to sync dummy users', 'warning');
      }
    } catch {
      showToast('Error syncing dummy users to hostels', 'error');
    } finally {
      setSeeding(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/superadmin/login');
  };

  const stat = (v: number | undefined) => (v !== undefined ? v : '—');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100/60 to-indigo-50/20">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-600 to-violet-700 text-white rounded-2xl shadow-sm">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">SuperAdmin Portal</h1>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Sync
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {user?.name || user?.email}
                {lastUpdated && (
                  <span className="ml-2 text-slate-400">
                    • Updated: {lastUpdated.toLocaleTimeString()}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSeedDummyUsers}
              disabled={seeding}
              className="hidden sm:flex items-center gap-2 px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition shadow-xs disabled:opacity-60"
            >
              <Sparkles className={`w-3.5 h-3.5 ${seeding ? 'animate-spin' : ''}`} />
              <span>{seeding ? 'Syncing...' : 'Sync Dummy Users'}</span>
            </button>
            <button
              onClick={() => fetchStats(true)}
              disabled={refreshing}
              className="p-2.5 text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition shadow-xs disabled:opacity-60"
              title="Refresh Real-time Data"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
            <button
              onClick={handleLogout}
              className="p-2.5 text-slate-500 hover:text-rose-600 rounded-xl border border-slate-200 bg-white hover:bg-rose-50 transition shadow-xs"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Real-time Hero Highlight Cards */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              Real-Time Highlights
            </h2>
            <span className="text-xs text-slate-500">Click any card to inspect full records</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Hostel Owners */}
            <Link
              href="/superadmin/owners"
              className="group bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md hover:border-violet-300 transition-all relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-violet-100/50 to-transparent rounded-bl-full pointer-events-none" />
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-violet-700 uppercase tracking-wider bg-violet-50 px-2.5 py-1 rounded-lg border border-violet-100">
                  Hostel Owners
                </span>
                <div className="p-2 bg-violet-100 text-violet-700 rounded-xl group-hover:scale-110 transition">
                  <Users className="w-5 h-5" />
                </div>
              </div>
              <p className="text-3xl font-black text-slate-900 tracking-tight">
                {loading ? '—' : stat(stats?.owners)}
              </p>
              <p className="text-xs text-slate-500 mt-1 flex items-center justify-between">
                <span>View all owners & properties</span>
                <ArrowUpRight className="w-4 h-4 text-violet-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
              </p>
            </Link>

            {/* Total Listed Hostels */}
            <Link
              href="/superadmin/hostels"
              className="group bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-emerald-100/50 to-transparent rounded-bl-full pointer-events-none" />
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                  Listed Hostels
                </span>
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl group-hover:scale-110 transition">
                  <Building2 className="w-5 h-5" />
                </div>
              </div>
              <p className="text-3xl font-black text-slate-900 tracking-tight">
                {loading ? '—' : stat(stats?.hostels)}
              </p>
              <p className="text-xs text-slate-500 mt-1 flex items-center justify-between">
                <span>Real-time occupancy & rooms</span>
                <ArrowUpRight className="w-4 h-4 text-emerald-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
              </p>
            </Link>

            {/* Dummy Users / Residents */}
            <Link
              href="/superadmin/users"
              className="group bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md hover:border-blue-300 transition-all relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-blue-100/50 to-transparent rounded-bl-full pointer-events-none" />
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-blue-700 uppercase tracking-wider bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                  Dummy Users
                </span>
                <div className="p-2 bg-blue-100 text-blue-700 rounded-xl group-hover:scale-110 transition">
                  <GraduationCap className="w-5 h-5" />
                </div>
              </div>
              <p className="text-3xl font-black text-slate-900 tracking-tight">
                {loading ? '—' : stat(stats?.students)}
              </p>
              <p className="text-xs text-slate-500 mt-1 flex items-center justify-between">
                <span>All hostel dummy residents</span>
                <ArrowUpRight className="w-4 h-4 text-blue-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
              </p>
            </Link>

            {/* Occupancy & Rooms */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-indigo-100/50 to-transparent rounded-bl-full pointer-events-none" />
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                  Occupancy
                </span>
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                  <Bed className="w-5 h-5" />
                </div>
              </div>
              <p className="text-3xl font-black text-slate-900 tracking-tight">
                {loading ? '—' : `${stats?.occupancyRate || 0}%`}
              </p>
              <div className="mt-2">
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                    style={{ width: `${stats?.occupancyRate || 0}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {stats?.totalOccupancy || 0} / {stats?.totalCapacity || 0} Beds Occupied
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Primary Navigation Actions */}
        <section>
          <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 text-slate-600" />
            Quick Navigation & Management
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* View Hostel Owners */}
            <Link
              href="/superadmin/owners"
              className="flex items-center justify-between bg-white rounded-2xl p-4 border border-slate-200/80 hover:border-violet-400 hover:bg-violet-50/30 transition shadow-xs group"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-3 bg-violet-100 text-violet-700 rounded-xl group-hover:scale-105 transition">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Hostel Owners Directory</h3>
                  <p className="text-xs text-slate-500">View all owners, contact details & properties</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-violet-600 group-hover:translate-x-1 transition" />
            </Link>

            {/* View Listed Hostels */}
            <Link
              href="/superadmin/hostels"
              className="flex items-center justify-between bg-white rounded-2xl p-4 border border-slate-200/80 hover:border-emerald-400 hover:bg-emerald-50/30 transition shadow-xs group"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl group-hover:scale-105 transition">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Listed Hostels Directory</h3>
                  <p className="text-xs text-slate-500">Real-time room occupancy & resident lists</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition" />
            </Link>

            {/* View Hostel Users */}
            <Link
              href="/superadmin/users"
              className="flex items-center justify-between bg-white rounded-2xl p-4 border border-slate-200/80 hover:border-blue-400 hover:bg-blue-50/30 transition shadow-xs group"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-3 bg-blue-100 text-blue-700 rounded-xl group-hover:scale-105 transition">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Hostel Users Directory</h3>
                  <p className="text-xs text-slate-500">Filter dummy users by hostel and rooms</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition" />
            </Link>

            {/* Create Hostel Owner */}
            <Link
              href="/superadmin/create-owner"
              className="flex items-center justify-between bg-white rounded-2xl p-4 border border-slate-200/80 hover:border-indigo-400 hover:bg-indigo-50/30 transition shadow-xs group"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-3 bg-indigo-100 text-indigo-700 rounded-xl group-hover:scale-105 transition">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Create Hostel Owner</h3>
                  <p className="text-xs text-slate-500">Register a new owner with credentials</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition" />
            </Link>

            {/* Support Tickets */}
            <Link
              href="/superadmin/support-tickets"
              className="flex items-center justify-between bg-white rounded-2xl p-4 border border-slate-200/80 hover:border-amber-400 hover:bg-amber-50/30 transition shadow-xs group"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-3 bg-amber-100 text-amber-700 rounded-xl group-hover:scale-105 transition">
                  <Ticket className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-sm">Support Tickets</h3>
                    {stats?.openTickets ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                        {stats.openTickets} Open
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-500">Manage all tickets and responses</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-amber-600 group-hover:translate-x-1 transition" />
            </Link>

            {/* Seed / Sync Dummy Users Button */}
            <button
              onClick={handleSeedDummyUsers}
              disabled={seeding}
              className="flex items-center justify-between bg-white rounded-2xl p-4 border border-slate-200/80 hover:border-emerald-400 hover:bg-emerald-50/30 transition shadow-xs group text-left disabled:opacity-60"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl group-hover:scale-105 transition">
                  <Sparkles className={`w-5 h-5 ${seeding ? 'animate-spin' : ''}`} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Sync Dummy Users</h3>
                  <p className="text-xs text-slate-500">Link dummy students to all database hostels</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition" />
            </button>
          </div>
        </section>

        {/* Live Preview: Listed Hostels & Hostel Owners */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recently Listed Hostels */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-600" />
                  <h3 className="font-bold text-slate-900 text-sm">Listed Hostels Overview</h3>
                </div>
                <Link
                  href="/superadmin/hostels"
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1"
                >
                  <span>View All ({stats?.hostels || 0})</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {stats?.recentHostels && stats.recentHostels.length > 0 ? (
                <div className="space-y-3">
                  {stats.recentHostels.map((h: any) => (
                    <div
                      key={h._id}
                      className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-900 text-xs">{h.name}</p>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-100 text-emerald-800 capitalize">
                            {h.type}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Owner: {typeof h.ownerId === 'object' ? h.ownerId?.name : 'Owner'} •{' '}
                          {h.address?.city || 'India'}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-slate-800 block">
                          {h.currentOccupancy || 0}/{h.capacity || 0} Beds
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {h.totalRooms || 0} Rooms
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-6">No hostels recorded yet</p>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100">
              <Link
                href="/superadmin/hostels"
                className="text-xs font-medium text-slate-600 hover:text-indigo-600 flex items-center gap-1"
              >
                <span>Browse rooms and view all dummy residents in hostels</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Registered Hostel Owners */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-violet-600" />
                  <h3 className="font-bold text-slate-900 text-sm">Hostel Owners Overview</h3>
                </div>
                <Link
                  href="/superadmin/owners"
                  className="text-xs font-semibold text-violet-700 hover:text-violet-800 inline-flex items-center gap-1"
                >
                  <span>View All ({stats?.owners || 0})</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {stats?.recentOwners && stats.recentOwners.length > 0 ? (
                <div className="space-y-3">
                  {stats.recentOwners.map((o: any) => (
                    <div
                      key={o._id}
                      className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-700 font-bold flex items-center justify-center text-xs">
                          {o.name ? o.name[0] : 'O'}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-xs">{o.name}</p>
                          <p className="text-[11px] text-slate-500">{o.email}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          Active
                        </span>
                        <p className="text-[10px] text-slate-400 mt-0.5">{o.phone || '—'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-6">No owners registered yet</p>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100">
              <Link
                href="/superadmin/create-owner"
                className="text-xs font-medium text-slate-600 hover:text-indigo-600 flex items-center gap-1"
              >
                <span>Register a new hostel owner credentials</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </section>

        {/* Database Overview Grid */}
        <section>
          <h2 className="flex items-center gap-2 text-slate-900 font-bold text-base mb-4">
            <LayoutGrid className="w-4 h-4 text-slate-600" />
            Complete Database Overview
          </h2>
          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 text-sm">
              Loading system metrics…
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
                <Building2 className="w-5 h-5 text-emerald-600 mb-2" />
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Hostels</p>
                <p className="text-2xl font-bold text-slate-900">{stat(stats?.hostels)}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
                <Bed className="w-5 h-5 text-indigo-600 mb-2" />
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Rooms</p>
                <p className="text-2xl font-bold text-slate-900">{stat(stats?.totalRooms)}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
                <Users className="w-5 h-5 text-indigo-600 mb-2" />
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Users</p>
                <p className="text-2xl font-bold text-slate-900">{stat(stats?.totalUsers)}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
                <UserPlus className="w-5 h-5 text-violet-600 mb-2" />
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Owners</p>
                <p className="text-2xl font-bold text-slate-900">{stat(stats?.owners)}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
                <GraduationCap className="w-5 h-5 text-blue-600 mb-2" />
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Students</p>
                <p className="text-2xl font-bold text-slate-900">{stat(stats?.students)}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
                <UserCheck className="w-5 h-5 text-amber-600 mb-2" />
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Wardens</p>
                <p className="text-2xl font-bold text-slate-900">{stat(stats?.wardens)}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
                <Sparkles className="w-5 h-5 text-teal-600 mb-2" />
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Cleaners</p>
                <p className="text-2xl font-bold text-slate-900">{stat(stats?.cleaners)}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
                <ShieldCheck className="w-5 h-5 text-slate-600 mb-2" />
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Security</p>
                <p className="text-2xl font-bold text-slate-900">{stat(stats?.security)}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
                <Ticket className="w-5 h-5 text-indigo-600 mb-2" />
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Support Tickets</p>
                <p className="text-2xl font-bold text-slate-900">{stat(stats?.supportTickets)}</p>
              </div>
              <div className="bg-white rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-xs">
                <Ticket className="w-5 h-5 text-amber-600 mb-2" />
                <p className="text-xs font-medium text-amber-700 uppercase tracking-wide">Open Tickets</p>
                <p className="text-2xl font-bold text-amber-700">{stat(stats?.openTickets)}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
                <Wallet className="w-5 h-5 text-green-600 mb-2" />
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Payments</p>
                <p className="text-2xl font-bold text-slate-900">{stat(stats?.totalPayments)}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
                <MessageSquare className="w-5 h-5 text-rose-600 mb-2" />
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Complaints</p>
                <p className="text-2xl font-bold text-slate-900">{stat(stats?.totalComplaints)}</p>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
