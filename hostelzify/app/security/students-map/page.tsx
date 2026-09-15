'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import SecurityLayout from '../../../components/SecurityLayout';
import { MapPin, RefreshCw, User } from 'lucide-react';
import type { StudentMarkerData } from '../../../components/maps/OSMStudentsMap';

const OSMStudentsMap = dynamic(
  () => import('../../../components/maps/OSMStudentsMap'),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center bg-gray-100 m-4 rounded-xl text-sm text-gray-500">
        Loading map...
      </div>
    ),
  }
);

type StudentItem = {
  student: {
    _id?: string;
    name: string;
    email?: string;
    studentId?: string;
    room?: string;
    block?: string;
    currentLocation?: {
      latitude: number;
      longitude: number;
      timestamp?: string;
    };
    lastLocationUpdate?: string;
  };
  status: string;
  checkInTime?: string;
  checkOutTime?: string;
};

const STATUS_COLOR: Record<string, string> = {
  inside: '#22c55e',
  outside: '#ef4444',
  not_checked: '#94a3b8',
};

const STATUS_LABEL: Record<string, string> = {
  inside: 'Checked In',
  outside: 'Checked Out',
  not_checked: 'Not Checked',
};

// Default hostel center (Bhopal, India)
const DEFAULT_LAT = 23.5235;
const DEFAULT_LNG = 77.8139;

export default function SecurityStudentsMapPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [students, setStudents] = useState<StudentItem[]>([]);
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
      const response = await api.getSecurityStudentsStatus();
      setStudents(response?.data || []);
    } catch (error) {
      console.error('Failed to load students:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = useMemo(() =>
    students.filter((item) => {
      if (filter === 'all') return true;
      if (filter === 'checked-in') return item.status === 'inside';
      if (filter === 'checked-out') return item.status === 'outside';
      if (filter === 'not-checked') return item.status === 'not_checked';
      return true;
    }), [students, filter]);

  const withLocation = useMemo(() =>
    filteredStudents.filter(
      (item) => item.student.currentLocation &&
        typeof item.student.currentLocation.latitude === 'number' &&
        typeof item.student.currentLocation.longitude === 'number'
    ), [filteredStudents]);

  const withoutLocation = useMemo(() =>
    filteredStudents.filter(
      (item) => !item.student.currentLocation ||
        typeof item.student.currentLocation.latitude !== 'number' ||
        typeof item.student.currentLocation.longitude !== 'number'
    ), [filteredStudents]);

  // Convert to OSM marker format with position fallback
  const markers: StudentMarkerData[] = useMemo(() =>
    filteredStudents.map((item, idx) => {
      const angle = (idx * 50 * Math.PI) / 180;
      const dist = 0.0003 + (idx % 4) * 0.00015;
      return {
        _id: item.student._id || item.student.studentId || String(idx),
        name: item.student.name,
        email: item.student.email,
        studentId: item.student.studentId,
        room: item.student.room,
        currentLocation: {
          latitude: item.student.currentLocation?.latitude ?? (DEFAULT_LAT + dist * Math.cos(angle)),
          longitude: item.student.currentLocation?.longitude ?? (DEFAULT_LNG + dist * Math.sin(angle)),
          timestamp: item.student.currentLocation?.timestamp || new Date().toISOString(),
        },
        lastLocationUpdate: item.student.lastLocationUpdate,
        isInside: item.status === 'inside',
        status: STATUS_LABEL[item.status] || 'Unknown',
      };
    }), [filteredStudents]);

  return (
    <SecurityLayout>
      <div className="flex flex-col min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 shadow-sm">
          <div className="flex-1">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Students Live Map
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Real-time location of all students — OpenStreetMap</p>
          </div>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 text-sm font-medium text-gray-700"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </header>

        {/* Filter Tabs */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex gap-2 flex-wrap">
          {(['all', 'checked-in', 'checked-out', 'not-checked'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === f
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {f.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
            </button>
          ))}
          <span className="ml-auto self-center text-sm text-gray-500">
            <span className="font-semibold text-gray-800">{withLocation.length}</span> on map
            {' · '}
            <span className="font-semibold text-gray-800">{withoutLocation.length}</span> no location
          </span>
        </div>

        {/* Map + Sidebar */}
        {loading && students.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent mx-auto" />
              <p className="text-gray-500 mt-3">Loading students...</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col md:flex-row min-h-0" style={{ minHeight: '500px' }}>
            {/* Map */}
            <div className="flex-1 min-h-[400px] md:min-h-0 p-4">
              <div className="h-full w-full rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <OSMStudentsMap
                  hostelLat={DEFAULT_LAT}
                  hostelLng={DEFAULT_LNG}
                  hostelName="Hostel Campus"
                  students={markers}
                  height="100%"
                />
              </div>
            </div>

            {/* Sidebar */}
            <aside className="w-full md:w-80 bg-white border-t md:border-t-0 md:border-l border-gray-200 flex flex-col max-h-[350px] md:max-h-none overflow-hidden">
              {/* With location */}
              <div className="p-4 border-b border-gray-200">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  On map ({withLocation.length})
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">Click a pin to see details</p>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {withLocation.length === 0 ? (
                  <p className="text-sm text-gray-500 p-2">No students with shared location.</p>
                ) : (
                  <ul className="space-y-1">
                    {withLocation.map((item, i) => (
                      <li key={i}>
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 text-sm">
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: STATUS_COLOR[item.status] || STATUS_COLOR.not_checked }}
                          />
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">{item.student.name}</p>
                            <p className="text-xs text-gray-500 truncate">
                              {STATUS_LABEL[item.status] || 'Unknown'}
                              {item.student.room ? ` · Room ${item.student.room}` : ''}
                            </p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Without location */}
              {withoutLocation.length > 0 && (
                <>
                  <div className="p-4 border-t border-gray-200">
                    <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      No location ({withoutLocation.length})
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">Location not shared or not updated</p>
                  </div>
                  <div className="overflow-y-auto p-2 max-h-[160px]">
                    <ul className="space-y-1">
                      {withoutLocation.slice(0, 20).map((item, i) => (
                        <li key={i}>
                          <div className="px-3 py-1.5 rounded-lg text-sm text-gray-600 truncate">
                            {item.student.name}
                            <span className="text-xs text-gray-400 ml-1">
                              ({STATUS_LABEL[item.status] || 'Unknown'})
                            </span>
                          </div>
                        </li>
                      ))}
                      {withoutLocation.length > 20 && (
                        <li className="px-3 py-1.5 text-xs text-gray-400">
                          +{withoutLocation.length - 20} more
                        </li>
                      )}
                    </ul>
                  </div>
                </>
              )}
            </aside>
          </div>
        )}
      </div>
    </SecurityLayout>
  );
}
