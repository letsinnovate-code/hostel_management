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
import api from '../../services/api';

export default function ViolationsScreen() {
  const [violations, setViolations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadViolations();
  }, []);

  const loadViolations = async () => {
    setLoading(true);
    try {
      const response = await api.getViolations();
      setViolations(response.data || []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load violations');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadViolations} />}
    >
      {violations.map((violation) => (
        <View key={violation._id} style={styles.card}>
          <Text style={styles.studentName}>
            {violation.studentId?.name || 'Unknown Student'}
          </Text>
          <Text style={styles.type}>{violation.violationType.toUpperCase()}</Text>
          <Text style={styles.description}>{violation.description}</Text>
          <View style={styles.footer}>
            <Text style={styles.date}>
              {new Date(violation.createdAt).toLocaleDateString()}
            </Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: violation.status === 'resolved' ? '#4CAF50' : '#FF9800' },
              ]}
            >
              <Text style={styles.statusText}>{violation.status.toUpperCase()}</Text>
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  card: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 15,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  studentName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#11181C',
  },
  type: {
    fontSize: 12,
    color: '#f44336',
    marginBottom: 8,
    fontWeight: '500',
  },
  description: {
    fontSize: 14,
    color: '#687076',
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: {
    fontSize: 12,
    color: '#999',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
});

