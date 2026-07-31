'use client';

import { useEffect, useRef, useState } from 'react';

interface GoogleMapProps {
  latitude?: number;
  longitude?: number;
  onLocationChange?: (lat: number, lng: number) => void;
  height?: string;
  zoom?: number;
}

declare global {
  interface Window {
    google: any;
  }
}

export default function GoogleMap({ 
  latitude, 
  longitude, 
  onLocationChange,
  height = '400px',
  zoom = 15
}: GoogleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [marker, setMarker] = useState<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Load Google Maps script
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

    // Initialize map
    if (!map) {
      const initialLat = latitude || 28.6139; // Default to Delhi
      const initialLng = longitude || 77.2090;
      
      const google = (window as any).google;
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
  }, [isLoaded, latitude, longitude, zoom, onLocationChange]);

  useEffect(() => {
    if (!map || !(window as any).google) return;

    // Update map center and marker when coordinates change
    if (latitude && longitude) {
      const position = { lat: latitude, lng: longitude };
      
      // Update map center
      map.setCenter(position);
      
      // Update or create marker
      if (marker) {
        marker.setPosition(position);
      } else {
        const google = (window as any).google;
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

        setMarker(newMarker);
      }
    }
  }, [map, latitude, longitude, onLocationChange]);

  if (!isLoaded) {
    return (
      <div 
        className="w-full bg-gray-100 flex items-center justify-center rounded-md"
        style={{ height }}
      >
        <p className="text-gray-600">Loading map...</p>
      </div>
    );
  }

  return (
    <div 
      ref={mapRef} 
      className="w-full rounded-md border border-gray-300"
      style={{ height }}
    />
  );
}

