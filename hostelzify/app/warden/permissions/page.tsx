'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import {
  FileCheck2,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Calendar,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  UserX,
  Phone,
  Building,
  ArrowRight,
  ExternalLink,
  FileText,
  LogOut,
  LogIn,
  History,
  Shield,
  MapPin,
  X,
  Info,
  Check,
  ChevronRight,
  ChevronLeft,
  CalendarRange,
  MessageSquare,
  Sparkles,
  Download,
  Eye,
  AlertOctagon,
} from 'lucide-react';

interface SupportingDoc {
  title?: string;
  fileUrl: string;
  fileType?: string;
  uploadedAt?: string;
}

interface Student {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  studentId?: string;
  gender?: string;
  course?: string;
  year?: string | number;
  status?: string;
  roomId?: {
    _id?: string;
    roomNumber?: string;
    floorNumber?: number;
  } | any;
  parentContact?: {
    name?: string;
    phone?: string;
  };
  emergencyContact?: {
    name?: string;
    phone?: string;
    relation?: string;
  };
}

interface LeaveApplication {
  _id: string;
  studentId: Student;
  permissionType?: string;
  type?: string;
  requestedDate: string;
  returnDate?: string;
  reason: string;
  destination?: string;
  status: 'pending' | 'approved' | 'checked-out' | 'returned' | 'rejected' | 'cancelled';
  supportingDocuments?: SupportingDoc[];
  documentUrl?: string;
  wardenRemarks?: string;
  rejectionReason?: string;
  cancellationReason?: string;
  actualCheckOutTime?: string;
  actualReturnTime?: string;
  approvedBy?: { name: string; role: string };
  cancelledBy?: { name: string; role: string };
  isOverdue?: boolean;
  hoursOverdue?: number;
  createdAt: string;
}

interface LeaveStats {
  total: number;
  pending: number;
  approved: number;
  checkedOut: number;
  overdue: number;
  returned: number;
  rejected: number;
  cancelled: number;
}

