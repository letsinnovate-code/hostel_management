'use client';

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import api from '../../../../services/api';
import { useToast } from '../../../../components/Toast';
import {
  ChevronLeft,
  Building2,
  Users,
  Bed,
  MapPin,
  Phone,
  Mail,
  RefreshCw,
  Search,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  ArrowUpRight,
  Home,
} from 'lucide-react';

interface DummyUser {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  studentId?: string;
  status?: string;
  roomNumber?: string;
  roomFloor?: number;
  roomCategory?: string;
  joinedAt?: string;
}

interface HostelItem {
  _id: string;
  name: string;
  type: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
    formattedAddress?: string;
  };
  contact?: {
    phone?: string;
    email?: string;
    managerName?: string;
  };
  ownerId?: {
    _id?: string;
    name?: string;
    email?: string;
    phone?: string;
  } | string;
  capacity?: number;
  currentOccupancy?: number;
  totalRoomsInDb?: number;
  totalRooms?: number;
  availableBeds?: number;
  occupancyRate?: number;
  activeComplaintsCount?: number;
  status?: string;
  dummyUsers?: DummyUser[];
}

export default function SuperAdminHostelsPage() {
  const [hostels, setHostels] = useState<HostelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'boys' | 'girls' | 'co-ed'>('all');
  const [expandedHostelId, setExpandedHostelId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const { showToast } = useToast();

  const loadHostels = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await api.getSuperadminHostels();
      if (res?.success && Array.isArray(res.data)) {
        setHostels(res.data);
        setLastUpdated(new Date());
        if (isManual) showToast('Hostels and resident data refreshed in real-time', 'success');
      } else {
        setHostels([]);
      }
    } catch {
      if (isManual) showToast('Failed to fetch realtime hostels', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadHostels();
    // Real-time polling every 20 seconds
    const interval = setInterval(() => {
      loadHostels();
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  const handleSeedDummyUsers = async () => {
    setSeeding(true);
    try {
      const res = await api.seedSuperadminDummyUsers();
      if (res?.success) {
        showToast(res.message || 'Dummy users and rooms successfully linked to all hostels!', 'success');
        await loadHostels(false);
      } else {
        showToast(res?.message || 'Unable to seed dummy users', 'warning');
      }
    } catch {
      showToast('Error seeding dummy users to hostels', 'error');
    } finally {
      setSeeding(false);
    }
  };

  const toggleExpand = (hostelId: string) => {
    setExpandedHostelId((prev) => (prev === hostelId ? null : hostelId));
  };

  const filteredHostels = hostels.filter((h) => {
    const q = search.toLowerCase().trim();
    const ownerName = typeof h.ownerId === 'object' ? h.ownerId?.name?.toLowerCase() : '';
    const ownerEmail = typeof h.ownerId === 'object' ? h.ownerId?.email?.toLowerCase() : '';
    const matchesSearch =
      !q ||
      h.name?.toLowerCase().includes(q) ||
      h.address?.city?.toLowerCase().includes(q) ||
      h.address?.state?.toLowerCase().includes(q) ||
      ownerName?.includes(q) ||
      ownerEmail?.includes(q);

    if (!matchesSearch) return false;
    if (typeFilter !== 'all' && h.type !== typeFilter) return false;
    return true;
  });

  const totalCapacityAll = hostels.reduce((acc, h) => acc + (h.capacity || 0), 0);
  const totalOccupancyAll = hostels.reduce((acc, h) => acc + (h.currentOccupancy || 0), 0);
  const totalRoomsAll = hostels.reduce((acc, h) => acc + (h.totalRoomsInDb || h.totalRooms || 0), 0);
  const totalDummyUsersAll = hostels.reduce((acc, h) => acc + (h.dummyUsers?.length || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100/60 to-emerald-50/30">
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
                <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                  <Building2 className="w-5 h-5" />
                </div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">Listed Hostels</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {hostels.length} Properties
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                <span>Real-time occupancy, rooms, and enrolled dummy users in all hostels</span>
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
              title="Populate or assign dummy users to all hostels"
            >
              <Sparkles className={`w-3.5 h-3.5 ${seeding ? 'animate-spin' : ''}`} />
              <span>{seeding ? 'Linking Users...' : 'Sync Dummy Users'}</span>
            </button>
            <button
              onClick={() => loadHostels(true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition shadow-xs disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-emerald-600' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Top Summary Metrics */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Listed Hostels</span>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{hostels.length}</p>
            <p className="text-xs text-slate-500 mt-1">Active registered properties</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Rooms</span>
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <Bed className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{totalRoomsAll}</p>
            <p className="text-xs text-slate-500 mt-1">Configured in database</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Dummy Users</span>
              <div className="p-2 bg-violet-50 text-violet-600 rounded-xl">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{totalDummyUsersAll}</p>
            <p className="text-xs text-slate-500 mt-1">Assigned across all hostels</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">System Occupancy</span>
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <Home className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {totalCapacityAll > 0 ? Math.round((totalOccupancyAll / totalCapacityAll) * 100) : 0}%
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {totalOccupancyAll} / {totalCapacityAll} Total Beds
            </p>
          </div>
        </section>

        {/* Search and Filters */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => startTransition(() => setSearch(e.target.value))}
              placeholder="Search hostel name, city, or owner..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            {(['all', 'boys', 'girls', 'co-ed'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={`px-3 py-1.5 text-xs font-medium rounded-xl capitalize transition ${
                  typeFilter === type
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {type} {type !== 'all' && `(${hostels.filter((h) => h.type === type).length})`}
              </button>
            ))}
          </div>
        </div>

        {/* Hostels List */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
            <div className="inline-block p-4 bg-emerald-50 rounded-2xl mb-3">
              <RefreshCw className="w-7 h-7 text-emerald-600 animate-spin" />
            </div>
            <p className="text-sm font-semibold text-slate-800">Loading listed hostels & dummy users in real-time...</p>
            <p className="text-xs text-slate-500 mt-1">Calculating rooms, occupancy, and residents</p>
          </div>
        ) : filteredHostels.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
            <div className="inline-block p-4 bg-slate-50 rounded-2xl mb-3">
              <Building2 className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-base font-semibold text-slate-800">No hostels found</p>
            <p className="text-xs text-slate-500 mt-1">Try changing your search keywords or filter.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {filteredHostels.map((h) => {
              const isExpanded = expandedHostelId === h._id;
              const ownerObj = typeof h.ownerId === 'object' ? h.ownerId : null;
              const roomCount = h.totalRoomsInDb || h.totalRooms || 0;
              const residentCount = h.dummyUsers?.length || h.currentOccupancy || 0;
              const capacity = h.capacity || 20;
              const occupancyPct = capacity > 0 ? Math.min(100, Math.round((residentCount / capacity) * 100)) : 0;

              return (
                <div
                  key={h._id}
                  className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs hover:shadow-md transition-all"
                >
                  <div className="p-6">
                    {/* Header Row */}
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h2 className="text-lg font-bold text-slate-900">{h.name}</h2>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                              h.type === 'boys'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : h.type === 'girls'
                                ? 'bg-pink-50 text-pink-700 border border-pink-200'
                                : 'bg-purple-50 text-purple-700 border border-purple-200'
                            }`}
                          >
                            {h.type}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Active
                          </span>
                          {h.activeComplaintsCount ? (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                              <ShieldAlert className="w-3 h-3" />
                              {h.activeComplaintsCount} Open Complaints
                            </span>
                          ) : null}
                        </div>

                        {/* Location */}
                        <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span>
                            {[h.address?.street, h.address?.city, h.address?.state, h.address?.pincode]
                              .filter(Boolean)
                              .join(', ') || 'Address not specified'}
                          </span>
                        </p>
                      </div>

                      {/* Owner pill */}
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-violet-100 text-violet-700 font-bold flex items-center justify-center text-xs">
                          {ownerObj?.name ? ownerObj.name[0] : 'O'}
                        </div>
                        <div>
                          <p className="text-[11px] font-medium text-slate-500">Hostel Owner</p>
                          <p className="text-xs font-bold text-slate-800">{ownerObj?.name || 'Unassigned'}</p>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                            {ownerObj?.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3" /> {ownerObj.email}
                              </span>
                            )}
                            {ownerObj?.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" /> {ownerObj.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Real-time metrics grid */}
                    <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gradient-to-r from-slate-50 to-emerald-50/20 rounded-xl p-3.5 border border-slate-100">
                      <div>
                        <span className="text-[11px] font-medium text-slate-500 block">Total Rooms (DB)</span>
                        <span className="text-lg font-bold text-slate-900">{roomCount}</span>
                      </div>
                      <div>
                        <span className="text-[11px] font-medium text-slate-500 block">Total Capacity</span>
                        <span className="text-lg font-bold text-slate-900">{capacity} Beds</span>
                      </div>
                      <div>
                        <span className="text-[11px] font-medium text-slate-500 block">Enrolled Dummy Users</span>
                        <span className="text-lg font-bold text-emerald-600">{residentCount} Residents</span>
                      </div>
                      <div>
                        <span className="text-[11px] font-medium text-slate-500 block">Occupancy Rate</span>
                        <span className="text-lg font-bold text-slate-900">{occupancyPct}%</span>
                      </div>
                    </div>

                    {/* Occupancy Progress Bar */}
                    <div className="mt-3">
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${occupancyPct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                        <span>{residentCount} Occupied</span>
                        <span>{Math.max(0, capacity - residentCount)} Beds Available</span>
                      </div>
                    </div>

                    {/* Bottom Action Bar */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <button
                        onClick={() => toggleExpand(h._id)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100/80 px-3.5 py-1.5 rounded-xl border border-emerald-200/80 transition"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>
                          {isExpanded ? 'Hide Dummy Users' : `List Dummy Users (${h.dummyUsers?.length || 0})`}
                        </span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      <div className="flex items-center gap-2">
                        <Link
                          href={`/superadmin/users?hostelId=${h._id}`}
                          className="text-xs font-medium text-slate-600 hover:text-indigo-600 flex items-center gap-1 transition"
                        >
                          <span>Open in Users Directory</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  </div>

                  {/* Expandable Dummy Users Table */}
                  {isExpanded && (
                    <div className="bg-slate-50/80 border-t border-slate-200/80 p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-emerald-600" />
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                            Enrolled Dummy Residents in {h.name}
                          </h3>
                        </div>
                        <span className="text-xs text-slate-500">
                          {h.dummyUsers?.length || 0} students assigned with rooms
                        </span>
                      </div>

                      {h.dummyUsers && h.dummyUsers.length > 0 ? (
                        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-100/80 text-slate-700 font-semibold border-b border-slate-200">
                              <tr>
                                <th className="p-3">Resident / Student</th>
                                <th className="p-3">Student ID</th>
                                <th className="p-3">Room</th>
                                <th className="p-3">Phone</th>
                                <th className="p-3">Status</th>
                                <th className="p-3">Joined</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-600">
                              {h.dummyUsers.map((u) => (
                                <tr key={u._id} className="hover:bg-slate-50 transition">
                                  <td className="p-3">
                                    <div className="flex items-center gap-2.5">
                                      <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs">
                                        {u.name ? u.name[0] : 'S'}
                                      </div>
                                      <div>
                                        <p className="font-semibold text-slate-900">{u.name}</p>
                                        <p className="text-[11px] text-slate-500">{u.email}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="p-3 font-mono text-[11px] text-slate-700">
                                    {u.studentId || '—'}
                                  </td>
                                  <td className="p-3">
                                    <span className="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 font-medium border border-blue-200 text-[11px]">
                                      Room {u.roomNumber}
                                    </span>
                                    {u.roomCategory && (
                                      <span className="text-[10px] text-slate-400 block mt-0.5">
                                        {u.roomCategory}
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-3 text-slate-600">{u.phone || '—'}</td>
                                  <td className="p-3">
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                                        u.status === 'active'
                                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                                      }`}
                                    >
                                      {u.status || 'active'}
                                    </span>
                                  </td>
                                  <td className="p-3 text-slate-400 text-[11px]">
                                    {u.joinedAt ? new Date(u.joinedAt).toLocaleDateString() : '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-500 text-xs">
                          No dummy users currently assigned to this hostel. Click &apos;Sync Dummy Users&apos; above to allocate students automatically.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
