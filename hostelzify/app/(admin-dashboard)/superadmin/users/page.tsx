'use client';

import { useState, useEffect, useTransition, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import api from '../../../../services/api';
import { useToast } from '../../../../components/Toast';
import {
  ChevronLeft,
  Users,
  Building2,
  Phone,
  Mail,
  RefreshCw,
  Search,
  Sparkles,
  Filter,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';

interface UserRecord {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  studentId?: string;
  primaryRole: string;
  status?: string;
  hostelName: string;
  roomNumber: string;
  hostelId?: {
    _id: string;
    name: string;
    type?: string;
  };
  roomId?: {
    _id: string;
    roomNumber: string;
    floorNumber?: number;
    category?: string;
  };
  createdAt?: string;
}

function UsersContent() {
  const searchParams = useSearchParams();
  const initialHostelId = searchParams.get('hostelId') || '';

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [hostelsList, setHostelsList] = useState<{ _id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [search, setSearch] = useState('');
  const [selectedHostel, setSelectedHostel] = useState<string>(initialHostelId);
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [, startTransition] = useTransition();
  const { showToast } = useToast();

  const loadData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [usersRes, hostelsRes] = await Promise.all([
        api.getSuperadminUsers(),
        api.getSuperadminHostels(),
      ]);

      if (usersRes?.success && Array.isArray(usersRes.data)) {
        setUsers(usersRes.data);
        setLastUpdated(new Date());
        if (isManual) showToast('Hostel dummy users refreshed in real-time', 'success');
      } else {
        setUsers([]);
      }

      if (hostelsRes?.success && Array.isArray(hostelsRes.data)) {
        setHostelsList(hostelsRes.data.map((h: any) => ({ _id: h._id, name: h.name })));
      }
    } catch {
      if (isManual) showToast('Failed to refresh users data', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      loadData();
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  const handleSeedDummyUsers = async () => {
    setSeeding(true);
    try {
      const res = await api.seedSuperadminDummyUsers();
      if (res?.success) {
        showToast(res.message || 'Dummy users linked to all hostels!', 'success');
        await loadData(false);
      } else {
        showToast(res?.message || 'Failed to seed dummy users', 'warning');
      }
    } catch {
      showToast('Error assigning dummy users to hostels', 'error');
    } finally {
      setSeeding(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.phone?.toLowerCase().includes(q) ||
      u.studentId?.toLowerCase().includes(q) ||
      u.roomNumber?.toLowerCase().includes(q) ||
      u.hostelName?.toLowerCase().includes(q);

    if (!matchesSearch) return false;

    if (selectedHostel) {
      const uHostelId = u.hostelId?._id?.toString() || '';
      if (uHostelId !== selectedHostel) return false;
    }

    if (selectedRole !== 'all') {
      if (u.primaryRole?.toLowerCase() !== selectedRole.toLowerCase()) return false;
    }

    return true;
  });

  const totalStudents = users.filter((u) => u.primaryRole === 'student').length;
  const assignedHostelCount = users.filter((u) => u.hostelName && u.hostelName !== 'Unassigned').length;
  const assignedRoomCount = users.filter((u) => u.roomNumber && u.roomNumber !== 'Unassigned').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100/60 to-blue-50/30">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/superadmin"
              className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition shadow-xs"
              aria-label="Back to dashboard"
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                  <Users className="w-5 h-5" />
                </div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">Hostel Users Directory</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                  {users.length} Users
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                <span>All dummy students and staff listed across all hostels in the database</span>
                {lastUpdated && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live sync: {lastUpdated.toLocaleTimeString()}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSeedDummyUsers}
              disabled={seeding}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition shadow-xs disabled:opacity-60"
            >
              <Sparkles className={`w-3.5 h-3.5 ${seeding ? 'animate-spin' : ''}`} />
              <span>{seeding ? 'Syncing...' : 'Sync Dummy Users'}</span>
            </button>
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition shadow-xs disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Metric Summary Cards */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Users</span>
              <div className="p-2 bg-slate-100 text-slate-600 rounded-xl">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{users.length}</p>
            <p className="text-xs text-slate-500 mt-1">Total system accounts</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Dummy Students</span>
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{totalStudents}</p>
            <p className="text-xs text-slate-500 mt-1">Enrolled student profiles</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Linked to Hostels</span>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{assignedHostelCount}</p>
            <p className="text-xs text-slate-500 mt-1">Active hostel residents</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Room Allocated</span>
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <UserCheck className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{assignedRoomCount}</p>
            <p className="text-xs text-slate-500 mt-1">Assigned specific room beds</p>
          </div>
        </section>

        {/* Filters and Search Bar */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => startTransition(() => setSearch(e.target.value))}
              placeholder="Search by name, email, ID, or room..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
            {/* Filter by Hostel */}
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedHostel}
                onChange={(e) => setSelectedHostel(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">All Hostels ({hostelsList.length})</option>
                {hostelsList.map((h) => (
                  <option key={h._id} value={h._id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter by Role */}
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="all">All Roles</option>
              <option value="student">Students</option>
              <option value="warden">Wardens</option>
              <option value="cleaner">Cleaners</option>
              <option value="security">Security</option>
              <option value="owner">Owners</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
            <div className="inline-block p-4 bg-blue-50 rounded-2xl mb-3">
              <RefreshCw className="w-7 h-7 text-blue-600 animate-spin" />
            </div>
            <p className="text-sm font-semibold text-slate-800">Loading hostel users in real-time...</p>
            <p className="text-xs text-slate-500 mt-1">Retrieving student records and hostel assignments</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
            <div className="inline-block p-4 bg-slate-50 rounded-2xl mb-3">
              <Users className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-base font-semibold text-slate-800">No users found</p>
            <p className="text-xs text-slate-500 mt-1">Try clearing filters or search terms.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-4">User Details</th>
                    <th className="p-4">Student ID</th>
                    <th className="p-4">Assigned Hostel</th>
                    <th className="p-4">Room Assignment</th>
                    <th className="p-4">Role</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Contact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  {filteredUsers.map((u) => {
                    const initials = u.name
                      ? u.name
                          .split(' ')
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()
                      : 'U';

                    return (
                      <tr key={u._id} className="hover:bg-slate-50/80 transition">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-xs">
                              {initials}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 text-sm">{u.name}</p>
                              <p className="text-[11px] text-slate-500">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 font-mono text-[11px] font-semibold text-slate-700">
                          {u.studentId || '—'}
                        </td>
                        <td className="p-4">
                          {u.hostelName && u.hostelName !== 'Unassigned' ? (
                            <Link
                              href="/superadmin/hostels"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition font-medium text-xs"
                            >
                              <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{u.hostelName}</span>
                            </Link>
                          ) : (
                            <span className="text-slate-400 italic">Unassigned</span>
                          )}
                        </td>
                        <td className="p-4">
                          {u.roomNumber && u.roomNumber !== 'Unassigned' ? (
                            <div>
                              <span className="px-2.5 py-1 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 font-semibold text-xs inline-block">
                                Room {u.roomNumber}
                              </span>
                              {u.roomId?.category && (
                                <span className="text-[10px] text-slate-400 block mt-0.5">
                                  {u.roomId.category} (Floor {u.roomId.floorNumber || 1})
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">No room</span>
                          )}
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize ${
                              u.primaryRole === 'student'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : u.primaryRole === 'owner'
                                ? 'bg-violet-50 text-violet-700 border border-violet-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {u.primaryRole}
                          </span>
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider ${
                              u.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {u.status || 'active'}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="space-y-1 text-slate-600">
                            {u.phone && (
                              <p className="flex items-center gap-1.5">
                                <Phone className="w-3 h-3 text-slate-400" />
                                <span>{u.phone}</span>
                              </p>
                            )}
                            <p className="flex items-center gap-1.5">
                              <Mail className="w-3 h-3 text-slate-400" />
                              <span className="truncate max-w-[140px]">{u.email}</span>
                            </p>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function SuperAdminUsersPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-slate-500">Loading Users Directory...</div>}>
      <UsersContent />
    </Suspense>
  );
}
