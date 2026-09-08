'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import SecurityLayout from '../../../components/SecurityLayout';
import { MapPin, RefreshCw, User } from 'lucide-react';

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

declare global {
  interface Window {
    google: any;
  }
}

function escapeHtml(text: string) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

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

export default function SecurityStudentsMapPage() {
  const { user } = useAuth();
  const router = useRouter();
  const mapRef = useRef<HTMLDivElement>(null);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [filter, setFilter] = useState<'all' | 'checked-in' | 'checked-out' | 'not-checked'>('all');
  const markersRef = useRef<any[]>([]);
  const infoWindowsRef = useRef<any[]>([]);

  useEffect(() => {
    if (!user || user.role !== 'security') {
      router.replace('/login');
      return;
    }
    loadData();
  }, [user, router]);

  // Load Google Maps script
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.google) {
      const script = document.createElement('script');
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
      script.async = true;
      script.defer = true;
      script.onload = () => setMapReady(true);
      document.head.appendChild(script);
    } else if (typeof window !== 'undefined' && window.google) {
      setMapReady(true);
    }
  }, []);

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

  // Initialize map
  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.google || mapInstance) return;
    const google = window.google;
    const map = new google.maps.Map(mapRef.current, {
      center: { lat: 28.6139, lng: 77.209 },
      zoom: 14,
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: true,
      zoomControl: true,
    });
    setMapInstance(map);
  }, [mapReady, mapRef.current]);

  // Plot markers based on current filter
  useEffect(() => {
    if (!mapInstance || !window.google) return;
    const google = window.google;

    // Clear old markers
    markersRef.current.forEach((m) => m.setMap(null));
    infoWindowsRef.current.forEach((iw) => iw.close());
    markersRef.current = [];
    infoWindowsRef.current = [];

    const filtered = students.filter((item) => {
      if (filter === 'all') return true;
      if (filter === 'checked-in') return item.status === 'inside';
      if (filter === 'checked-out') return item.status === 'outside';
      if (filter === 'not-checked') return item.status === 'not_checked';
      return true;
    });

    const withLocation = filtered.filter(
      (item) =>
        item.student.currentLocation &&
        typeof item.student.currentLocation.latitude === 'number' &&
        typeof item.student.currentLocation.longitude === 'number'
    );

    if (withLocation.length === 0) return;

    const bounds = new google.maps.LatLngBounds();

    withLocation.forEach((item) => {
      const pos = {
        lat: item.student.currentLocation!.latitude,
        lng: item.student.currentLocation!.longitude,
      };
      bounds.extend(pos);

      const color = STATUS_COLOR[item.status] || STATUS_COLOR.not_checked;
      const marker = new google.maps.Marker({
        position: pos,
        map: mapInstance,
        title: item.student.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      });
      markersRef.current.push(marker);

      const lastUpdate = item.student.lastLocationUpdate
        ? new Date(item.student.lastLocationUpdate).toLocaleString()
        : '—';

      const statusLabel = STATUS_LABEL[item.status] || 'Unknown';
      const content = `
        <div style="padding: 8px; min-width: 180px; font-family: system-ui, sans-serif;">
          <p style="margin: 0 0 4px 0; font-weight: 600; color: #111;">${escapeHtml(item.student.name)}</p>
          ${item.student.email ? `<p style="margin: 0 0 2px 0; font-size: 12px; color: #374151;">${escapeHtml(item.student.email)}</p>` : ''}
          ${item.student.studentId ? `<p style="margin: 0 0 4px 0; font-size: 11px; color: #6b7280;">ID: ${escapeHtml(item.student.studentId)}</p>` : ''}
          <span style="display:inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; background:${color}22; color:${color}; border: 1px solid ${color}44;">${escapeHtml(statusLabel)}</span>
          ${item.student.room ? `<p style="margin: 4px 0 0 0; font-size: 11px; color: #6b7280;">Room: ${escapeHtml(item.student.room)}</p>` : ''}
          <p style="margin: 4px 0 0 0; font-size: 11px; color: #9ca3af;">Last update: ${escapeHtml(lastUpdate)}</p>
        </div>
      `;

      const infoWindow = new google.maps.InfoWindow({ content });
      infoWindowsRef.current.push(infoWindow);

      marker.addListener('click', () => {
        infoWindowsRef.current.forEach((iw) => iw.close());
        infoWindow.open(mapInstance, marker);
      });
    });

    mapInstance.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
  }, [mapInstance, students, filter]);

  const filteredStudents = students.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'checked-in') return item.status === 'inside';
    if (filter === 'checked-out') return item.status === 'outside';
    if (filter === 'not-checked') return item.status === 'not_checked';
    return true;
  });

  const withLocation = filteredStudents.filter(
    (item) =>
      item.student.currentLocation &&
      typeof item.student.currentLocation.latitude === 'number' &&
      typeof item.student.currentLocation.longitude === 'number'
  );

  const withoutLocation = filteredStudents.filter(
    (item) =>
      !item.student.currentLocation ||
      typeof item.student.currentLocation.latitude !== 'number' ||
      typeof item.student.currentLocation.longitude !== 'number'
  );

  return (
    <SecurityLayout>
      <div className="flex flex-col min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 shadow-sm">
          <div className="flex-1">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Students Live Map
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Real-time location of all students</p>
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
            <div className="flex-1 relative min-h-[350px] md:min-h-0">
              {!mapReady ? (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 m-4 rounded-xl">
                  <p className="text-gray-500 text-sm">Loading map...</p>
                </div>
              ) : (
                <div ref={mapRef} className="absolute inset-0 m-4 rounded-xl border border-gray-200 overflow-hidden" />
              )}
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
