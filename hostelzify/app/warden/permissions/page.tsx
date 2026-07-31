'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';

export default function WardenPermissions() {
  const { user } = useAuth();
  const router = useRouter();
  const [permissions, setPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

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
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (permissionId: string) => {
    try {
      await api.approvePermission(permissionId);
      loadPermissions();
    } catch (error: any) {
      alert(error.message || 'Failed to approve permission');
    }
  };

  const handleReject = async (permissionId: string) => {
    const reason = prompt('Enter rejection reason:');
    if (reason) {
      try {
        await api.rejectPermission(permissionId, reason);
        loadPermissions();
      } catch (error: any) {
        alert(error.message || 'Failed to reject permission');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-black 900">Pending Permissions</h1>
            <a
              href="/warden/dashboard"
              className="px-4 py-2 text-sm font-medium text-black 700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Back to Dashboard
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="text-center py-8">
            <p className="text-black 600">Loading permissions...</p>
          </div>
        ) : permissions.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-black 600">No pending permissions</p>
          </div>
        ) : (
          <div className="space-y-4">
            {permissions.map((permission) => (
              <div key={permission.id} className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-black 900">{permission.type}</h3>
                <p className="text-sm text-black 600 mt-1">{permission.reason}</p>
                <p className="text-sm text-black 500 mt-2">
                  Student: {permission.studentName || 'N/A'}
                </p>
                <div className="mt-4 flex gap-3">
                  <button
                    onClick={() => handleApprove(permission.id)}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(permission.id)}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

