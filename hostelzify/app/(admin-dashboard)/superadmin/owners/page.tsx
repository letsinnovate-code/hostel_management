'use client';

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import api from '../../../../services/api';
import { useToast } from '../../../../components/Toast';
import {
  ChevronLeft,
  Users,
  Building2,
  Phone,
  Mail,
  Calendar,
  Search,
  RefreshCw,
  UserPlus,
  Bed,
  CheckCircle2,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';

interface HostelBrief {
  _id: string;
  name: string;
  type: string;
  city?: string;
  state?: string;
  capacity?: number;
  currentOccupancy?: number;
  totalRooms?: number;
  status?: string;
}

interface OwnerItem {
  _id: string;
  name: string;
  email: string;
  phone: string;
  status?: string;
  createdAt?: string;
  hostelsCount: number;
  hostels: HostelBrief[];
  totalRooms: number;
  totalStudents: number;
  totalCapacity: number;
}

export default function SuperAdminOwnersPage() {
  const [owners, setOwners] = useState<OwnerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'with-hostels' | 'no-hostels'>('all');
  const [, startTransition] = useTransition();
  const { showToast } = useToast();

  const loadOwners = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await api.getSuperadminOwners();
      if (res?.success && Array.isArray(res.data)) {
        setOwners(res.data);
        setLastUpdated(new Date());
        if (isManual) showToast('Hostel owners data refreshed in real-time', 'success');
      } else {
        setOwners([]);
      }
    } catch {
      if (isManual) showToast('Failed to refresh hostel owners', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadOwners();
    // Real-time polling every 20 seconds
    const interval = setInterval(() => {
      loadOwners();
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  const filteredOwners = owners.filter((owner) => {
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      owner.name?.toLowerCase().includes(q) ||
      owner.email?.toLowerCase().includes(q) ||
      owner.phone?.toLowerCase().includes(q) ||
      owner.hostels?.some((h) => h.name?.toLowerCase().includes(q) || h.city?.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    if (filterType === 'with-hostels') return owner.hostelsCount > 0;
    if (filterType === 'no-hostels') return owner.hostelsCount === 0;
    return true;
  });

  const totalHostelsManaged = owners.reduce((acc, o) => acc + (o.hostelsCount || 0), 0);
  const totalStudentsEnrolled = owners.reduce((acc, o) => acc + (o.totalStudents || 0), 0);
  const totalRoomsManaged = owners.reduce((acc, o) => acc + (o.totalRooms || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100/60 to-indigo-50/30">
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
                <div className="p-1.5 bg-violet-100 text-violet-700 rounded-lg">
                  <Users className="w-5 h-5" />
                </div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">Hostel Owners</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-800 border border-violet-200">
                  {owners.length} Registered
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                <span>Real-time overview of all hostel owners and their listed properties</span>
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
              onClick={() => loadOwners(true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition shadow-xs disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
              <span>Refresh</span>
            </button>
            <Link
              href="/superadmin/create-owner"
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition shadow-sm"
            >
              <UserPlus className="w-4 h-4" />
              <span>Create Owner</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Metric Summary Cards */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Owners</span>
              <div className="p-2 bg-violet-50 text-violet-600 rounded-xl">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{owners.length}</p>
            <p className="text-xs text-slate-500 mt-1">Registered hostel proprietors</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Listed Hostels</span>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{totalHostelsManaged}</p>
            <p className="text-xs text-slate-500 mt-1">Across all owners</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Rooms Managed</span>
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <Bed className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{totalRoomsManaged}</p>
            <p className="text-xs text-slate-500 mt-1">Active configured rooms</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Enrolled Residents</span>
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{totalStudentsEnrolled}</p>
            <p className="text-xs text-slate-500 mt-1">Total dummy & active users</p>
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
              placeholder="Search by name, email, phone, or hostel..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-xl transition ${
                filterType === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({owners.length})
            </button>
            <button
              onClick={() => setFilterType('with-hostels')}
              className={`px-3 py-1.5 text-xs font-medium rounded-xl transition ${
                filterType === 'with-hostels'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              With Hostels ({owners.filter((o) => o.hostelsCount > 0).length})
            </button>
            <button
              onClick={() => setFilterType('no-hostels')}
              className={`px-3 py-1.5 text-xs font-medium rounded-xl transition ${
                filterType === 'no-hostels'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              No Hostels ({owners.filter((o) => o.hostelsCount === 0).length})
            </button>
          </div>
        </div>

        {/* Owners Directory List */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
            <div className="inline-block p-4 bg-violet-50 rounded-2xl mb-3">
              <RefreshCw className="w-7 h-7 text-violet-600 animate-spin" />
            </div>
            <p className="text-sm font-semibold text-slate-800">Loading hostel owners in real-time...</p>
            <p className="text-xs text-slate-500 mt-1">Retrieving database records & listed property metrics</p>
          </div>
        ) : filteredOwners.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
            <div className="inline-block p-4 bg-slate-50 rounded-2xl mb-3">
              <Users className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-base font-semibold text-slate-800">No hostel owners match your filter</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Try adjusting your search query or create a new hostel owner.
            </p>
            <Link
              href="/superadmin/create-owner"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition"
            >
              <UserPlus className="w-4 h-4" />
              <span>Create First Owner</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredOwners.map((owner) => {
              const initials = owner.name
                ? owner.name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()
                : 'OW';

              return (
                <div
                  key={owner._id}
                  className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white font-bold flex items-center justify-center text-base shadow-sm">
                          {initials}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="font-bold text-slate-900 text-base">{owner.name}</h2>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              Active
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            Joined {owner.createdAt ? new Date(owner.createdAt).toLocaleDateString() : 'Recently'}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {owner.hostelsCount} {owner.hostelsCount === 1 ? 'Hostel' : 'Hostels'}
                        </span>
                      </div>
                    </div>

                    {/* Contact details */}
                    <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <a
                        href={`mailto:${owner.email}`}
                        className="flex items-center gap-2 text-slate-600 hover:text-indigo-600 p-2 rounded-xl hover:bg-indigo-50/50 transition truncate"
                      >
                        <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="truncate">{owner.email}</span>
                      </a>
                      <a
                        href={`tel:${owner.phone}`}
                        className="flex items-center gap-2 text-slate-600 hover:text-indigo-600 p-2 rounded-xl hover:bg-indigo-50/50 transition"
                      >
                        <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span>{owner.phone || 'No phone provided'}</span>
                      </a>
                    </div>

                    {/* Real-time stats bar */}
                    <div className="mt-3 grid grid-cols-3 gap-2 bg-slate-50 rounded-xl p-2.5 border border-slate-100 text-center">
                      <div>
                        <p className="text-[11px] font-medium text-slate-500">Hostels</p>
                        <p className="text-base font-bold text-slate-900">{owner.hostelsCount}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-medium text-slate-500">Rooms</p>
                        <p className="text-base font-bold text-slate-900">{owner.totalRooms}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-medium text-slate-500">Residents</p>
                        <p className="text-base font-bold text-emerald-600">{owner.totalStudents}</p>
                      </div>
                    </div>

                    {/* Listed Hostels tags */}
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                        Listed Properties ({owner.hostels?.length || 0}):
                      </p>
                      {owner.hostels && owner.hostels.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {owner.hostels.map((h) => (
                            <Link
                              key={h._id}
                              href={`/superadmin/hostels`}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs bg-emerald-50/80 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 transition"
                            >
                              <span className="font-medium">{h.name}</span>
                              {h.city && <span className="text-[10px] text-emerald-600 font-normal">({h.city})</span>}
                              <ArrowUpRight className="w-3 h-3 opacity-60" />
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">No hostels listed yet for this owner</p>
                      )}
                    </div>
                  </div>

                  {/* Card footer */}
                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <Link
                      href="/superadmin/hostels"
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1"
                    >
                      <span>View Hostels Directory</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                    <Link
                      href="/superadmin/users"
                      className="text-xs font-medium text-slate-500 hover:text-slate-800"
                    >
                      View Assigned Residents
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
