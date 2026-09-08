'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import {
  Wrench,
  CheckCircle,
  Clock,
  Play,
  RefreshCw,
  AlertCircle,
  User,
} from 'lucide-react';

export default function CleanerComplaints() {
  const { user } = useAuth();
  const router = useRouter();
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user || (user.role !== 'cleaner' && user.role !== 'supervisor' && !user.roles?.includes('cleaner'))) {
      router.replace('/login');
      return;
    }
    loadComplaints();
  }, [user, router]);

  const loadComplaints = async () => {
    setLoading(true);
    try {
      const response = await api.getAssignedComplaints();
      const data = response?.data || response || [];
      setComplaints(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error('Failed to load complaints:', error);
      toast.error('Could not load assigned complaints');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (complaintId: string, status: string) => {
    setUpdatingId(complaintId);
    try {
      await api.updateComplaintStatus(complaintId, status);
      toast.success(`Complaint marked as ${status.replace('_', ' ')}`);
      loadComplaints();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update complaint');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Wrench className="w-7 h-7 text-amber-500" />
            Assigned Maintenance & Complaints
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Resolve student room complaints and maintenance tasks assigned to your shift.
          </p>
        </div>

        <button
          onClick={loadComplaints}
          disabled={loading}
          className="self-start sm:self-center p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
          title="Refresh"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Complaints List */}
      {loading ? (
        <div className="p-12 text-center text-gray-500">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
          Loading assigned complaints...
        </div>
      ) : complaints.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <div className="w-14 h-14 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-gray-900 text-base">No open complaints!</h3>
          <p className="text-sm text-gray-500 mt-1">
            All maintenance and housekeeping tickets are currently resolved.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {complaints.map((complaint) => {
            const cid = complaint._id || complaint.id;
            return (
              <div
                key={cid}
                className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-gray-900">{complaint.title || 'Maintenance Complaint'}</h3>
                    <p className="text-xs text-gray-500 capitalize mt-0.5">
                      Category: {complaint.complaintType || 'Housekeeping'}
                    </p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${
                    complaint.status === 'resolved'
                      ? 'bg-green-100 text-green-800'
                      : complaint.status === 'in_progress' || complaint.status === 'in-progress'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {complaint.status?.replace('_', ' ') || 'Pending'}
                  </span>
                </div>

                <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 p-3 rounded-lg">
                  {complaint.description}
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs text-gray-500">
                  <span>Room: {complaint.roomNumber || complaint.roomId?.roomNumber || 'Assigned Room'}</span>
                  <div className="flex gap-2">
                    {(complaint.status === 'pending' || complaint.status === 'assigned') && (
                      <button
                        onClick={() => handleStatusUpdate(cid, 'in-progress')}
                        disabled={updatingId === cid}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-xs transition-colors disabled:opacity-50"
                      >
                        <Play className="w-3.5 h-3.5" />
                        Start Work
                      </button>
                    )}
                    {complaint.status !== 'resolved' && (
                      <button
                        onClick={() => handleStatusUpdate(cid, 'resolved')}
                        disabled={updatingId === cid}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium text-xs transition-colors disabled:opacity-50"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Mark Resolved
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
