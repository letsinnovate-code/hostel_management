'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import StudentLayout from '../../../components/StudentLayout';
import { AlertCircle, Calendar, FileText, AlertTriangle, CheckCircle } from 'lucide-react';

export default function StudentViolations() {
  const { user } = useAuth();
  const router = useRouter();
  const [violations, setViolations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'student') {
      router.replace('/login');
      return;
    }
    loadViolations();
  }, [user, router]);

  const loadViolations = async () => {
    setLoading(true);
    try {
      const response = await api.getViolationHistory();
      setViolations(response.data || []);
    } catch (error: any) {
      console.error('Failed to load violations:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'high':
      case 'critical':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <StudentLayout>
      <div className="min-h-screen bg-gray-50">
        <div className="p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Violation History</h1>
            <p className="text-sm text-gray-600 mt-1">View your violation records</p>
          </div>

          {loading ? (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <p className="text-gray-600">Loading violations...</p>
            </div>
          ) : violations.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <p className="text-gray-600 text-lg mb-2">No violations recorded</p>
              <p className="text-gray-500 text-sm">Keep up the good behavior!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {violations.map((violation) => (
                <div key={violation.id} className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                          <AlertTriangle className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{violation.type || 'Violation'}</h3>
                          <p className="text-sm text-gray-500">Violation ID: {violation.id}</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 ml-13">{violation.description || violation.reason || 'No description available'}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getSeverityColor(violation.severity)}`}>
                      {violation.severity || 'Medium'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200">
                    {violation.date && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="w-4 h-4" />
                        <span>Date: {new Date(violation.date).toLocaleDateString()}</span>
                      </div>
                    )}
                    {violation.warden && (
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Reported by: </span>
                        {violation.warden}
                      </div>
                    )}
                    {violation.penalty && (
                      <div className="text-sm text-red-600">
                        <span className="font-medium">Penalty: </span>
                        {violation.penalty}
                      </div>
                    )}
                    {violation.status && (
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Status: </span>
                        {violation.status}
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

