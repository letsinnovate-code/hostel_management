import React, { forwardRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';

export const PROVIDER_GOOGLE = 'google';
export const PROVIDER_DEFAULT = 'default';

export const Marker = ({ children }) => {
  if (children) return <View>{children}</View>;
  return null;
};

export const Polygon = () => null;
export const Polyline = () => null;
export const Circle = () => null;
export const Callout = ({ children }) => <View>{children}</View>;

export const MapView = forwardRef(({
  style,
  initialRegion,
  region,
  children,
  ...props
}, ref) => {
  useImperativeHandle(ref, () => ({
    animateToRegion: () => {},
    fitToCoordinates: () => {},
    animateCamera: () => {},
  }));

  const currentRegion = region || initialRegion || { latitude: 28.6139, longitude: 77.209 };
  const lat = Number(currentRegion?.latitude) || 28.6139;
  const lng = Number(currentRegion?.longitude) || 77.209;

  const osmUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01}%2C${lat - 0.01}%2C${lng + 0.01}%2C${lat + 0.01}&layer=mapnik&marker=${lat}%2C${lng}`;

  const openInGoogleMaps = () => {
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
  };

  return (
    <View style={[styles.container, style]}>
      {Platform.OS === 'web' && typeof document !== 'undefined' ? (
        <iframe
          title="Map"
          src={osmUrl}
          style={{ width: '100%', height: '100%', border: 0, borderRadius: 12 }}
        />
      ) : (
        <View style={styles.fallback}>
          <Text style={styles.text}>Map ({lat.toFixed(4)}, {lng.toFixed(4)})</Text>
        </View>
      )}
      <TouchableOpacity style={styles.openBtn} onPress={openInGoogleMaps} activeOpacity={0.8}>
        <Text style={styles.openBtnText}>Open in Google Maps ↗</Text>
      </TouchableOpacity>
      <View style={styles.hidden}>{children}</View>
    </View>
  );
});

MapView.displayName = 'MapView';

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#e5e7eb',
    borderRadius: 12,
    minHeight: 220,
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#6b7280',
    fontSize: 14,
  },
  openBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: '#0a7ea4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
  },
  openBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  hidden: {
    display: 'none',
  },
});

export default MapView;
