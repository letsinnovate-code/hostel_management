'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, isOwnerUser } from '../../../contexts/AuthContext';
import { useOwnerHostel } from '../../../contexts/OwnerHostelContext';
import api from '../../../services/api';
import { ChevronLeft, MapPin, User, RefreshCw } from 'lucide-react';

type StudentWithLocation = {
  _id: string;
  name: string;
  email?: string;
  studentId?: string;
  currentLocation?: {
    latitude: number;
    longitude: number;
    timestamp?: string;
  };
  lastLocationUpdate?: string;
  locationPermissionStatus?: string;
};

declare global {
  interface Window {
    google: any;
  }
}

export default function StudentsMapPage() {
  const { user } = useAuth();
  const { selectedHostel } = useOwnerHostel();
  const router = useRouter();
  const mapRef = useRef<HTMLDivElement>(null);
  const [students, setStudents] = useState<StudentWithLocation[]>([]);
  const [hostelCenter, setHostelCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const markersRef = useRef<any[]>([]);
  const infoWindowsRef = useRef<any[]>([]);
  const hostelMarkerRef = useRef<any>(null);

  useEffect(() => {
    if (!user || !isOwnerUser(user)) {
      router.replace('/login');
      return;
    }
  }, [user, router]);

  useEffect(() => {
    if (typeof window !== 'undefined' && !window.google) {
      const script = document.createElement('script');
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry`;
      script.async = true;
      script.defer = true;
      script.onload = () => setMapReady(true);
      document.head.appendChild(script);
    } else if (window.google) {
      setMapReady(true);
    }
  }, []);

  const loadData = async () => {
    if (!selectedHostel) {
      setStudents([]);
      setHostelCenter(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [studentsData, hostelData] = await Promise.all([
        api.getStudentLocations({ hostelId: selectedHostel }),
        api.getHostel(selectedHostel),
      ]);
      setStudents(Array.isArray(studentsData) ? studentsData : []);
      const hostel = hostelData?.data ?? hostelData;
      const lat = hostel?.address?.coordinates?.latitude;
      const lng = hostel?.address?.coordinates?.longitude;
      if (lat != null && lng != null) {
        setHostelCenter({ lat: Number(lat), lng: Number(lng) });
      } else {
        setHostelCenter(null);
      }
    } catch (e) {
      console.error('Failed to load students map data', e);
      setStudents([]);
      setHostelCenter(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedHostel]);

  // Initialize map once script and container are ready
  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.google) return;
    const google = window.google;
    const center = hostelCenter || { lat: 28.6139, lng: 77.209 };
    if (!mapInstance) {
      const map = new google.maps.Map(mapRef.current, {
        center,
        zoom: 14,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
      });
      setMapInstance(map);
    }
  }, [mapReady, mapRef.current, hostelCenter]);

  // Center map on hostel when hostel center loads
  useEffect(() => {
    if (mapInstance && hostelCenter) {
      mapInstance.setCenter(hostelCenter);
    }
  }, [mapInstance, hostelCenter]);

  // Hostel marker
  useEffect(() => {
    if (!mapInstance || !window.google || !hostelCenter) {
      if (hostelMarkerRef.current) {
        hostelMarkerRef.current.setMap(null);
        hostelMarkerRef.current = null;
      }
      return;
    }
    const google = window.google;
    if (hostelMarkerRef.current) hostelMarkerRef.current.setMap(null);
    const m = new google.maps.Marker({
      position: hostelCenter,
      map: mapInstance,
      title: 'Hostel',
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 12,
        fillColor: '#0ea5e9',
        fillOpacity: 1,
        strokeColor: '#0284c7',
        strokeWeight: 2,
      },
    });
    hostelMarkerRef.current = m;
  }, [mapInstance, hostelCenter]);

  // Plot student markers
  useEffect(() => {
    if (!mapInstance || !window.google) return;
    const google = window.google;

    // Clear previous markers and info windows
    markersRef.current.forEach((m) => m.setMap(null));
    infoWindowsRef.current.forEach((iw) => iw.close());
    markersRef.current = [];
    infoWindowsRef.current = [];

    const studentsWithLocation = students.filter(
      (s) =>
        s.currentLocation &&
        typeof s.currentLocation.latitude === 'number' &&
        typeof s.currentLocation.longitude === 'number'
    );

    if (studentsWithLocation.length === 0) return;

    const bounds = new google.maps.LatLngBounds();

    studentsWithLocation.forEach((student) => {
      const pos = {
        lat: student.currentLocation!.latitude,
        lng: student.currentLocation!.longitude,
      };
      bounds.extend(pos);

      const marker = new google.maps.Marker({
        position: pos,
        map: mapInstance,
        title: student.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#2563eb',
          fillOpacity: 1,
          strokeColor: '#1d4ed8',
          strokeWeight: 2,
        },
      });
      markersRef.current.push(marker);

      const lastUpdate = student.lastLocationUpdate
        ? new Date(student.lastLocationUpdate).toLocaleString()
        : '—';
      const content = `
        <div style="padding: 8px; min-width: 180px; font-family: system-ui, sans-serif;">
          <p style="margin: 0 0 4px 0; font-weight: 600; color: #111;">${escapeHtml(student.name)}</p>
          ${student.studentId ? `<p style="margin: 0 0 2px 0; font-size: 12px; color: #6b7280;">ID: ${escapeHtml(student.studentId)}</p>` : ''}
          ${student.email ? `<p style="margin: 0 0 2px 0; font-size: 12px; color: #374151; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(student.email)}</p>` : ''}
          <p style="margin: 4px 0 0 0; font-size: 11px; color: #9ca3af;">Last update: ${escapeHtml(lastUpdate)}</p>
          <a href="/owner/students/${student._id}" style="font-size: 12px; color: #2563eb; margin-top: 6px; display: inline-block;">View profile →</a>
        </div>
      `;
      const infoWindow = new google.maps.InfoWindow({ content });
      infoWindowsRef.current.push(infoWindow);

      marker.addListener('click', () => {
        infoWindowsRef.current.forEach((iw) => iw.close());
        infoWindow.open(mapInstance, marker);
      });
    });

    // Fit bounds to show all markers (and optionally hostel); add a little padding
    if (hostelCenter) bounds.extend(hostelCenter);
    mapInstance.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
  }, [mapInstance, students, hostelCenter]);

  const withLocation = students.filter(
    (s) =>
      s.currentLocation &&
      typeof s.currentLocation.latitude === 'number' &&
      typeof s.currentLocation.longitude === 'number'
  );
  const withoutLocation = students.filter(
    (s) =>
      !s.currentLocation ||
      typeof s.currentLocation.latitude !== 'number' ||
      typeof s.currentLocation.longitude !== 'number'
  );

  function escapeHtml(text: string) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 shadow-sm">
        <Link
          href="/owner/dashboard"
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
          aria-label="Back"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">Students map</h1>
          <p className="text-sm text-gray-500">Live locations of all students</p>
        </div>
        <button
          type="button"
          onClick={loadData}
          disabled={loading || !selectedHostel}
          className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 flex items-center gap-2 text-sm font-medium text-gray-700"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </header>

      {!selectedHostel ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <p className="text-gray-500">Select a hostel to view the students map.</p>
        </div>
      ) : loading && students.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent mx-auto" />
            <p className="text-gray-500 mt-3">Loading students...</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col md:flex-row min-h-0">
          <div className="flex-1 min-h-[320px] md:min-h-0 relative">
            {!mapReady ? (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg m-4">
                <p className="text-sm text-gray-500">Loading map...</p>
              </div>
            ) : (
              <div ref={mapRef} className="absolute inset-0 m-4 rounded-xl border border-gray-200 overflow-hidden" />
            )}
          </div>
          <aside className="w-full md:w-80 bg-white border-t md:border-t-0 md:border-l border-gray-200 flex flex-col max-h-[320px] md:max-h-none overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600" />
                On map ({withLocation.length})
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">Click a pin to see details</p>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {withLocation.length === 0 ? (
                <p className="text-sm text-gray-500 p-2">No students with shared location in this hostel.</p>
              ) : (
                <ul className="space-y-1">
                  {withLocation.map((s) => (
                    <li key={s._id}>
                      <Link
                        href={`/owner/students/${s._id}`}
                        className="block px-3 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-900"
                      >
                        {s.name}
                        {s.studentId ? (
                          <span className="text-gray-500 font-normal ml-1">({s.studentId})</span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {withoutLocation.length > 0 && (
              <>
                <div className="p-4 border-t border-gray-200">
                  <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    No location ({withoutLocation.length})
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">Location not shared or not yet updated</p>
                </div>
                <div className="flex-1 overflow-y-auto p-2 max-h-[140px]">
                  <ul className="space-y-1">
                    {withoutLocation.slice(0, 20).map((s) => (
                      <li key={s._id}>
                        <Link
                          href={`/owner/students/${s._id}`}
                          className="block px-3 py-1.5 rounded-lg hover:bg-gray-50 text-sm text-gray-600 truncate"
                        >
                          {s.name}
                        </Link>
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
  );
}
