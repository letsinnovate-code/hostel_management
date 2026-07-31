import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  children: ReactNode;
  /** Optional fallback when map crashes (e.g. open external maps link) */
  onRetry?: () => void;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches JS errors in map screen so the app doesn't crash.
 * Native map crashes may still occur; this helps with render/state errors.
 */
export class MapErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('[MapErrorBoundary]', error?.message, errorInfo?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Ionicons name="map-outline" size={48} color="#94a3b8" />
          <Text style={styles.title}>Map couldn't load</Text>
          <Text style={styles.message}>
            {this.props.fallbackMessage ?? "The map view had a problem. You can still get directions below."}
          </Text>
          {this.props.onRetry && (
            <TouchableOpacity style={styles.button} onPress={this.props.onRetry} activeOpacity={0.8}>
              <Text style={styles.buttonText}>Try again</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f8fafc',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 12,
  },
  message: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  button: {
    marginTop: 20,
    backgroundColor: '#6366f1',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});
