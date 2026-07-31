import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import MapView, { Marker, Polygon, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';

export type HostelBoundaryData = {
  hostel: {
    id: string;
    name: string;
    latitude: number | null;
    longitude: number | null;
  };
  geoFence: {
    type: 'circle' | 'rectangle' | 'polygon';
    bounds: { north: number; south: number; east: number; west: number } | null;
    polygon: Array<{ latitude: number; longitude: number }> | null;
    center: { latitude: number; longitude: number } | null;
    radius: number | null;
  } | null;
};

interface DashboardMapProps {
  boundary: HostelBoundaryData | null;
  currentLocation?: { latitude: number; longitude: number } | null;
  height?: number;
  showLegend?: boolean;
}

// Zoomed-in view: max deltas so we never show whole city, only hostel + nearby
const MAX_DELTA = 0.003; // ~300m – keeps view on hostel and students, not city
const MIN_DELTA = 0.0004; // building-level minimum

function getRegionFromCoords(coords: { latitude: number; longitude: number }[], padding = 1.15) {
  if (!coords.length) return null;
  const lats = coords.map((c) => c.latitude);
  const lngs = coords.map((c) => c.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const spanLat = Math.min(Math.max((maxLat - minLat) * padding, MIN_DELTA), MAX_DELTA);
  const spanLng = Math.min(Math.max((maxLng - minLng) * padding, MIN_DELTA), MAX_DELTA);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: spanLat,
    longitudeDelta: spanLng,
  };
}

export default function DashboardMap({
  boundary,
  currentLocation,
  height = 200,
  showLegend = true,
}: DashboardMapProps) {
  const [userLoc, setUserLoc] = useState<{ latitude: number; longitude: number } | null>(currentLocation ?? null);

  useEffect(() => {
    if (currentLocation) setUserLoc(currentLocation);
  }, [currentLocation?.latitude, currentLocation?.longitude]);

  if (!boundary?.hostel || boundary.hostel.latitude == null || boundary.hostel.longitude == null) {
    return (
      <View style={[styles.placeholder, { height }]}>
        <Text style={styles.placeholderText}>Hostel boundary not set</Text>
      </View>
    );
  }

  const hostelLat = boundary.hostel.latitude;
  const hostelLng = boundary.hostel.longitude;
  const bounds = boundary.geoFence?.bounds;
  const polygonFromGeo = boundary.geoFence?.polygon;
  const polygonCoords =
    boundary.geoFence?.type === 'polygon' && polygonFromGeo && polygonFromGeo.length >= 3
      ? polygonFromGeo.map((p) => ({ latitude: p.latitude, longitude: p.longitude }))
      : bounds && boundary.geoFence?.type === 'rectangle'
        ? [
            { latitude: bounds.north, longitude: bounds.west },
            { latitude: bounds.north, longitude: bounds.east },
            { latitude: bounds.south, longitude: bounds.east },
            { latitude: bounds.south, longitude: bounds.west },
          ]
        : [];

  const allCoords = [...polygonCoords, { latitude: hostelLat, longitude: hostelLng }];
  if (userLoc) allCoords.push(userLoc);
  const region = polygonCoords.length >= 3
    ? getRegionFromCoords(allCoords)
    : { latitude: hostelLat, longitude: hostelLng, latitudeDelta: MAX_DELTA, longitudeDelta: MAX_DELTA };

  return (
    <View style={styles.wrapper}>
      {/* <Text style={styles.label}>Your location & hostel boundary</Text>
      <MapView
        style={[styles.map, { height }]}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={region || { latitude: hostelLat, longitude: hostelLng, latitudeDelta: MAX_DELTA, longitudeDelta: MAX_DELTA }}
        showsUserLocation={false}
        showsMyLocationButton={false}
        scrollEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
      >
        <Marker
          coordinate={{ latitude: hostelLat, longitude: hostelLng }}
          title={boundary.hostel.name}
          pinColor="#2563eb"
        />
        {userLoc && (
          <Marker
            coordinate={userLoc}
            title="You"
            pinColor="#22c55e"
          />
        )}
        {polygonCoords.length >= 3 && (
          <Polygon
            coordinates={polygonCoords}
            fillColor="rgba(14, 165, 233, 0.25)"
            strokeColor="#0284c7"
            strokeWidth={2}
          />
        )}
      </MapView>
      {showLegend && (
        <Text style={styles.hint}>
          Blue = boundary · {userLoc ? 'Green = you' : 'Allow location to see your position'}
        </Text>
      )} */}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 16,
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  map: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  placeholder: {
    width: '100%',
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 13,
    color: '#6b7280',
  },
  hint: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 6,
  },
});
