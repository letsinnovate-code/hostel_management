import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

export default function WardenDashboard() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const response = await api.getDashboard(user?.hostelId);
      setDashboard(response.data);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadDashboard} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Warden Dashboard</Text>
      </View>

      {dashboard && (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Summary</Text>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{dashboard.summary?.totalStudents || 0}</Text>
                <Text style={styles.statLabel}>Total Students</Text>
              </View>
              <View style={styles.stat}>
                <Text style={[styles.statValue, styles.statInside]}>
                  {dashboard.summary?.inside || 0}
                </Text>
                <Text style={styles.statLabel}>Inside</Text>
              </View>
              <View style={styles.stat}>
                <Text style={[styles.statValue, styles.statOutside]}>
                  {dashboard.summary?.outside || 0}
                </Text>
                <Text style={styles.statLabel}>Outside</Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Pending Permissions</Text>
            <Text style={styles.count}>{dashboard.pendingPermissions || 0}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Active Violations</Text>
            <Text style={styles.count}>{dashboard.activeViolations || 0}</Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#11181C',
  },
  card: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    color: '#11181C',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#11181C',
  },
  statInside: {
    color: '#4CAF50',
  },
  statOutside: {
    color: '#FF9800',
  },
  statLabel: {
    fontSize: 12,
    color: '#687076',
    marginTop: 5,
  },
  count: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#0a7ea4',
    textAlign: 'center',
  },
});

