'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import StudentLayout from '../../../components/StudentLayout';
import { UserPlus, Plus, CheckCircle, XCircle, Clock, Calendar, User } from 'lucide-react';

export default function StudentVisitors() {
  const { user } = useAuth();
  const router = useRouter();
  const [visitors, setVisitors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'student') {
      router.replace('/login');
      return;
    }
    loadVisitors();
  }, [user, router]);

  const loadVisitors = async () => {
    setLoading(true);
    try {
      const response = await api.getVisitorRequests();
      setVisitors(response.data || []);
    } catch (error: any) {
      console.error('Failed to load visitors:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved':
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
              <h1 className="text-2xl font-bold text-gray-900">Visitor Requests</h1>
              <p className="text-sm text-gray-600 mt-1">Request and manage visitor access</p>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <Plus className="w-5 h-5" />
              <span>New Request</span>
            </button>
          </div>

          {loading ? (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <p className="text-gray-600">Loading visitor requests...</p>
            </div>
          ) : visitors.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <UserPlus className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-lg mb-2">No visitor requests yet</p>
              <p className="text-gray-500 text-sm">Submit your first visitor request to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {visitors.map((visitor) => (
                <div key={visitor.id} className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                          <User className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{visitor.visitorName || 'Visitor'}</h3>
                          <p className="text-sm text-gray-500">Request ID: {visitor.id}</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 ml-13">{visitor.purpose || visitor.reason || 'No purpose specified'}</p>
                    </div>
                    <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(visitor.status)}`}>
                      {getStatusIcon(visitor.status)}
                      {visitor.status || 'Pending'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200">
                    {visitor.visitDate && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="w-4 h-4" />
                        <span>Visit Date: {new Date(visitor.visitDate).toLocaleDateString()}</span>
                      </div>
                    )}
                    {visitor.createdAt && (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Clock className="w-4 h-4" />
                        <span>Requested: {new Date(visitor.createdAt).toLocaleDateString()}</span>
                      </div>
                    )}
                    {visitor.visitorPhone && (
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Phone: </span>
                        {visitor.visitorPhone}
                      </div>
                    )}
                    {visitor.rejectionReason && (
                      <div className="text-sm text-red-600">
                        <span className="font-medium">Rejection Reason: </span>
                        {visitor.rejectionReason}
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

