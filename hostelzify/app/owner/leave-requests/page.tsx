'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, isOwnerUser } from '../../../contexts/AuthContext';
import { useOwnerHostel } from '../../../contexts/OwnerHostelContext';
import api from '../../../services/api';
import { Calendar, User, ChevronLeft, Check, X } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function OwnerLeaveRequestsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { selectedHostel } = useOwnerHostel();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [acting, setActing] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectId, setRejectId] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !isOwnerUser(user)) {
      router.replace('/login');
      return;
    }
  }, [user, router]);

  useEffect(() => {
    if (!user) return;
    loadLeave();
  }, [user, selectedHostel, statusFilter]);

  const loadLeave = async () => {
    setLoading(true);
    try {
      const data = await api.getLeaveRequests(selectedHostel || undefined, statusFilter || undefined);
      setList(Array.isArray(data) ? data : []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (permissionId: string) => {
    setActing(permissionId);
    try {
      await api.approveLeaveRequest(permissionId);
      toast.success('Leave request approved');
      loadLeave();
    } catch (e: any) {
      toast.error(e.message || 'Failed to approve');
    } finally {
      setActing(null);
    }
  };

  const handleReject = async () => {
    if (!rejectId) return;
    setActing(rejectId);
    try {
      await api.rejectLeaveRequest(rejectId, rejectReason);
      toast.success('Leave request rejected');
      setRejectId(null);
      setRejectReason('');
      loadLeave();
    } catch (e: any) {
      toast.error(e.message || 'Failed to reject');
    } finally {
      setActing(null);
    }
  };

  const formatType = (t: string) => t?.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || '—';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto px-4 md:px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/owner/dashboard" className="p-2 rounded-lg hover:bg-gray-100 text-gray-600" aria-label="Back">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">Leave / Outpass</h1>
              <p className="text-sm text-gray-600 mt-0.5">Approve or reject student leave requests</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto px-4 md:px-6 py-6">
        <div className="flex flex-wrap gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500 border-t-transparent" />
          </div>
        ) : list.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <Calendar className="w-14 h-14 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No leave requests</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {list.map((p: any) => {
              const studentName = p.studentId?.name ?? 'Student';
              return (
                <li key={p._id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900">{studentName}</span>
                        <span className="text-sm text-gray-500">{formatType(p.permissionType)}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          p.status === 'approved' ? 'bg-green-100 text-green-800' :
                          p.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {p.status}
                        </span>
                      </div>
                      <p className="text-gray-600 mt-1">{p.reason}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        From: {new Date(p.requestedDate).toLocaleDateString()}
                        {p.returnDate && ` — To: ${new Date(p.returnDate).toLocaleDateString()}`}
                      </p>
                      {p.rejectionReason && (
                        <p className="text-sm text-red-600 mt-1">Rejection: {p.rejectionReason}</p>
                      )}
                    </div>
                    {p.status === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(p._id)}
                          disabled={!!acting}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                        >
                          <Check className="w-4 h-4" /> Approve
                        </button>
                        <button
                          onClick={() => setRejectId(p._id)}
                          disabled={!!acting}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                        >
                          <X className="w-4 h-4" /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-2">Reject leave request</h3>
            <input
              type="text"
              placeholder="Reason (optional)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => { setRejectId(null); setRejectReason(''); }} className="flex-1 py-2 border border-gray-300 rounded-lg">Cancel</button>
              <button onClick={handleReject} disabled={!!acting} className="flex-1 py-2 bg-red-600 text-white rounded-lg disabled:opacity-50">Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
