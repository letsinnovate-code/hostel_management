'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import {
  Users,
  Search,
  Filter,
  RefreshCw,
  Building,
  GraduationCap,
  Calendar,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Phone,
  Mail,
  UserCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  BedDouble,
  Shield,
  Layers,
} from 'lucide-react';

interface StudentItem {
  _id: string;
  name: string;
  studentId?: string;
  email: string;
  phone: string;
  gender?: string;
  course?: string;
  year?: string | number;
  status: 'active' | 'on-leave' | 'suspended' | 'exited';
  presenceStatus?: 'inside' | 'outside' | 'on-leave' | 'unknown';
  lastCheckIn?: string | null;
  lastCheckOut?: string | null;
  roomId?: {
    _id: string;
    roomNumber: string;
    floorNumber: number;
    capacity: number;
    currentOccupancy: number;
    category?: string;
  };
  blockId?: {
    _id: string;
    name: string;
  };
  parentContact?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  profileImage?: string;
  createdAt: string;
}

export default function WardenStudentsDirectoryPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [students, setStudents] = useState<StudentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter States
  const [search, setSearch] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('all');
  const [selectedFloor, setSelectedFloor] = useState('all');
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedGender, setSelectedGender] = useState('all');

  // Sorting
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalStudents, setTotalStudents] = useState(0);

  // Facets & Metrics from Backend
  const [facets, setFacets] = useState<{
    rooms: Array<{ _id: string; roomNumber: string; floorNumber: number }>;
    floors: number[];
    courses: string[];
    years: string[];
  }>({ rooms: [], floors: [], courses: [], years: [] });

  const [metrics, setMetrics] = useState<{
    total: number;
    active: number;
    onLeave: number;
    suspended: number;
    exited: number;
  }>({ total: 0, active: 0, onLeave: 0, suspended: 0, exited: 0 });

  // Load students function
  const fetchStudents = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await api.getWardenStudentsList({
        page,
        limit,
        search: search.trim() || undefined,
        room: selectedRoom !== 'all' ? selectedRoom : undefined,
        floor: selectedFloor !== 'all' ? selectedFloor : undefined,
        course: selectedCourse !== 'all' ? selectedCourse : undefined,
        year: selectedYear !== 'all' ? selectedYear : undefined,
        status: selectedStatus !== 'all' ? selectedStatus : undefined,
        gender: selectedGender !== 'all' ? selectedGender : undefined,
        sortBy,
        sortOrder,
      });

      if (res?.success && res.data) {
        setStudents(res.data.students || []);
        if (res.data.pagination) {
          setTotalStudents(res.data.pagination.total || 0);
          setTotalPages(res.data.pagination.totalPages || 1);
        }
        if (res.data.facets) {
          setFacets(res.data.facets);
        }
        if (res.data.metrics) {
          setMetrics(res.data.metrics);
        }
      }
    } catch (err: any) {
      console.error('Failed to load students:', err);
      toast.error(err.message || 'Failed to load students directory');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [
    page,
    limit,
    search,
    selectedRoom,
    selectedFloor,
    selectedCourse,
    selectedYear,
    selectedStatus,
    selectedGender,
    sortBy,
    sortOrder,
  ]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // Reset page when filters change
  const handleFilterChange = (setter: (val: string) => void, val: string) => {
    setter(val);
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearch('');
    setSelectedRoom('all');
    setSelectedFloor('all');
    setSelectedCourse('all');
    setSelectedYear('all');
    setSelectedStatus('all');
    setSelectedGender('all');
    setSortBy('name');
    setSortOrder('asc');
    setPage(1);
  };

  const hasActiveFilters =
    search.trim() !== '' ||
    selectedRoom !== 'all' ||
    selectedFloor !== 'all' ||
    selectedCourse !== 'all' ||
    selectedYear !== 'all' ||
    selectedStatus !== 'all' ||
    selectedGender !== 'all';

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    setPage(1);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Student Management</h1>
              <p className="text-sm text-gray-500">
                Directory, room allocations, attendance status, and student records for your hostel.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          <button
            onClick={() => fetchStudents(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold border border-gray-200 transition-all shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Residents</p>
            <p className="text-2xl font-bold text-gray-900">{metrics.total}</p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-emerald-100 bg-emerald-50/20 shadow-xs flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Active</p>
            <p className="text-2xl font-bold text-emerald-900">{metrics.active}</p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-purple-100 bg-purple-50/20 shadow-xs flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider">On Leave</p>
            <p className="text-2xl font-bold text-purple-900">{metrics.onLeave}</p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-rose-100 bg-rose-50/20 shadow-xs flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Suspended / Out</p>
            <p className="text-2xl font-bold text-rose-900">{metrics.suspended + metrics.exited}</p>
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        {/* Top search & sorting row */}
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, student ID, email, phone, or room..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-9 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
            />
            {search && (
              <button
                onClick={() => {
                  setSearch('');
                  setPage(1);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Sort Controls */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500 whitespace-nowrap">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
              aria-label="Sort by"
              className="py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            >
              <option value="name">Name</option>
              <option value="studentId">Student ID</option>
              <option value="status">Status</option>
              <option value="createdAt">Registration Date</option>
            </select>

            <button
              onClick={toggleSortOrder}
              title={`Sort order: ${sortOrder === 'asc' ? 'Ascending' : 'Descending'}`}
              className="p-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-gray-700 transition-colors"
            >
              {sortOrder === 'asc' ? (
                <ArrowUp className="w-4 h-4 text-indigo-600" />
              ) : (
                <ArrowDown className="w-4 h-4 text-indigo-600" />
              )}
            </button>
          </div>
        </div>

        {/* Filter Dropdowns Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2 border-t border-gray-100">
          {/* Room Filter */}
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Room</label>
            <select
              value={selectedRoom}
              onChange={(e) => handleFilterChange(setSelectedRoom, e.target.value)}
              className="w-full py-1.5 px-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            >
              <option value="all">All Rooms</option>
              {facets.rooms.map((r) => (
                <option key={r._id} value={r.roomNumber}>
                  Room {r.roomNumber}
                </option>
              ))}
            </select>
          </div>

          {/* Floor Filter */}
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Floor</label>
            <select
              value={selectedFloor}
              onChange={(e) => handleFilterChange(setSelectedFloor, e.target.value)}
              className="w-full py-1.5 px-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            >
              <option value="all">All Floors</option>
              {facets.floors.map((f) => (
                <option key={f} value={f}>
                  Floor {f}
                </option>
              ))}
            </select>
          </div>

          {/* Course Filter */}
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Course</label>
            <select
              value={selectedCourse}
              onChange={(e) => handleFilterChange(setSelectedCourse, e.target.value)}
              className="w-full py-1.5 px-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            >
              <option value="all">All Courses</option>
              {facets.courses.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Year Filter */}
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Year</label>
            <select
              value={selectedYear}
              onChange={(e) => handleFilterChange(setSelectedYear, e.target.value)}
              className="w-full py-1.5 px-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            >
              <option value="all">All Years</option>
              {facets.years.map((y) => (
                <option key={y} value={y}>
                  Year {y}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => handleFilterChange(setSelectedStatus, e.target.value)}
              className="w-full py-1.5 px-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="on-leave">On Leave</option>
              <option value="suspended">Suspended</option>
              <option value="exited">Exited</option>
            </select>
          </div>

          {/* Gender Filter */}
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Gender</label>
            <select
              value={selectedGender}
              onChange={(e) => handleFilterChange(setSelectedGender, e.target.value)}
              className="w-full py-1.5 px-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            >
              <option value="all">All Genders</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        {/* Active Filters Clear Row */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 text-xs">
            <span className="text-gray-500">Filters active</span>
            <button
              onClick={handleResetFilters}
              className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset All Filters</span>
            </button>
          </div>
        )}
      </div>

      {/* Student List View */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin text-indigo-600 mb-3">
              <RefreshCw className="w-8 h-8" />
            </div>
            <p className="text-sm font-semibold text-gray-600">Loading student directory...</p>
          </div>
        ) : students.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 bg-gray-50 border border-gray-200 rounded-2xl flex items-center justify-center text-gray-400 mx-auto mb-4">
              <Users className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">No students found</h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto mb-5">
              {hasActiveFilters
                ? 'No students match your active filters or search criteria.'
                : 'There are currently no students registered in your hostel.'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl text-sm font-semibold transition-colors"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/75 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    <th className="py-3.5 px-5">Student</th>
                    <th className="py-3.5 px-4">Room & Block</th>
                    <th className="py-3.5 px-4">Live Presence</th>
                    <th className="py-3.5 px-4">Course / Year</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Contact</th>
                    <th className="py-3.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {students.map((student) => {
                    const initials = student.name
                      ? student.name
                          .split(' ')
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()
                      : 'ST';

                    // Presence badge colors
                    const presence = student.presenceStatus || 'unknown';
                    const presenceConfig = {
                      inside: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', label: 'Inside' },
                      outside: { bg: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500', label: 'Outside' },
                      'on-leave': { bg: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-500', label: 'On Leave' },
                      unknown: { bg: 'bg-gray-50 text-gray-600 border-gray-200', dot: 'bg-gray-400', label: 'Unknown' },
                    }[presence];

                    // Status badge colors
                    const statusConfig = {
                      active: 'bg-emerald-50 text-emerald-700 border-emerald-100',
                      'on-leave': 'bg-purple-50 text-purple-700 border-purple-100',
                      suspended: 'bg-rose-50 text-rose-700 border-rose-100',
                      exited: 'bg-gray-100 text-gray-700 border-gray-200',
                    }[student.status] || 'bg-gray-50 text-gray-700 border-gray-200';

                    return (
                      <tr
                        key={student._id}
                        className="hover:bg-indigo-50/20 transition-colors group cursor-pointer"
                        onClick={() => router.push(`/warden/students/${student._id}`)}
                      >
                        {/* Student Name & Avatar */}
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-indigo-700 flex items-center justify-center text-white font-bold text-xs shadow-xs shrink-0">
                              {student.profileImage ? (
                                <img
                                  src={student.profileImage}
                                  alt={student.name}
                                  className="w-full h-full object-cover rounded-xl"
                                />
                              ) : (
                                initials
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                                {student.name}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-gray-500 font-mono">
                                  {student.studentId || 'ID: Pending'}
                                </span>
                                {student.gender && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 uppercase font-semibold">
                                    {student.gender}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Room & Block */}
                        <td className="py-4 px-4">
                          {student.roomId ? (
                            <div>
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-xs border border-indigo-100">
                                <BedDouble className="w-3.5 h-3.5" />
                                <span>Room {student.roomId.roomNumber}</span>
                              </span>
                              <p className="text-xs text-gray-400 mt-1">
                                Floor {student.roomId.floorNumber ?? '—'}
                                {student.blockId?.name ? ` • Block ${student.blockId.name}` : ''}
                              </p>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 italic">Unassigned</span>
                          )}
                        </td>

                        {/* Live Presence */}
                        <td className="py-4 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${presenceConfig.bg}`}
                          >
                            <span className={`w-2 h-2 rounded-full ${presenceConfig.dot} animate-pulse`} />
                            <span>{presenceConfig.label}</span>
                          </span>
                        </td>

                        {/* Course / Year */}
                        <td className="py-4 px-4">
                          <p className="font-medium text-gray-800 text-xs truncate max-w-[130px]">
                            {student.course || '—'}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {student.year ? `Year ${student.year}` : 'Year N/A'}
                          </p>
                        </td>

                        {/* Status */}
                        <td className="py-4 px-4">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-semibold border capitalize ${statusConfig}`}
                          >
                            {student.status}
                          </span>
                        </td>

                        {/* Contact */}
                        <td className="py-4 px-4">
                          <div className="space-y-0.5">
                            <p className="text-xs font-mono text-gray-700">{student.phone}</p>
                            {student.parentContact?.phone && (
                              <p className="text-[11px] text-gray-400">
                                Parent: <span className="font-mono">{student.parentContact.phone}</span>
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Action */}
                        <td className="py-4 px-5 text-right">
                          <Link
                            href={`/warden/students/${student._id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-indigo-50 text-gray-700 hover:text-indigo-600 rounded-lg text-xs font-semibold border border-gray-200 hover:border-indigo-200 transition-all shadow-2xs"
                          >
                            <span>Profile</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden divide-y divide-gray-100">
              {students.map((student) => {
                const initials = student.name
                  ? student.name
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()
                  : 'ST';

                const presence = student.presenceStatus || 'unknown';
                const presenceConfig = {
                  inside: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', label: 'Inside' },
                  outside: { bg: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500', label: 'Outside' },
                  'on-leave': { bg: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-500', label: 'On Leave' },
                  unknown: { bg: 'bg-gray-50 text-gray-600 border-gray-200', dot: 'bg-gray-400', label: 'Unknown' },
                }[presence];

                return (
                  <div
                    key={student._id}
                    onClick={() => router.push(`/warden/students/${student._id}`)}
                    className="p-4 space-y-3 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-xs">
                          {student.profileImage ? (
                            <img
                              src={student.profileImage}
                              alt={student.name}
                              className="w-full h-full object-cover rounded-xl"
                            />
                          ) : (
                            initials
                          )}
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900 leading-tight">{student.name}</h4>
                          <p className="text-xs text-gray-500 font-mono mt-0.5">
                            {student.studentId || 'ID: Pending'}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${presenceConfig.bg}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${presenceConfig.dot}`} />
                        <span>{presenceConfig.label}</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                      <div className="bg-gray-50 p-2 rounded-lg">
                        <span className="text-gray-400 block text-[10px] uppercase font-bold">Room</span>
                        <span className="font-semibold text-gray-800">
                          {student.roomId ? `Room ${student.roomId.roomNumber}` : 'Unassigned'}
                        </span>
                      </div>
                      <div className="bg-gray-50 p-2 rounded-lg">
                        <span className="text-gray-400 block text-[10px] uppercase font-bold">Course / Year</span>
                        <span className="font-semibold text-gray-800 truncate block">
                          {student.course || '—'} {student.year ? `(${student.year})` : ''}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs font-mono text-gray-600">{student.phone}</span>
                      <Link
                        href={`/warden/students/${student._id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-semibold"
                      >
                        <span>View Details</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            <div className="p-4 sm:p-5 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>
                  Showing <strong className="text-gray-800">{(page - 1) * limit + 1}</strong> to{' '}
                  <strong className="text-gray-800">{Math.min(page * limit, totalStudents)}</strong> of{' '}
                  <strong className="text-gray-800">{totalStudents}</strong> students
                </span>

                <div className="flex items-center gap-1.5 pl-2 border-l border-gray-200">
                  <span>Per page:</span>
                  <select
                    value={limit}
                    onChange={(e) => {
                      setLimit(Number(e.target.value));
                      setPage(1);
                    }}
                    aria-label="Items per page"
                    className="py-1 px-2 bg-gray-50 border border-gray-200 rounded-md text-xs font-semibold text-gray-700"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(1)}
                  disabled={page <= 1}
                  title="First Page"
                  className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 disabled:opacity-30 disabled:pointer-events-none"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  title="Previous Page"
                  className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 disabled:opacity-30 disabled:pointer-events-none"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="px-3 py-1 text-xs font-bold text-gray-700 bg-gray-50 border border-gray-200 rounded-lg">
                  Page {page} of {totalPages}
                </div>

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  title="Next Page"
                  className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 disabled:opacity-30 disabled:pointer-events-none"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(totalPages)}
                  disabled={page >= totalPages}
                  title="Last Page"
                  className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 disabled:opacity-30 disabled:pointer-events-none"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
