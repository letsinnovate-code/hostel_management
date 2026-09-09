'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import {
  LifeBuoy,
  Search,
  Filter,
  RefreshCw,
  Clock,
  User,
  Phone,
  Building,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  AlertOctagon,
  ArrowRight,
  ExternalLink,
  FileText,
  MessageSquare,
  Wrench,
  Shield,
  Send,
  UserCheck,
  RotateCcw,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  X,
  Info,
  Calendar,
  Layers,
  ArrowUpRight,
  Image as ImageIcon,
  Tag,
  Check,
  Flame,
} from 'lucide-react';

interface TimelineEvent {
  action: string;
  performedBy?: { _id?: string; name?: string; role?: string } | any;
  performedByName?: string;
  performedByRole?: string;
  notes?: string;
  fromStatus?: string;
  toStatus?: string;
  timestamp: string;
}

interface ComplaintRemark {
  _id?: string;
  author?: { _id?: string; name?: string; role?: string } | any;
  authorName?: string;
  authorRole?: string;
  comment: string;
  createdAt: string;
}

interface Complaint {
  _id: string;
  raisedBy: {
    _id: string;
    name: string;
    email?: string;
    phone?: string;
    studentId?: string;
    gender?: string;
    course?: string;
    year?: string | number;
    profileImage?: string;
    parentContact?: { name?: string; phone?: string };
    emergencyContact?: { name?: string; phone?: string };
    roomId?: { _id?: string; roomNumber?: string; floorNumber?: number } | any;
  };
  complaintType: 'cleaning' | 'food' | 'safety' | 'maintenance' | 'other';
  title: string;
  description: string;
  roomId?: { _id?: string; roomNumber?: string; floorNumber?: number } | any;
  assignedTo?: { _id?: string; name: string; role: string; phone?: string; email?: string };
  assignedStaffName?: string;
  assignedStaffPhone?: string;
  assignedStaffRole?: string;
  assignedAt?: string;
  status: 'open' | 'assigned' | 'in-progress' | 'resolved' | 'closed' | 'reopened';
  priority: 'low' | 'medium' | 'high' | 'critical' | 'urgent';
  images?: string[];
  attachments?: Array<{ name?: string; url: string; fileType?: string; uploadedAt?: string }>;
  rating?: number;
  mealType?: string;
  resolvedAt?: string;
  resolvedBy?: { name?: string; role?: string };
  resolutionNotes?: string;
  closedAt?: string;
  closedBy?: { name?: string; role?: string };
  reopenedAt?: string;
  reopenedBy?: { name?: string; role?: string };
  reopenReason?: string;
  isEscalated?: boolean;
  escalatedTo?: string;
  escalatedAt?: string;
  escalationReason?: string;
  remarks?: ComplaintRemark[];
  timeline?: TimelineEvent[];
  createdAt: string;
  updatedAt: string;
}

interface StaffUser {
  _id: string;
  name: string;
  role: string;
  phone?: string;
  email?: string;
}

interface ComplaintStats {
  total: number;
  open: number;
  assigned: number;
  inProgress: number;
  resolved: number;
  closed: number;
  critical: number;
  escalated: number;
}

