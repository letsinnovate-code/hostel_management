'use client';

import { useEffect, useRef, useState } from 'react';
import { useGoogleMapsScript } from '../hooks/useGoogleMapsScript';
import {
  Bounds,
  LatLng,
  getDefaultBoundsAroundHostel,
  getDefaultPolygonAroundHostel,
} from './maps/mapTypes';

// Re-export types and helpers for full backward compatibility
export type { Bounds, LatLng };
export { getDefaultBoundsAroundHostel, getDefaultPolygonAroundHostel };

export interface GeoFenceMapProps {
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
  const markerRef = useRef<any>(null);
  const rectangleRef = useRef<any>(null);
  const polygonRef = useRef<any>(null);
  const { isLoaded, loadError } = useGoogleMapsScript('places,geometry');

  useEffect(() => {
    if (!isLoaded || !mapRef.current || !window.google) return;

    if (!map) {
      const google = window.google;
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
      markerRef.current = newMarker;
    }
  }, [isLoaded, hostelLat, hostelLng, zoom, map]);

  // Rectangle display (when polygon not used)
  useEffect(() => {
    if (!map || !window.google) return;
    const google = window.google;

    if (initialPolygon && initialPolygon.length >= 3) {
      if (rectangleRef.current) {
        rectangleRef.current.setMap(null);
        rectangleRef.current = null;
      }
      return;
    }

    if (!initialBounds) {
      if (rectangleRef.current) {
        rectangleRef.current.setMap(null);
        rectangleRef.current = null;
      }
      return;
    }

    const rectBounds = new google.maps.LatLngBounds(
      { lat: initialBounds.south, lng: initialBounds.west },
      { lat: initialBounds.north, lng: initialBounds.east }
    );

    if (rectangleRef.current) {
      rectangleRef.current.setBounds(rectBounds);
      rectangleRef.current.setMap(map);
    } else {
      const rect = new google.maps.Rectangle({
        bounds: rectBounds,
        map,
        fillColor: '#0a7ea4',
        fillOpacity: 0.25,
        strokeColor: '#0a7ea4',
        strokeWeight: 2,
      });
      rectangleRef.current = rect;
    }

    const boundsToFit = rectBounds.extend({ lat: hostelLat, lng: hostelLng });
    map.fitBounds(boundsToFit, 20);
  }, [map, initialBounds, initialPolygon, hostelLat, hostelLng]);

  // Polygon display (editable quadrilateral)
  useEffect(() => {
    if (!map || !window.google) return;
    const google = window.google;

    if (!initialPolygon || initialPolygon.length < 3) {
      if (polygonRef.current) {
        polygonRef.current.setMap(null);
        polygonRef.current = null;
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

    if (polygonRef.current) {
      polygonRef.current.setPath(path);
      polygonRef.current.setMap(map);
      if (editable) {
        polygonRef.current.setEditable(true);
        polygonRef.current.setDraggable(true);
      } else {
        polygonRef.current.setEditable(false);
        polygonRef.current.setDraggable(false);
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
      polygonRef.current = poly;

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
  }, [map, initialPolygon, editable, onPolygonChange, hostelLat, hostelLng]);

  if (loadError) {
    return (
      <div
        className="w-full flex items-center justify-center bg-gray-100 rounded-md border border-gray-300 text-gray-500"
        style={{ height }}
      >
        <p className="text-sm">Unable to load Geo-Fence map</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div
        className="w-full bg-gray-100 flex items-center justify-center rounded-md border border-gray-200"
        style={{ height }}
      >
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-2"></div>
          <p className="text-sm text-gray-500">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div
        ref={mapRef}
        className="w-full rounded-md border border-gray-300 overflow-hidden"
        style={{ height }}
      />
      {editable && initialPolygon && initialPolygon.length >= 3 && (
        <p className="text-sm text-gray-600">
          Drag the corners or edges on the map to resize the boundary. You can get any quadrilateral shape.
        </p>
      )}
    </div>
  );
}
