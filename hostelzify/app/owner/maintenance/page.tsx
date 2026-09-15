'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, isOwnerUser } from '../../../contexts/AuthContext';
import { useOwnerHostel } from '../../../contexts/OwnerHostelContext';
import api from '../../../services/api';
import {
  Wrench,
  ChevronLeft,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  User,
  Building2,
  Calendar,
  Layers,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function OwnerMaintenancePage() {
  const { user } = useAuth();
  const router = useRouter();
  const { hostels, selectedHostel, setSelectedHostel } = useOwnerHostel();

  const [list, setList] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  // Modals
  const [updateModal, setUpdateModal] = useState<{
    id: string;
    title: string;
    status: string;
    notes: string;
  } | null>(null);
  const [assignModal, setAssignModal] = useState<{
    id: string;
    title: string;
    assignedStaffId: string;
  } | null>(null);
  const [updating, setUpdating] = useState(false);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (!user || !isOwnerUser(user)) {
      router.replace('/login');
      return;
    }
  }, [user, router]);

  useEffect(() => {
    if (!user) return;
    loadMaintenance();
  }, [user, selectedHostel]);

  const loadMaintenance = async () => {
    setLoading(true);
    try {
      const [maintRes, staffRes]: [any, any] = await Promise.all([
        api.getMaintenanceComplaints(selectedHostel || undefined).catch(() => []),
        api.getOwnerStaff({ hostelId: selectedHostel || undefined }).catch(() => []),
      ]);

      const mList = Array.isArray(maintRes) ? maintRes : [];
      const sList = Array.isArray(staffRes) ? staffRes : staffRes?.data?.staff || staffRes?.data || [];

      setList(mList);
      setStaffList(sList.filter((s: any) => s.role !== 'student'));
    } catch (err: any) {
      toast.error('Failed to load maintenance records');
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const data = await api.getMaintenanceComplaints(selectedHostel || undefined);
      setList(Array.isArray(data) ? data : []);
      toast.success('Maintenance records refreshed');
    } catch {
      toast.error('Failed to refresh');
    } finally {
      setRefreshing(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!updateModal) return;
    setUpdating(true);
    try {
      await api.updateComplaintStatus(updateModal.id, updateModal.status, updateModal.notes);
      toast.success('Maintenance work order status updated');
      setUpdateModal(null);
      loadMaintenance();
    } catch (e: any) {
      toast.error(e.response?.data?.message || e.message || 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const handleAssignStaff = async () => {
    if (!assignModal || !assignModal.assignedStaffId) {
      toast.error('Please select a staff technician');
      return;
    }
    setAssigning(true);
    try {
      await api.assignOwnerComplaint(assignModal.id, { assignedTo: assignModal.assignedStaffId });
      toast.success('Work order assigned successfully');
      setAssignModal(null);
      loadMaintenance();
    } catch (e: any) {
      toast.error(e.response?.data?.message || e.message || 'Failed to assign staff');
    } finally {
      setAssigning(false);
    }
  };

  // Filtered list
  const filteredList = useMemo(() => {
    return list.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && item.priority !== priorityFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const titleMatch = (item.title || '').toLowerCase().includes(q);
        const descMatch = (item.description || '').toLowerCase().includes(q);
        const roomMatch = (item.roomId?.roomNumber || '').toLowerCase().includes(q);
        const studentMatch = (item.raisedBy?.name || '').toLowerCase().includes(q);
        if (!titleMatch && !descMatch && !roomMatch && !studentMatch) return false;
      }
      return true;
    });
  }, [list, statusFilter, priorityFilter, search]);

  // KPI calculations
  const totalCount = list.length;
  const openCount = list.filter((i) => i.status === 'open').length;
  const inProgressCount = list.filter((i) => i.status === 'in-progress' || i.status === 'assigned').length;
  const resolvedCount = list.filter((i) => i.status === 'resolved' || i.status === 'closed').length;

  const priorityBadges: Record<string, string> = {
    urgent: 'bg-red-100 text-red-800 border-red-200',
    high: 'bg-orange-100 text-orange-800 border-orange-200',
    medium: 'bg-blue-100 text-blue-800 border-blue-200',
    low: 'bg-gray-100 text-gray-800 border-gray-200',
  };

  const statusBadges: Record<string, string> = {
    open: 'bg-amber-100 text-amber-800 border-amber-200',
    assigned: 'bg-purple-100 text-purple-800 border-purple-200',
    'in-progress': 'bg-blue-100 text-blue-800 border-blue-200',
    resolved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    closed: 'bg-gray-100 text-gray-800 border-gray-200',
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link
                href="/owner/dashboard"
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
                title="Back to Dashboard"
              >
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Wrench className="w-6 h-6 text-blue-600" />
                  Facility Maintenance & Work Orders
                </h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  Track room repairs, plumbing, electrical, and facility upkeep operations
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium shadow-sm transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>

              <div className="flex items-center gap-2 bg-gray-50 border border-gray-300 rounded-lg px-3 py-1.5 shadow-sm">
                <Building2 className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-gray-700">Property:</span>
                <select
                  value={selectedHostel || ''}
                  onChange={(e) => setSelectedHostel(e.target.value || '')}
                  className="bg-transparent border-none text-sm font-semibold text-gray-900 focus:ring-0 cursor-pointer"
                >
                  <option value="">All Managed Hostels</option>
                  {hostels.map((h: any) => (
                    <option key={h._id} value={h._id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Work Orders</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{totalCount}</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Open / Pending</p>
              <p className="text-2xl font-bold text-amber-700 mt-1">{openCount}</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">In Progress</p>
              <p className="text-2xl font-bold text-blue-700 mt-1">{inProgressCount}</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Resolved</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">{resolvedCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 mt-6">
        {/* Filter Toolbar */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Filter className="w-4 h-4 text-gray-400" />
              <span className="font-medium">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="open">Open</option>
                <option value="assigned">Assigned</option>
                <option value="in-progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-700">
              <span className="font-medium">Priority:</span>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="px-3 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Priorities</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by title, room, resident..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Work Order List */}
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-16 text-center shadow-sm">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mb-3" />
            <p className="text-sm font-medium text-gray-600">Loading maintenance records...</p>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-16 text-center shadow-sm">
            <Wrench className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-base font-semibold text-gray-900">No maintenance orders found</p>
            <p className="text-sm text-gray-500 mt-1">All facility fixtures are operating optimally.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredList.map((item: any) => (
              <div
                key={item._id}
                className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:border-gray-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-gray-900 text-base">{item.title}</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                        statusBadges[item.status] || 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {item.status}
                    </span>
                    {item.priority && (
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold uppercase border ${
                          priorityBadges[item.priority] || 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {item.priority}
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-gray-600">{item.description}</p>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 pt-1">
                    <span className="flex items-center gap-1 font-medium text-gray-700">
                      <Layers className="w-3.5 h-3.5 text-gray-400" />
                      {item.roomId?.roomNumber ? `Room ${item.roomId.roomNumber}` : 'General Facility'}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-gray-400" />
                      Raised by: {item.raisedBy?.name || 'Resident'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—'}
                    </span>
                    {item.assignedTo && (
                      <span className="flex items-center gap-1 text-purple-700 font-semibold bg-purple-50 px-2 py-0.5 rounded">
                        Technician: {item.assignedTo?.name || 'Assigned'}
                      </span>
                    )}
                  </div>

                  {item.resolutionNotes && (
                    <div className="mt-2 bg-green-50 border border-green-200 rounded-lg p-2.5 text-xs text-green-800">
                      <span className="font-semibold">Resolution Notes: </span>
                      {item.resolutionNotes}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() =>
                      setAssignModal({
                        id: item._id,
                        title: item.title,
                        assignedStaffId: item.assignedTo?._id || '',
                      })
                    }
                    className="px-3 py-1.5 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-semibold transition-colors"
                  >
                    Assign Staff
                  </button>
                  <button
                    onClick={() =>
                      setUpdateModal({
                        id: item._id,
                        title: item.title,
                        status: item.status,
                        notes: item.resolutionNotes || '',
                      })
                    }
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
                  >
                    Update Status
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assign Modal */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Assign Maintenance Work Order</h3>
              <p className="text-xs text-gray-500 mt-1 line-clamp-1">Item: {assignModal.title}</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Select Technician / Staff
              </label>
              <select
                value={assignModal.assignedStaffId}
                onChange={(e) => setAssignModal({ ...assignModal, assignedStaffId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Staff Member</option>
                {staffList.map((st: any) => (
                  <option key={st._id} value={st._id}>
                    {st.name} ({st.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setAssignModal(null)}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignStaff}
                disabled={assigning}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm disabled:opacity-50"
              >
                {assigning ? 'Assigning...' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Update Modal */}
      {updateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Update Work Order Status</h3>
              <p className="text-xs text-gray-500 mt-1 line-clamp-1">{updateModal.title}</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Progress Status
              </label>
              <select
                value={updateModal.status}
                onChange={(e) => setUpdateModal({ ...updateModal, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="open">Open</option>
                <option value="assigned">Assigned</option>
                <option value="in-progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Resolution & Repair Notes
              </label>
              <textarea
                placeholder="Details of repair work done, replacement parts, cost..."
                value={updateModal.notes}
                onChange={(e) => setUpdateModal({ ...updateModal, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setUpdateModal(null)}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateStatus}
                disabled={updating}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm disabled:opacity-50"
              >
                {updating ? 'Saving...' : 'Save Status'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
