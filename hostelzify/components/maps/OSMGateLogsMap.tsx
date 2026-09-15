'use client';

import { useEffect, useRef, useState } from 'react';
import type * as LType from 'leaflet';
import { LogIn, LogOut, MapPin, Navigation } from 'lucide-react';

export interface GateLogMapEvent {
  time: string;
  type: 'in' | 'out';
  studentId: string;
  studentName: string;
  studentEmail?: string;
  studentNumber?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface OSMGateLogsMapProps {
  hostelLat: number;
  hostelLng: number;
  hostelName?: string;
  events: GateLogMapEvent[];
  height?: string;
}

export default function OSMGateLogsMap({
  hostelLat,
  hostelLng,
  hostelName = 'Hostel Gate',
  events,
  height = '420px',
}: OSMGateLogsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LType.Map | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const validLat = Number.isFinite(hostelLat) && hostelLat !== 0 ? hostelLat : 23.5235;
  const validLng = Number.isFinite(hostelLng) && hostelLng !== 0 ? hostelLng : 77.8139;

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
        zoom: 17,
        zoomControl: true,
      });

      mapInstanceRef.current = map;

      // OpenStreetMap Tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      // Gate / Hostel Entrance Icon
      const gateIcon = L.divIcon({
        className: 'custom-gate-icon',
        html: `
          <div style="position: relative; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 42px; height: 42px; border-radius: 50%; background: rgba(8, 145, 178, 0.25); animation: ping 3s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="width: 32px; height: 32px; border-radius: 50%; background: #0891b2; border: 2.5px solid white; box-shadow: 0 4px 8px rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center; color: white;">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="9" y1="3" x2="9" y2="21"></line>
              </svg>
            </div>
          </div>
        `,
        iconSize: [42, 42],
        iconAnchor: [21, 21],
      });

      L.marker([validLat, validLng], { icon: gateIcon })
        .addTo(map)
        .bindPopup(`
          <div style="padding: 10px; font-family: system-ui, sans-serif;">
            <b style="font-size: 13px; color: #0f172a;">🚪 ${escapeHtml(hostelName)} — Main Gate</b>
            <p style="font-size: 11px; color: #64748b; margin: 4px 0 0 0;">Check-in & Check-out Point</p>
          </div>
        `, { className: 'custom-popup' });

      // Plot recent events near gate with slight radial scatter if coordinates match gate
      const recentEvents = events.slice(0, 15);
      recentEvents.forEach((ev, idx) => {
        const isIn = ev.type === 'in';
        const angle = (idx / Math.max(recentEvents.length, 1)) * 2 * Math.PI;
        // 15 - 35 meter slight scatter around the gate for visual legibility
        const scatterRadius = 0.00015 + (idx % 3) * 0.00008;
        const ptLat = ev.coordinates?.latitude || (validLat + Math.sin(angle) * scatterRadius);
        const ptLng = ev.coordinates?.longitude || (validLng + Math.cos(angle) * scatterRadius);

        const color = isIn ? '#10b981' : '#f97316';
        const label = isIn ? 'IN' : 'OUT';
        const timeStr = ev.time ? new Date(ev.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';

        const eventIcon = L.divIcon({
          className: 'custom-gate-event-marker',
          html: `
            <div style="display: flex; align-items: center; gap: 4px; background: ${color}; color: white; padding: 2px 6px; border-radius: 9999px; font-size: 10px; font-weight: 700; box-shadow: 0 2px 4px rgba(0,0,0,0.25); border: 1.5px solid white;">
              <span>${label}</span>
              <span style="font-weight: 500; opacity: 0.9;">${timeStr}</span>
            </div>
          `,
          iconSize: [80, 24],
          iconAnchor: [40, 12],
        });

        L.marker([ptLat, ptLng], { icon: eventIcon })
          .addTo(map)
          .bindPopup(`
            <div style="padding: 10px; font-family: system-ui, sans-serif; min-width: 170px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                <b style="font-size: 13px; color: #0f172a;">${escapeHtml(ev.studentName)}</b>
                <span style="font-size: 10px; font-weight: 700; color: ${color};">${label}</span>
              </div>
              ${ev.studentNumber ? `<p style="font-size: 11px; color: #64748b; margin: 0 0 2px 0;">ID: ${escapeHtml(ev.studentNumber)}</p>` : ''}
              <p style="font-size: 11px; color: #64748b; margin: 0;">Time: <b>${escapeHtml(timeStr)}</b></p>
            </div>
          `, { className: 'custom-popup' });
      });

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
  }, [isClient, validLat, validLng, events]);

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
    <div className="relative w-full rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-gray-50 flex flex-col">
      <div ref={containerRef} style={{ height }} className="w-full z-0" />
      <div className="bg-white/95 backdrop-blur px-4 py-2 border-t border-gray-200 flex items-center justify-between text-xs text-gray-600">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-600 inline-block" />
            <span className="font-semibold text-gray-700">Main Gate</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            <span className="text-gray-700">Check-In</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" />
            <span className="text-gray-700">Check-Out</span>
          </div>
        </div>
        <span className="text-gray-500">Live Gate Geo-Logs</span>
      </div>
    </div>
  );
}
