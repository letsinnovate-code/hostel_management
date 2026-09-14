'use client';

import { useEffect, useRef } from 'react';
import { useGoogleMapsScript } from '../hooks/useGoogleMapsScript';
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
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const hostelMarkerRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const polygonRef = useRef<any>(null);
  const rectRef = useRef<any>(null);
  const { isLoaded, loadError } = useGoogleMapsScript('places,geometry');

  const hostelLat = boundary?.hostel?.latitude ?? 28.6139;
  const hostelLng = boundary?.hostel?.longitude ?? 77.209;
  const geoFence = boundary?.geoFence;
  const polygonPath =
    geoFence?.type === 'polygon' && geoFence.polygon && geoFence.polygon.length >= 3
      ? geoFence.polygon.map((p) => ({ lat: p.latitude, lng: p.longitude }))
      : null;
  const bounds = geoFence?.type === 'rectangle' && geoFence.bounds ? geoFence.bounds : null;

  // Initialize Map
  useEffect(() => {
    if (!isLoaded || !mapRef.current || !window.google) return;
    const google = window.google;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new google.maps.Map(mapRef.current, {
        center: { lat: hostelLat, lng: hostelLng },
        zoom: 16,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
      });
    }

    return () => {
      if (hostelMarkerRef.current) hostelMarkerRef.current.setMap(null);
      if (userMarkerRef.current) userMarkerRef.current.setMap(null);
      if (polygonRef.current) polygonRef.current.setMap(null);
      if (rectRef.current) rectRef.current.setMap(null);
      mapInstanceRef.current = null;
    };
  }, [isLoaded, hostelLat, hostelLng]);

  // Sync Hostel Marker & Boundary
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !window.google) return;
    const google = window.google;

    // Update or create hostel marker
    if (!hostelMarkerRef.current) {
      hostelMarkerRef.current = new google.maps.Marker({
        position: { lat: hostelLat, lng: hostelLng },
        map,
        title: boundary?.hostel?.name || 'Hostel',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#2563eb',
          fillOpacity: 1,
          strokeColor: '#1d4ed8',
          strokeWeight: 2,
        },
      });
    } else {
      hostelMarkerRef.current.setPosition({ lat: hostelLat, lng: hostelLng });
      hostelMarkerRef.current.setTitle(boundary?.hostel?.name || 'Hostel');
    }

    // Clean up old boundary overlays
    if (polygonRef.current) {
      polygonRef.current.setMap(null);
      polygonRef.current = null;
    }
    if (rectRef.current) {
      rectRef.current.setMap(null);
      rectRef.current = null;
    }

    if (polygonPath && polygonPath.length >= 3) {
      polygonRef.current = new google.maps.Polygon({
        paths: polygonPath,
        map,
        fillColor: '#0ea5e9',
        fillOpacity: 0.25,
        strokeColor: '#0284c7',
        strokeWeight: 2,
      });
    } else if (bounds) {
      const rectBounds = new google.maps.LatLngBounds(
        { lat: bounds.south, lng: bounds.west },
        { lat: bounds.north, lng: bounds.east }
      );
      rectRef.current = new google.maps.Rectangle({
        bounds: rectBounds,
        map,
        fillColor: '#0ea5e9',
        fillOpacity: 0.25,
        strokeColor: '#0284c7',
        strokeWeight: 2,
      });
    }
  }, [boundary, polygonPath, bounds, hostelLat, hostelLng]);

  // Sync User Location Marker In-place
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !window.google) return;
    const google = window.google;

    if (currentLocation?.latitude != null && currentLocation?.longitude != null) {
      const newPos = { lat: currentLocation.latitude, lng: currentLocation.longitude };
      if (userMarkerRef.current) {
        userMarkerRef.current.setPosition(newPos);
      } else {
        userMarkerRef.current = new google.maps.Marker({
          position: newPos,
          map,
          title: 'You',
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#22c55e',
            fillOpacity: 1,
            strokeColor: '#16a34a',
            strokeWeight: 2,
          },
        });
      }

      // Extend bounds to keep both hostel and student visible
      const latLngBounds = new google.maps.LatLngBounds();
      latLngBounds.extend({ lat: hostelLat, lng: hostelLng });
      latLngBounds.extend(newPos);
      map.fitBounds(latLngBounds, 40);
    } else {
      if (userMarkerRef.current) {
        userMarkerRef.current.setMap(null);
        userMarkerRef.current = null;
      }
    }
  }, [currentLocation, hostelLat, hostelLng]);

  if (loadError) {
    return (
      <div
        className="w-full rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-500"
        style={{ height }}
      >
        <p className="text-sm">Unable to load student map</p>
      </div>
    );
  }

  if (!isLoaded) {
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
        ref={mapRef}
        className="w-full rounded-xl border border-gray-200 overflow-hidden"
        style={{ height }}
      />
      <p className="text-xs text-gray-500">
        Blue: hostel boundary · {currentLocation ? 'Green: your location' : 'Allow location to see your position'}
      </p>
    </div>
  );
}
