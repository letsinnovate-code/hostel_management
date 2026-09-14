'use client';

import { useRef, useEffect, useCallback } from 'react';

export interface MarkerData {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  color?: string;
  strokeColor?: string;
  contentHtml?: string;
}

/**
 * Hook for differential Google Maps marker management.
 * Updates marker coordinates and properties in-place without tearing down/rebuilding markers,
 * preventing screen flicker and DOM churn during rapid socket location broadcasts.
 */
export function useMarkerManager(mapInstance: any) {
  const markersMapRef = useRef<
    Map<
      string,
      {
        marker: any;
        infoWindow: any;
        lat: number;
        lng: number;
        color?: string;
      }
    >
  >(new Map());

  const syncMarkers = useCallback(
    (items: MarkerData[], options: { fitBounds?: boolean; padding?: number } = {}) => {
      if (!mapInstance || !window.google) return;
      const google = window.google;

      const incomingIds = new Set<string>();
      const bounds = options.fitBounds ? new google.maps.LatLngBounds() : null;

      items.forEach((item) => {
        incomingIds.add(item.id);
        const pos = { lat: item.latitude, lng: item.longitude };
        if (bounds) bounds.extend(pos);

        const existing = markersMapRef.current.get(item.id);
        if (existing) {
          // 1. In-place position update without recreating marker
          if (existing.lat !== item.latitude || existing.lng !== item.longitude) {
            existing.marker.setPosition(pos);
            existing.lat = item.latitude;
            existing.lng = item.longitude;
          }
          // 2. In-place icon update if color changed
          if (item.color && existing.color !== item.color) {
            existing.marker.setIcon({
              path: google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: item.color,
              fillOpacity: 1,
              strokeColor: item.strokeColor || '#ffffff',
              strokeWeight: 2,
            });
            existing.color = item.color;
          }
          // 3. Update info window content without closing it
          if (item.contentHtml) {
            existing.infoWindow.setContent(item.contentHtml);
          }
        } else {
          // 4. Create new marker instance only for first appearance
          const marker = new google.maps.Marker({
            position: pos,
            map: mapInstance,
            title: item.title,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: item.color || '#2563eb',
              fillOpacity: 1,
              strokeColor: item.strokeColor || '#ffffff',
              strokeWeight: 2,
            },
          });

          const infoWindow = new google.maps.InfoWindow({
            content: item.contentHtml || item.title,
          });

          marker.addListener('click', () => {
            // Close other info windows
            markersMapRef.current.forEach((entry) => entry.infoWindow.close());
            infoWindow.open(mapInstance, marker);
          });

          markersMapRef.current.set(item.id, {
            marker,
            infoWindow,
            lat: item.latitude,
            lng: item.longitude,
            color: item.color,
          });
        }
      });

      // 5. Remove markers for entities no longer present
      markersMapRef.current.forEach((entry, id) => {
        if (!incomingIds.has(id)) {
          entry.infoWindow.close();
          entry.marker.setMap(null);
          markersMapRef.current.delete(id);
        }
      });

      if (options.fitBounds && bounds && items.length > 0) {
        mapInstance.fitBounds(bounds, options.padding || 60);
      }
    },
    [mapInstance]
  );

  const clearMarkers = useCallback(() => {
    markersMapRef.current.forEach((entry) => {
      entry.infoWindow.close();
      entry.marker.setMap(null);
    });
    markersMapRef.current.clear();
  }, []);

  useEffect(() => {
    return () => {
      clearMarkers();
    };
  }, [clearMarkers]);

  return {
    syncMarkers,
    clearMarkers,
  };
}
