'use client';

import { useEffect, useRef, useState } from 'react';
import type * as LType from 'leaflet';

export interface OSMLocationViewProps {
  latitude?: number | null;
  longitude?: number | null;
  /** If provided, the marker becomes draggable and this callback fires on drop/click */
  onLocationChange?: (lat: number, lng: number) => void;
  height?: string;
  zoom?: number;
  /** Label shown in the pin popup */
  label?: string;
}

export default function OSMLocationView({
  latitude,
  longitude,
  onLocationChange,
  height = '400px',
  zoom = 15,
  label = 'Hostel Location',
}: OSMLocationViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LType.Map | null>(null);
  const markerRef = useRef<LType.Marker | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Default coordinates — Bhopal, India
  const lat = latitude && Number.isFinite(latitude) && latitude !== 0 ? latitude : 23.5235;
  const lng = longitude && Number.isFinite(longitude) && longitude !== 0 ? longitude : 77.8139;

  useEffect(() => {
    if (!isClient || !containerRef.current) return;
    let isMounted = true;

    import('leaflet').then((L) => {
      if (!isMounted || !containerRef.current) return;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }

      const map = L.map(containerRef.current, {
        center: [lat, lng],
        zoom,
        zoomControl: true,
        scrollWheelZoom: true,
      });

      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      // Custom pulsing hostel marker
      const hostelIcon = L.divIcon({
        className: 'osm-hostel-pin',
        html: `
          <div style="position:relative;display:flex;align-items:center;justify-content:center;">
            <div style="position:absolute;width:40px;height:40px;border-radius:50%;background:rgba(37,99,235,0.2);animation:ping 2.5s cubic-bezier(0,0,0.2,1) infinite;"></div>
            <div style="width:30px;height:30px;border-radius:50%;background:#2563eb;border:2.5px solid white;box-shadow:0 4px 10px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;color:white;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
            </div>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      const popupText = `<div style="padding:8px 4px;font-family:system-ui,sans-serif;"><b style="font-size:13px;color:#1e40af;">📍 ${label}</b><br/><span style="font-size:11px;color:#64748b;">Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}</span></div>`;

      const marker = L.marker([lat, lng], {
        icon: hostelIcon,
        draggable: !!onLocationChange,
      }).addTo(map).bindPopup(popupText);

      markerRef.current = marker;

      if (onLocationChange) {
        map.on('click', (e: LType.LeafletMouseEvent) => {
          const newLat = e.latlng.lat;
          const newLng = e.latlng.lng;
          marker.setLatLng([newLat, newLng]);
          onLocationChange(newLat, newLng);
        });
        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          onLocationChange(pos.lat, pos.lng);
        });
      }

      setTimeout(() => map.invalidateSize(), 200);
    });

    return () => {
      isMounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, lat, lng]);

  // Pan to new coordinates when they update without remounting
  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    if (latitude && longitude && Number.isFinite(latitude) && Number.isFinite(longitude)) {
      mapRef.current.setView([latitude, longitude], zoom, { animate: true });
      markerRef.current.setLatLng([latitude, longitude]);
    }
  }, [latitude, longitude]);

  if (!isClient) {
    return (
      <div
        className="w-full flex items-center justify-center bg-gray-100 rounded-xl border border-gray-200 text-gray-400 text-sm"
        style={{ height }}
      >
        Loading map...
      </div>
    );
  }

  return (
    <div className="w-full relative rounded-xl overflow-hidden border border-gray-200 shadow-sm" style={{ height }}>
      <div ref={containerRef} className="w-full h-full" />
      {onLocationChange && (
        <div className="absolute bottom-3 left-3 z-[400] bg-white/90 backdrop-blur px-2.5 py-1.5 rounded-lg shadow text-xs font-medium text-gray-600 border border-gray-200">
          📌 Click map or drag pin to set location
        </div>
      )}
    </div>
  );
}
