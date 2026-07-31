'use client';

import { useEffect, useRef, useState } from 'react';

export interface LatLng {
  latitude: number;
  longitude: number;
}

export type BoundaryData = {
  hostel: {
    id: string;
    name: string;
    latitude: number | null;
    longitude: number | null;
  };
  geoFence: {
    type: 'circle' | 'rectangle' | 'polygon';
    bounds: { north: number; south: number; east: number; west: number } | null;
    polygon: LatLng[] | null;
    center: LatLng | null;
    radius: number | null;
  } | null;
};

interface StudentDashboardMapProps {
  boundary: BoundaryData | null;
  currentLocation?: LatLng | null;
  height?: string;
}

declare global {
  interface Window {
    google: any;
  }
}

export default function StudentDashboardMap({
  boundary,
  currentLocation,
  height = '200px',
}: StudentDashboardMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [hostelMarker, setHostelMarker] = useState<any>(null);
  const [userMarker, setUserMarker] = useState<any>(null);
  const [polygonObj, setPolygonObj] = useState<any>(null);
  const [rectObj, setRectObj] = useState<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && !(window as any).google) {
      const script = document.createElement('script');
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
      script.async = true;
      script.defer = true;
      script.onload = () => setIsLoaded(true);
      document.head.appendChild(script);
    } else if ((window as any).google) {
      setIsLoaded(true);
    }
  }, []);

  const hostelLat = boundary?.hostel?.latitude ?? 28.6139;
  const hostelLng = boundary?.hostel?.longitude ?? 77.209;
  const hasHostel = boundary?.hostel?.latitude != null && boundary?.hostel?.longitude != null;
  const geoFence = boundary?.geoFence;
  const polygonPath = geoFence?.type === 'polygon' && geoFence.polygon && geoFence.polygon.length >= 3
    ? geoFence.polygon.map((p) => ({ lat: p.latitude, lng: p.longitude }))
    : null;
  const bounds = geoFence?.type === 'rectangle' && geoFence.bounds ? geoFence.bounds : null;

  useEffect(() => {
    if (!isLoaded || !mapRef.current || !(window as any).google) return;
    const google = (window as any).google;

    if (!map) {
      const newMap = new google.maps.Map(mapRef.current, {
        center: { lat: hostelLat, lng: hostelLng },
        zoom: 16,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
      });
      setMap(newMap);
    }
  }, [isLoaded, hostelLat, hostelLng]);

  useEffect(() => {
    if (!map || !(window as any).google) return;
    const google = (window as any).google;

    if (hostelMarker) hostelMarker.setMap(null);
    const hMarker = new google.maps.Marker({
      position: { lat: hostelLat, lng: hostelLng },
      map,
      title: boundary?.hostel?.name || 'Hostel',
      icon: { path: google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: '#2563eb', fillOpacity: 1, strokeColor: '#1d4ed8', strokeWeight: 2 },
    });
    setHostelMarker(hMarker);

    if (userMarker) userMarker.setMap(null);
    if (currentLocation?.latitude != null && currentLocation?.longitude != null) {
      const uMarker = new google.maps.Marker({
        position: { lat: currentLocation.latitude, lng: currentLocation.longitude },
        map,
        title: 'You',
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: '#22c55e', fillOpacity: 1, strokeColor: '#16a34a', strokeWeight: 2 },
      });
      setUserMarker(uMarker);
    } else {
      setUserMarker(null);
    }
  }, [map, boundary, currentLocation, hostelLat, hostelLng]);

  useEffect(() => {
    if (!map || !(window as any).google) return;
    const google = (window as any).google;

    if (polygonObj) {
      polygonObj.setMap(null);
      setPolygonObj(null);
    }
    if (rectObj) {
      rectObj.setMap(null);
      setRectObj(null);
    }

    if (polygonPath && polygonPath.length >= 3) {
      const poly = new google.maps.Polygon({
        paths: polygonPath,
        map,
        fillColor: '#0ea5e9',
        fillOpacity: 0.25,
        strokeColor: '#0284c7',
        strokeWeight: 2,
      });
      setPolygonObj(poly);
    } else if (bounds) {
      const rectBounds = new google.maps.LatLngBounds(
        { lat: bounds.south, lng: bounds.west },
        { lat: bounds.north, lng: bounds.east }
      );
      const rect = new google.maps.Rectangle({
        bounds: rectBounds,
        map,
        fillColor: '#0ea5e9',
        fillOpacity: 0.25,
        strokeColor: '#0284c7',
        strokeWeight: 2,
      });
      setRectObj(rect);
    }

    const latLngBounds = new google.maps.LatLngBounds();
    latLngBounds.extend({ lat: hostelLat, lng: hostelLng });
    if (polygonPath) polygonPath.forEach((p: { lat: number; lng: number }) => latLngBounds.extend(p));
    else if (bounds) {
      latLngBounds.extend({ lat: bounds.south, lng: bounds.west });
      latLngBounds.extend({ lat: bounds.north, lng: bounds.east });
    }
    if (currentLocation?.latitude != null && currentLocation?.longitude != null) {
      latLngBounds.extend({ lat: currentLocation.latitude, lng: currentLocation.longitude });
    }
    map.fitBounds(latLngBounds, 40);
  }, [map, polygonPath, bounds, currentLocation, hostelLat, hostelLng]);

  if (!isLoaded) {
    return (
      <div className="w-full rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center" style={{ height }}>
        <p className="text-sm text-gray-500">Loading map...</p>
      </div>
    );
  }

  if (!boundary || boundary.hostel?.latitude == null || boundary.hostel?.longitude == null) {
    return (
      <div className="w-full rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center" style={{ height }}>
        <p className="text-sm text-gray-500">Hostel location not set</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div ref={mapRef} className="w-full rounded-xl border border-gray-200 overflow-hidden" style={{ height }} />
      <p className="text-xs text-gray-500">
        Blue: hostel boundary · {currentLocation ? 'Green: your location' : 'Allow location to see your position'}
      </p>
    </div>
  );
}
