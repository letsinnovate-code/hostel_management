'use client';

import { useEffect, useRef, useState } from 'react';
import type * as LType from 'leaflet';
import { LatLng, BoundaryData } from './maps/mapTypes';

// Re-export for backward compatibility
export type { LatLng, BoundaryData };

interface StudentDashboardMapProps {
  boundary: BoundaryData | null;
  currentLocation?: LatLng | null;
  height?: string;
}

export default function StudentDashboardMap({
  boundary,
  currentLocation,
  height = '200px',
}: StudentDashboardMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LType.Map | null>(null);
  const hostelMarkerRef = useRef<LType.Marker | null>(null);
  const userMarkerRef = useRef<LType.Marker | null>(null);
  const overlayRef = useRef<LType.Layer | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const hostelLat = boundary?.hostel?.latitude ?? 23.5235;
  const hostelLng = boundary?.hostel?.longitude ?? 77.8139;
  const hostelName = boundary?.hostel?.name || 'Hostel Campus';

  useEffect(() => {
    if (!isClient || !containerRef.current) return;
    let isMounted = true;

    import('leaflet').then((L) => {
      if (!isMounted || !containerRef.current) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        hostelMarkerRef.current = null;
        userMarkerRef.current = null;
        overlayRef.current = null;
      }

      const map = L.map(containerRef.current, {
        center: [hostelLat, hostelLng],
        zoom: 16,
        zoomControl: true,
      });

      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      // Hostel pin icon
      const hostelIcon = L.divIcon({
        className: 'student-hostel-pin',
        html: `
          <div style="position:relative;display:flex;align-items:center;justify-content:center;">
            <div style="position:absolute;width:36px;height:36px;border-radius:50%;background:rgba(37,99,235,0.25);animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
            <div style="width:26px;height:26px;border-radius:50%;background:#2563eb;border:2px solid white;box-shadow:0 3px 8px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;color:white;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
            </div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const hostelMarker = L.marker([hostelLat, hostelLng], { icon: hostelIcon })
        .addTo(map)
        .bindPopup(`<b>${hostelName}</b>`);
      hostelMarkerRef.current = hostelMarker;

      // Draw GeoFence boundary
      const geoFence = boundary?.geoFence;
      if (geoFence?.type === 'polygon' && geoFence.polygon && geoFence.polygon.length >= 3) {
        const latLngs: [number, number][] = geoFence.polygon.map((p) => [p.latitude, p.longitude]);
        const polygon = L.polygon(latLngs, {
          color: '#0284c7',
          weight: 2,
          fillColor: '#0ea5e9',
          fillOpacity: 0.2,
        }).addTo(map);
        overlayRef.current = polygon;
      } else if (geoFence?.type === 'rectangle' && geoFence.bounds) {
        const bounds: LType.LatLngBoundsExpression = [
          [geoFence.bounds.south, geoFence.bounds.west],
          [geoFence.bounds.north, geoFence.bounds.east],
        ];
        const rect = L.rectangle(bounds, {
          color: '#0284c7',
          weight: 2,
          fillColor: '#0ea5e9',
          fillOpacity: 0.2,
        }).addTo(map);
        overlayRef.current = rect;
      }

      // Draw user location if available
      if (currentLocation?.latitude != null && currentLocation?.longitude != null) {
        const userIcon = L.divIcon({
          className: 'student-user-pin',
          html: `
            <div style="position:relative;display:flex;align-items:center;justify-content:center;">
              <div style="position:absolute;width:30px;height:30px;border-radius:50%;background:rgba(34,197,94,0.35);animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
              <div style="width:20px;height:20px;border-radius:50%;background:#22c55e;border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>
            </div>
          `,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });

        const userMarker = L.marker([currentLocation.latitude, currentLocation.longitude], {
          icon: userIcon,
        })
          .addTo(map)
          .bindPopup('<b>You are here</b>');
        userMarkerRef.current = userMarker;

        const bounds = L.latLngBounds([
          [hostelLat, hostelLng],
          [currentLocation.latitude, currentLocation.longitude],
        ]);
        map.fitBounds(bounds.pad(0.3));
      }

      setTimeout(() => {
        map.invalidateSize();
      }, 250);
    });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isClient, hostelLat, hostelLng, boundary, currentLocation]);

  if (!isClient) {
    return (
      <div
        className="w-full rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center"
        style={{ height }}
      >
        <p className="text-sm text-gray-500">Loading map...</p>
      </div>
    );
  }

  if (!boundary || boundary.hostel?.latitude == null || boundary.hostel?.longitude == null) {
    return (
      <div
        className="w-full rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center"
        style={{ height }}
      >
        <p className="text-sm text-gray-500">Hostel location not set</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div
        ref={containerRef}
        className="w-full rounded-xl border border-gray-200 overflow-hidden shadow-inner"
        style={{ height }}
      />
      <p className="text-xs text-gray-500">
        Blue: hostel boundary · {currentLocation ? 'Green: your location' : 'Allow location to see your position'}
      </p>
    </div>
  );
}
