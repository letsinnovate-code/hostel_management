'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import SecurityLayout from '../../../components/SecurityLayout';
import {
  Users,
  LogIn,
  LogOut,
  UserCheck,
  Clock,
  MapPin,
} from 'lucide-react';

export default function SecurityDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'checked-in' | 'checked-out' | 'not-checked'>('all');

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
      const [statsRes, studentsRes] = await Promise.all([
        api.getSecurityDashboardStats().catch(() => ({ data: null })),
        api.getSecurityStudentsStatus().catch(() => ({ data: [] })),
      ]);

      setStats(statsRes?.data || null);
      setStudents(studentsRes?.data || []);
    } catch (error: any) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'inside':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'outside':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'not_checked':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'inside':
        return 'Checked In';
      case 'outside':
        return 'Checked Out';
      case 'not_checked':
        return 'Not Checked';
      default:
        return 'Unknown';
    }
  };

  const filteredStudents = students.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'checked-in') return item.status === 'inside';
    if (filter === 'checked-out') return item.status === 'outside';
    if (filter === 'not-checked') return item.status === 'not_checked';
    return true;
  });

  return (
    <SecurityLayout>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
        <div className="p-6">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Security Dashboard
            </h1>
            <p className="text-gray-600 mt-2">Monitor student check-in and check-out status</p>
          </div>

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-blue-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Total Students</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalStudents || 0}</p>
                  </div>
                  <Users className="w-10 h-10 text-blue-500" />
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-green-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Checked In</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{stats.checkedIn || 0}</p>
                  </div>
                  <LogIn className="w-10 h-10 text-green-500" />
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-red-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Checked Out</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{stats.checkedOut || 0}</p>
                  </div>
                  <LogOut className="w-10 h-10 text-red-500" />
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-gray-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Not Checked</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{stats.notChecked || 0}</p>
                  </div>
                  <UserCheck className="w-10 h-10 text-gray-500" />
                </div>
              </div>
            </div>
          )}

          {/* Filter Tabs */}
          <div className="bg-white rounded-xl shadow-md p-4 mb-6">
            <div className="flex gap-2 flex-wrap">
              {(['all', 'checked-in', 'checked-out', 'not-checked'] as const).map((filterOption) => (
                <button
                  key={filterOption}
                  onClick={() => setFilter(filterOption)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    filter === filterOption
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {filterOption.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Students List */}
          {loading ? (
            <div className="bg-white rounded-xl shadow-md p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600"></div>
              <p className="text-gray-600 mt-4">Loading students...</p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="bg-white rounded-xl shadow-md p-12 text-center">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-lg mb-2">No students found</p>
              <p className="text-gray-500 text-sm">No students match the selected filter</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Student
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Room
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Check-in Time
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Check-out Time
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredStudents.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{item.student.name}</p>
                            <p className="text-xs text-gray-500">{item.student.email}</p>
                            {item.student.studentId && (
                              <p className="text-xs text-gray-400">ID: {item.student.studentId}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-900">
                              {item.student.block !== 'N/A' ? `${item.student.block} - ` : ''}
                              {item.student.room}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold border-2 ${getStatusColor(item.status)}`}>
                            {getStatusLabel(item.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {item.checkInTime ? (
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-900">
                                {new Date(item.checkInTime).toLocaleTimeString('en-IN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {item.checkOutTime ? (
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-900">
                                {new Date(item.checkOutTime).toLocaleTimeString('en-IN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </SecurityLayout>
  );
}

