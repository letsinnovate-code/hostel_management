'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import {
  FileCheck,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Calendar,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  MessageSquare,
} from 'lucide-react';

export default function WardenPermissions() {
  const { user } = useAuth();
  const router = useRouter();
  const [permissions, setPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL');

  // Rejection modal state
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedPermissionId, setSelectedPermissionId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    if (!user || user.role !== 'warden') {
      router.replace('/login');
      return;
    }
    loadPermissions();
  }, [user, router]);

  const loadPermissions = async () => {
    setLoading(true);
    try {
      const response = await api.getPendingPermissions();
      setPermissions(response.data || []);
    } catch (error: any) {
      console.error('Failed to load permissions:', error);
      toast.error(error.message || 'Failed to load permissions');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (permissionId: string) => {
    setActionLoading(permissionId);
    try {
      await api.approvePermission(permissionId);
      toast.success('Permission granted and student notified');
      loadPermissions();
    } catch (error: any) {
      toast.error(error.message || 'Failed to approve permission');
    } finally {
      setActionLoading(null);
    }
  };

  const openRejectModal = (permissionId: string) => {
    setSelectedPermissionId(permissionId);
    setRejectionReason('');
    setRejectModalOpen(true);
  };

  const confirmReject = async () => {
    if (!selectedPermissionId) return;
    if (!rejectionReason.trim()) {
      toast.error('Please specify a rejection reason');
      return;
    }

    setActionLoading(selectedPermissionId);
    try {
      await api.rejectPermission(selectedPermissionId, rejectionReason.trim());
      toast.success('Permission rejected and student notified');
      setRejectModalOpen(false);
      setSelectedPermissionId(null);
      setRejectionReason('');
      loadPermissions();
    } catch (error: any) {
      toast.error(error.message || 'Failed to reject permission');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredPermissions = permissions.filter((perm) => {
    const studentName = perm.studentId?.name || perm.studentName || '';
    const room = perm.studentId?.roomId || '';
    const type = perm.type || '';
    const matchesSearch =
      studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.toLowerCase().includes(searchQuery.toLowerCase()) ||
      type.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'ALL' || type.toUpperCase() === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Student Permissions & Gate Outpass</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              {permissions.length} Pending
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Review outpass requests, leaves, and curfew extension requests.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadPermissions}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search student name, room, or request reason..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full md:w-auto text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          >
            <option value="ALL">All Categories</option>
            <option value="LEAVE">Leave / Vacation</option>
            <option value="NIGHT_OUT">Night Outpass</option>
            <option value="DAY_PASS">Day Pass</option>
            <option value="LATE_ENTRY">Late Entry</option>
          </select>
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-sm text-gray-500">Fetching pending permission applications...</p>
        </div>
      ) : filteredPermissions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <div className="w-16 h-16 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">All Caught Up!</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
            There are no pending student permission requests waiting for your approval right now.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredPermissions.map((permission) => {
            const permId = permission._id || permission.id;
            const student = permission.studentId || {};
            const studentName = student.name || permission.studentName || 'Student';
            const room = student.roomId ? `Room ${student.roomId}` : 'Room unassigned';
            const phone = student.phone || 'Phone unlisted';
            const isProcessing = actionLoading === permId;

            return (
              <div
                key={permId}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-indigo-200 transition-all p-6 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 uppercase tracking-wide">
                          {permission.type || 'Permission'}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-600">
                          {room}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 mt-2 flex items-center gap-1.5">
                        <User className="w-4 h-4 text-gray-400" />
                        {studentName}
                      </h3>
                      <p className="text-xs text-gray-400">{phone}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-200">
                      <Clock className="w-3.5 h-3.5" /> Pending
                    </span>
                  </div>

                  <div className="mt-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                      Reason / Destination
                    </p>
                    <p className="text-sm text-gray-700 font-medium">
                      {permission.reason || 'No specific reason provided.'}
                    </p>
                  </div>

                  {/* Dates if available */}
                  {(permission.startDate || permission.returnDate || permission.date) && (
                    <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        <span>
                          {permission.startDate ? new Date(permission.startDate).toLocaleDateString('en-IN') : 'Immediate'}
                          {permission.returnDate && ` → ${new Date(permission.returnDate).toLocaleDateString('en-IN')}`}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-gray-100 flex items-center gap-3">
                  <button
                    onClick={() => handleApprove(permId)}
                    disabled={isProcessing}
                    className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Approve
                  </button>
                  <button
                    onClick={() => openRejectModal(permId)}
                    disabled={isProcessing}
                    className="flex-1 py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Rejection Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Decline Permission Request</h3>
                <p className="text-xs text-gray-500">State why this outpass cannot be granted</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Reason for Rejection (Visible to Student & Parent)
              </label>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Disciplinary hold active, exams scheduled, or parent confirmation missing."
                className="w-full text-sm border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 resize-none"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmReject}
                disabled={actionLoading !== null}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
              >
                Confirm Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
