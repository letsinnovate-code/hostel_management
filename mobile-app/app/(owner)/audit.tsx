import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';

export default function AuditScreen() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const response = await api.getAuditLogs();
      setLogs(response.data || []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadLogs} />}
      >
        {logs.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No audit logs found</Text>
          </View>
        ) : (
          logs.map((log) => (
            <View key={log._id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.action}>{log.action}</Text>
                <Text style={styles.timestamp}>
                  {new Date(log.timestamp).toLocaleString()}
                </Text>
              </View>
              {log.performedBy && (
                <Text style={styles.user}>
                  By: {log.performedBy.name} ({log.performedBy.role})
                </Text>
              )}
              {log.entityType && (
                <Text style={styles.entity}>
                  Entity: {log.entityType}
                </Text>
              )}
              {log.details && (
                <Text style={styles.details}>
                  {JSON.stringify(log.details, null, 2)}
                </Text>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  card: {
    backgroundColor: '#fff',
    margin: 15,
    marginTop: 0,
    padding: 15,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  action: {
    fontSize: 16,
    fontWeight: '600',
    color: '#11181C',
    flex: 1,
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
  },
  user: {
    fontSize: 14,
    color: '#687076',
    marginTop: 4,
  },
  entity: {
    fontSize: 14,
    color: '#0a7ea4',
    marginTop: 4,
  },
  details: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    fontFamily: 'monospace',
  },
});