export default function WardenComplaintsPage() {
  const { user } = useAuth();
  const router = useRouter();

  // Active view tab: 'all' | 'open' | 'active' | 'critical' | 'resolved'
  const [activeTab, setActiveTab] = useState<'all' | 'open' | 'active' | 'critical' | 'resolved'>('all');

  // Core data states
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffUser[]>([]);
  const [stats, setStats] = useState<ComplaintStats>({
    total: 0,
    open: 0,
    assigned: 0,
    inProgress: 0,
    resolved: 0,
    closed: 0,
    critical: 0,
    escalated: 0,
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modals & Drawers
  const [assignModal, setAssignModal] = useState<{
    open: boolean;
    complaint: Complaint | null;
    assigneeType: 'user' | 'custom';
    assignedToUserId: string;
    customName: string;
    customPhone: string;
    customRole: string;
    remarks: string;
  }>({
    open: false,
    complaint: null,
    assigneeType: 'user',
    assignedToUserId: '',
    customName: '',
    customPhone: '',
    customRole: 'Technician',
    remarks: '',
  });

  const [resolveModal, setResolveModal] = useState<{
    open: boolean;
    complaint: Complaint | null;
    resolutionNotes: string;
    remarks: string;
  }>({
    open: false,
    complaint: null,
    resolutionNotes: '',
    remarks: '',
  });

  const [reopenModal, setReopenModal] = useState<{
    open: boolean;
    complaint: Complaint | null;
    reopenReason: string;
    remarks: string;
  }>({
    open: false,
    complaint: null,
    reopenReason: '',
    remarks: '',
  });

  const [escalateModal, setEscalateModal] = useState<{
    open: boolean;
    complaint: Complaint | null;
    escalateTo: string;
    escalationReason: string;
  }>({
    open: false,
    complaint: null,
    escalateTo: 'owner',
    escalationReason: '',
  });

  const [remarkModal, setRemarkModal] = useState<{
    open: boolean;
    complaint: Complaint | null;
    comment: string;
  }>({
    open: false,
    complaint: null,
    comment: '',
  });

  const [detailsDrawer, setDetailsDrawer] = useState<{
    open: boolean;
    complaint: Complaint | null;
    loadingDetails: boolean;
  }>({
    open: false,
    complaint: null,
    loadingDetails: false,
  });

  useEffect(() => {
    if (!user || user.role !== 'warden') {
      router.replace('/login');
      return;
    }
    loadComplaints();
    loadStaffMembers();
  }, [user, router, activeTab, statusFilter, categoryFilter, priorityFilter, startDateFilter, endDateFilter, currentPage]);

  const loadComplaints = async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        page: currentPage,
        limit: 15,
      };

      if (activeTab === 'open') {
        params.status = 'open';
      } else if (activeTab === 'active') {
        params.status = 'active'; // maps to open, assigned, in-progress
      } else if (activeTab === 'critical') {
        params.priority = 'critical';
      } else if (activeTab === 'resolved') {
        params.status = 'resolved';
      } else if (statusFilter !== 'ALL') {
        params.status = statusFilter;
      }

      if (categoryFilter !== 'ALL') {
        params.category = categoryFilter;
      }

      if (priorityFilter !== 'ALL' && activeTab !== 'critical') {
        params.priority = priorityFilter;
      }

      if (startDateFilter) params.startDate = startDateFilter;
      if (endDateFilter) params.endDate = endDateFilter;

      const response = await api.getWardenComplaints(params);
      setComplaints(response.data || []);
      if (response.stats) {
        setStats(response.stats);
      }
      if (response.pagination) {
        setTotalPages(response.pagination.totalPages || 1);
      }
    } catch (error: any) {
      console.error('Failed to load complaints:', error);
      toast.error(error.response?.data?.message || error.message || 'Failed to load complaints');
    } finally {
      setLoading(false);
    }
  };

  const loadStaffMembers = async () => {
    try {
      const res = await api.getWardenHostelStaff();
      setStaffMembers(res.data || []);
    } catch (err) {
      console.warn('Could not load hostel staff for assignment:', err);
    }
  };

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setCategoryFilter('ALL');
    setPriorityFilter('ALL');
    setStartDateFilter('');
    setEndDateFilter('');
    setCurrentPage(1);
  };

  // Client-side search matching across fields
  const filteredComplaints = useMemo(() => {
    if (!searchQuery.trim()) return complaints;
    const q = searchQuery.toLowerCase().trim();
    return complaints.filter((item) => {
      const title = item.title?.toLowerCase() || '';
      const desc = item.description?.toLowerCase() || '';
      const studentName = item.raisedBy?.name?.toLowerCase() || '';
      const rollNo = item.raisedBy?.studentId?.toLowerCase() || '';
      const roomNumber =
        typeof item.roomId === 'object'
          ? item.roomId?.roomNumber?.toLowerCase() || ''
          : '';
      const staff = (item.assignedTo?.name || item.assignedStaffName || '').toLowerCase();
      const cat = item.complaintType?.toLowerCase() || '';

      return (
        title.includes(q) ||
        desc.includes(q) ||
        studentName.includes(q) ||
        rollNo.includes(q) ||
        roomNumber.includes(q) ||
        staff.includes(q) ||
        cat.includes(q)
      );
    });
  }, [complaints, searchQuery]);

  // Open Details Drawer
  const openComplaintDetails = async (complaint: Complaint) => {
    setDetailsDrawer({
      open: true,
      complaint,
      loadingDetails: true,
    });
    try {
      const res = await api.getWardenComplaintDetails(complaint._id);
      setDetailsDrawer({
        open: true,
        complaint: res.data || complaint,
        loadingDetails: false,
      });
    } catch (error: any) {
      console.error('Failed to load complaint details:', error);
      setDetailsDrawer((prev) => ({ ...prev, loadingDetails: false }));
    }
  };

  // Assign Handler
  const handleAssignConfirm = async () => {
    if (!assignModal.complaint) return;
    const compId = assignModal.complaint._id;

    if (assignModal.assigneeType === 'user' && !assignModal.assignedToUserId) {
      toast.error('Please select a staff member to assign');
      return;
    }
    if (assignModal.assigneeType === 'custom' && !assignModal.customName.trim()) {
      toast.error('Please enter the technician / staff name');
      return;
    }

    setActionLoading(compId);
    try {
      const payload: any = {
        remarks: assignModal.remarks.trim() || undefined,
      };

      if (assignModal.assigneeType === 'user') {
        payload.assignedTo = assignModal.assignedToUserId;
      } else {
        payload.assignedStaffName = assignModal.customName.trim();
        payload.assignedStaffPhone = assignModal.customPhone.trim() || undefined;
        payload.assignedStaffRole = assignModal.customRole.trim() || 'Technician';
      }

      await api.assignWardenComplaint(compId, payload);
      toast.success('Complaint assigned successfully');
      setAssignModal({
        open: false,
        complaint: null,
        assigneeType: 'user',
        assignedToUserId: '',
        customName: '',
        customPhone: '',
        customRole: 'Technician',
        remarks: '',
      });
      loadComplaints();
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || 'Failed to assign complaint');
    } finally {
      setActionLoading(null);
    }
  };

  // Quick Start In-Progress Handler
  const handleStartWork = async (complaintId: string) => {
    setActionLoading(complaintId);
    try {
      await api.updateWardenComplaintStatus(complaintId, {
        status: 'in-progress',
        remarks: 'Work started on this issue by maintenance staff.',
      });
      toast.success('Complaint marked In-Progress');
      loadComplaints();
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || 'Failed to update status');
    } finally {
      setActionLoading(null);
    }
  };

  // Resolve Handler
  const handleResolveConfirm = async () => {
    if (!resolveModal.complaint) return;
    if (!resolveModal.resolutionNotes.trim()) {
      toast.error('Resolution notes are required');
      return;
    }

    const compId = resolveModal.complaint._id;
    setActionLoading(compId);
    try {
      await api.resolveWardenComplaint(compId, {
        resolutionNotes: resolveModal.resolutionNotes.trim(),
        remarks: resolveModal.remarks.trim() || undefined,
      });
      toast.success('Complaint resolved successfully & student notified');
      setResolveModal({ open: false, complaint: null, resolutionNotes: '', remarks: '' });
      loadComplaints();
      if (detailsDrawer.open && detailsDrawer.complaint?._id === compId) {
        openComplaintDetails(detailsDrawer.complaint);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || 'Failed to resolve complaint');
    } finally {
      setActionLoading(null);
    }
  };

  // Reopen Handler
  const handleReopenConfirm = async () => {
    if (!reopenModal.complaint) return;
    if (!reopenModal.reopenReason.trim()) {
      toast.error('Please specify why this complaint is being reopened');
      return;
    }

    const compId = reopenModal.complaint._id;
    setActionLoading(compId);
    try {
      await api.reopenWardenComplaint(compId, {
        reopenReason: reopenModal.reopenReason.trim(),
        remarks: reopenModal.remarks.trim() || undefined,
      });
      toast.success('Complaint reopened and marked In-Progress');
      setReopenModal({ open: false, complaint: null, reopenReason: '', remarks: '' });
      loadComplaints();
      if (detailsDrawer.open && detailsDrawer.complaint?._id === compId) {
        openComplaintDetails(detailsDrawer.complaint);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || 'Failed to reopen complaint');
    } finally {
      setActionLoading(null);
    }
  };

  // Escalate Handler
  const handleEscalateConfirm = async () => {
    if (!escalateModal.complaint) return;
    if (!escalateModal.escalationReason.trim()) {
      toast.error('Please provide an escalation explanation');
      return;
    }

    const compId = escalateModal.complaint._id;
    setActionLoading(compId);
    try {
      await api.escalateWardenComplaint(compId, {
        escalateTo: escalateModal.escalateTo,
        escalationReason: escalateModal.escalationReason.trim(),
      });
      toast.success(`Complaint escalated to ${escalateModal.escalateTo.toUpperCase()}`);
      setEscalateModal({ open: false, complaint: null, escalateTo: 'owner', escalationReason: '' });
      loadComplaints();
      if (detailsDrawer.open && detailsDrawer.complaint?._id === compId) {
        openComplaintDetails(detailsDrawer.complaint);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || 'Failed to escalate complaint');
    } finally {
      setActionLoading(null);
    }
  };

  // Add Remark Handler
  const handleAddRemarkConfirm = async () => {
    if (!remarkModal.complaint) return;
    if (!remarkModal.comment.trim()) {
      toast.error('Remark content cannot be empty');
      return;
    }

    const compId = remarkModal.complaint._id;
    setActionLoading(compId);
    try {
      await api.addWardenComplaintRemark(compId, {
        comment: remarkModal.comment.trim(),
      });
      toast.success('Remark added to complaint');
      setRemarkModal({ open: false, complaint: null, comment: '' });
      loadComplaints();
      if (detailsDrawer.open && detailsDrawer.complaint?._id === compId) {
        openComplaintDetails(detailsDrawer.complaint);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || 'Failed to add remark');
    } finally {
      setActionLoading(null);
    }
  };

  // Close Complaint Handler
  const handleCloseComplaint = async (complaintId: string) => {
    setActionLoading(complaintId);
    try {
      await api.updateWardenComplaintStatus(complaintId, {
        status: 'closed',
        remarks: 'Ticket formally closed and verified by Warden.',
      });
      toast.success('Complaint closed');
      loadComplaints();
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || 'Failed to close complaint');
    } finally {
      setActionLoading(null);
    }
  };

  // Priority badge helper
  const getPriorityBadge = (priority: string, isEscalated?: boolean) => {
    const p = (priority || 'medium').toLowerCase();
    if (isEscalated || p === 'critical' || p === 'urgent') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
          <Flame className="w-3.5 h-3.5 text-rose-600" />
          {isEscalated ? 'ESCALATED' : 'CRITICAL'}
        </span>
      );
    }
    switch (p) {
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-500" /> High Priority
          </span>
        );
      case 'medium':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            Medium
          </span>
        );
      case 'low':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
            Low
          </span>
        );
    }
  };

  // Status badge helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600" /> New / Open
          </span>
        );
      case 'assigned':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <UserCheck className="w-3.5 h-3.5 text-indigo-600" /> Assigned
          </span>
        );
      case 'in-progress':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <Wrench className="w-3.5 h-3.5 text-purple-600" /> In Progress
          </span>
        );
      case 'resolved':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Resolved
          </span>
        );
      case 'closed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-300">
            <Check className="w-3.5 h-3.5 text-gray-500" /> Closed
          </span>
        );
      case 'reopened':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
            <RotateCcw className="w-3.5 h-3.5 text-rose-600" /> Reopened
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

  // Category badge helper
  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'maintenance':
        return <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">Maintenance</span>;
      case 'cleaning':
        return <span className="text-xs font-semibold px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-100">Cleaning</span>;
      case 'food':
        return <span className="text-xs font-semibold px-2 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-100">Mess / Food</span>;
      case 'safety':
        return <span className="text-xs font-semibold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-100">Safety & Security</span>;
      default:
        return <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200">General</span>;
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-100">
              <LifeBuoy className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Warden Complaint Management</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Track issues, assign technicians, review resolution notes, escalate critical tickets, and maintain an audit history.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              loadComplaints();
              loadStaffMembers();
            }}
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
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Complaints</span>
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
          </div>
          <p className="text-2xl font-extrabold text-gray-900 mt-2">{stats.total}</p>
          <p className="text-xs text-gray-400 mt-0.5">All time records</p>
        </button>

        <button
          onClick={() => {
            setActiveTab('open');
            setStatusFilter('open');
          }}
          className={`p-4 rounded-2xl border text-left transition-all ${
            activeTab === 'open'
              ? 'bg-amber-50 border-amber-200 ring-2 ring-amber-500/20 shadow-sm'
              : 'bg-white border-gray-100 hover:border-gray-200 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">New & Unassigned</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-extrabold text-amber-900 mt-2">{stats.open}</p>
          <p className="text-xs text-amber-600 mt-0.5">Awaiting triage</p>
        </button>

        <button
          onClick={() => {
            setActiveTab('active');
          }}
          className={`p-4 rounded-2xl border text-left transition-all ${
            activeTab === 'active'
              ? 'bg-purple-50 border-purple-200 ring-2 ring-purple-500/20 shadow-sm'
              : 'bg-white border-gray-100 hover:border-gray-200 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-700 uppercase tracking-wider">In Progress</span>
            <Wrench className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-extrabold text-purple-900 mt-2">{stats.inProgress + stats.assigned}</p>
          <p className="text-xs text-purple-600 mt-0.5">{stats.assigned} assigned, {stats.inProgress} active</p>
        </button>

        <button
          onClick={() => {
            setActiveTab('critical');
          }}
          className={`p-4 rounded-2xl border text-left transition-all ${
            activeTab === 'critical'
              ? 'bg-rose-50 border-rose-200 ring-2 ring-rose-500/20 shadow-sm'
              : 'bg-white border-gray-100 hover:border-gray-200 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-700 uppercase tracking-wider">Critical Watch</span>
            <Flame className={`w-4 h-4 text-rose-600 ${stats.critical > 0 ? 'animate-bounce' : ''}`} />
          </div>
          <p className="text-2xl font-extrabold text-rose-900 mt-2">{stats.critical}</p>
          <p className="text-xs text-rose-600 mt-0.5 font-medium">
            {stats.escalated > 0 ? `${stats.escalated} Escalated to Owner` : 'High priority issues'}
          </p>
        </button>

        <button
          onClick={() => {
            setActiveTab('resolved');
            setStatusFilter('resolved');
          }}
          className={`p-4 rounded-2xl border text-left transition-all ${
            activeTab === 'resolved'
              ? 'bg-emerald-50 border-emerald-200 ring-2 ring-emerald-500/20 shadow-sm'
              : 'bg-white border-gray-100 hover:border-gray-200 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Resolved & Closed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-extrabold text-emerald-900 mt-2">{stats.resolved + stats.closed}</p>
          <p className="text-xs text-emerald-600 mt-0.5">Completed tickets</p>
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
            activeTab === 'all'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <LifeBuoy className="w-4 h-4" />
          All Complaints ({stats.total})
        </button>

        <button
          onClick={() => {
            setActiveTab('open');
            setStatusFilter('open');
          }}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'open'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Clock className="w-4 h-4" />
          Open & Triage ({stats.open})
        </button>

        <button
          onClick={() => {
            setActiveTab('active');
          }}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'active'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Wrench className="w-4 h-4" />
          In Progress & Assigned ({stats.inProgress + stats.assigned})
        </button>

        <button
          onClick={() => {
            setActiveTab('critical');
          }}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'critical'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Flame className="w-4 h-4" />
          Critical & Escalated ({stats.critical})
        </button>

        <button
          onClick={() => {
            setActiveTab('resolved');
            setStatusFilter('resolved');
          }}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'resolved'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          Resolved & Archive ({stats.resolved + stats.closed})
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
              placeholder="Search title, description, resident name, roll number, room, or staff..."
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

          {/* Category Filter */}
          <div className="flex items-center gap-2 w-full lg:w-auto">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full lg:w-auto text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="ALL">All Categories</option>
              <option value="maintenance">Maintenance</option>
              <option value="cleaning">Cleaning</option>
              <option value="food">Mess / Food</option>
              <option value="safety">Safety & Security</option>
              <option value="other">Other / General</option>
            </select>
          </div>

          {/* Priority Filter */}
          {activeTab !== 'critical' && (
            <div className="flex items-center gap-2 w-full lg:w-auto">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Priority:</span>
              <select
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full lg:w-auto text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                <option value="ALL">All Priorities</option>
                <option value="critical">Critical / Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          )}

          {/* Status Filter */}
          {activeTab === 'all' && (
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
                <option value="open">Open / New</option>
                <option value="assigned">Assigned</option>
                <option value="in-progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
                <option value="reopened">Reopened</option>
              </select>
            </div>
          )}
        </div>

        {/* Date Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-gray-100 text-xs text-gray-500">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-gray-600 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Filed Date:
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
              Showing <span className="font-semibold text-gray-800">{filteredComplaints.length}</span> tickets
            </span>
            {(searchQuery || statusFilter !== 'ALL' || categoryFilter !== 'ALL' || priorityFilter !== 'ALL' || startDateFilter || endDateFilter) && (
              <button
                onClick={resetFilters}
                className="text-xs font-semibold text-rose-600 hover:text-rose-800 underline"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-sm font-medium text-gray-600">Loading complaint tickets & tracking timeline...</p>
        </div>
      ) : filteredComplaints.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">No Complaints Found</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
            {activeTab === 'open'
              ? 'Great! There are no unassigned open tickets requiring triage.'
              : activeTab === 'critical'
              ? 'Excellent! No critical or escalated issues currently reported.'
              : 'No complaints matched the current query or filter criteria.'}
          </p>
          {(searchQuery || statusFilter !== 'ALL' || categoryFilter !== 'ALL' || priorityFilter !== 'ALL' || startDateFilter || endDateFilter) && (
            <button
              onClick={resetFilters}
              className="mt-4 px-4 py-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 rounded-xl inline-flex items-center gap-1.5"
            >
              Clear Filter Settings
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredComplaints.map((complaint) => {
            const student = complaint.raisedBy || {};
            const roomInfo =
              typeof complaint.roomId === 'object' && complaint.roomId?.roomNumber
                ? `Room ${complaint.roomId?.roomNumber}`
                : typeof student.roomId === 'object' && student.roomId?.roomNumber
                ? `Room ${student.roomId?.roomNumber}`
                : 'Room Unassigned';
            const floorInfo =
              typeof complaint.roomId === 'object' && complaint.roomId?.floorNumber !== undefined
                ? `Floor ${complaint.roomId?.floorNumber}`
                : typeof student.roomId === 'object' && student.roomId?.floorNumber !== undefined
                ? `Floor ${student.roomId?.floorNumber}`
                : '';

            const isProcessing = actionLoading === complaint._id;
            const assignedStaffName =
              complaint.assignedTo?.name || complaint.assignedStaffName || 'Unassigned';

            const hasPhotos =
              (complaint.images && complaint.images.length > 0) ||
              (complaint.attachments && complaint.attachments.length > 0);

            return (
              <div
                key={complaint._id}
                className={`bg-white rounded-2xl border transition-all shadow-sm flex flex-col justify-between hover:shadow-md ${
                  complaint.isEscalated || complaint.priority === 'critical'
                    ? 'border-rose-300 ring-1 ring-rose-300 bg-rose-50/15'
                    : 'border-gray-100 hover:border-indigo-100'
                }`}
              >
                <div className="p-5 sm:p-6">
                  {/* Top Bar: Category, Room Badge & Status */}
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getCategoryBadge(complaint.complaintType)}
                      <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-gray-100 text-gray-700">
                        {roomInfo} {floorInfo && `• ${floorInfo}`}
                      </span>
                      {getPriorityBadge(complaint.priority, complaint.isEscalated)}
                    </div>
                    {getStatusBadge(complaint.status)}
                  </div>

                  {/* Title & Description */}
                  <div className="mt-3.5">
                    <h3 className="text-base font-bold text-gray-900 line-clamp-1">{complaint.title}</h3>
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2 leading-relaxed">
                      {complaint.description}
                    </p>
                  </div>

                  {/* Resident Info & Assigned Staff Bar */}
                  <div className="mt-4 pt-3.5 border-t border-gray-100 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">Raised By</span>
                      <p className="font-bold text-gray-800 mt-0.5 flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-gray-400" />
                        {student.name || 'Resident'}
                      </p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {student.phone ? (
                          <a href={`tel:${student.phone}`} className="hover:text-indigo-600 transition-colors">
                            {student.phone}
                          </a>
                        ) : (
                          student.studentId || ''
                        )}
                      </p>
                    </div>

                    <div>
                      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">Assigned Staff</span>
                      <p className={`font-bold mt-0.5 flex items-center gap-1 ${
                        assignedStaffName === 'Unassigned' ? 'text-amber-700 italic' : 'text-gray-800'
                      }`}>
                        <Wrench className="w-3.5 h-3.5 text-gray-400" />
                        {assignedStaffName}
                      </p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {complaint.assignedStaffRole || (complaint.assignedTo?.role ? `${complaint.assignedTo.role}` : 'Staff')}
                      </p>
                    </div>
                  </div>

                  {/* Resolution Notes preview if resolved */}
                  {complaint.resolutionNotes && (
                    <div className="mt-3.5 p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl text-xs space-y-1">
                      <span className="font-bold text-emerald-900 block flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Resolution Note:
                      </span>
                      <p className="text-gray-700">{complaint.resolutionNotes}</p>
                    </div>
                  )}

                  {/* Meta Indicators */}
                  <div className="mt-3.5 flex items-center justify-between gap-2 text-xs text-gray-400 pt-1">
                    <div className="flex items-center gap-3">
                      <span>Filed {new Date(complaint.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}</span>
                      {hasPhotos && (
                        <span className="text-indigo-600 font-medium flex items-center gap-1">
                          <ImageIcon className="w-3.5 h-3.5" /> Attachments
                        </span>
                      )}
                    </div>
                    {complaint.timeline && (
                      <span className="text-[11px] text-gray-500 font-medium">
                        {complaint.timeline.length} history events
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom Actions Toolbar */}
                <div className="px-5 py-3.5 bg-gray-50/80 border-t border-gray-100 rounded-b-2xl flex items-center justify-between gap-2 flex-wrap">
                  <button
                    onClick={() => openComplaintDetails(complaint)}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    View Timeline & Details <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-center gap-2">
                    {/* If open -> Assign or In Progress */}
                    {complaint.status === 'open' && (
                      <>
                        <button
                          onClick={() =>
                            setAssignModal({
                              open: true,
                              complaint,
                              assigneeType: 'user',
                              assignedToUserId: '',
                              customName: '',
                              customPhone: '',
                              customRole: 'Technician',
                              remarks: '',
                            })
                          }
                          disabled={isProcessing}
                          className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors flex items-center gap-1 disabled:opacity-50"
                        >
                          <UserCheck className="w-3.5 h-3.5" /> Assign
                        </button>
                        <button
                          onClick={() => handleStartWork(complaint._id)}
                          disabled={isProcessing}
                          className="py-1.5 px-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1 disabled:opacity-50"
                        >
                          <Wrench className="w-3.5 h-3.5" /> Start Work
                        </button>
                      </>
                    )}

                    {/* If assigned -> Start Work or Resolve */}
                    {complaint.status === 'assigned' && (
                      <>
                        <button
                          onClick={() => handleStartWork(complaint._id)}
                          disabled={isProcessing}
                          className="py-1.5 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors flex items-center gap-1 disabled:opacity-50"
                        >
                          <Wrench className="w-3.5 h-3.5" /> In Progress
                        </button>
                        <button
                          onClick={() => setResolveModal({ open: true, complaint, resolutionNotes: '', remarks: '' })}
                          disabled={isProcessing}
                          className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors flex items-center gap-1 disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Resolve
                        </button>
                      </>
                    )}

                    {/* If in-progress -> Resolve */}
                    {(complaint.status === 'in-progress' || complaint.status === 'reopened') && (
                      <button
                        onClick={() => setResolveModal({ open: true, complaint, resolutionNotes: '', remarks: '' })}
                        disabled={isProcessing}
                        className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors flex items-center gap-1 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Resolve
                      </button>
                    )}

                    {/* If resolved -> Close or Reopen */}
                    {complaint.status === 'resolved' && (
                      <>
                        <button
                          onClick={() => handleCloseComplaint(complaint._id)}
                          disabled={isProcessing}
                          className="py-1.5 px-2.5 bg-gray-800 hover:bg-gray-900 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors flex items-center gap-1 disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" /> Close Ticket
                        </button>
                        <button
                          onClick={() => setReopenModal({ open: true, complaint, reopenReason: '', remarks: '' })}
                          disabled={isProcessing}
                          className="py-1.5 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1 disabled:opacity-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Reopen
                        </button>
                      </>
                    )}

                    {/* If closed -> Can Reopen */}
                    {complaint.status === 'closed' && (
                      <button
                        onClick={() => setReopenModal({ open: true, complaint, reopenReason: '', remarks: '' })}
                        disabled={isProcessing}
                        className="py-1.5 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1 disabled:opacity-50"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Reopen
                      </button>
                    )}

                    {/* Escalate button for active unresolved tickets */}
                    {complaint.status !== 'resolved' && complaint.status !== 'closed' && !complaint.isEscalated && (
                      <button
                        onClick={() =>
                          setEscalateModal({
                            open: true,
                            complaint,
                            escalateTo: 'owner',
                            escalationReason: '',
                          })
                        }
                        className="py-1.5 px-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-xs font-semibold transition-colors"
                        title="Escalate to Management"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Add Remark button */}
                    <button
                      onClick={() => setRemarkModal({ open: true, complaint, comment: '' })}
                      className="py-1.5 px-2 bg-white hover:bg-gray-100 text-gray-600 border border-gray-200 rounded-xl text-xs font-medium transition-colors"
                      title="Add Internal Remark"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
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

      {/* 1. ASSIGN MODAL */}
      {assignModal.open && assignModal.complaint && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5 text-indigo-700">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Assign Complaint</h3>
                  <p className="text-xs text-gray-500 line-clamp-1">{assignModal.complaint.title}</p>
                </div>
              </div>
              <button
                onClick={() => setAssignModal((prev) => ({ ...prev, open: false, complaint: null }))}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Assignee mode selector */}
            <div className="flex rounded-xl bg-gray-100 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setAssignModal((prev) => ({ ...prev, assigneeType: 'user' }))}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  assignModal.assigneeType === 'user' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'
                }`}
              >
                System Staff User
              </button>
              <button
                type="button"
                onClick={() => setAssignModal((prev) => ({ ...prev, assigneeType: 'custom' }))}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  assignModal.assigneeType === 'custom' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'
                }`}
              >
                External Technician / Trade
              </button>
            </div>

            {assignModal.assigneeType === 'user' ? (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Select Staff Member <span className="text-rose-600">*</span>
                </label>
                <select
                  value={assignModal.assignedToUserId}
                  onChange={(e) => setAssignModal((prev) => ({ ...prev, assignedToUserId: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-xl p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="">-- Choose Staff Member --</option>
                  {staffMembers.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} ({s.role.toUpperCase()}) {s.phone ? `• ${s.phone}` : ''}
                    </option>
                  ))}
                </select>
                {staffMembers.length === 0 && (
                  <p className="text-[11px] text-gray-400 mt-1">
                    No registered staff accounts found. You can use "External Technician / Trade" mode above.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Technician / Staff Name <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={assignModal.customName}
                    onChange={(e) => setAssignModal((prev) => ({ ...prev, customName: e.target.value }))}
                    placeholder="e.g. Ramesh Kumar (Electrician)"
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Role / Trade</label>
                    <input
                      type="text"
                      value={assignModal.customRole}
                      onChange={(e) => setAssignModal((prev) => ({ ...prev, customRole: e.target.value }))}
                      placeholder="e.g. Plumber, Electrician"
                      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Contact Phone</label>
                    <input
                      type="text"
                      value={assignModal.customPhone}
                      onChange={(e) => setAssignModal((prev) => ({ ...prev, customPhone: e.target.value }))}
                      placeholder="e.g. +91 9876543210"
                      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Assignment Instructions / Notes</label>
              <textarea
                rows={2}
                value={assignModal.remarks}
                onChange={(e) => setAssignModal((prev) => ({ ...prev, remarks: e.target.value }))}
                placeholder="e.g. Bring replacement MCB and multimeter; inspect Room circuit."
                className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setAssignModal((prev) => ({ ...prev, open: false, complaint: null }))}
                className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAssignConfirm}
                disabled={actionLoading !== null}
                className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Check className="w-4 h-4" /> Confirm Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. RESOLVE MODAL */}
      {resolveModal.open && resolveModal.complaint && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5 text-emerald-700">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Resolve Complaint</h3>
                  <p className="text-xs text-gray-500 line-clamp-1">{resolveModal.complaint.title}</p>
                </div>
              </div>
              <button
                onClick={() => setResolveModal({ open: false, complaint: null, resolutionNotes: '', remarks: '' })}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Resolution Notes <span className="text-rose-600">*</span>
              </label>
              <textarea
                rows={3}
                value={resolveModal.resolutionNotes}
                onChange={(e) => setResolveModal((prev) => ({ ...prev, resolutionNotes: e.target.value }))}
                placeholder="Detail the work carried out (e.g., Geyser heating element replaced and tested; water pressure verified)."
                className="w-full text-sm border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Internal Note (Optional)</label>
              <input
                type="text"
                value={resolveModal.remarks}
                onChange={(e) => setResolveModal((prev) => ({ ...prev, remarks: e.target.value }))}
                placeholder="e.g. Spare part purchased from vendor invoice #4521"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setResolveModal({ open: false, complaint: null, resolutionNotes: '', remarks: '' })}
                className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResolveConfirm}
                disabled={actionLoading !== null}
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Check className="w-4 h-4" /> Mark as Resolved
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. REOPEN MODAL */}
      {reopenModal.open && reopenModal.complaint && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5 text-rose-700">
                <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                  <RotateCcw className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Reopen Complaint</h3>
                  <p className="text-xs text-gray-500 line-clamp-1">{reopenModal.complaint.title}</p>
                </div>
              </div>
              <button
                onClick={() => setReopenModal({ open: false, complaint: null, reopenReason: '', remarks: '' })}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Reason for Reopening <span className="text-rose-600">*</span>
              </label>
              <textarea
                rows={3}
                value={reopenModal.reopenReason}
                onChange={(e) => setReopenModal((prev) => ({ ...prev, reopenReason: e.target.value }))}
                placeholder="State why this issue requires further action (e.g., Leakage reoccurred within 24 hours; student reported problem persisting)."
                className="w-full text-sm border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 resize-none"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setReopenModal({ open: false, complaint: null, reopenReason: '', remarks: '' })}
                className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReopenConfirm}
                disabled={actionLoading !== null}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
              >
                Confirm Reopen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. ESCALATE MODAL */}
      {escalateModal.open && escalateModal.complaint && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5 text-rose-700">
                <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                  <Flame className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Escalate to Management</h3>
                  <p className="text-xs text-gray-500 line-clamp-1">{escalateModal.complaint.title}</p>
                </div>
              </div>
              <button
                onClick={() => setEscalateModal({ open: false, complaint: null, escalateTo: 'owner', escalationReason: '' })}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900">
              Escalating increases priority to <span className="font-bold">CRITICAL</span> and sends a high-priority alert directly to the Hostel Owner & Management dashboard.
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Escalate To</label>
              <select
                value={escalateModal.escalateTo}
                onChange={(e) => setEscalateModal((prev) => ({ ...prev, escalateTo: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-xl p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              >
                <option value="owner">Hostel Owner</option>
                <option value="superadmin">Superadmin Support</option>
                <option value="management">Management Operations</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Escalation Reason <span className="text-rose-600">*</span>
              </label>
              <textarea
                rows={3}
                value={escalateModal.escalationReason}
                onChange={(e) => setEscalateModal((prev) => ({ ...prev, escalationReason: e.target.value }))}
                placeholder="Explain why this issue requires owner intervention (e.g., Major plumbing pipeline burst affecting entire 2nd floor; capital expenditure required)."
                className="w-full text-sm border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 resize-none"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEscalateModal({ open: false, complaint: null, escalateTo: 'owner', escalationReason: '' })}
                className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEscalateConfirm}
                disabled={actionLoading !== null}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <ArrowUpRight className="w-4 h-4" /> Confirm Escalation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. ADD REMARK MODAL */}
      {remarkModal.open && remarkModal.complaint && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2 text-gray-900">
                <MessageSquare className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold">Add Internal Remark</h3>
              </div>
              <button
                onClick={() => setRemarkModal({ open: false, complaint: null, comment: '' })}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Remark / Comment</label>
              <textarea
                rows={3}
                value={remarkModal.comment}
                onChange={(e) => setRemarkModal((prev) => ({ ...prev, comment: e.target.value }))}
                placeholder="Enter observations, inspection notes, or technician updates..."
                className="w-full text-sm border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRemarkModal({ open: false, complaint: null, comment: '' })}
                className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddRemarkConfirm}
                disabled={actionLoading !== null}
                className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
              >
                Save Remark
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. COMPLAINT DETAILS & TIMELINE DRAWER */}
      {detailsDrawer.open && detailsDrawer.complaint && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-end">
          <div className="bg-white w-full max-w-2xl h-full shadow-2xl p-6 sm:p-8 overflow-y-auto space-y-6 animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center gap-2">
                <LifeBuoy className="w-6 h-6 text-indigo-600" />
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Complaint Details & Timeline</h2>
                  <p className="text-xs text-gray-500">Ticket ID: #{detailsDrawer.complaint._id.slice(-6).toUpperCase()}</p>
                </div>
              </div>
              <button
                onClick={() => setDetailsDrawer({ open: false, complaint: null, loadingDetails: false })}
                className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status & Priority Ribbon */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200/70 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                {getCategoryBadge(detailsDrawer.complaint.complaintType)}
                {getPriorityBadge(detailsDrawer.complaint.priority, detailsDrawer.complaint.isEscalated)}
              </div>
              {getStatusBadge(detailsDrawer.complaint.status)}
            </div>

            {/* Issue Description */}
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-2">
              <h3 className="text-base font-bold text-gray-900">{detailsDrawer.complaint.title}</h3>
              <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                {detailsDrawer.complaint.description}
              </p>
            </div>

            {/* Resident & Room Card */}
            <div className="p-4 bg-white border border-gray-200 rounded-2xl space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Resident Information</h4>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-700 pt-1">
                <p>Name: <span className="font-semibold text-gray-900">{detailsDrawer.complaint.raisedBy?.name}</span></p>
                <p>Roll No: <span className="font-semibold text-gray-900">{detailsDrawer.complaint.raisedBy?.studentId || 'N/A'}</span></p>
                <p>Phone: <span className="font-semibold text-gray-900">{detailsDrawer.complaint.raisedBy?.phone || 'N/A'}</span></p>
                <p>Room: <span className="font-semibold text-gray-900">{
                  typeof detailsDrawer.complaint.roomId === 'object'
                    ? detailsDrawer.complaint.roomId?.roomNumber
                    : 'Unassigned'
                }</span></p>
              </div>
            </div>

            {/* Assigned Staff Card */}
            <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600">Assigned Technician / Staff</h4>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-700 pt-1">
                <p>Staff: <span className="font-semibold text-gray-900">{
                  detailsDrawer.complaint.assignedTo?.name || detailsDrawer.complaint.assignedStaffName || 'Not Assigned'
                }</span></p>
                <p>Role: <span className="font-semibold text-gray-900">{
                  detailsDrawer.complaint.assignedStaffRole || detailsDrawer.complaint.assignedTo?.role || 'Staff'
                }</span></p>
                {(detailsDrawer.complaint.assignedStaffPhone || detailsDrawer.complaint.assignedTo?.phone) && (
                  <p>Phone: <span className="font-semibold text-gray-900">{
                    detailsDrawer.complaint.assignedStaffPhone || detailsDrawer.complaint.assignedTo?.phone
                  }</span></p>
                )}
                {detailsDrawer.complaint.assignedAt && (
                  <p>Assigned At: <span className="font-semibold text-gray-900">{
                    new Date(detailsDrawer.complaint.assignedAt).toLocaleDateString()
                  }</span></p>
                )}
              </div>
            </div>

            {/* Resolution Card if resolved */}
            {detailsDrawer.complaint.resolutionNotes && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-1.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Resolution Summary
                </h4>
                <p className="text-sm text-gray-800 leading-relaxed font-medium">
                  {detailsDrawer.complaint.resolutionNotes}
                </p>
                {detailsDrawer.complaint.resolvedAt && (
                  <p className="text-[11px] text-emerald-700 pt-1">
                    Resolved on {new Date(detailsDrawer.complaint.resolvedAt).toLocaleString()}
                  </p>
                )}
              </div>
            )}

            {/* Attachments / Images Gallery */}
            {((detailsDrawer.complaint.images && detailsDrawer.complaint.images.length > 0) ||
              (detailsDrawer.complaint.attachments && detailsDrawer.complaint.attachments.length > 0)) && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Attached Images & Proof</h4>
                <div className="grid grid-cols-3 gap-2">
                  {detailsDrawer.complaint.images?.map((img, idx) => (
                    <a
                      key={idx}
                      href={img}
                      target="_blank"
                      rel="noreferrer"
                      className="group block relative aspect-video bg-gray-100 rounded-xl overflow-hidden border border-gray-200"
                    >
                      <img src={img} alt={`Proof ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-semibold transition-opacity">
                        View Photo
                      </div>
                    </a>
                  ))}
                  {detailsDrawer.complaint.attachments?.map((att, idx) => (
                    <a
                      key={idx}
                      href={att.url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center gap-2 hover:bg-gray-100 transition-colors"
                    >
                      <FileText className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-semibold text-gray-800 truncate">{att.name || 'Attachment'}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Internal Remarks Log */}
            {detailsDrawer.complaint.remarks && detailsDrawer.complaint.remarks.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Internal Remarks & Notes</h4>
                <div className="space-y-2">
                  {detailsDrawer.complaint.remarks.map((rem, idx) => (
                    <div key={idx} className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs">
                      <div className="flex items-center justify-between text-gray-500 mb-1">
                        <span className="font-bold text-gray-800">{rem.authorName || 'Staff'} ({rem.authorRole || 'warden'})</span>
                        <span className="text-[11px]">{new Date(rem.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-gray-700">{rem.comment}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Visual Workflow Timeline */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Chronological Event Timeline</h4>
              {detailsDrawer.loadingDetails ? (
                <div className="py-8 text-center text-gray-400">
                  <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  Loading timeline...
                </div>
              ) : detailsDrawer.complaint.timeline && detailsDrawer.complaint.timeline.length > 0 ? (
                <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                  {detailsDrawer.complaint.timeline.map((evt, idx) => (
                    <div key={idx} className="relative">
                      <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-white border-2 border-indigo-600 flex items-center justify-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                      </div>
                      <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-gray-900 uppercase tracking-wide text-[11px]">
                            {evt.action.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {new Date(evt.timestamp).toLocaleString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-gray-700">{evt.notes}</p>
                        <p className="text-[10px] text-gray-400">
                          By {evt.performedByName || 'User'} ({evt.performedByRole || 'warden'})
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">No historical events recorded for this ticket.</p>
              )}
            </div>

            {/* Close drawer */}
            <div className="pt-4 border-t border-gray-100">
              <button
                onClick={() => setDetailsDrawer({ open: false, complaint: null, loadingDetails: false })}
                className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-sm transition-colors"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
