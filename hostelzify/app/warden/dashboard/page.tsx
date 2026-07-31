'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import Link from 'next/link';
import AlertBell from '../../../components/AlertBell';
import { useAlertSocket } from '../../../contexts/AlertSocketContext';
import { ShieldAlert } from 'lucide-react';

export default function WardenDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { connected } = useAlertSocket();

  useEffect(() => {
    if (!user || user.role !== 'warden') {
      router.replace('/login');
      return;
    }
    loadDashboard();
  }, [user, router]);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const response = await api.getDashboard();
      setDashboard(response.data);
    } catch (error: any) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
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
              <h1 className="text-2xl font-bold text-gray-900">Warden Dashboard</h1>
              <p className="text-sm text-gray-600">Welcome, {user?.name}</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Live alert bell with unread badge */}
              <AlertBell href="/warden/alerts" hostelId={user?.hostelId} />
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
        {/* Stats */}
        {dashboard && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-600">Pending Permissions</p>
              <p className="text-3xl font-bold text-gray-900">{dashboard.pendingPermissions || 0}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-600">Active Violations</p>
              <p className="text-3xl font-bold text-gray-900">{dashboard.activeViolations || 0}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-600">Pending Visitors</p>
              <p className="text-3xl font-bold text-gray-900">{dashboard.pendingVisitors || 0}</p>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link
            href="/warden/permissions"
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Permissions</h3>
            <p className="text-sm text-gray-600">Review and approve permissions</p>
          </Link>
          <Link
            href="/warden/violations"
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Violations</h3>
            <p className="text-sm text-gray-600">Manage violations</p>
          </Link>
          {/* ✅ Alert Dashboard card */}
          <Link
            href="/warden/alerts"
            className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow p-6 hover:shadow-xl transition-all hover:scale-[1.02] text-white"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold">Alert Dashboard</h3>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-gray-300'}`} />
                <ShieldAlert className="w-5 h-5 text-white/80" />
              </div>
            </div>
            <p className="text-sm text-white/80">Curfew checks, leave violations & real-time alerts</p>
          </Link>
        </div>
      </main>
    </div>
  );
}
