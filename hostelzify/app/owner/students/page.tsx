'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import { useToast } from '../../../components/Toast';
import {
  GraduationCap,
  Search,
  Filter,
  Users,
  Eye,
  Building2,
  BedDouble,
  CreditCard,
  AlertTriangle,
  FileCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Phone,
  Mail,
  User,
  Shield,
  Loader2,
  X,
  RefreshCw,
} from 'lucide-react';
import { useHostelsQuery } from '../../../hooks/queries/useHostelsQuery';
import { useOwnerHostel } from '../../../contexts/OwnerHostelContext';
import { Plus } from 'lucide-react';

export default function OwnerStudentsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const { selectedHostel, setSelectedHostel, hostels: ownerHostels } = useOwnerHostel();

  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [hostelFilter, setHostelFilter] = useState(selectedHostel || '');
  const [statusFilter, setStatusFilter] = useState('all');
  const [feeFilter, setFeeFilter] = useState('all');

  // Selected student for drawer/modal
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);

  const { data: hostels = [] } = useHostelsQuery();

  useEffect(() => {
    if (selectedHostel) {
      setHostelFilter(selectedHostel);
    }
  }, [selectedHostel]);

  useEffect(() => {
    if (!user || user.role !== 'owner') {
      router.replace('/login');
      return;
    }
    loadStudents();
  }, [user, router, selectedHostel]);

  const loadStudents = async () => {
    setLoading(true);
    try {
      const res: any = await api.getOwnerStudents({
        limit: 200,
        hostelId: selectedHostel || undefined,
      });
      const data = Array.isArray(res) ? res : res?.data ?? [];
      setStudents(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to load students', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res: any = await api.getOwnerStudents({
        limit: 200,
        hostelId: selectedHostel || undefined,
      });
      const data = Array.isArray(res) ? res : res?.data ?? [];
      setStudents(data);
      showToast('Students list refreshed', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to refresh', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const handleUpdateStudentStatus = async (newStatus: string) => {
    if (!selectedStudent) return;
    setStatusUpdating(true);
    try {
      await api.updateStudentStatus(selectedStudent._id || selectedStudent.id, newStatus);
      showToast(`Student status updated to ${newStatus}`, 'success');
      setSelectedStudent((prev: any) => ({ ...prev, status: newStatus }));
      setStudents((prev) =>
        prev.map((s) => (s._id === selectedStudent._id ? { ...s, status: newStatus } : s))
      );
    } catch (err: any) {
      showToast(err.message || 'Failed to update status', 'error');
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleResendWelcomeEmail = async () => {
    if (!selectedStudent) return;
    setResendingEmail(true);
    try {
      await api.resendWelcomeEmail(selectedStudent._id || selectedStudent.id);
      showToast('Welcome email resent successfully', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to resend welcome email', 'error');
    } finally {
      setResendingEmail(false);
    }
  };

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (search) {
        const query = search.toLowerCase();
        const nameMatch = s.name?.toLowerCase().includes(query);
        const emailMatch = s.email?.toLowerCase().includes(query);
        const phoneMatch = s.phone?.toLowerCase().includes(query);
        const studentIdMatch = s.studentId?.toLowerCase().includes(query);
        const roomMatch = s.roomId?.roomNumber?.toLowerCase().includes(query);
        if (!nameMatch && !emailMatch && !phoneMatch && !studentIdMatch && !roomMatch) {
          return false;
        }
      }

      if (hostelFilter) {
        const sHostelId = typeof s.hostelId === 'object' ? s.hostelId?._id : s.hostelId;
        if (sHostelId !== hostelFilter) return false;
      }

      if (statusFilter !== 'all') {
        if (s.status !== statusFilter) return false;
      }

      if (feeFilter !== 'all') {
        const hasPending = s.pendingFees || s.paymentStatus === 'pending';
        if (feeFilter === 'pending' && !hasPending) return false;
        if (feeFilter === 'paid' && hasPending) return false;
      }

      return true;
    });
  }, [students, search, hostelFilter, statusFilter, feeFilter]);

  const stats = useMemo(() => {
    const total = students.length;
    const active = students.filter((s) => s.status === 'active').length;
    const onLeave = students.filter((s) => s.status === 'on_leave' || s.status === 'on-leave').length;
    const pendingFeesCount = students.filter((s) => s.pendingFees || s.paymentStatus === 'pending').length;
    return { total, active, onLeave, pendingFeesCount };
  }, [students]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Active</span>;
      case 'on_leave':
      case 'on-leave':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">On Leave</span>;
      case 'suspended':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">Suspended</span>;
      case 'exited':
      case 'graduated':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-50 text-gray-700 border border-gray-200">Exited</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-50 text-gray-700 border border-gray-200">{status || 'Active'}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200/60 flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5" />
              Resident Oversight Hub
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mt-1">
            Student Roster & Overview
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            High-level oversight of occupancy, residency status, attendance, leaves, and fee compliance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="p-2.5 text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors disabled:opacity-50"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-purple-600' : ''}`} />
          </button>
          <Link
            href="/owner/students/create"
            className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all font-bold text-xs shadow-xs flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Add Resident
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-gray-200/80 p-4 shadow-xs">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Residents</p>
          <p className="text-2xl font-black text-gray-900 mt-1">{stats.total}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Enrolled students</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200/80 p-4 shadow-xs">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Active In Hostel</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{stats.active}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Current residents</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200/80 p-4 shadow-xs">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Currently On Leave</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{stats.onLeave}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Approved outpass</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200/80 p-4 shadow-xs">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Pending Dues</p>
          <p className="text-2xl font-black text-rose-600 mt-1">{stats.pendingFeesCount}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Students with unpaid fees</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">Filter by Property</label>
            <select
              value={hostelFilter}
              onChange={(e) => {
                const val = e.target.value;
                setHostelFilter(val);
                if (val) setSelectedHostel(val);
              }}
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 bg-white"
            >
              <option value="">All Hostels ({hostels.length})</option>
              {hostels.map((h: any) => (
                <option key={h._id || h.id} value={h._id || h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">Residency Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 bg-white"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="on_leave">On Leave</option>
              <option value="suspended">Suspended</option>
              <option value="exited">Exited</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">Fee Compliance</label>
            <select
              value={feeFilter}
              onChange={(e) => setFeeFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 bg-white"
            >
              <option value="all">All Fee Records</option>
              <option value="paid">Fully Paid</option>
              <option value="pending">Pending Payment</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">Search Resident</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, ID, room, phone..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-700">Loading student roster...</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-12 text-center">
            <GraduationCap className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-gray-900">No students found</h3>
            <p className="text-xs text-gray-500 mt-1">Try adjusting your filters or search keywords.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 text-xs font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 text-left">Student Info</th>
                  <th className="px-6 py-4 text-left">Student ID</th>
                  <th className="px-6 py-4 text-left">Property & Room</th>
                  <th className="px-6 py-4 text-left">Status</th>
                  <th className="px-6 py-4 text-left">Fee Status</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-xs">
                {filteredStudents.map((student: any) => {
                  const roomNum = student.roomId?.roomNumber || student.roomNumber || '—';
                  const hostelName = student.hostelId?.name || (typeof student.hostelId === 'string' ? 'Hostel' : '—');
                  const hasPendingFee = student.pendingFees || student.paymentStatus === 'pending';

                  return (
                    <tr
                      key={student._id || student.id}
                      className="hover:bg-gray-50/80 transition-colors cursor-pointer"
                      onClick={() => setSelectedStudent(student)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-sm">
                            {student.name ? student.name.charAt(0).toUpperCase() : 'S'}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900">{student.name || 'Unnamed Student'}</p>
                            <p className="text-[11px] text-gray-500">{student.email}</p>
                            {student.phone && (
                              <p className="text-[10px] text-gray-400">{student.phone}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span className="font-mono font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                          {student.studentId || student._id?.slice(-6) || '—'}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <p className="font-semibold text-gray-900">{hostelName}</p>
                        <p className="text-[11px] text-gray-500">Room {roomNum}</p>
                      </td>

                      <td className="px-6 py-4">{getStatusBadge(student.status)}</td>

                      <td className="px-6 py-4">
                        {hasPendingFee ? (
                          <span className="inline-flex items-center gap-1 text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                            <Clock className="w-3 h-3" />
                            Pending Dues
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            Paid
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedStudent(student)}
                          className="px-3 py-1.5 text-xs font-bold text-purple-600 hover:bg-purple-50 rounded-lg transition-colors inline-flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View Profile
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Student Oversight Detail Drawer / Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-gray-200 max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-purple-100 text-purple-700 font-black text-lg flex items-center justify-center">
                  {selectedStudent.name ? selectedStudent.name.charAt(0).toUpperCase() : 'S'}
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900">{selectedStudent.name}</h3>
                  <p className="text-xs text-gray-500">ID: {selectedStudent.studentId || selectedStudent._id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedStudent(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Status Bar */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200/80">
                <p className="text-[10px] uppercase font-bold text-gray-400">Residency</p>
                <div className="mt-1">{getStatusBadge(selectedStudent.status)}</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200/80">
                <p className="text-[10px] uppercase font-bold text-gray-400">Room Allocation</p>
                <p className="text-xs font-bold text-gray-900 mt-1">
                  Room {selectedStudent.roomId?.roomNumber || selectedStudent.roomNumber || 'Unassigned'}
                </p>
              </div>
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200/80">
                <p className="text-[10px] uppercase font-bold text-gray-400">Fee Status</p>
                <p className="text-xs font-bold text-gray-900 mt-1">
                  {selectedStudent.pendingFees ? '₹' + selectedStudent.pendingFees + ' Due' : 'All Clear'}
                </p>
              </div>
            </div>

            {/* Contact Details */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">Contact Information</h4>
              <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200/80 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-gray-400">Email:</span>
                  <p className="font-semibold text-gray-900">{selectedStudent.email || '—'}</p>
                </div>
                <div>
                  <span className="text-gray-400">Phone:</span>
                  <p className="font-semibold text-gray-900">{selectedStudent.phone || '—'}</p>
                </div>
                <div>
                  <span className="text-gray-400">Guardian Name:</span>
                  <p className="font-semibold text-gray-900">{selectedStudent.parentContact?.name || selectedStudent.parentInfo?.name || '—'}</p>
                </div>
                <div>
                  <span className="text-gray-400">Guardian Phone:</span>
                  <p className="font-semibold text-gray-900">{selectedStudent.parentContact?.phone || selectedStudent.parentInfo?.phone || '—'}</p>
                </div>
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">Emergency Contact</h4>
              <div className="bg-rose-50/50 p-3.5 rounded-xl border border-rose-100 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-rose-400 text-[10px] uppercase font-bold">Contact Name</span>
                  <p className="font-semibold text-rose-900">{selectedStudent.emergencyContact?.name || '—'}</p>
                </div>
                <div>
                  <span className="text-rose-400 text-[10px] uppercase font-bold">Phone Number</span>
                  <p className="font-semibold text-rose-900">{selectedStudent.emergencyContact?.phone || '—'}</p>
                </div>
                <div>
                  <span className="text-rose-400 text-[10px] uppercase font-bold">Relationship</span>
                  <p className="font-semibold text-rose-900">{selectedStudent.emergencyContact?.relationship || '—'}</p>
                </div>
              </div>
            </div>

            {/* Boundary Notification Note */}
            <div className="bg-purple-50 p-3 rounded-xl border border-purple-200/60 text-xs text-purple-900 flex items-start gap-2">
              <Shield className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
              <p>
                <strong>Owner Governance Notice:</strong> Daily operational student administration (leave approvals, check-ins, room swaps) is performed by the assigned Warden.
              </p>
            </div>

            {/* Owner Actions */}
            <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-500">Status:</span>
                <select
                  value={selectedStudent.status || 'active'}
                  disabled={statusUpdating}
                  onChange={(e) => handleUpdateStudentStatus(e.target.value)}
                  className="px-2.5 py-1 text-xs border border-gray-300 rounded-lg bg-white font-medium focus:ring-2 focus:ring-purple-500"
                >
                  <option value="active">Active</option>
                  <option value="on-leave">On Leave</option>
                  <option value="suspended">Suspended</option>
                  <option value="exited">Exited</option>
                </select>
                {statusUpdating && <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResendWelcomeEmail}
                  disabled={resendingEmail}
                  className="px-3 py-1.5 border border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Mail className="w-3.5 h-3.5" />
                  {resendingEmail ? 'Sending...' : 'Resend Welcome Email'}
                </button>
                <Link
                  href={`/owner/students/${selectedStudent._id || selectedStudent.id}`}
                  className="px-3.5 py-1.5 bg-purple-600 text-white rounded-xl text-xs font-bold hover:bg-purple-700 transition-colors flex items-center gap-1"
                >
                  Full Profile &rarr;
                </Link>
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="px-4 py-1.5 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
