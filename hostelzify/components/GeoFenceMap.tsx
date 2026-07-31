'use client';

import { useEffect, useRef, useState } from 'react';

export interface Bounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface LatLng {
  latitude: number;
  longitude: number;
}

interface GeoFenceMapProps {
  hostelLat: number;
  hostelLng: number;
  /** Rectangle bounds (for type rectangle) */
  bounds?: Bounds | null;
  /** Polygon (4+ points for quadrilateral). When provided with editable, user can drag vertices. */
  polygon?: LatLng[] | null;
  editable?: boolean;
  onPolygonChange?: (coords: LatLng[]) => void;
  height?: string;
  zoom?: number;
}

declare global {
  interface Window {
    google: any;
  }
}

const METERS_PER_DEG_LAT = 111320;
const METERS_PER_DEG_LNG = (lat: number) => 111320 * Math.cos((lat * Math.PI) / 180);

export function getDefaultBoundsAroundHostel(hostelLat: number, hostelLng: number, sizeMeters = 150): Bounds {
  const dLat = sizeMeters / METERS_PER_DEG_LAT;
  const dLng = sizeMeters / METERS_PER_DEG_LNG(hostelLat);
  return {
    north: hostelLat + dLat / 2,
    south: hostelLat - dLat / 2,
    east: hostelLng + dLng / 2,
    west: hostelLng - dLng / 2,
  };
}

/** Returns 4 corners of a quadrilateral (rectangle) around the hostel. */
export function getDefaultPolygonAroundHostel(hostelLat: number, hostelLng: number, sizeMeters = 150): LatLng[] {
  const b = getDefaultBoundsAroundHostel(hostelLat, hostelLng, sizeMeters);
  return [
    { latitude: b.north, longitude: b.west },
    { latitude: b.north, longitude: b.east },
    { latitude: b.south, longitude: b.east },
    { latitude: b.south, longitude: b.west },
  ];
}

export default function GeoFenceMap({
  hostelLat,
  hostelLng,
  bounds: initialBounds,
  polygon: initialPolygon,
  editable = false,
  onPolygonChange,
  height = '400px',
  zoom = 17,
}: GeoFenceMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [marker, setMarker] = useState<any>(null);
  const [rectangle, setRectangle] = useState<any>(null);
  const [polygon, setPolygon] = useState<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && !(window as any).google) {
      const script = document.createElement('script');
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => setIsLoaded(true);
      document.head.appendChild(script);
    } else if ((window as any).google) {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!isLoaded || !mapRef.current || !(window as any).google) return;

    if (!map) {
      const google = (window as any).google;
      const newMap = new google.maps.Map(mapRef.current, {
        center: { lat: hostelLat, lng: hostelLng },
        zoom,
        mapTypeControl: true,
        streetViewControl: true,
        fullscreenControl: true,
      });
      const newMarker = new google.maps.Marker({
        position: { lat: hostelLat, lng: hostelLng },
        map: newMap,
        title: 'Hostel',
      });
      setMap(newMap);
      setMarker(newMarker);
    }
  }, [isLoaded, hostelLat, hostelLng, zoom]);

  // Rectangle display (when polygon not used)
  useEffect(() => {
    if (!map || !(window as any).google) return;
    const google = (window as any).google;

    if (initialPolygon && initialPolygon.length >= 3) {
      if (rectangle) {
        rectangle.setMap(null);
        setRectangle(null);
      }
      return;
    }

    if (!initialBounds) {
      if (rectangle) {
        rectangle.setMap(null);
        setRectangle(null);
      }
      return;
    }

    const rectBounds = new google.maps.LatLngBounds(
      { lat: initialBounds.south, lng: initialBounds.west },
      { lat: initialBounds.north, lng: initialBounds.east }
    );

    if (rectangle) {
      rectangle.setBounds(rectBounds);
      rectangle.setMap(map);
    } else {
      const rect = new google.maps.Rectangle({
        bounds: rectBounds,
        map,
        fillColor: '#0a7ea4',
        fillOpacity: 0.25,
        strokeColor: '#0a7ea4',
        strokeWeight: 2,
      });
      setRectangle(rect);
    }

    const boundsToFit = rectBounds.extend({ lat: hostelLat, lng: hostelLng });
    map.fitBounds(boundsToFit, 20);
  }, [map, initialBounds, initialPolygon]);

  // Polygon display (editable quadrilateral)
  useEffect(() => {
    if (!map || !(window as any).google) return;
    const google = (window as any).google;

    if (!initialPolygon || initialPolygon.length < 3) {
      if (polygon) {
        polygon.setMap(null);
        setPolygon(null);
      }
      return;
    }

    const path = initialPolygon.map((p) => ({ lat: p.latitude, lng: p.longitude }));

    const updateFromPath = (p: any) => {
      const pth = p.getPath();
      const coords: LatLng[] = [];
      for (let i = 0; i < pth.getLength(); i++) {
        const pt = pth.getAt(i);
        coords.push({ latitude: pt.lat(), longitude: pt.lng() });
      }
      onPolygonChange?.(coords);
    };

    if (polygon) {
      polygon.setPath(path);
      polygon.setMap(map);
      if (editable) {
        polygon.setEditable(true);
        polygon.setDraggable(true);
      } else {
        polygon.setEditable(false);
        polygon.setDraggable(false);
      }
    } else {
      const poly = new google.maps.Polygon({
        paths: path,
        map,
        fillColor: '#0a7ea4',
        fillOpacity: 0.25,
        strokeColor: '#0a7ea4',
        strokeWeight: 2,
        editable: !!editable,
        draggable: !!editable,
      });
      setPolygon(poly);

      if (editable && onPolygonChange) {
        poly.getPath().addListener('set_at', () => updateFromPath(poly));
        poly.getPath().addListener('insert_at', () => updateFromPath(poly));
        poly.addListener('dragend', () => updateFromPath(poly));
      }
    }

    const bounds = new google.maps.LatLngBounds();
    path.forEach((pt: { lat: number; lng: number }) => bounds.extend(pt));
    bounds.extend({ lat: hostelLat, lng: hostelLng });
    map.fitBounds(bounds, 20);
  }, [map, editable, onPolygonChange]);

  if (!isLoaded) {
    return (
      <div className="w-full bg-gray-100 flex items-center justify-center rounded-md" style={{ height }}>
        <p className="text-gray-600">Loading map...</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div ref={mapRef} className="w-full rounded-md border border-gray-300 overflow-hidden" style={{ height }} />
      {editable && initialPolygon && initialPolygon.length >= 3 && (
        <p className="text-sm text-gray-600">
          Drag the corners or edges on the map to resize the boundary. You can get any quadrilateral shape.
        </p>
      )}
    </div>
  );
}
