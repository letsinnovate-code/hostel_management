'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  Phone,
  User,
  Shield,
  ShieldAlert,
  LogOut,
  LogIn,
  AlertTriangle,
  ChevronRight,
  X,
  FileText,
  Building,
  Check,
  Info,
  Trash2,
  Flame,
  AlertCircle,
} from 'lucide-react';

interface VisitorItem {
  _id: string;
  visitorName: string;
  visitorPhone: string;
  visitorIdProof?: string;
  visitingStudentId?: {
    _id: string;
    name: string;
    roomId?: string | { roomNumber: string };
    phone?: string;
    studentId?: string;
  } | any;
  purpose: string;
  visitDate?: string;
  entryTime?: string | null;
  exitTime?: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'checked-out';
  approvedBy?: {
    _id: string;
    name: string;
    role?: string;
  } | any;
  rejectionReason?: string;
  incidentNotes?: string;
  isFlagged?: boolean;
  createdAt: string;
}

export default function WardenVisitorsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [visitors, setVisitors] = useState<VisitorItem[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filters
  const [activeTab, setActiveTab] = useState<'all' | 'inside' | 'pending' | 'checked-out' | 'rejected'>('all');
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newVisitor, setNewVisitor] = useState({
    visitorName: '',
    visitorPhone: '',
    visitorIdProof: '',
    visitingStudentId: '',
    purpose: '',
    visitDate: new Date().toISOString().split('T')[0],
    autoApprove: true,
  });

  const [rejectModal, setRejectModal] = useState<{ open: boolean; visitor: VisitorItem | null; reason: string }>({
    open: false,
    visitor: null,
    reason: '',
  });

  const [incidentModal, setIncidentModal] = useState<{ open: boolean; visitor: VisitorItem | null; notes: string }>({
    open: false,
    visitor: null,
    notes: '',
  });

  const [deleteModal, setDeleteModal] = useState<{ open: boolean; visitorId: string; visitorName: string }>({
    open: false,
    visitorId: '',
    visitorName: '',
  });

  // Auth verification
  useEffect(() => {
    if (!user) return;
    const role = Array.isArray(user.role) ? user.role[0] : user.role;
    if (!['warden', 'owner', 'superadmin'].includes(role as string)) {
      router.replace('/login');
    }
  }, [user, router]);

  // Load visitors & hostel students
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [visRes, stuRes] = await Promise.all([
        api.getWardenVisitors(),
        api.getWardenHostelStudents().catch(() => ({ data: [] })),
      ]);

      if (visRes?.success) {
        setVisitors(visRes.data || []);
      }
      if (stuRes?.data) {
        setStudents(stuRes.data || []);
      }
    } catch (err: any) {
      console.error('Failed to load visitors data:', err);
      toast.error(err.message || 'Failed to fetch visitor records');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Actions
  const handleApprove = async (visitorId: string) => {
    setActionLoading(visitorId);
    try {
      await api.approveWardenVisitor(visitorId);
      toast.success('Visitor entry approved');
      loadData(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve visitor');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModal.visitor) return;
    setActionLoading('reject');
    try {
      await api.rejectWardenVisitor(rejectModal.visitor._id, rejectModal.reason);
      toast.success('Visitor entry rejected');
      setRejectModal({ open: false, visitor: null, reason: '' });
      loadData(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject visitor');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCheckout = async (visitorId: string) => {
    setActionLoading(visitorId);
    try {
      await api.checkoutWardenVisitor(visitorId);
      toast.success('Visitor checked out successfully');
      loadData(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to checkout visitor');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.visitorId) return;
    setActionLoading('delete');
    try {
      await api.deleteWardenVisitor(deleteModal.visitorId);
      toast.success('Visitor record removed');
      setDeleteModal({ open: false, visitorId: '', visitorName: '' });
      loadData(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete record');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateVisitor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVisitor.visitorName.trim() || !newVisitor.visitorPhone.trim() || !newVisitor.visitingStudentId || !newVisitor.purpose.trim()) {
      toast.error('Please complete all required fields');
      return;
    }
    setActionLoading('create');
    try {
      await api.createWardenVisitor(newVisitor);
      toast.success('Visitor registered successfully');
      setAddModalOpen(false);
      setNewVisitor({
        visitorName: '',
        visitorPhone: '',
        visitorIdProof: '',
        visitingStudentId: '',
        purpose: '',
        visitDate: new Date().toISOString().split('T')[0],
        autoApprove: true,
      });
      loadData(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to register visitor');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRecordIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incidentModal.visitor) return;
    if (!incidentModal.notes.trim()) {
      toast.error('Please enter incident details');
      return;
    }
    setActionLoading('incident');
    try {
      // Create incident record
      await api.createWardenIncident({
        title: `Visitor Incident: ${incidentModal.visitor.visitorName}`,
        description: `Visitor ${incidentModal.visitor.visitorName} (Phone: ${incidentModal.visitor.visitorPhone}) visiting ${incidentModal.visitor.visitingStudentId?.name || 'Student'}. Incident notes: ${incidentModal.notes}`,
        priority: 'high',
      });
      toast.success('Unusual incident logged and escalated');
      setIncidentModal({ open: false, visitor: null, notes: '' });
      loadData(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to record incident');
    } finally {
      setActionLoading(null);
    }
  };

  // Metrics calculation
  const metrics = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    let todayCount = 0;
    let insideCount = 0;
    let pendingCount = 0;
    let checkedOutCount = 0;

    for (const v of visitors) {
      const vDate = v.visitDate ? new Date(v.visitDate).toISOString().split('T')[0] : '';
      if (vDate === todayStr || (v.createdAt && new Date(v.createdAt).toISOString().split('T')[0] === todayStr)) {
        todayCount++;
      }
      if (v.status === 'approved' && !v.exitTime) {
        insideCount++;
      }
      if (v.status === 'pending') {
        pendingCount++;
      }
      if (v.status === 'checked-out' || (v.status === 'approved' && v.exitTime)) {
        checkedOutCount++;
      }
    }

    return {
      total: visitors.length,
      today: todayCount,
      inside: insideCount,
      pending: pendingCount,
      checkedOut: checkedOutCount,
    };
  }, [visitors]);

  // Filtered list
  const filteredVisitors = useMemo(() => {
    return visitors.filter((v) => {
      // Tab filter
      if (activeTab === 'inside') {
        if (!(v.status === 'approved' && !v.exitTime)) return false;
      } else if (activeTab === 'pending') {
        if (v.status !== 'pending') return false;
      } else if (activeTab === 'checked-out') {
        if (!(v.status === 'checked-out' || (v.status === 'approved' && v.exitTime))) return false;
      } else if (activeTab === 'rejected') {
        if (v.status !== 'rejected') return false;
      }

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = v.visitorName?.toLowerCase().includes(q);
        const matchesPhone = v.visitorPhone?.includes(q);
        const matchesStudent = v.visitingStudentId?.name?.toLowerCase().includes(q);
        const matchesPurpose = v.purpose?.toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesStudent && !matchesPurpose) return false;
      }

      // Date filter
      if (dateFilter) {
        const vDate = v.visitDate ? new Date(v.visitDate).toISOString().split('T')[0] : '';
        if (vDate !== dateFilter) return false;
      }

      return true;
    });
  }, [visitors, activeTab, search, dateFilter]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200">
                Hostel Administration
              </span>
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Building className="w-3.5 h-3.5" />
                {user?.hostelName || 'Hostel Visitors Log'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
              Visitor Registry & Security
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              Monitor, verify, approve, and track all guest visits, student family visits, and contractor access.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="p-2.5 text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors flex items-center justify-center disabled:opacity-50"
              title="Refresh visitors"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-sky-600' : ''}`} />
            </button>

            <button
              onClick={() => setAddModalOpen(true)}
              className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-colors flex items-center gap-2 shrink-0"
            >
              <Plus className="w-4 h-4" />
              Register New Visitor
            </button>
          </div>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6">
          <div className="bg-sky-50/70 border border-sky-200/80 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-sky-800">Today's Visitors</span>
              <Calendar className="w-4 h-4 text-sky-600" />
            </div>
            <p className="text-2xl font-black text-sky-950 mt-1">{metrics.today}</p>
            <p className="text-[11px] text-sky-700 mt-0.5">Checked in or registered today</p>
          </div>

          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-emerald-800">Currently Inside</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <p className="text-2xl font-black text-emerald-950 mt-1">{metrics.inside}</p>
            <p className="text-[11px] text-emerald-700 mt-0.5">Active inside hostel premises</p>
          </div>

          <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-amber-800">Pending Approval</span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-2xl font-black text-amber-950 mt-1">{metrics.pending}</p>
            <p className="text-[11px] text-amber-700 mt-0.5">Awaiting warden verification</p>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-gray-700">Checked Out</span>
              <CheckCircle2 className="w-4 h-4 text-gray-500" />
            </div>
            <p className="text-2xl font-black text-gray-900 mt-1">{metrics.checkedOut}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Completed guest stays</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b md:border-b-0 border-gray-100">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                activeTab === 'all'
                  ? 'bg-gray-900 text-white shadow-xs'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              All Visitors ({visitors.length})
            </button>

            <button
              onClick={() => setActiveTab('inside')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                activeTab === 'inside'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Currently Inside ({metrics.inside})
            </button>

            <button
              onClick={() => setActiveTab('pending')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                activeTab === 'pending'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Pending Approval
              {metrics.pending > 0 && (
                <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-white text-amber-900 font-black">
                  {metrics.pending}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('checked-out')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                activeTab === 'checked-out'
                  ? 'bg-gray-900 text-white shadow-xs'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Checked Out ({metrics.checkedOut})
            </button>

            <button
              onClick={() => setActiveTab('rejected')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                activeTab === 'rejected'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Rejected
            </button>
          </div>

          {/* Search & Date */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search visitor, student, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />

            {(search || dateFilter) && (
              <button
                onClick={() => {
                  setSearch('');
                  setDateFilter('');
                }}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 text-xs"
                title="Clear filters"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Visitors Table */}
        {loading ? (
          <div className="py-20 text-center">
            <div className="inline-block animate-spin text-sky-600 mb-3">
              <RefreshCw className="w-8 h-8" />
            </div>
            <p className="text-sm font-semibold text-gray-700">Loading visitor logs...</p>
          </div>
        ) : filteredVisitors.length === 0 ? (
          <div className="py-16 text-center bg-gray-50/60 rounded-xl border border-dashed border-gray-200">
            <Users className="w-10 h-10 text-gray-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-gray-800">No Visitor Records Found</p>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              {search || dateFilter || activeTab !== 'all'
                ? 'No visitors matched the selected filters. Try changing or clearing filters.'
                : 'No visitors have been recorded yet. Click "Register New Visitor" to log an entry.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider bg-gray-50/50">
                  <th className="py-3 px-3">Visitor Name & Phone</th>
                  <th className="py-3 px-3">Visiting Student</th>
                  <th className="py-3 px-3">Purpose & ID Proof</th>
                  <th className="py-3 px-3">Date & Timings</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredVisitors.map((v) => {
                  const isInside = v.status === 'approved' && !v.exitTime;
                  const isPending = v.status === 'pending';
                  const isCheckedOut = v.status === 'checked-out' || (v.status === 'approved' && !!v.exitTime);
                  const isRejected = v.status === 'rejected';

                  return (
                    <tr key={v._id} className="hover:bg-gray-50/80 transition-colors">
                      {/* Visitor Name & Phone */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-gray-900 text-sm">{v.visitorName}</div>
                        <div className="flex items-center gap-1.5 text-gray-500 mt-0.5">
                          <Phone className="w-3 h-3 text-gray-400" />
                          <span>{v.visitorPhone}</span>
                        </div>
                      </td>

                      {/* Visiting Student */}
                      <td className="py-3 px-3">
                        {v.visitingStudentId ? (
                          <div>
                            <div className="font-semibold text-gray-900">
                              {typeof v.visitingStudentId === 'object' ? v.visitingStudentId.name : 'Resident'}
                            </div>
                            <div className="text-[11px] text-gray-500">
                              {typeof v.visitingStudentId === 'object' && v.visitingStudentId.roomId
                                ? `Room ${typeof v.visitingStudentId.roomId === 'object' ? v.visitingStudentId.roomId.roomNumber : v.visitingStudentId.roomId}`
                                : 'Hostel Resident'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">Not specified</span>
                        )}
                      </td>

                      {/* Purpose & ID Proof */}
                      <td className="py-3 px-3">
                        <div className="font-medium text-gray-800">{v.purpose}</div>
                        {v.visitorIdProof && (
                          <span className="inline-block mt-0.5 px-1.5 py-0.2 text-[10px] rounded bg-gray-100 text-gray-600 font-mono">
                            ID: {v.visitorIdProof}
                          </span>
                        )}
                      </td>

                      {/* Date & Timings */}
                      <td className="py-3 px-3">
                        <div className="font-medium text-gray-900">
                          {v.visitDate ? new Date(v.visitDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                        </div>
                        <div className="text-[11px] text-gray-500 flex items-center gap-2 mt-0.5">
                          {v.entryTime && (
                            <span className="text-emerald-700 font-mono">
                              In: {new Date(v.entryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                          {v.exitTime && (
                            <span className="text-gray-600 font-mono">
                              Out: {new Date(v.exitTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        {isInside && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Inside Hostel
                          </span>
                        )}
                        {isPending && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-600" />
                            Pending Review
                          </span>
                        )}
                        {isCheckedOut && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-700 border border-gray-200">
                            <Check className="w-3 h-3 text-gray-500" />
                            Checked Out
                          </span>
                        )}
                        {isRejected && (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <XCircle className="w-3 h-3 text-rose-500" />
                              Rejected
                            </span>
                            {v.rejectionReason && (
                              <p className="text-[10px] text-rose-600 mt-0.5 max-w-xs truncate" title={v.rejectionReason}>
                                {v.rejectionReason}
                              </p>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isPending && (
                            <>
                              <button
                                onClick={() => handleApprove(v._id)}
                                disabled={actionLoading === v._id}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs disabled:opacity-50"
                              >
                                {actionLoading === v._id ? 'Approving...' : 'Approve'}
                              </button>
                              <button
                                onClick={() => setRejectModal({ open: true, visitor: v, reason: '' })}
                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition-colors"
                              >
                                Reject
                              </button>
                            </>
                          )}

                          {isInside && (
                            <button
                              onClick={() => handleCheckout(v._id)}
                              disabled={actionLoading === v._id}
                              className="px-2.5 py-1 bg-gray-900 hover:bg-black text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-2xs disabled:opacity-50"
                            >
                              <LogOut className="w-3 h-3" />
                              {actionLoading === v._id ? 'Logging...' : 'Check Out'}
                            </button>
                          )}

                          {/* Flag unusual incident */}
                          <button
                            onClick={() => setIncidentModal({ open: true, visitor: v, notes: '' })}
                            title="Report unusual visitor incident"
                            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          >
                            <AlertTriangle className="w-4 h-4" />
                          </button>

                          {/* Delete Record */}
                          <button
                            onClick={() => setDeleteModal({ open: true, visitorId: v._id, visitorName: v.visitorName })}
                            title="Delete record"
                            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal 1: Register New Visitor */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-gray-200 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                  <LogIn className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Register Visitor Entry</h3>
                  <p className="text-xs text-gray-500">Record gate arrival and issue entry permit</p>
                </div>
              </div>
              <button
                onClick={() => setAddModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateVisitor} className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Visitor Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Kumar"
                    value={newVisitor.visitorName}
                    onChange={(e) => setNewVisitor({ ...newVisitor, visitorName: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Visitor Contact Phone *</label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. +91 9876543210"
                    value={newVisitor.visitorPhone}
                    onChange={(e) => setNewVisitor({ ...newVisitor, visitorPhone: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Visiting Student *</label>
                <select
                  required
                  value={newVisitor.visitingStudentId}
                  onChange={(e) => setNewVisitor({ ...newVisitor, visitingStudentId: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="">-- Select Resident Student --</option>
                  {students.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} {s.roomId ? `(Room ${s.roomId.roomNumber || s.roomId})` : ''} - {s.studentId || s.phone}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">ID Proof Number</label>
                  <input
                    type="text"
                    placeholder="Aadhaar / DL / Voter ID"
                    value={newVisitor.visitorIdProof}
                    onChange={(e) => setNewVisitor({ ...newVisitor, visitorIdProof: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Visit Date</label>
                  <input
                    type="date"
                    value={newVisitor.visitDate}
                    onChange={(e) => setNewVisitor({ ...newVisitor, visitDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Visit Purpose *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Parent Visit / Delivery / Academic Project"
                  value={newVisitor.purpose}
                  onChange={(e) => setNewVisitor({ ...newVisitor, purpose: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="flex items-center gap-2 p-3 bg-sky-50/60 border border-sky-100 rounded-xl">
                <input
                  type="checkbox"
                  id="autoApprove"
                  checked={newVisitor.autoApprove}
                  onChange={(e) => setNewVisitor({ ...newVisitor, autoApprove: e.target.checked })}
                  className="w-4 h-4 text-sky-600 rounded"
                />
                <label htmlFor="autoApprove" className="text-xs text-gray-800 font-medium">
                  Auto-Approve & Mark Entry Time Immediately (Guest is currently present at gate)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'create'}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
                >
                  {actionLoading === 'create' ? 'Registering...' : 'Register Visitor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Reject Entry Modal */}
      {rejectModal.open && rejectModal.visitor && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-200">
            <h3 className="text-base font-bold text-gray-900">Reject Visitor Entry</h3>
            <p className="text-xs text-gray-500 mt-1">
              Rejecting visitor <b>{rejectModal.visitor.visitorName}</b> visiting{' '}
              <b>{rejectModal.visitor.visitingStudentId?.name || 'student'}</b>.
            </p>

            <form onSubmit={handleReject} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Reason for Rejection *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Inappropriate visiting hours, student denied visitor, lack of valid ID"
                  value={rejectModal.reason}
                  onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectModal({ open: false, visitor: null, reason: '' })}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'reject'}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
                >
                  {actionLoading === 'reject' ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Unusual Incident Modal */}
      {incidentModal.open && incidentModal.visitor && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Report Unusual Visitor Incident</h3>
                <p className="text-xs text-gray-500">Log security or behavioral infraction</p>
              </div>
            </div>

            <form onSubmit={handleRecordIncident} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Incident Description *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Describe suspicious behavior, rule violations, unauthorized access attempt, or property damage..."
                  value={incidentModal.notes}
                  onChange={(e) => setIncidentModal({ ...incidentModal, notes: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIncidentModal({ open: false, visitor: null, notes: '' })}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'incident'}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
                >
                  {actionLoading === 'incident' ? 'Logging...' : 'Log & Escalate Incident'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Delete Confirmation */}
      {deleteModal.open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-gray-200">
            <h3 className="text-base font-bold text-gray-900">Delete Visitor Record?</h3>
            <p className="text-xs text-gray-500 mt-1">
              Are you sure you want to delete the visitor log for <b>{deleteModal.visitorName}</b>? This action cannot be undone.
            </p>

            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setDeleteModal({ open: false, visitorId: '', visitorName: '' })}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={actionLoading === 'delete'}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
              >
                {actionLoading === 'delete' ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
