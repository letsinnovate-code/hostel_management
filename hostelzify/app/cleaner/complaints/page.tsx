'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';

export default function CleanerComplaints() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || (user.role !== 'cleaner' && user.role !== 'supervisor')) {
      router.replace('/login');
      return;
    }
    loadComplaints();
  }, [user, router]);

  const loadComplaints = async () => {
    setLoading(true);
    try {
      const response = await api.getAssignedComplaints();
      setComplaints(response.data || []);
    } catch (error: any) {
      console.error('Failed to load complaints:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (complaintId: string, status: string) => {
    try {
      await api.updateComplaintStatus(complaintId, status);
      loadComplaints();
    } catch (error: any) {
      alert(error.message || 'Failed to update complaint');
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-black 900">Assigned Complaints</h1>
              <p className="text-sm text-black 600">Welcome, {user?.name}</p>
            </div>
            <div className="flex gap-3">
              <a
                href="/cleaner/tasks"
                className="px-4 py-2 text-sm font-medium text-black 700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Tasks
              </a>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="text-center py-8">
            <p className="text-black 600">Loading complaints...</p>
          </div>
        ) : complaints.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-black 600">No complaints assigned</p>
          </div>
        ) : (
          <div className="space-y-4">
            {complaints.map((complaint) => (
              <div key={complaint.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold text-black 900">{complaint.title || 'Complaint'}</h3>
                    <p className="text-sm text-black 600 mt-1">{complaint.description}</p>
                    <p className="text-sm text-black 500 mt-2">
                      Status: <span className="font-medium">{complaint.status}</span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {complaint.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleStatusUpdate(complaint.id, 'in_progress')}
                          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Start
                        </button>
                        <button
                          onClick={() => handleStatusUpdate(complaint.id, 'resolved')}
                          className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          Resolve
                        </button>
                      </>
                    )}
                    {complaint.status === 'in_progress' && (
                      <button
                        onClick={() => handleStatusUpdate(complaint.id, 'resolved')}
                        className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

