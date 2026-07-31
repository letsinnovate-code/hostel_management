'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
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
};

export default function SuperAdminPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .getSuperadminDashboard()
      .then((res) => {
        if (!cancelled && res?.data) setStats(res.data);
      })
      .catch(() => setStats(null))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    router.replace('/superadmin/login');
  };

  const stat = (v: number | undefined) => (v !== undefined ? v : '—');

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-xl">
            <Shield className="w-7 h-7 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">SuperAdmin</h1>
            <p className="text-sm text-slate-500">{user?.name || user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="p-2.5 text-slate-500 hover:text-red-600 rounded-xl hover:bg-slate-100 transition"
          title="Logout"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      <main className="p-6 max-w-4xl mx-auto">
        {/* DB Overview */}
        <section className="mb-8">
          <h2 className="flex items-center gap-2 text-slate-800 font-semibold mb-4">
            <LayoutGrid className="w-5 h-5 text-slate-600" />
            Database overview
          </h2>
          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
              Loading stats…
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <Building2 className="w-5 h-5 text-emerald-600 mb-2" />
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Hostels</p>
                <p className="text-2xl font-bold text-slate-900">{stat(stats?.hostels)}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <LayoutGrid className="w-5 h-5 text-slate-600 mb-2" />
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Rooms</p>
                <p className="text-2xl font-bold text-slate-900">{stat(stats?.totalRooms)}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <Users className="w-5 h-5 text-indigo-600 mb-2" />
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total users</p>
                <p className="text-2xl font-bold text-slate-900">{stat(stats?.totalUsers)}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <UserPlus className="w-5 h-5 text-violet-600 mb-2" />
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Owners</p>
                <p className="text-2xl font-bold text-slate-900">{stat(stats?.owners)}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <GraduationCap className="w-5 h-5 text-blue-600 mb-2" />
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Students</p>
                <p className="text-2xl font-bold text-slate-900">{stat(stats?.students)}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <UserCheck className="w-5 h-5 text-amber-600 mb-2" />
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Wardens</p>
                <p className="text-2xl font-bold text-slate-900">{stat(stats?.wardens)}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <Sparkles className="w-5 h-5 text-teal-600 mb-2" />
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Cleaners</p>
                <p className="text-2xl font-bold text-slate-900">{stat(stats?.cleaners)}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <ShieldCheck className="w-5 h-5 text-slate-600 mb-2" />
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Security</p>
                <p className="text-2xl font-bold text-slate-900">{stat(stats?.security)}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <Ticket className="w-5 h-5 text-indigo-600 mb-2" />
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Support tickets</p>
                <p className="text-2xl font-bold text-slate-900">{stat(stats?.supportTickets)}</p>
              </div>
              <div className="bg-white rounded-xl border border-amber-200 bg-amber-50/50 p-4 rounded-xl shadow-sm">
                <Ticket className="w-5 h-5 text-amber-600 mb-2" />
                <p className="text-xs font-medium text-amber-700 uppercase tracking-wide">Open tickets</p>
                <p className="text-2xl font-bold text-amber-700">{stat(stats?.openTickets)}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <Wallet className="w-5 h-5 text-green-600 mb-2" />
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Payments</p>
                <p className="text-2xl font-bold text-slate-900">{stat(stats?.totalPayments)}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <MessageSquare className="w-5 h-5 text-rose-600 mb-2" />
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Complaints</p>
                <p className="text-2xl font-bold text-slate-900">{stat(stats?.totalComplaints)}</p>
              </div>
            </div>
          )}
        </section>

        {/* Actions */}
        <section>
          <h2 className="flex items-center gap-2 text-slate-800 font-semibold mb-4">Actions</h2>
          <div className="space-y-3">
            <Link
              href="/superadmin/create-owner"
              className="flex items-center justify-between bg-white rounded-xl shadow-sm p-4 border-2 border-violet-200 hover:border-violet-400 hover:bg-violet-50/50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-violet-100 rounded-xl">
                  <UserPlus className="w-6 h-6 text-violet-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900">Create hostel owner</h2>
                  <p className="text-sm text-slate-500">Register a new owner with email and password</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400" />
            </Link>

            <Link
              href="/superadmin/support-tickets"
              className="flex items-center justify-between bg-white rounded-xl shadow-sm p-4 border border-slate-200 hover:bg-slate-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-100 rounded-xl">
                  <Ticket className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900">Support tickets</h2>
                  <p className="text-sm text-slate-500">View and manage all support tickets</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400" />
            </Link>

            <Link
              href="/superadmin/hostels"
              className="flex items-center justify-between bg-white rounded-xl shadow-sm p-4 border border-slate-200 hover:bg-slate-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-100 rounded-xl">
                  <Building2 className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900">Hostels</h2>
                  <p className="text-sm text-slate-500">View all hostels and their owners</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400" />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
