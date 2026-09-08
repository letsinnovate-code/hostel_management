'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, isOwnerUser } from '../../../contexts/AuthContext';
import { useOwnerHostel } from '../../../contexts/OwnerHostelContext';
import api from '../../../services/api';
import { Wrench, User, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function OwnerMaintenancePage() {
  const { user } = useAuth();
  const router = useRouter();
  const { selectedHostel } = useOwnerHostel();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [updating, setUpdating] = useState<string | null>(null);
  const [updateModal, setUpdateModal] = useState<{ id: string; status: string; notes: string } | null>(null);

  useEffect(() => {
    if (!user || !isOwnerUser(user)) {
      router.replace('/login');
      return;
    }
  }, [user, router]);

  useEffect(() => {
    if (!user) return;
    loadMaintenance();
  }, [user, selectedHostel, statusFilter]);

  const loadMaintenance = async () => {
    setLoading(true);
    try {
      const data = await api.getMaintenanceComplaints(selectedHostel || undefined, statusFilter || undefined);
      setList(Array.isArray(data) ? data : []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!updateModal) return;
    setUpdating(updateModal.id);
    try {
      await api.updateComplaintStatus(updateModal.id, updateModal.status, updateModal.notes);
      toast.success('Complaint status updated');
      setUpdateModal(null);
      loadMaintenance();
    } catch (e: any) {
      toast.error(e.message || 'Failed to update');
    } finally {
      setUpdating(null);
    }
  };

  const statusColor: Record<string, string> = {
    open: 'bg-amber-100 text-amber-800',
    assigned: 'bg-blue-100 text-blue-800',
    'in-progress': 'bg-blue-100 text-blue-800',
    resolved: 'bg-green-100 text-green-800',
    closed: 'bg-gray-100 text-gray-800',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto px-4 md:px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/owner/dashboard" className="p-2 rounded-lg hover:bg-gray-100 text-gray-600" aria-label="Back">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">Room maintenance</h1>
              <p className="text-sm text-gray-600 mt-0.5">View and update maintenance requests</p>
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
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            >
              <option value="">All</option>
              <option value="open">Open</option>
              <option value="in-progress">In progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-green-500 border-t-transparent" />
          </div>
        ) : list.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <Wrench className="w-14 h-14 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No maintenance requests</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {list.map((c: any) => (
              <li key={c._id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">{c.title}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor[c.status] || 'bg-gray-100 text-gray-800'}`}>
                        {c.status}
                      </span>
                    </div>
                    <p className="text-gray-600 mt-1">{c.description}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {c.raisedBy?.name ?? 'Student'}
                      {c.roomId?.roomNumber && ` · Room ${c.roomId.roomNumber}`}
                      {' · '}{new Date(c.createdAt).toLocaleDateString()}
                    </p>
                    {c.resolutionNotes && (
                      <p className="text-sm text-green-700 mt-1">Resolution: {c.resolutionNotes}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setUpdateModal({ id: c._id, status: c.status, notes: c.resolutionNotes || '' })}
                    className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50"
                  >
                    Update status
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {updateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Update status</h3>
            <select
              value={updateModal.status}
              onChange={(e) => setUpdateModal({ ...updateModal, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4"
            >
              <option value="open">Open</option>
              <option value="assigned">Assigned</option>
              <option value="in-progress">In progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            <textarea
              placeholder="Resolution notes (optional)"
              value={updateModal.notes}
              onChange={(e) => setUpdateModal({ ...updateModal, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4"
              rows={3}
            />
            <div className="flex gap-2">
              <button onClick={() => setUpdateModal(null)} className="flex-1 py-2 border border-gray-300 rounded-lg">Cancel</button>
              <button onClick={handleUpdateStatus} disabled={!!updating} className="flex-1 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
