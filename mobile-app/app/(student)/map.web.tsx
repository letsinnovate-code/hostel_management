import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function StudentMapScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.placeholder}>
        <Text style={styles.icon}>🗺️</Text>
        <Text style={styles.title}>Map View</Text>
        <Text style={styles.subtitle}>
          The interactive map is available on mobile devices only.
        </Text>
        <Text style={styles.hint}>
          Please use the iOS or Android app to view your location and hostel boundary.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  placeholder: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  hint: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
  },
});
