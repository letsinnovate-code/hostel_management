'use client';

import { useEffect, useRef, useState } from 'react';
import type * as LType from 'leaflet';
import { LatLng, getDefaultPolygonAroundHostel } from './mapTypes';
import { MapPin, Navigation, Maximize2, RotateCcw } from 'lucide-react';

export interface OSMGeoFenceMapProps {
  hostelLat: number;
  hostelLng: number;
  hostelName?: string;
  polygon?: LatLng[] | null;
  editable?: boolean;
  onPolygonChange?: (coords: LatLng[]) => void;
  height?: string;
  zoom?: number;
  onLocationSelect?: (lat: number, lng: number) => void;
}

export default function OSMGeoFenceMap({
  hostelLat,
  hostelLng,
  hostelName = 'Hostel',
  polygon: initialPolygon,
  editable = false,
  onPolygonChange,
  height = '480px',
  zoom = 17,
  onLocationSelect,
}: OSMGeoFenceMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LType.Map | null>(null);
  const polygonLayerRef = useRef<LType.Polygon | null>(null);
  const vertexMarkersRef = useRef<LType.Marker[]>([]);
  const hostelMarkerRef = useRef<LType.Marker | null>(null);
  const [activeCoords, setActiveCoords] = useState<LatLng[]>(initialPolygon || []);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Synchronize internal activeCoords when initialPolygon changes externally
  useEffect(() => {
    if (initialPolygon && initialPolygon.length >= 3) {
      setActiveCoords(initialPolygon);
    }
  }, [initialPolygon]);

  useEffect(() => {
    if (!isClient || !containerRef.current) return;

    let isMounted = true;

    // Dynamically import Leaflet to avoid SSR window errors
    import('leaflet').then((L) => {
      if (!isMounted || !containerRef.current) return;

      // Clean up previous instance if any
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const validLat = Number.isFinite(hostelLat) && hostelLat !== 0 ? hostelLat : 23.5235;
      const validLng = Number.isFinite(hostelLng) && hostelLng !== 0 ? hostelLng : 77.8139;

      const map = L.map(containerRef.current, {
        center: [validLat, validLng],
        zoom: zoom || 17,
        zoomControl: true,
      });

      mapInstanceRef.current = map;

      // OpenStreetMap standard tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      // Hostel Center Marker (Custom SVG Icon)
      const hostelIcon = L.divIcon({
        className: 'custom-hostel-icon',
        html: `
          <div style="position: relative; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 36px; height: 36px; border-radius: 50%; background: rgba(37, 99, 235, 0.25); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="width: 28px; height: 28px; border-radius: 50%; background: #2563eb; border: 2px solid white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center; color: white;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
            </div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const hostelMarker = L.marker([validLat, validLng], { icon: hostelIcon })
        .addTo(map)
        .bindPopup(`<b>${hostelName}</b><br/>Lat: ${validLat.toFixed(5)}, Lng: ${validLng.toFixed(5)}`);
      hostelMarkerRef.current = hostelMarker;

      // Handle map click if onLocationSelect provided
      if (onLocationSelect) {
        map.on('click', (e: LType.LeafletMouseEvent) => {
          onLocationSelect(e.latlng.lat, e.latlng.lng);
        });
      }

      // Initial render of polygon
      renderPolygonAndVertices(L, map, activeCoords, validLat, validLng);

      // Invalidate size to prevent gray tiles on flex containers
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
  }, [isClient, hostelLat, hostelLng]);

  // Re-render polygon when activeCoords changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    import('leaflet').then((L) => {
      if (!mapInstanceRef.current) return;
      const validLat = Number.isFinite(hostelLat) && hostelLat !== 0 ? hostelLat : 23.5235;
      const validLng = Number.isFinite(hostelLng) && hostelLng !== 0 ? hostelLng : 77.8139;
      renderPolygonAndVertices(L, mapInstanceRef.current, activeCoords, validLat, validLng);
    });
  }, [activeCoords, editable]);

  const renderPolygonAndVertices = (
    L: typeof import('leaflet'),
    map: LType.Map,
    coords: LatLng[],
    centerLat: number,
    centerLng: number
  ) => {
    // Clear old polygon layer
    if (polygonLayerRef.current) {
      polygonLayerRef.current.remove();
      polygonLayerRef.current = null;
    }

    // Clear old vertex markers
    vertexMarkersRef.current.forEach((m) => m.remove());
    vertexMarkersRef.current = [];

    const effectiveCoords = coords && coords.length >= 3 ? coords : getDefaultPolygonAroundHostel(centerLat, centerLng, 80);

    const latLngs: [number, number][] = effectiveCoords.map((c) => [c.latitude, c.longitude]);

    // Create Leaflet polygon
    const polygon = L.polygon(latLngs, {
      color: '#2563eb',
      weight: 2.5,
      fillColor: '#3b82f6',
      fillOpacity: 0.25,
      dashArray: editable ? '4, 4' : undefined,
    }).addTo(map);

    polygonLayerRef.current = polygon;

    // If editable, add draggable handle at each vertex
    if (editable) {
      effectiveCoords.forEach((pt, index) => {
        const vertexIcon = L.divIcon({
          className: 'custom-vertex-icon',
          html: `
            <div style="width: 16px; height: 16px; border-radius: 50%; background: #ffffff; border: 3px solid #2563eb; box-shadow: 0 2px 4px rgba(0,0,0,0.3); cursor: grab;"></div>
          `,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });

        const vertexMarker = L.marker([pt.latitude, pt.longitude], {
          icon: vertexIcon,
          draggable: true,
        }).addTo(map);

        vertexMarker.on('drag', (e: any) => {
          const newPos = e.target.getLatLng();
          const updatedCoords = [...effectiveCoords];
          updatedCoords[index] = { latitude: newPos.lat, longitude: newPos.lng };
          polygon.setLatLngs(updatedCoords.map((c) => [c.latitude, c.longitude]));
        });

        vertexMarker.on('dragend', (e: any) => {
          const newPos = e.target.getLatLng();
          const updatedCoords = [...effectiveCoords];
          updatedCoords[index] = { latitude: newPos.lat, longitude: newPos.lng };
          setActiveCoords(updatedCoords);
          onPolygonChange?.(updatedCoords);
        });

        vertexMarkersRef.current.push(vertexMarker);
      });
    }
  };

  const handleApplyPreset = (sizeMeters: number) => {
    const validLat = Number.isFinite(hostelLat) && hostelLat !== 0 ? hostelLat : 23.5235;
    const validLng = Number.isFinite(hostelLng) && hostelLng !== 0 ? hostelLng : 77.8139;
    const newCoords = getDefaultPolygonAroundHostel(validLat, validLng, sizeMeters);
    setActiveCoords(newCoords);
    onPolygonChange?.(newCoords);

    if (mapInstanceRef.current) {
      const bounds = newCoords.map((c) => [c.latitude, c.longitude] as [number, number]);
      mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40] });
    }
  };

  const handleCenterHostel = () => {
    const validLat = Number.isFinite(hostelLat) && hostelLat !== 0 ? hostelLat : 23.5235;
    const validLng = Number.isFinite(hostelLng) && hostelLng !== 0 ? hostelLng : 77.8139;
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([validLat, validLng], 17);
    }
  };

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-gray-200 shadow-sm bg-gray-50">
      {/* Map Canvas */}
      <div ref={containerRef} style={{ height }} className="w-full z-0" />

      {/* Preset Controls Overlay */}
      {editable && (
        <div className="absolute top-3 right-3 z-[400] flex flex-wrap gap-1.5 bg-white/95 backdrop-blur-md p-1.5 rounded-lg shadow-md border border-gray-200 text-xs font-medium text-gray-700">
          <span className="px-2 py-1 text-gray-500 font-normal">Presets:</span>
          <button
            type="button"
            onClick={() => handleApplyPreset(50)}
            className="px-2 py-1 bg-gray-100 hover:bg-blue-50 hover:text-blue-600 rounded transition-colors"
          >
            50m Box
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset(100)}
            className="px-2 py-1 bg-gray-100 hover:bg-blue-50 hover:text-blue-600 rounded transition-colors"
          >
            100m Box
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset(200)}
            className="px-2 py-1 bg-gray-100 hover:bg-blue-50 hover:text-blue-600 rounded transition-colors"
          >
            200m Box
          </button>
          <button
            type="button"
            onClick={handleCenterHostel}
            title="Recenter on Hostel"
            className="p-1 bg-gray-100 hover:bg-blue-50 hover:text-blue-600 rounded transition-colors"
          >
            <Navigation className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Status Bar */}
      <div className="bg-white px-4 py-2 border-t border-gray-200 flex flex-wrap items-center justify-between text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-blue-600" />
          <span>
            Hostel Center: <b>{hostelLat?.toFixed(4) || '—'}, {hostelLng?.toFixed(4) || '—'}</b>
          </span>
          <span className="text-gray-300">•</span>
          <span>{activeCoords.length} Boundary Vertices</span>
        </div>
        {editable && (
          <span className="text-blue-600 font-medium">
            Drag the white corner circles to reshape the boundary
          </span>
        )}
      </div>
    </div>
  );
}
