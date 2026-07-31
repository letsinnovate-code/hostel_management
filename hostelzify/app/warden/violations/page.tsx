'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';

export default function WardenViolations() {
  const { user } = useAuth();
  const router = useRouter();
  const [violations, setViolations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'warden') {
      router.replace('/login');
      return;
    }
    loadViolations();
  }, [user, router]);

  const loadViolations = async () => {
    setLoading(true);
    try {
      const response = await api.getViolations();
      setViolations(response.data || []);
    } catch (error: any) {
      console.error('Failed to load violations:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-black 900">Violations</h1>
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
            <p className="text-black 600">Loading violations...</p>
          </div>
        ) : violations.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-black 600">No violations</p>
          </div>
        ) : (
          <div className="space-y-4">
            {violations.map((violation) => (
              <div key={violation.id} className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-black 900">{violation.type}</h3>
                <p className="text-sm text-black 600 mt-1">{violation.description}</p>
                <p className="text-sm text-black 500 mt-2">
                  Student: {violation.studentName || 'N/A'} | Status: {violation.status}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

