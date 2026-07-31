import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

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

export default function DashboardMap({
  boundary,
  height = 200,
}: DashboardMapProps) {
  const hostelName = boundary?.hostel?.name || 'Hostel';

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>Your location & hostel boundary</Text>
      <View style={[styles.placeholder, { height }]}>
        <Text style={styles.placeholderText}>
          {boundary?.hostel ? `${hostelName} - Map available on mobile` : 'Hostel boundary not set'}
        </Text>
      </View>
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
  placeholder: {
    width: '100%',
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  placeholderText: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
  },
});
