'use client';

import { useEffect, useRef, useState } from 'react';
import type * as LType from 'leaflet';
import { LatLng } from './mapTypes';
import { MapPin, Navigation, User, ExternalLink, RefreshCw, ZoomIn, ZoomOut } from 'lucide-react';

export interface StudentMarkerData {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  studentId?: string;
  room?: string;
  currentLocation?: {
    latitude: number;
    longitude: number;
    timestamp?: string;
  };
  lastLocationUpdate?: string;
  status?: string;
  isInside?: boolean;
}

export interface OSMStudentsMapProps {
  hostelLat: number;
  hostelLng: number;
  hostelName?: string;
  polygon?: LatLng[] | null;
  students: StudentMarkerData[];
  selectedStudentId?: string | null;
  onStudentSelect?: (student: StudentMarkerData) => void;
  height?: string;
}

export default function OSMStudentsMap({
  hostelLat,
  hostelLng,
  hostelName = 'Hostel',
  polygon: boundaryPolygon,
  students,
  selectedStudentId,
  onStudentSelect,
  height = '560px',
}: OSMStudentsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LType.Map | null>(null);
  const studentMarkersRef = useRef<Map<string, LType.Marker>>(new Map());
  const polygonLayerRef = useRef<LType.Polygon | null>(null);
  const hostelMarkerRef = useRef<LType.Marker | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const validLat = Number.isFinite(hostelLat) && hostelLat !== 0 ? hostelLat : 23.5235;
  const validLng = Number.isFinite(hostelLng) && hostelLng !== 0 ? hostelLng : 77.8139;

  // Initialize Leaflet Map
  useEffect(() => {
    if (!isClient || !containerRef.current) return;

    let isMounted = true;

    import('leaflet').then((L) => {
      if (!isMounted || !containerRef.current) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const map = L.map(containerRef.current, {
        center: [validLat, validLng],
        zoom: 14,
        zoomControl: true,
      });

      mapInstanceRef.current = map;

      // OpenStreetMap Tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      // Hostel Marker
      const hostelIcon = L.divIcon({
        className: 'custom-hostel-icon',
        html: `
          <div style="position: relative; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 44px; height: 44px; border-radius: 50%; background: rgba(37, 99, 235, 0.2); animation: ping 2.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="width: 32px; height: 32px; border-radius: 50%; background: #2563eb; border: 2.5px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: center; color: white;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
            </div>
          </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });

      const hostelMarker = L.marker([validLat, validLng], { icon: hostelIcon })
        .addTo(map)
        .bindPopup(`
          <div style="padding: 10px; font-family: system-ui, -apple-system, sans-serif;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
              <span style="font-size: 14px; font-weight: 700; color: #1e3a8a;">🏢 ${escapeHtml(hostelName)}</span>
            </div>
            <p style="font-size: 12px; color: #64748b; margin: 0;">Main Hostel Campus</p>
            <p style="font-size: 11px; color: #94a3b8; margin: 4px 0 0 0;">Coords: ${validLat.toFixed(4)}, ${validLng.toFixed(4)}</p>
          </div>
        `, { className: 'custom-popup' });

      hostelMarkerRef.current = hostelMarker;

      // Render Geofence Boundary Polygon if present
      if (boundaryPolygon && boundaryPolygon.length >= 3) {
        const latLngs: [number, number][] = boundaryPolygon.map((p) => [p.latitude, p.longitude]);
        polygonLayerRef.current = L.polygon(latLngs, {
          color: '#10b981',
          weight: 2,
          fillColor: '#10b981',
          fillOpacity: 0.15,
          dashArray: '5, 5',
        }).addTo(map);
      }

      // Render Students
      renderStudentMarkers(L, map, students);

      setTimeout(() => {
        map.invalidateSize();
      }, 200);
    });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isClient, validLat, validLng]);

  // Update students when students array changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    import('leaflet').then((L) => {
      if (!mapInstanceRef.current) return;
      renderStudentMarkers(L, mapInstanceRef.current, students);
    });
  }, [students]);

  // Update boundary polygon when it changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    import('leaflet').then((L) => {
      if (!mapInstanceRef.current) return;
      if (polygonLayerRef.current) {
        polygonLayerRef.current.remove();
        polygonLayerRef.current = null;
      }
      if (boundaryPolygon && boundaryPolygon.length >= 3) {
        const latLngs: [number, number][] = boundaryPolygon.map((p) => [p.latitude, p.longitude]);
        polygonLayerRef.current = L.polygon(latLngs, {
          color: '#10b981',
          weight: 2,
          fillColor: '#10b981',
          fillOpacity: 0.15,
          dashArray: '5, 5',
        }).addTo(mapInstanceRef.current);
      }
    });
  }, [boundaryPolygon]);


  // Handle selected student focus
  useEffect(() => {
    if (!selectedStudentId || !mapInstanceRef.current) return;
    const targetStudent = students.find((s) => s._id === selectedStudentId);
    if (
      targetStudent &&
      targetStudent.currentLocation &&
      Number.isFinite(targetStudent.currentLocation.latitude) &&
      Number.isFinite(targetStudent.currentLocation.longitude)
    ) {
      const lat = targetStudent.currentLocation.latitude;
      const lng = targetStudent.currentLocation.longitude;
      mapInstanceRef.current.flyTo([lat, lng], 16, { duration: 1.2 });

      const marker = studentMarkersRef.current.get(selectedStudentId);
      if (marker) {
        marker.openPopup();
      }
    }
  }, [selectedStudentId, students]);

  const renderStudentMarkers = (
    L: typeof import('leaflet'),
    map: LType.Map,
    studentList: StudentMarkerData[]
  ) => {
    // Clear old markers
    studentMarkersRef.current.forEach((m) => m.remove());
    studentMarkersRef.current.clear();

    const validStudents = studentList.filter(
      (s) =>
        s.currentLocation &&
        Number.isFinite(s.currentLocation.latitude) &&
        Number.isFinite(s.currentLocation.longitude)
    );

    const boundsPoints: [number, number][] = [[validLat, validLng]];

    validStudents.forEach((student) => {
      const lat = student.currentLocation!.latitude;
      const lng = student.currentLocation!.longitude;
      boundsPoints.push([lat, lng]);

      const isInside = student.isInside ?? true;
      const pinColor = isInside ? '#10b981' : '#f59e0b';
      const initial = (student.name || 'S').charAt(0).toUpperCase();
      const lastUpdateStr = student.lastLocationUpdate
        ? new Date(student.lastLocationUpdate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
        : 'Recent';

      const studentIcon = L.divIcon({
        className: 'custom-student-marker',
        html: `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: ${pinColor}; border: 2.5px solid #ffffff; box-shadow: 0 4px 8px rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 13px;">
              ${initial}
            </div>
            <div style="margin-top: 2px; background: rgba(15, 23, 42, 0.85); color: white; font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 6px; white-space: nowrap; max-width: 90px; overflow: hidden; text-overflow: ellipsis; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
              ${escapeHtml(student.name.split(' ')[0])}
            </div>
          </div>
        `,
        iconSize: [36, 50],
        iconAnchor: [18, 25],
      });

      const popupHtml = `
        <div style="padding: 12px; font-family: system-ui, -apple-system, sans-serif; min-width: 200px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <span style="font-size: 14px; font-weight: 700; color: #0f172a;">${escapeHtml(student.name)}</span>
            <span style="font-size: 10px; padding: 2px 6px; border-radius: 9999px; background: ${isInside ? '#d1fae5' : '#fef3c7'}; color: ${isInside ? '#065f46' : '#92400e'}; font-weight: 600;">
              ${isInside ? 'Inside Hostel' : 'Outside Hostel'}
            </span>
          </div>
          ${student.studentId ? `<div style="font-size: 11px; color: #64748b; margin-bottom: 2px;">ID: <b>${escapeHtml(student.studentId)}</b></div>` : ''}
          ${student.room ? `<div style="font-size: 11px; color: #64748b; margin-bottom: 2px;">Room: <b>${escapeHtml(student.room)}</b></div>` : ''}
          ${student.phone ? `<div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">Phone: <b>${escapeHtml(student.phone)}</b></div>` : ''}
          <div style="font-size: 10px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 6px; margin-top: 6px; display: flex; justify-content: space-between; align-items: center;">
            <span>Seen: ${escapeHtml(lastUpdateStr)}</span>
            <a href="/owner/students/${student._id}" style="color: #2563eb; font-weight: 600; text-decoration: none; font-size: 11px;">View Profile &rarr;</a>
          </div>
        </div>
      `;

      const marker = L.marker([lat, lng], { icon: studentIcon })
        .addTo(map)
        .bindPopup(popupHtml, { className: 'custom-popup' });

      marker.on('click', () => {
        onStudentSelect?.(student);
      });

      studentMarkersRef.current.set(student._id, marker);
    });

    // Auto fit bounds if students exist
    if (boundsPoints.length > 1) {
      map.fitBounds(boundsPoints, { padding: [50, 50], maxZoom: 16 });
    }
  };

  const handleFitAll = () => {
    if (!mapInstanceRef.current) return;
    const validStudents = students.filter(
      (s) =>
        s.currentLocation &&
        Number.isFinite(s.currentLocation.latitude) &&
        Number.isFinite(s.currentLocation.longitude)
    );
    const pts: [number, number][] = [[validLat, validLng], ...validStudents.map((s) => [s.currentLocation!.latitude, s.currentLocation!.longitude] as [number, number])];
    mapInstanceRef.current.fitBounds(pts, { padding: [50, 50], maxZoom: 16 });
  };

  const handleRecenterHostel = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([validLat, validLng], 16, { duration: 1.2 });
    }
  };

  function escapeHtml(text: string) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-gray-50 flex flex-col">
      {/* Map Container */}
      <div ref={containerRef} style={{ height }} className="w-full flex-1 z-0" />

      {/* Floating Control Buttons */}
      <div className="absolute top-4 right-4 z-[400] flex flex-col gap-2">
        <button
          type="button"
          onClick={handleFitAll}
          title="Fit All on Map"
          className="p-2.5 bg-white/95 backdrop-blur shadow-md hover:bg-gray-50 text-gray-700 rounded-xl border border-gray-200 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95"
        >
          <Navigation className="w-4 h-4 text-blue-600" />
          <span>Fit All</span>
        </button>
        <button
          type="button"
          onClick={handleRecenterHostel}
          title="Center on Hostel"
          className="p-2.5 bg-white/95 backdrop-blur shadow-md hover:bg-gray-50 text-gray-700 rounded-xl border border-gray-200 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95"
        >
          <MapPin className="w-4 h-4 text-blue-600" />
          <span>Hostel</span>
        </button>
      </div>

      {/* Footer Legend */}
      <div className="bg-white/95 backdrop-blur border-t border-gray-200 px-4 py-2.5 flex flex-wrap items-center justify-between text-xs text-gray-600 z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block border border-white shadow-sm" />
            <span className="font-medium text-gray-700">Inside Perimeter</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-500 inline-block border border-white shadow-sm" />
            <span className="font-medium text-gray-700">Outside Perimeter</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-blue-600 inline-block border border-white shadow-sm" />
            <span className="font-medium text-gray-700">Hostel Campus</span>
          </div>
        </div>
        <div className="text-gray-500 font-medium">
          OpenStreetMap &bull; Real-time GPS Tracking
        </div>
      </div>
    </div>
  );
}
