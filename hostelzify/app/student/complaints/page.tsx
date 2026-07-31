'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import StudentLayout from '../../../components/StudentLayout';
import { FileText, Plus, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function StudentComplaints() {
  const { user } = useAuth();
  const router = useRouter();
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'student') {
      router.replace('/login');
      return;
    }
    loadComplaints();
  }, [user, router]);

  const loadComplaints = async () => {
    setLoading(true);
    try {
      const response = await api.getComplaints();
      setComplaints(response.data || []);
    } catch (error: any) {
      console.error('Failed to load complaints:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'resolved':
      case 'closed':
        return 'bg-green-100 text-green-800';
      case 'pending':
      case 'in progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'resolved':
      case 'closed':
        return <CheckCircle className="w-4 h-4" />;
      case 'rejected':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <StudentLayout>
      <div className="min-h-screen bg-gray-50">
        <div className="p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Complaints</h1>
              <p className="text-sm text-gray-600 mt-1">Submit and track your complaints</p>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <Plus className="w-5 h-5" />
              <span>New Complaint</span>
            </button>
          </div>

          {loading ? (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <p className="text-gray-600">Loading complaints...</p>
            </div>
          ) : complaints.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-lg mb-2">No complaints yet</p>
              <p className="text-gray-500 text-sm">Submit your first complaint to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {complaints.map((complaint) => (
                <div key={complaint.id} className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">{complaint.title || 'Complaint'}</h3>
                      <p className="text-sm text-gray-600">{complaint.description || complaint.message}</p>
                    </div>
                    <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(complaint.status)}`}>
                      {getStatusIcon(complaint.status)}
                      {complaint.status || 'Pending'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      {complaint.createdAt && (
                        <span>Submitted: {new Date(complaint.createdAt).toLocaleDateString()}</span>
                      )}
                      {complaint.category && <span>Category: {complaint.category}</span>}
                    </div>
                    {complaint.resolutionNotes && (
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Resolution: </span>
                        {complaint.resolutionNotes}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </StudentLayout>
  );
}

