'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import { useToast } from '../../../components/Toast';
import {
  AlertTriangle,
  MessageSquare,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  User,
  Wrench,
  ShieldAlert,
  Loader2,
  X,
  RefreshCw,
  Building2,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { useHostelsQuery } from '../../../hooks/queries/useHostelsQuery';
import { useOwnerHostel } from '../../../contexts/OwnerHostelContext';

export default function OwnerComplaintsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const { selectedHostel } = useOwnerHostel();

  const [complaints, setComplaints] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [hostelFilter, setHostelFilter] = useState('');

  // Sync hostelFilter with global selectedHostel
  useEffect(() => {
    if (selectedHostel) {
      setHostelFilter(selectedHostel);
    }
  }, [selectedHostel]);

  // Modals
  const [selectedComplaint, setSelectedComplaint] = useState<any | null>(null);
  const [assignModal, setAssignModal] = useState<any | null>(null);
  const [assignedStaffId, setAssignedStaffId] = useState('');
  const [assigning, setAssigning] = useState(false);

  const [statusModal, setStatusModal] = useState<any | null>(null);
  const [newStatus, setNewStatus] = useState('resolved');
  const [statusRemarks, setStatusRemarks] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const { data: hostels = [] } = useHostelsQuery();

  useEffect(() => {
    if (!user || user.role !== 'owner') {
      router.replace('/login');
      return;
    }
    loadData();
  }, [user, router, hostelFilter]);

  const loadData = async () => {
    setLoading(true);
    const targetHostel = hostelFilter || selectedHostel;
    try {
      const [compRes, staffRes] = await Promise.all([
        api.getOwnerComplaints(targetHostel ? { hostelId: targetHostel } : {}).catch(() => ({ data: [] })),
        api.getOwnerStaff(targetHostel ? { hostelId: targetHostel } : {}).catch(() => ({ data: [] })),
      ]);

      const compList = Array.isArray(compRes) ? compRes : (compRes as any)?.data ?? [];
      const sList = Array.isArray(staffRes) ? staffRes : (staffRes as any)?.data ?? [];

      setComplaints(compList);
      setStaffList(sList.filter((s: any) => s.role !== 'student'));
    } catch (err: any) {
      showToast(err.message || 'Failed to load complaints', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    const targetHostel = hostelFilter || selectedHostel;
    try {
      const compRes: any = await api.getOwnerComplaints(targetHostel ? { hostelId: targetHostel } : {});
      const compList = Array.isArray(compRes) ? compRes : compRes?.data ?? [];
      setComplaints(compList);
      showToast('Complaints refreshed', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to refresh', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignModal || !assignedStaffId) {
      showToast('Please select a staff member', 'error');
      return;
    }
    setAssigning(true);
    try {
      await api.assignOwnerComplaint(assignModal._id || assignModal.id, {
        assignedTo: assignedStaffId,
      });
      showToast('Staff assigned to grievance', 'success');
      setAssignModal(null);
      setAssignedStaffId('');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to assign staff', 'error');
    } finally {
      setAssigning(false);
    }
  };

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusModal) return;
    setUpdatingStatus(true);
    try {
      await api.updateOwnerComplaintStatus(statusModal._id || statusModal.id, newStatus, statusRemarks);
      showToast(`Complaint marked as ${newStatus}`, 'success');
      setStatusModal(null);
      setStatusRemarks('');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to update complaint', 'error');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      if (search) {
        const query = search.toLowerCase();
        const titleMatch = c.title?.toLowerCase().includes(query);
        const descMatch = c.description?.toLowerCase().includes(query);
        const studentMatch = c.raisedBy?.name?.toLowerCase().includes(query);
        if (!titleMatch && !descMatch && !studentMatch) return false;
      }
      if (statusFilter !== 'all') {
        if (c.status !== statusFilter) return false;
      }
      if (categoryFilter !== 'all') {
        const cat = c.category || c.complaintType;
        if (cat !== categoryFilter) return false;
      }
      if (priorityFilter !== 'all') {
        if (c.priority !== priorityFilter) return false;
      }
      if (hostelFilter) {
        const cHostelId = typeof c.hostelId === 'object' ? c.hostelId?._id : c.hostelId;
        if (cHostelId !== hostelFilter) return false;
      }
      return true;
    });
  }, [complaints, search, statusFilter, categoryFilter, priorityFilter, hostelFilter]);

  const stats = useMemo(() => {
    const total = complaints.length;
    const unresolved = complaints.filter((c) => c.status === 'open' || c.status === 'in-progress').length;
    const urgent = complaints.filter((c) => (c.priority === 'urgent' || c.priority === 'high') && c.status !== 'resolved').length;
    const resolved = complaints.filter((c) => c.status === 'resolved').length;
    return { total, unresolved, urgent, resolved };
  }, [complaints]);

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <span className="px-2 py-0.5 rounded-md text-xs font-black bg-rose-100 text-rose-800 animate-pulse">URGENT</span>;
      case 'high':
        return <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">High</span>;
      case 'medium':
        return <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">Medium</span>;
      default:
        return <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-gray-50 text-gray-700 border border-gray-200">Low</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">Open</span>;
      case 'in-progress':
        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">In Progress</span>;
      case 'resolved':
        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Resolved</span>;
      case 'rejected':
        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600">Dismissed</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700">{status}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200/60 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Resident Grievance Center
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mt-1">
            Complaints & Grievance Logs
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Supervise hostel complaints, assign staff, enforce resolution SLAs, and maintain resident satisfaction.
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="p-2.5 text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors disabled:opacity-50 self-start md:self-auto"
          title="Refresh complaints"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-rose-600' : ''}`} />
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-gray-200/80 p-4 shadow-xs">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Grievances</p>
          <p className="text-2xl font-black text-gray-900 mt-1">{stats.total}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Reported tickets</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200/80 p-4 shadow-xs">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Active / Unresolved</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{stats.unresolved}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Requiring attention</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200/80 p-4 shadow-xs">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Urgent / High Priority</p>
          <p className="text-2xl font-black text-rose-600 mt-1">{stats.urgent}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">High severity issues</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200/80 p-4 shadow-xs">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Resolved Rate</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">
            {stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 100}%
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">{stats.resolved} completed</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">Hostel Property</label>
            <select
              value={hostelFilter}
              onChange={(e) => setHostelFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-rose-500 bg-white"
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
            <label className="block text-xs font-bold text-gray-600 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-rose-500 bg-white"
            >
              <option value="all">All Statuses</option>
              <option value="open">Open</option>
              <option value="in-progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-rose-500 bg-white"
            >
              <option value="all">All Categories</option>
              <option value="maintenance">Maintenance</option>
              <option value="cleanliness">Cleanliness</option>
              <option value="food">Food & Mess</option>
              <option value="noise">Noise / Disturbance</option>
              <option value="security">Security</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">Priority</label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-rose-500 bg-white"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search grievance..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Complaints Table */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-rose-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-700">Loading complaints...</p>
          </div>
        ) : filteredComplaints.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-gray-900">No complaints matching filter</h3>
            <p className="text-xs text-gray-500 mt-1">All clear across properties!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 text-xs font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 text-left">Grievance Title</th>
                  <th className="px-6 py-4 text-left">Resident</th>
                  <th className="px-6 py-4 text-left">Category</th>
                  <th className="px-6 py-4 text-left">Priority</th>
                  <th className="px-6 py-4 text-left">Assigned Staff</th>
                  <th className="px-6 py-4 text-left">Status</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-xs">
                {filteredComplaints.map((c) => {
                  const studentName = c.raisedBy?.name || 'Resident';
                  const roomNum = c.roomId?.roomNumber || '—';
                  const staffName = c.assignedTo?.name || null;

                  return (
                    <tr
                      key={c._id || c.id}
                      className="hover:bg-gray-50/80 transition-colors cursor-pointer"
                      onClick={() => setSelectedComplaint(c)}
                    >
                      <td className="px-6 py-4">
                        <p className="font-bold text-gray-900">{c.title || 'Untitled Grievance'}</p>
                        <p className="text-[11px] text-gray-500 line-clamp-1 max-w-xs">{c.description}</p>
                      </td>

                      <td className="px-6 py-4">
                        <p className="font-semibold text-gray-900">{studentName}</p>
                        <p className="text-[11px] text-gray-400">Room {roomNum}</p>
                      </td>

                      <td className="px-6 py-4 capitalize font-semibold text-gray-700">
                        {c.category || c.complaintType || 'General'}
                      </td>

                      <td className="px-6 py-4">{getPriorityBadge(c.priority)}</td>

                      <td className="px-6 py-4">
                        {staffName ? (
                          <span className="font-semibold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">
                            {staffName}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">Unassigned</span>
                        )}
                      </td>

                      <td className="px-6 py-4">{getStatusBadge(c.status)}</td>

                      <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              setAssignModal(c);
                              setAssignedStaffId(c.assignedTo?._id || '');
                            }}
                            className="px-2.5 py-1 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="Assign Staff"
                          >
                            Assign
                          </button>
                          <button
                            onClick={() => {
                              setStatusModal(c);
                              setNewStatus(c.status === 'open' ? 'in-progress' : 'resolved');
                            }}
                            className="px-2.5 py-1 text-xs font-bold text-emerald-600 hover:bg-emerald-50 rounded-lg"
                            title="Update Status"
                          >
                            Resolve
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

      {/* Detail Modal */}
      {selectedComplaint && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-gray-200 max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <h3 className="text-base font-black text-gray-900">Grievance Overview</h3>
              </div>
              <button onClick={() => setSelectedComplaint(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <p className="text-base font-black text-gray-900">{selectedComplaint.title}</p>
                <p className="text-gray-600 mt-1">{selectedComplaint.description}</p>
              </div>

              <div className="bg-gray-50 rounded-xl p-3.5 space-y-2 border border-gray-200/80">
                <div className="flex justify-between">
                  <span className="text-gray-400">Reported By:</span>
                  <span className="font-bold text-gray-900">{selectedComplaint.raisedBy?.name || 'Resident'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Room Location:</span>
                  <span className="font-bold text-gray-900">Room {selectedComplaint.roomId?.roomNumber || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Category:</span>
                  <span className="font-bold capitalize text-gray-900">{selectedComplaint.category || selectedComplaint.complaintType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Assigned Handler:</span>
                  <span className="font-bold text-gray-900">{selectedComplaint.assignedTo?.name || 'Unassigned'}</span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setSelectedComplaint(null)}
                className="px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-gray-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Staff Modal */}
      {assignModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-gray-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">Assign Staff to Grievance</h3>
              <button onClick={() => setAssignModal(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Select Staff Member</label>
                <select
                  required
                  value={assignedStaffId}
                  onChange={(e) => setAssignedStaffId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Choose Staff...</option>
                  {staffList.map((s) => (
                    <option key={s._id || s.id} value={s._id || s.id}>
                      {s.name} ({s.role?.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAssignModal(null)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigning}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 disabled:opacity-50"
                >
                  {assigning ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Update Status Modal */}
      {statusModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-gray-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">Update Complaint Status</h3>
              <button onClick={() => setStatusModal(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStatusSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="in-progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="rejected">Dismissed</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Resolution Remarks</label>
                <textarea
                  rows={3}
                  value={statusRemarks}
                  onChange={(e) => setStatusRemarks(e.target.value)}
                  placeholder="Notes regarding resolution or work completed..."
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStatusModal(null)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingStatus}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 disabled:opacity-50"
                >
                  {updatingStatus ? 'Updating...' : 'Save Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
