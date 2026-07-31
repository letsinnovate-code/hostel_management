'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import SecurityLayout from '../../../components/SecurityLayout';
import { LogOut, Clock, MapPin } from 'lucide-react';

export default function SecurityCheckedOut() {
  const { user } = useAuth();
  const router = useRouter();
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'security') {
      router.replace('/login');
      return;
    }
    loadData();
  }, [user, router]);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await api.getSecurityCheckedOutStudents();
      setStudents(response.data || []);
    } catch (error: any) {
      console.error('Failed to load checked-out students:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SecurityLayout>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
        <div className="p-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-red-600 to-rose-600 bg-clip-text text-transparent">
              Checked Out Students
            </h1>
            <p className="text-gray-600 mt-2">Students currently outside the hostel</p>
          </div>

          {loading ? (
            <div className="bg-white rounded-xl shadow-md p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-4 border-red-600"></div>
              <p className="text-gray-600 mt-4">Loading...</p>
            </div>
          ) : students.length === 0 ? (
            <div className="bg-white rounded-xl shadow-md p-12 text-center">
              <LogOut className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-lg mb-2">No students checked out</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {students.map((attendance, index) => (
                <div key={index} className="bg-white rounded-xl shadow-md p-6 border-l-4 border-red-500">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900">
                        {attendance.studentId?.name || 'Unknown Student'}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">{attendance.studentId?.email}</p>
                      {attendance.studentId?.studentId && (
                        <p className="text-xs text-gray-400 mt-1">ID: {attendance.studentId.studentId}</p>
                      )}
                    </div>
                    <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                      <LogOut className="w-6 h-6 text-red-600" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    {attendance.studentId?.roomId?.roomNumber && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <MapPin className="w-4 h-4" />
                        <span>Room {attendance.studentId.roomId.roomNumber}</span>
                      </div>
                    )}
                    {attendance.checkOutTime && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Clock className="w-4 h-4" />
                        <span>
                          Checked out: {new Date(attendance.checkOutTime).toLocaleString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </SecurityLayout>
  );
}