export default function WardenLeaveManagement() {
  const { user } = useAuth();
  const router = useRouter();

  // Navigation tabs: 'all' | 'pending' | 'absent' | 'overdue' | 'history'
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'absent' | 'overdue' | 'history'>('all');

  // Core data states
  const [leaves, setLeaves] = useState<LeaveApplication[]>([]);
  const [stats, setStats] = useState<LeaveStats>({
    total: 0,
    pending: 0,
    approved: 0,
    checkedOut: 0,
    overdue: 0,
    returned: 0,
    rejected: 0,
    cancelled: 0,
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modals & Drawers
  const [approveModal, setApproveModal] = useState<{ open: boolean; leave: LeaveApplication | null; remarks: string }>({
    open: false,
    leave: null,
    remarks: '',
  });

  const [rejectModal, setRejectModal] = useState<{ open: boolean; leave: LeaveApplication | null; reason: string; remarks: string }>({
    open: false,
    leave: null,
    reason: '',
    remarks: '',
  });

  const [cancelModal, setCancelModal] = useState<{ open: boolean; leave: LeaveApplication | null; reason: string }>({
    open: false,
    leave: null,
    reason: '',
  });

  const [checkOutModal, setCheckOutModal] = useState<{ open: boolean; leave: LeaveApplication | null; time: string; remarks: string }>({
    open: false,
    leave: null,
    time: '',
    remarks: '',
  });

  const [returnModal, setReturnModal] = useState<{ open: boolean; leave: LeaveApplication | null; time: string; remarks: string }>({
    open: false,
    leave: null,
    time: '',
    remarks: '',
  });

  const [remarksModal, setRemarksModal] = useState<{ open: boolean; leave: LeaveApplication | null; remarks: string }>({
    open: false,
    leave: null,
    remarks: '',
  });

  const [detailsDrawer, setDetailsDrawer] = useState<{ open: boolean; leave: LeaveApplication | null }>({
    open: false,
    leave: null,
  });

  const [historyDrawer, setHistoryDrawer] = useState<{
    open: boolean;
    student: Student | null;
    history: LeaveApplication[];
    historyStats: any;
    loading: boolean;
  }>({
    open: false,
    student: null,
    history: [],
    historyStats: null,
    loading: false,
  });

  useEffect(() => {
    if (!user || user.role !== 'warden') {
      router.replace('/login');
      return;
    }
    loadLeaveData();
  }, [user, router, activeTab, statusFilter, typeFilter, startDateFilter, endDateFilter, currentPage]);

  const loadLeaveData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'absent') {
        const response = await api.getWardenCurrentlyAbsent();
        const items = response.data || [];
        setLeaves(items);
        setStats((prev) => ({
          ...prev,
          checkedOut: response.count ?? items.length,
        }));
        setTotalPages(1);
      } else if (activeTab === 'overdue') {
        const response = await api.getWardenOverdueLeaves();
        const items = response.data || [];
        setLeaves(items);
        setStats((prev) => ({
          ...prev,
          overdue: response.count ?? items.length,
        }));
        setTotalPages(1);
      } else {
        const params: Record<string, any> = {
          page: currentPage,
          limit: 15,
        };

        if (activeTab === 'pending') {
          params.status = 'pending';
        } else if (statusFilter !== 'ALL') {
          params.status = statusFilter;
        }

        if (typeFilter !== 'ALL') {
          params.permissionType = typeFilter;
        }

        if (startDateFilter) {
          params.startDate = startDateFilter;
        }
        if (endDateFilter) {
          params.endDate = endDateFilter;
        }

        const response = await api.getWardenLeaves(params);
        setLeaves(response.data || []);
        if (response.stats) {
          setStats(response.stats);
        }
        if (response.pagination) {
          setTotalPages(response.pagination.totalPages || 1);
        }
      }
    } catch (error: any) {
      console.error('Failed to load leave applications:', error);
      toast.error(error.response?.data?.message || error.message || 'Failed to load leaves');
    } finally {
      setLoading(false);
    }
  };

  // Quick reset filters
  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setTypeFilter('ALL');
    setStartDateFilter('');
    setEndDateFilter('');
    setCurrentPage(1);
  };

  // Filtered leaves by client search query
  const filteredLeaves = useMemo(() => {
    if (!searchQuery.trim()) return leaves;
    const q = searchQuery.toLowerCase().trim();
    return leaves.filter((leave) => {
      const studentName = leave.studentId?.name || '';
      const rollNo = leave.studentId?.studentId || '';
      const roomNum =
        typeof leave.studentId?.roomId === 'object'
          ? leave.studentId?.roomId?.roomNumber || ''
          : leave.studentId?.roomId || '';
      const destination = leave.destination || '';
      const reason = leave.reason || '';
      const type = leave.permissionType || leave.type || '';

      return (
        studentName.toLowerCase().includes(q) ||
        rollNo.toLowerCase().includes(q) ||
        roomNum.toLowerCase().includes(q) ||
        destination.toLowerCase().includes(q) ||
        reason.toLowerCase().includes(q) ||
        type.toLowerCase().includes(q)
      );
    });
  }, [leaves, searchQuery]);

  // Handle Approve
  const handleApproveConfirm = async () => {
    if (!approveModal.leave) return;
    const leaveId = approveModal.leave._id;
    setActionLoading(leaveId);
    try {
      await api.approveWardenLeave(leaveId, {
        wardenRemarks: approveModal.remarks.trim() || undefined,
      });
      toast.success('Leave approved successfully & student notified');
      setApproveModal({ open: false, leave: null, remarks: '' });
      loadLeaveData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || 'Failed to approve leave');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle Reject
  const handleRejectConfirm = async () => {
    if (!rejectModal.leave) return;
    if (!rejectModal.reason.trim()) {
      toast.error('Rejection reason is required');
      return;
    }
    const leaveId = rejectModal.leave._id;
    setActionLoading(leaveId);
    try {
      await api.rejectWardenLeave(leaveId, {
        rejectionReason: rejectModal.reason.trim(),
        wardenRemarks: rejectModal.remarks.trim() || undefined,
      });
      toast.success('Leave rejected & student notified');
      setRejectModal({ open: false, leave: null, reason: '', remarks: '' });
      loadLeaveData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || 'Failed to reject leave');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle Cancel / Revoke
  const handleCancelConfirm = async () => {
    if (!cancelModal.leave) return;
    if (!cancelModal.reason.trim()) {
      toast.error('Cancellation reason is required');
      return;
    }
    const leaveId = cancelModal.leave._id;
    setActionLoading(leaveId);
    try {
      await api.cancelWardenLeave(leaveId, {
        cancellationReason: cancelModal.reason.trim(),
      });
      toast.success('Leave revoked & student status restored');
      setCancelModal({ open: false, leave: null, reason: '' });
      loadLeaveData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || 'Failed to cancel leave');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle Check-Out (Departure)
  const handleCheckOutConfirm = async () => {
    if (!checkOutModal.leave) return;
    const leaveId = checkOutModal.leave._id;
    setActionLoading(leaveId);
    try {
      await api.recordWardenLeaveCheckOut(leaveId, {
        actualCheckOutTime: checkOutModal.time || undefined,
        remarks: checkOutModal.remarks.trim() || undefined,
      });
      toast.success('Student departure recorded & marked On-Leave');
      setCheckOutModal({ open: false, leave: null, time: '', remarks: '' });
      loadLeaveData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || 'Failed to record check-out');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle Return (Arrival)
  const handleReturnConfirm = async () => {
    if (!returnModal.leave) return;
    const leaveId = returnModal.leave._id;
    setActionLoading(leaveId);
    try {
      await api.recordWardenLeaveReturn(leaveId, {
        actualReturnTime: returnModal.time || undefined,
        remarks: returnModal.remarks.trim() || undefined,
      });
      toast.success('Student return verified & status restored to Active');
      setReturnModal({ open: false, leave: null, time: '', remarks: '' });
      loadLeaveData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || 'Failed to record return');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle Remarks Update
  const handleRemarksConfirm = async () => {
    if (!remarksModal.leave) return;
    const leaveId = remarksModal.leave._id;
    setActionLoading(leaveId);
    try {
      await api.updateWardenLeaveRemarks(leaveId, {
        wardenRemarks: remarksModal.remarks.trim(),
      });
      toast.success('Remarks updated successfully');
      setRemarksModal({ open: false, leave: null, remarks: '' });
      loadLeaveData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || 'Failed to update remarks');
    } finally {
      setActionLoading(null);
    }
  };

  // Open Student History Drawer
  const openStudentHistory = async (student: Student) => {
    setHistoryDrawer({
      open: true,
      student,
      history: [],
      historyStats: null,
      loading: true,
    });

    try {
      const res = await api.getWardenStudentLeaveHistory(student._id);
      setHistoryDrawer((prev) => ({
        ...prev,
        history: res.data || [],
        historyStats: res.stats || null,
        loading: false,
      }));
    } catch (error: any) {
      console.error('Failed to load student history:', error);
      toast.error('Failed to load leave history for this resident');
      setHistoryDrawer((prev) => ({ ...prev, loading: false }));
    }
  };

  // Helper status badge generator
  const getStatusBadge = (leave: LeaveApplication) => {
    const status = leave.status;
    const isOverdue = leave.isOverdue;

    if (isOverdue && status === 'checked-out') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
          OVERDUE ({leave.hoursOverdue ? `${leave.hoursOverdue}h` : 'Late'})
        </span>
      );
    }

    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5" /> Pending Review
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> Approved (Awaiting Departure)
          </span>
        );
      case 'checked-out':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <LogOut className="w-3.5 h-3.5" /> Checked Out (On Leave)
          </span>
        );
      case 'returned':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <LogIn className="w-3.5 h-3.5" /> Returned to Hostel
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5" /> Rejected
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-300">
            <X className="w-3.5 h-3.5" /> Revoked / Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-100">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Warden Leave & Permission Management</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Review outpass applications, track absent residents, record physical returns, and manage overdue alerts.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadLeaveData}
            disabled={loading}
            className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <button
          onClick={() => {
            setActiveTab('all');
            setStatusFilter('ALL');
          }}
          className={`p-4 rounded-2xl border text-left transition-all ${
            activeTab === 'all' && statusFilter === 'ALL'
              ? 'bg-indigo-50 border-indigo-200 ring-2 ring-indigo-500/20 shadow-sm'
              : 'bg-white border-gray-100 hover:border-gray-200 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Applications</span>
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
          </div>
          <p className="text-2xl font-extrabold text-gray-900 mt-2">{stats.total}</p>
          <p className="text-xs text-gray-400 mt-0.5">All time records</p>
        </button>

        <button
          onClick={() => {
            setActiveTab('pending');
            setStatusFilter('pending');
          }}
          className={`p-4 rounded-2xl border text-left transition-all ${
            activeTab === 'pending'
              ? 'bg-amber-50 border-amber-200 ring-2 ring-amber-500/20 shadow-sm'
              : 'bg-white border-gray-100 hover:border-gray-200 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Pending Review</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-extrabold text-amber-900 mt-2">{stats.pending}</p>
          <p className="text-xs text-amber-600 mt-0.5">Requires approval</p>
        </button>

        <button
          onClick={() => {
            setActiveTab('absent');
            setStatusFilter('checked-out');
          }}
          className={`p-4 rounded-2xl border text-left transition-all ${
            activeTab === 'absent'
              ? 'bg-purple-50 border-purple-200 ring-2 ring-purple-500/20 shadow-sm'
              : 'bg-white border-gray-100 hover:border-gray-200 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-700 uppercase tracking-wider">Currently Absent</span>
            <LogOut className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-extrabold text-purple-900 mt-2">{stats.checkedOut}</p>
          <p className="text-xs text-purple-600 mt-0.5">Out of hostel</p>
        </button>

        <button
          onClick={() => {
            setActiveTab('overdue');
          }}
          className={`p-4 rounded-2xl border text-left transition-all ${
            activeTab === 'overdue'
              ? 'bg-rose-50 border-rose-200 ring-2 ring-rose-500/20 shadow-sm'
              : 'bg-white border-gray-100 hover:border-gray-200 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-700 uppercase tracking-wider">Overdue Watch</span>
            <AlertTriangle className={`w-4 h-4 text-rose-600 ${stats.overdue > 0 ? 'animate-bounce' : ''}`} />
          </div>
          <p className="text-2xl font-extrabold text-rose-900 mt-2">{stats.overdue}</p>
          <p className="text-xs text-rose-600 mt-0.5 font-medium">
            {stats.overdue > 0 ? 'Action required!' : 'None overdue'}
          </p>
        </button>

        <button
          onClick={() => {
            setActiveTab('all');
            setStatusFilter('returned');
          }}
          className={`p-4 rounded-2xl border text-left transition-all ${
            activeTab === 'all' && statusFilter === 'returned'
              ? 'bg-emerald-50 border-emerald-200 ring-2 ring-emerald-500/20 shadow-sm'
              : 'bg-white border-gray-100 hover:border-gray-200 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Returned Safely</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-extrabold text-emerald-900 mt-2">{stats.returned}</p>
          <p className="text-xs text-emerald-600 mt-0.5">Completed leaves</p>
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2 overflow-x-auto">
        <button
          onClick={() => {
            setActiveTab('all');
            setStatusFilter('ALL');
          }}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'all' && statusFilter === 'ALL'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <FileCheck2 className="w-4 h-4" />
          All Applications ({stats.total})
        </button>

        <button
          onClick={() => {
            setActiveTab('pending');
            setStatusFilter('pending');
          }}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'pending'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Clock className="w-4 h-4" />
          Pending Approvals ({stats.pending})
        </button>

        <button
          onClick={() => {
            setActiveTab('absent');
          }}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'absent'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <LogOut className="w-4 h-4" />
          Currently Absent ({stats.checkedOut})
        </button>

        <button
          onClick={() => {
            setActiveTab('overdue');
          }}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'overdue'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <AlertOctagon className="w-4 h-4" />
          Overdue Watch ({stats.overdue})
        </button>

        <button
          onClick={() => {
            setActiveTab('history');
            setStatusFilter('returned');
          }}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'history'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <History className="w-4 h-4" />
          Return Ledger & History
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search resident name, roll number, room, destination, reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          {activeTab !== 'pending' && activeTab !== 'absent' && activeTab !== 'overdue' && (
            <div className="flex items-center gap-2 w-full lg:w-auto">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full lg:w-auto text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="pending">Pending Review</option>
                <option value="approved">Approved</option>
                <option value="checked-out">Checked Out (On Leave)</option>
                <option value="returned">Returned</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled / Revoked</option>
              </select>
            </div>
          )}

          {/* Leave Type Filter */}
          <div className="flex items-center gap-2 w-full lg:w-auto">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full lg:w-auto text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="ALL">All Categories</option>
              <option value="LEAVE">Leave / Vacation</option>
              <option value="NIGHT_OUT">Night Outpass</option>
              <option value="DAY_PASS">Day Pass</option>
              <option value="EMERGENCY">Emergency</option>
              <option value="LATE_ENTRY">Late Entry</option>
            </select>
          </div>
        </div>

        {/* Date Range Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-gray-100 text-xs text-gray-500">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-gray-600 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Date Filter:
            </span>
            <input
              type="date"
              value={startDateFilter}
              onChange={(e) => setStartDateFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="From Date"
            />
            <span>to</span>
            <input
              type="date"
              value={endDateFilter}
              onChange={(e) => setEndDateFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="To Date"
            />
            {(startDateFilter || endDateFilter) && (
              <button
                onClick={() => {
                  setStartDateFilter('');
                  setEndDateFilter('');
                }}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium ml-1"
              >
                Clear Dates
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span>
              Showing <span className="font-semibold text-gray-800">{filteredLeaves.length}</span> records
            </span>
            {(searchQuery || statusFilter !== 'ALL' || typeFilter !== 'ALL' || startDateFilter || endDateFilter) && (
              <button
                onClick={resetFilters}
                className="text-xs font-semibold text-rose-600 hover:text-rose-800 underline"
              >
                Reset All Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-sm font-medium text-gray-600">Loading leave records & absence verification...</p>
        </div>
      ) : filteredLeaves.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">No Leave Applications Found</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
            {activeTab === 'pending'
              ? 'Great job! There are no pending leave requests waiting for your decision right now.'
              : activeTab === 'overdue'
              ? 'Excellent! No students are currently overdue from their scheduled leaves.'
              : activeTab === 'absent'
              ? 'No students are currently marked as checked out on leave.'
              : 'No leave applications matched the selected filters.'}
          </p>
          {(searchQuery || statusFilter !== 'ALL' || typeFilter !== 'ALL' || startDateFilter || endDateFilter) && (
            <button
              onClick={resetFilters}
              className="mt-4 px-4 py-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 rounded-xl inline-flex items-center gap-1.5"
            >
              Clear Search Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredLeaves.map((leave) => {
            const student = leave.studentId || ({} as Student);
            const studentName = student.name || 'Resident';
            const rollNo = student.studentId ? `ID: ${student.studentId}` : '';
            const roomNumber =
              typeof student.roomId === 'object'
                ? student.roomId?.roomNumber
                  ? `Room ${student.roomId?.roomNumber}`
                  : 'Room Unassigned'
                : student.roomId
                ? `Room ${student.roomId}`
                : 'Room Unassigned';
            const floorInfo =
              typeof student.roomId === 'object' && student.roomId?.floorNumber !== undefined
                ? `Floor ${student.roomId?.floorNumber}`
                : '';
            const isProcessing = actionLoading === leave._id;
            const category = leave.permissionType || leave.type || 'Leave';

            // Document check
            const hasDocs =
              (leave.supportingDocuments && leave.supportingDocuments.length > 0) || Boolean(leave.documentUrl);

            return (
              <div
                key={leave._id}
                className={`bg-white rounded-2xl border transition-all shadow-sm flex flex-col justify-between hover:shadow-md ${
                  leave.isOverdue && leave.status === 'checked-out'
                    ? 'border-rose-300 ring-1 ring-rose-300 bg-rose-50/20'
                    : 'border-gray-100 hover:border-indigo-100'
                }`}
              >
                <div className="p-5 sm:p-6">
                  {/* Top line: Tags & Status Badge */}
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {category}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-gray-100 text-gray-700">
                        {roomNumber} {floorInfo && `• ${floorInfo}`}
                      </span>
                      {rollNo && (
                        <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-600">
                          {rollNo}
                        </span>
                      )}
                    </div>
                    {getStatusBadge(leave)}
                  </div>

                  {/* Student profile info */}
                  <div className="mt-3.5 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        {studentName}
                        {student.gender && (
                          <span className="text-xs font-normal text-gray-400 capitalize">({student.gender})</span>
                        )}
                      </h3>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-1 flex-wrap">
                        {student.phone && (
                          <a
                            href={`tel:${student.phone}`}
                            className="flex items-center gap-1 hover:text-indigo-600 transition-colors"
                          >
                            <Phone className="w-3.5 h-3.5 text-gray-400" />
                            {student.phone}
                          </a>
                        )}
                        {student.course && (
                          <span>
                            {student.course} {student.year ? `• Year ${student.year}` : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quick Student History Ledger Button */}
                    <button
                      onClick={() => openStudentHistory(student)}
                      className="px-2.5 py-1 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-100 transition-colors flex items-center gap-1 whitespace-nowrap"
                      title="View Student Leave History"
                    >
                      <History className="w-3.5 h-3.5" />
                      History
                    </button>
                  </div>

                  {/* Destination & Reason Banner */}
                  <div className="mt-4 p-3.5 bg-gray-50 rounded-xl border border-gray-100 space-y-1.5 text-xs">
                    {leave.destination && (
                      <div className="flex items-center gap-1.5 text-gray-700 font-semibold">
                        <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span>Destination: <span className="font-bold text-gray-900">{leave.destination}</span></span>
                      </div>
                    )}
                    <div className="text-gray-600">
                      <span className="font-semibold text-gray-500">Reason:</span> {leave.reason || 'No specific explanation provided.'}
                    </div>
                  </div>

                  {/* Dates Grid */}
                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Departure Date</p>
                      <p className="font-bold text-gray-800 mt-0.5 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-gray-500" />
                        {leave.requestedDate ? new Date(leave.requestedDate).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        }) : 'N/A'}
                      </p>
                      {leave.actualCheckOutTime && (
                        <p className="text-[11px] text-purple-700 font-medium mt-1">
                          Departed: {new Date(leave.actualCheckOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>

                    <div className={`p-2.5 rounded-xl border ${
                      leave.isOverdue && leave.status === 'checked-out'
                        ? 'bg-rose-50 border-rose-200'
                        : 'bg-slate-50 border-slate-100'
                    }`}>
                      <p className={`text-[11px] font-semibold uppercase tracking-wider ${
                        leave.isOverdue && leave.status === 'checked-out' ? 'text-rose-600 font-bold' : 'text-gray-400'
                      }`}>
                        Expected Return
                      </p>
                      <p className="font-bold text-gray-800 mt-0.5 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-gray-500" />
                        {leave.returnDate ? new Date(leave.returnDate).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        }) : 'N/A'}
                      </p>
                      {leave.actualReturnTime ? (
                        <p className="text-[11px] text-emerald-700 font-medium mt-1">
                          Returned: {new Date(leave.actualReturnTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      ) : leave.isOverdue && leave.status === 'checked-out' ? (
                        <p className="text-[11px] text-rose-700 font-bold mt-1">
                          ⚠️ {leave.hoursOverdue ? `${leave.hoursOverdue}h overdue` : 'Overdue!'}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {/* Supporting Documents & Remarks indicators */}
                  <div className="mt-3.5 flex items-center justify-between gap-2 flex-wrap text-xs text-gray-500">
                    <div className="flex items-center gap-2">
                      {hasDocs ? (
                        <button
                          onClick={() => setDetailsDrawer({ open: true, leave })}
                          className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-800"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          View Documents ({leave.supportingDocuments?.length || 1})
                        </button>
                      ) : (
                        <span className="text-gray-400 italic">No docs attached</span>
                      )}
                    </div>

                    {leave.wardenRemarks && (
                      <span className="text-gray-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[11px] truncate max-w-[200px]" title={leave.wardenRemarks}>
                        Remarks: {leave.wardenRemarks}
                      </span>
                    )}
                  </div>

                  {/* Guardian / Emergency Contact snippet if overdue or on leave */}
                  {(leave.status === 'checked-out' || leave.isOverdue) && student.parentContact?.phone && (
                    <div className="mt-3 p-2.5 bg-amber-50/70 border border-amber-200/80 rounded-xl flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-amber-700" />
                        <span className="text-amber-900 font-medium">
                          Parent: <span className="font-bold">{student.parentContact.name || 'Guardian'}</span> ({student.parentContact.phone})
                        </span>
                      </div>
                      <a
                        href={`tel:${student.parentContact.phone}`}
                        className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-semibold transition-colors shadow-sm"
                      >
                        Call Parent
                      </a>
                    </div>
                  )}
                </div>

                {/* Bottom Action Ribbon */}
                <div className="px-5 py-3.5 bg-gray-50/80 border-t border-gray-100 rounded-b-2xl flex items-center justify-between gap-2 flex-wrap">
                  <button
                    onClick={() => setDetailsDrawer({ open: true, leave })}
                    className="text-xs font-semibold text-gray-600 hover:text-indigo-600 flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" /> Full Details
                  </button>

                  <div className="flex items-center gap-2">
                    {/* Actions when PENDING */}
                    {leave.status === 'pending' && (
                      <>
                        <button
                          onClick={() => setApproveModal({ open: true, leave, remarks: '' })}
                          disabled={isProcessing}
                          className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors flex items-center gap-1 disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Approve
                        </button>
                        <button
                          onClick={() => setRejectModal({ open: true, leave, reason: '', remarks: '' })}
                          disabled={isProcessing}
                          className="py-1.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1 disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Reject
                        </button>
                      </>
                    )}

                    {/* Actions when APPROVED */}
                    {leave.status === 'approved' && (
                      <>
                        <button
                          onClick={() =>
                            setCheckOutModal({
                              open: true,
                              leave,
                              time: new Date().toISOString().slice(0, 16),
                              remarks: '',
                            })
                          }
                          disabled={isProcessing}
                          className="py-1.5 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors flex items-center gap-1 disabled:opacity-50"
                          title="Record physical gate departure"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          Record Departure (Check Out)
                        </button>
                        <button
                          onClick={() => setCancelModal({ open: true, leave, reason: '' })}
                          disabled={isProcessing}
                          className="py-1.5 px-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1 disabled:opacity-50"
                          title="Revoke approval"
                        >
                          <X className="w-3.5 h-3.5 text-gray-500" />
                          Revoke
                        </button>
                      </>
                    )}

                    {/* Actions when CHECKED-OUT */}
                    {leave.status === 'checked-out' && (
                      <>
                        <button
                          onClick={() =>
                            setReturnModal({
                              open: true,
                              leave,
                              time: new Date().toISOString().slice(0, 16),
                              remarks: '',
                            })
                          }
                          disabled={isProcessing}
                          className="py-1.5 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors flex items-center gap-1 disabled:opacity-50"
                          title="Record physical arrival back at hostel"
                        >
                          <LogIn className="w-3.5 h-3.5" />
                          Record Return (Arrival)
                        </button>
                        <button
                          onClick={() => setRemarksModal({ open: true, leave, remarks: leave.wardenRemarks || '' })}
                          className="py-1.5 px-2 text-xs font-medium text-gray-600 hover:text-gray-900 bg-white border border-gray-200 rounded-lg"
                          title="Add/Edit Remarks"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}

                    {/* Actions when RETURNED / REJECTED / CANCELLED */}
                    {(leave.status === 'returned' || leave.status === 'rejected' || leave.status === 'cancelled') && (
                      <button
                        onClick={() => setRemarksModal({ open: true, leave, remarks: leave.wardenRemarks || '' })}
                        className="py-1.5 px-2.5 text-xs font-medium text-gray-600 hover:text-gray-900 bg-white border border-gray-200 rounded-lg flex items-center gap-1"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
                        {leave.wardenRemarks ? 'Edit Remarks' : 'Add Remarks'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white px-5 py-3 rounded-2xl border border-gray-100 shadow-sm text-sm">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-40 flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          <span className="text-gray-500 font-medium">
            Page <span className="font-bold text-gray-800">{currentPage}</span> of{' '}
            <span className="font-bold text-gray-800">{totalPages}</span>
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-40 flex items-center gap-1"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ================= MODALS & DRAWERS ================= */}

      {/* 1. APPROVE MODAL */}
      {approveModal.open && approveModal.leave && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5 text-emerald-700">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Approve Leave Application</h3>
                  <p className="text-xs text-gray-500">Confirm permission for {approveModal.leave.studentId?.name}</p>
                </div>
              </div>
              <button
                onClick={() => setApproveModal({ open: false, leave: null, remarks: '' })}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-emerald-50/70 border border-emerald-100 rounded-xl text-xs text-emerald-900 space-y-1">
              <p className="font-semibold">Leave Summary:</p>
              <p>Type: <span className="font-bold">{approveModal.leave.permissionType || 'Leave'}</span></p>
              <p>Requested: {new Date(approveModal.leave.requestedDate).toLocaleDateString()} → Expected Return: {approveModal.leave.returnDate ? new Date(approveModal.leave.returnDate).toLocaleDateString() : 'Immediate'}</p>
              {approveModal.leave.destination && <p>Destination: {approveModal.leave.destination}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Warden Remarks / Special Conditions (Optional)
              </label>
              <textarea
                rows={3}
                value={approveModal.remarks}
                onChange={(e) => setApproveModal((prev) => ({ ...prev, remarks: e.target.value }))}
                placeholder="e.g. Approved. Must report back before 8:00 PM on Sunday with parent signoff."
                className="w-full text-sm border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setApproveModal({ open: false, leave: null, remarks: '' })}
                className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApproveConfirm}
                disabled={actionLoading !== null}
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                Confirm Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. REJECT MODAL */}
      {rejectModal.open && rejectModal.leave && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5 text-rose-700">
                <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                  <XCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Reject Leave Application</h3>
                  <p className="text-xs text-gray-500">Decline permission for {rejectModal.leave.studentId?.name}</p>
                </div>
              </div>
              <button
                onClick={() => setRejectModal({ open: false, leave: null, reason: '', remarks: '' })}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Reason for Rejection <span className="text-rose-600">*</span>
              </label>
              <textarea
                rows={3}
                value={rejectModal.reason}
                onChange={(e) => setRejectModal((prev) => ({ ...prev, reason: e.target.value }))}
                placeholder="e.g. Mid-term examination scheduled during requested dates, or invalid parent contact provided."
                className="w-full text-sm border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Additional Remarks for Hostel Records (Optional)
              </label>
              <input
                type="text"
                value={rejectModal.remarks}
                onChange={(e) => setRejectModal((prev) => ({ ...prev, remarks: e.target.value }))}
                placeholder="e.g. Spoke with parents on phone, they were unaware of this leave."
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRejectModal({ open: false, leave: null, reason: '', remarks: '' })}
                className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectConfirm}
                disabled={actionLoading !== null}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. CANCEL / REVOKE MODAL */}
      {cancelModal.open && cancelModal.leave && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5 text-amber-700">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Revoke / Cancel Leave Approval</h3>
                  <p className="text-xs text-gray-500">Revoke leave for {cancelModal.leave.studentId?.name}</p>
                </div>
              </div>
              <button
                onClick={() => setCancelModal({ open: false, leave: null, reason: '' })}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-600">
              Revoking this leave will invalidate the approved gate outpass and reset the student profile status back to active.
            </p>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Reason for Cancellation <span className="text-rose-600">*</span>
              </label>
              <textarea
                rows={3}
                value={cancelModal.reason}
                onChange={(e) => setCancelModal((prev) => ({ ...prev, reason: e.target.value }))}
                placeholder="e.g. Student cancelled trip; emergency hostel curfew instituted; parent requested cancellation."
                className="w-full text-sm border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 resize-none"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCancelModal({ open: false, leave: null, reason: '' })}
                className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleCancelConfirm}
                disabled={actionLoading !== null}
                className="flex-1 py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
              >
                Confirm Revoke
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. CHECK-OUT (DEPARTURE) MODAL */}
      {checkOutModal.open && checkOutModal.leave && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5 text-purple-700">
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                  <LogOut className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Record Physical Departure</h3>
                  <p className="text-xs text-gray-500">{checkOutModal.leave.studentId?.name} leaving hostel premises</p>
                </div>
              </div>
              <button
                onClick={() => setCheckOutModal({ open: false, leave: null, time: '', remarks: '' })}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Actual Departure Timestamp
              </label>
              <input
                type="datetime-local"
                value={checkOutModal.time}
                onChange={(e) => setCheckOutModal((prev) => ({ ...prev, time: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Departure Notes (Luggage, vehicle number, companion info)
              </label>
              <input
                type="text"
                value={checkOutModal.remarks}
                onChange={(e) => setCheckOutModal((prev) => ({ ...prev, remarks: e.target.value }))}
                placeholder="e.g. Departed with parents in car KA01AB1234"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCheckOutModal({ open: false, leave: null, time: '', remarks: '' })}
                className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCheckOutConfirm}
                disabled={actionLoading !== null}
                className="flex-1 py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <LogOut className="w-4 h-4" />
                Record Departure
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. RETURN (ARRIVAL) MODAL */}
      {returnModal.open && returnModal.leave && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5 text-emerald-700">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <LogIn className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Record Resident Return</h3>
                  <p className="text-xs text-gray-500">Verify return for {returnModal.leave.studentId?.name}</p>
                </div>
              </div>
              <button
                onClick={() => setReturnModal({ open: false, leave: null, time: '', remarks: '' })}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {returnModal.leave.isOverdue && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  Resident is returning after expected date ({new Date(returnModal.leave.returnDate || '').toLocaleDateString()}).
                  Recording return will automatically resolve any open curfew/leave alerts.
                </span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Actual Return Timestamp
              </label>
              <input
                type="datetime-local"
                value={returnModal.time}
                onChange={(e) => setReturnModal((prev) => ({ ...prev, time: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Condition Notes & Return Remarks (Optional)
              </label>
              <input
                type="text"
                value={returnModal.remarks}
                onChange={(e) => setReturnModal((prev) => ({ ...prev, remarks: e.target.value }))}
                placeholder="e.g. Returned safely; medical certificate verified; on-time return."
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setReturnModal({ open: false, leave: null, time: '', remarks: '' })}
                className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReturnConfirm}
                disabled={actionLoading !== null}
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                Verify & Close Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. EDIT REMARKS MODAL */}
      {remarksModal.open && remarksModal.leave && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2 text-gray-900">
                <MessageSquare className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold">Warden Remarks</h3>
              </div>
              <button
                onClick={() => setRemarksModal({ open: false, leave: null, remarks: '' })}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Internal Remarks & Compliance Notes
              </label>
              <textarea
                rows={4}
                value={remarksModal.remarks}
                onChange={(e) => setRemarksModal((prev) => ({ ...prev, remarks: e.target.value }))}
                placeholder="Enter observations, parent conversations, or verification notes..."
                className="w-full text-sm border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRemarksModal({ open: false, leave: null, remarks: '' })}
                className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRemarksConfirm}
                disabled={actionLoading !== null}
                className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
              >
                Save Remarks
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. FULL DETAILS DRAWER */}
      {detailsDrawer.open && detailsDrawer.leave && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-end">
          <div className="bg-white w-full max-w-xl h-full shadow-2xl p-6 sm:p-8 overflow-y-auto space-y-6 animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-6 h-6 text-indigo-600" />
                <h2 className="text-xl font-bold text-gray-900">Application Details</h2>
              </div>
              <button
                onClick={() => setDetailsDrawer({ open: false, leave: null })}
                className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Resident Card */}
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-gray-900">{detailsDrawer.leave.studentId?.name}</h3>
                {getStatusBadge(detailsDrawer.leave)}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 pt-1">
                <p>Roll No: <span className="font-semibold text-gray-800">{detailsDrawer.leave.studentId?.studentId || 'N/A'}</span></p>
                <p>Phone: <span className="font-semibold text-gray-800">{detailsDrawer.leave.studentId?.phone || 'N/A'}</span></p>
                <p>Course: <span className="font-semibold text-gray-800">{detailsDrawer.leave.studentId?.course || 'N/A'}</span></p>
                <p>Room: <span className="font-semibold text-gray-800">{
                  typeof detailsDrawer.leave.studentId?.roomId === 'object'
                    ? detailsDrawer.leave.studentId?.roomId?.roomNumber || 'Unassigned'
                    : detailsDrawer.leave.studentId?.roomId || 'Unassigned'
                }</span></p>
              </div>

              {/* Parents info */}
              <div className="pt-2 border-t border-gray-200/60 text-xs space-y-1">
                <p className="font-semibold text-gray-700">Parent / Guardian Contact:</p>
                <p className="text-gray-600">
                  {detailsDrawer.leave.studentId?.parentContact?.name || 'Guardian'}: {detailsDrawer.leave.studentId?.parentContact?.phone || 'No phone recorded'}
                </p>
                {detailsDrawer.leave.studentId?.emergencyContact?.phone && (
                  <p className="text-gray-600">
                    Emergency: {detailsDrawer.leave.studentId?.emergencyContact?.name} ({detailsDrawer.leave.studentId?.emergencyContact?.phone})
                  </p>
                )}
              </div>
            </div>

            {/* Leave Details */}
            <div className="space-y-3 text-sm">
              <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wider text-gray-400">Leave Parameters</h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-400 block mb-1 font-medium">Category</span>
                  <span className="font-bold text-gray-900">{detailsDrawer.leave.permissionType || detailsDrawer.leave.type || 'Leave'}</span>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-400 block mb-1 font-medium">Destination</span>
                  <span className="font-bold text-gray-900">{detailsDrawer.leave.destination || 'Not Specified'}</span>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-400 block mb-1 font-medium">Requested Departure</span>
                  <span className="font-bold text-gray-900">
                    {new Date(detailsDrawer.leave.requestedDate).toLocaleString()}
                  </span>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-400 block mb-1 font-medium">Expected Return</span>
                  <span className="font-bold text-gray-900">
                    {detailsDrawer.leave.returnDate ? new Date(detailsDrawer.leave.returnDate).toLocaleString() : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Reason */}
              <div className="p-3.5 bg-gray-50 rounded-xl">
                <span className="text-xs text-gray-400 font-medium block mb-1">Reason Stated by Student</span>
                <p className="text-sm text-gray-800">{detailsDrawer.leave.reason}</p>
              </div>

              {/* Actual Departure & Arrival */}
              {(detailsDrawer.leave.actualCheckOutTime || detailsDrawer.leave.actualReturnTime) && (
                <div className="p-3.5 bg-indigo-50/60 border border-indigo-100 rounded-xl text-xs space-y-1">
                  <span className="font-bold text-indigo-900 block mb-1">Gate Verification Logs:</span>
                  {detailsDrawer.leave.actualCheckOutTime && (
                    <p className="text-gray-700">
                      • Gate Departure: <span className="font-semibold">{new Date(detailsDrawer.leave.actualCheckOutTime).toLocaleString()}</span>
                    </p>
                  )}
                  {detailsDrawer.leave.actualReturnTime && (
                    <p className="text-gray-700">
                      • Gate Arrival: <span className="font-semibold">{new Date(detailsDrawer.leave.actualReturnTime).toLocaleString()}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Supporting Documents */}
              <div className="space-y-2">
                <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wider text-gray-400">
                  Supporting Documents
                </h4>
                {detailsDrawer.leave.supportingDocuments && detailsDrawer.leave.supportingDocuments.length > 0 ? (
                  <div className="space-y-2">
                    {detailsDrawer.leave.supportingDocuments.map((doc, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-xl"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-indigo-600" />
                          <div>
                            <p className="text-xs font-semibold text-gray-800">{doc.title || `Document #${idx + 1}`}</p>
                            <p className="text-[10px] text-gray-400">{doc.fileType || 'Attachment'}</p>
                          </div>
                        </div>
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1 bg-white hover:bg-gray-100 text-indigo-600 border border-gray-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> View
                        </a>
                      </div>
                    ))}
                  </div>
                ) : detailsDrawer.leave.documentUrl ? (
                  <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-xl">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-semibold text-gray-800">Attached Document</span>
                    </div>
                    <a
                      href={detailsDrawer.leave.documentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1 bg-white hover:bg-gray-100 text-indigo-600 border border-gray-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> View
                    </a>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">No supporting documents uploaded for this application.</p>
                )}
              </div>

              {/* Warden Remarks */}
              {detailsDrawer.leave.wardenRemarks && (
                <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl text-xs space-y-1">
                  <span className="font-bold text-amber-900 block">Warden Remarks:</span>
                  <p className="text-gray-800">{detailsDrawer.leave.wardenRemarks}</p>
                </div>
              )}

              {/* Rejection / Cancellation Notes */}
              {detailsDrawer.leave.rejectionReason && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-1">
                  <span className="font-bold text-rose-900 block">Rejection Reason:</span>
                  <p className="text-rose-800">{detailsDrawer.leave.rejectionReason}</p>
                </div>
              )}

              {detailsDrawer.leave.cancellationReason && (
                <div className="p-3.5 bg-gray-100 border border-gray-300 rounded-xl text-xs space-y-1">
                  <span className="font-bold text-gray-900 block">Cancellation / Revocation Reason:</span>
                  <p className="text-gray-800">{detailsDrawer.leave.cancellationReason}</p>
                </div>
              )}
            </div>

            {/* Close */}
            <div className="pt-4 border-t border-gray-100">
              <button
                onClick={() => setDetailsDrawer({ open: false, leave: null })}
                className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-sm transition-colors"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. STUDENT LEAVE HISTORY DRAWER */}
      {historyDrawer.open && historyDrawer.student && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-end">
          <div className="bg-white w-full max-w-2xl h-full shadow-2xl p-6 sm:p-8 overflow-y-auto space-y-6 animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center gap-2">
                <History className="w-6 h-6 text-indigo-600" />
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Resident Leave Ledger</h2>
                  <p className="text-xs text-gray-500">
                    Historical leave compliance for {historyDrawer.student.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setHistoryDrawer({ open: false, student: null, history: [], historyStats: null, loading: false })}
                className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Resident Info Badge */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900">{historyDrawer.student.name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  ID: {historyDrawer.student.studentId || 'N/A'} • {historyDrawer.student.phone || 'No phone'}
                </p>
              </div>
              {historyDrawer.student.status && (
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                  historyDrawer.student.status === 'on-leave'
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}>
                  Current: {historyDrawer.student.status}
                </span>
              )}
            </div>

            {/* History Stats Bar */}
            {historyDrawer.historyStats && (
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-gray-400 font-semibold">Total</p>
                  <p className="text-lg font-bold text-gray-800 mt-0.5">{historyDrawer.historyStats.total}</p>
                </div>
                <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100">
                  <p className="text-emerald-600 font-semibold">Returned</p>
                  <p className="text-lg font-bold text-emerald-800 mt-0.5">{historyDrawer.historyStats.returned}</p>
                </div>
                <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-100">
                  <p className="text-rose-600 font-semibold">Overdue</p>
                  <p className="text-lg font-bold text-rose-800 mt-0.5">{historyDrawer.historyStats.overdue}</p>
                </div>
                <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-100">
                  <p className="text-amber-600 font-semibold">Rejected</p>
                  <p className="text-lg font-bold text-amber-800 mt-0.5">{historyDrawer.historyStats.rejected}</p>
                </div>
              </div>
            )}

            {/* Timeline */}
            {historyDrawer.loading ? (
              <div className="py-12 text-center text-gray-400">
                <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Fetching student leave history...
              </div>
            ) : historyDrawer.history.length === 0 ? (
              <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-2xl">
                No past leave records found for this student.
              </div>
            ) : (
              <div className="space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-gray-400">Historical Timeline</h4>
                {historyDrawer.history.map((record) => (
                  <div
                    key={record._id}
                    className="p-4 bg-white border border-gray-100 rounded-xl shadow-xs space-y-2 hover:border-indigo-100 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded uppercase">
                        {record.permissionType || record.type || 'Leave'}
                      </span>
                      {getStatusBadge(record)}
                    </div>
                    <p className="text-xs text-gray-700 font-medium">{record.reason}</p>
                    <div className="flex items-center gap-3 text-[11px] text-gray-400">
                      <span>Depart: {new Date(record.requestedDate).toLocaleDateString()}</span>
                      <span>Return: {record.returnDate ? new Date(record.returnDate).toLocaleDateString() : 'N/A'}</span>
                    </div>
                    {record.wardenRemarks && (
                      <p className="text-[11px] text-gray-500 bg-gray-50 p-1.5 rounded">
                        Remarks: {record.wardenRemarks}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
