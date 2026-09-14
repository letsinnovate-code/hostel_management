'use client';

import { useEffect, useRef, useState } from 'react';
import { useGoogleMapsScript } from '../hooks/useGoogleMapsScript';

export interface GoogleMapProps {
  latitude?: number;
  longitude?: number;
  onLocationChange?: (lat: number, lng: number) => void;
  height?: string;
  zoom?: number;
}

export default function GoogleMap({
  latitude,
  longitude,
  onLocationChange,
  height = '400px',
  zoom = 15,
}: GoogleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const markerRef = useRef<any>(null);
  const { isLoaded, loadError } = useGoogleMapsScript('places');

  useEffect(() => {
    if (!isLoaded || !mapRef.current || !window.google) return;

    // Initialize map
    if (!map) {
      const initialLat = latitude || 28.6139; // Default to Delhi
      const initialLng = longitude || 77.209;

      const google = window.google;
      const newMap = new google.maps.Map(mapRef.current, {
        center: { lat: initialLat, lng: initialLng },
        zoom: zoom,
        mapTypeControl: true,
        streetViewControl: true,
        fullscreenControl: true,
      });

      setMap(newMap);

      // Add click listener if onLocationChange is provided
      if (onLocationChange) {
        newMap.addListener('click', (e: any) => {
          if (e.latLng) {
            const lat = e.latLng.lat();
            const lng = e.latLng.lng();
            onLocationChange(lat, lng);
          }
        });
      }
    }
  }, [isLoaded, latitude, longitude, zoom, onLocationChange, map]);

  useEffect(() => {
    if (!map || !window.google) return;

    // Update map center and marker when coordinates change
    if (latitude && longitude) {
      const position = { lat: latitude, lng: longitude };

      // Update map center
      map.setCenter(position);

      // Update or create marker
      if (markerRef.current) {
        markerRef.current.setPosition(position);
      } else {
        const google = window.google;
        const newMarker = new google.maps.Marker({
          position: position,
          map: map,
          draggable: !!onLocationChange,
          title: 'Hostel Location',
        });

        if (onLocationChange) {
          newMarker.addListener('dragend', (e: any) => {
            if (e.latLng) {
              const lat = e.latLng.lat();
              const lng = e.latLng.lng();
              onLocationChange(lat, lng);
            }
          });
        }

        markerRef.current = newMarker;
      }
    }
  }, [latitude, longitude, map, onLocationChange]);

  if (loadError) {
    return (
      <div
        className="w-full flex items-center justify-center bg-gray-100 rounded-lg border border-gray-300 text-gray-500"
        style={{ height }}
      >
        <p className="text-sm">Unable to load Google Maps</p>
      </div>
    );
  }

  return (
    <div className="w-full relative" style={{ height }}>
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg border border-gray-300">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-2"></div>
            <p className="text-sm text-gray-500">Loading map...</p>
          </div>
        </div>
      )}
      <div ref={mapRef} className="w-full h-full rounded-lg" />
    </div>
  );
}
