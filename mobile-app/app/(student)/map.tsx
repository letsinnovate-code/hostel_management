import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Polygon } from 'react-native-maps';
import * as Location from 'expo-location';
import api from '../../services/api';
import { MapErrorBoundary } from '../../components/MapErrorBoundary';

type HostelBoundary = {
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

const DEFAULT_REGION = {
  latitude: 28.6139,
  longitude: 77.209,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

function safeNum(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// Defer map mount to avoid native crash when MapView is created too early (common on APK)
const MAP_MOUNT_DELAY_MS = 300;

export default function StudentMapScreen() {
  const navigation = useNavigation();
  const [boundary, setBoundary] = useState<HostelBoundary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapMountAllowed, setMapMountAllowed] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await api.getHostelBoundary();
        if (mounted) {
          setBoundary(data ?? null);
          setError(null);
        }
      } catch (e: any) {
        if (mounted) {
          setError(e?.message || 'Failed to load hostel boundary');
          setBoundary(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => {});
        }
      } catch (_) {}
    })();
    return () => { mounted = false; };
  }, []);

  // Defer MapView mount so native map isn't created during initial render (reduces APK crashes)
  useEffect(() => {
    if (loading || error) return;
    const t = setTimeout(() => setMapMountAllowed(true), MAP_MOUNT_DELAY_MS);
    return () => clearTimeout(t);
  }, [loading, error]);

  const refetchBoundary = useCallback(() => {
    setError(null);
    setLoading(true);
    api.getHostelBoundary()
      .then((data) => {
        setBoundary(data ?? null);
        setError(null);
      })
      .catch((e: any) => setError(e?.message || 'Failed to load hostel boundary'))
      .finally(() => setLoading(false));
  }, []);

  const handleMapReady = useCallback(() => {
    // Native map ready; optional: could set state for padding etc. if needed later
  }, []);

  const handleRetry = useCallback(() => {
    setMapMountAllowed(false);
    setError(null);
    setLoading(true);
    api.getHostelBoundary()
      .then((data) => {
        setBoundary(data ?? null);
        setError(null);
      })
      .catch((e: any) => {
        setError(e?.message || 'Failed to load hostel boundary');
        setBoundary(null);
      })
      .finally(() => {
        setLoading(false);
        setTimeout(() => setMapMountAllowed(true), MAP_MOUNT_DELAY_MS);
      });
  }, []);

  const hostelLat = safeNum(boundary?.hostel?.latitude, DEFAULT_REGION.latitude);
  const hostelLng = safeNum(boundary?.hostel?.longitude, DEFAULT_REGION.longitude);
  const hasHostelLocation = boundary?.hostel != null && Number.isFinite(Number(boundary?.hostel?.latitude)) && Number.isFinite(Number(boundary?.hostel?.longitude));

  const openDirections = useCallback(() => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${hostelLat},${hostelLng}`;
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open maps app.'));
  }, [hostelLat, hostelLng]);

  const useMapPlaceholder = Platform.OS === 'android' && typeof __DEV__ !== 'undefined' && !__DEV__;

  useEffect(() => {
    if (!hasHostelLocation || useMapPlaceholder) return;
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={openDirections} style={styles.headerButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="navigate" size={22} color="#0a7ea4" />
        </TouchableOpacity>
      ),
    });
    return () => {
      navigation.setOptions({ headerRight: undefined });
    };
  }, [hasHostelLocation, useMapPlaceholder, openDirections, navigation]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0a7ea4" />
        <Text style={styles.loadingText}>Loading map...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={refetchBoundary} activeOpacity={0.8}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const initialRegion = {
    latitude: hostelLat,
    longitude: hostelLng,
    latitudeDelta: 0.002,
    longitudeDelta: 0.002,
  };

  const bounds = boundary?.geoFence?.bounds;
  const polygonFromGeo = boundary?.geoFence?.polygon;
  const polygonCoords =
    boundary?.geoFence?.type === 'polygon' && polygonFromGeo && polygonFromGeo.length >= 3
      ? polygonFromGeo
          .map((p) => ({ latitude: safeNum(p.latitude, hostelLat), longitude: safeNum(p.longitude, hostelLng) }))
          .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
      : bounds && boundary?.geoFence?.type === 'rectangle'
        ? [
            { latitude: safeNum(bounds.north, hostelLat), longitude: safeNum(bounds.west, hostelLng) },
            { latitude: safeNum(bounds.north, hostelLat), longitude: safeNum(bounds.east, hostelLng) },
            { latitude: safeNum(bounds.south, hostelLat), longitude: safeNum(bounds.east, hostelLng) },
            { latitude: safeNum(bounds.south, hostelLat), longitude: safeNum(bounds.west, hostelLng) },
          ]
        : [];

  if (!mapMountAllowed) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0a7ea4" />
        <Text style={styles.loadingText}>Preparing map...</Text>
      </View>
    );
  }

  const markerCoord = { latitude: hostelLat, longitude: hostelLng };
  const polygonSafe = polygonCoords.length >= 3
    ? polygonCoords.filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
    : [];

  if (useMapPlaceholder) {
    return (
      <View style={styles.container}>
        <View style={styles.placeholderCard}>
          <Ionicons name="map-outline" size={48} color="#0a7ea4" />
          <Text style={styles.placeholderTitle}>{boundary?.hostel?.name ?? 'Hostel'}</Text>
          <Text style={styles.placeholderHint}>
            Blue area = hostel boundary. Open in Google Maps for directions and your location.
          </Text>
          {hasHostelLocation && (
            <TouchableOpacity style={styles.directionsButton} activeOpacity={0.8} onPress={openDirections}>
              <Ionicons name="navigate" size={20} color="#fff" />
              <Text style={styles.directionsButtonText}>Open in Google Maps</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <MapErrorBoundary onRetry={handleRetry}>
      <View style={styles.container}>
        <MapView
          style={styles.map}
          initialRegion={initialRegion}
          showsUserLocation
          showsMyLocationButton
          cacheEnabled
          scrollEnabled
          zoomEnabled
          rotateEnabled={false}
          pitchEnabled={false}
          onMapReady={handleMapReady}
        >
          {hasHostelLocation && Number.isFinite(markerCoord.latitude) && Number.isFinite(markerCoord.longitude) && (
            <Marker
              coordinate={markerCoord}
              title={boundary?.hostel?.name ?? 'Hostel'}
              pinColor="#0a7ea4"
            />
          )}
          {polygonSafe.length >= 3 && (
            <Polygon
              coordinates={polygonSafe}
              fillColor="rgba(10, 126, 164, 0.2)"
              strokeColor="#0a7ea4"
              strokeWidth={2}
            />
          )}
        </MapView>
        <View style={styles.legend} pointerEvents="none">
          <Text style={styles.legendTitle}>Legend</Text>
          <Text style={styles.legendItem}>• Blue dot = Your location</Text>
          <Text style={styles.legendItem}>• Blue pin = Hostel</Text>
          <Text style={styles.legendItem}>• Blue area = Hostel boundary</Text>
          <Text style={styles.legendHint}>Tap compass in header for directions</Text>
        </View>
      </View>
    </MapErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  headerButton: {
    padding: 8,
    marginRight: 8,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#687076',
  },
  errorText: {
    fontSize: 16,
    color: '#c53030',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#0a7ea4',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  legend: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255,255,255,0.92)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    color: '#11181C',
  },
  legendItem: {
    fontSize: 12,
    color: '#687076',
    marginBottom: 2,
  },
  legendHint: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
  },
  directionsButton: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a7ea4',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  directionsButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  placeholderCard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f8fafc',
  },
  placeholderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 12,
  },
  placeholderHint: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});
