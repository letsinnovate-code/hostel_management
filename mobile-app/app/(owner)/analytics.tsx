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
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';

export default function AnalyticsScreen() {
  const [kpis, setKpis] = useState<any>(null);
  const [occupancy, setOccupancy] = useState<any>(null);
  const [financial, setFinancial] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'kpis' | 'occupancy' | 'financial'>('kpis');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [kpisRes, occupancyRes, financialRes] = await Promise.all([
        api.getDashboardKPIs().catch(() => null),
        api.getOccupancyReport().catch(() => null),
        api.getFinancialReport().catch(() => null),
      ]);
      if (kpisRes?.data) setKpis(kpisRes.data);
      if (occupancyRes?.data) setOccupancy(occupancyRes.data);
      if (financialRes?.data) setFinancial(financialRes.data);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'kpis' && styles.activeTab]}
          onPress={() => setActiveTab('kpis')}
        >
          <Text style={[styles.tabText, activeTab === 'kpis' && styles.activeTabText]}>
            KPIs
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'occupancy' && styles.activeTab]}
          onPress={() => setActiveTab('occupancy')}
        >
          <Text style={[styles.tabText, activeTab === 'occupancy' && styles.activeTabText]}>
            Occupancy
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'financial' && styles.activeTab]}
          onPress={() => setActiveTab('financial')}
        >
          <Text style={[styles.tabText, activeTab === 'financial' && styles.activeTabText]}>
            Financial
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} />}
      >
        {activeTab === 'kpis' && kpis && (
          <View style={styles.content}>
            <View style={styles.kpiGrid}>
              <View style={styles.kpiCard}>
                <Ionicons name="people" size={32} color="#0a7ea4" />
                <Text style={styles.kpiValue}>{kpis.totalStudents || 0}</Text>
                <Text style={styles.kpiLabel}>Total Students</Text>
              </View>
              <View style={styles.kpiCard}>
                <Ionicons name="home" size={32} color="#4CAF50" />
                <Text style={styles.kpiValue}>{kpis.occupiedRooms || 0}</Text>
                <Text style={styles.kpiLabel}>Occupied Rooms</Text>
              </View>
              <View style={styles.kpiCard}>
                <Ionicons name="cash" size={32} color="#FF9800" />
                <Text style={styles.kpiValue}>₹{kpis.totalRevenue?.toLocaleString() || 0}</Text>
                <Text style={styles.kpiLabel}>Total Revenue</Text>
              </View>
              <View style={styles.kpiCard}>
                <Ionicons name="warning" size={32} color="#f44336" />
                <Text style={styles.kpiValue}>{kpis.totalViolations || 0}</Text>
                <Text style={styles.kpiLabel}>Violations</Text>
              </View>
            </View>
          </View>
        )}

        {activeTab === 'occupancy' && occupancy && (
          <View style={styles.content}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Occupancy Overview</Text>
              <View style={styles.statRow}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{occupancy.totalRooms || 0}</Text>
                  <Text style={styles.statLabel}>Total Rooms</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={[styles.statValue, styles.occupied]}>
                    {occupancy.occupiedRooms || 0}
                  </Text>
                  <Text style={styles.statLabel}>Occupied</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={[styles.statValue, styles.available]}>
                    {occupancy.availableRooms || 0}
                  </Text>
                  <Text style={styles.statLabel}>Available</Text>
                </View>
              </View>
              <Text style={styles.occupancyRate}>
                Occupancy Rate: {occupancy.occupancyRate || 0}%
              </Text>
            </View>
          </View>
        )}

        {activeTab === 'financial' && financial && (
          <View style={styles.content}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Financial Summary</Text>
              <View style={styles.financialRow}>
                <View style={styles.financialItem}>
                  <Text style={styles.financialLabel}>Total Revenue</Text>
                  <Text style={[styles.financialValue, styles.revenue]}>
                    ₹{financial.totalRevenue?.toLocaleString() || 0}
                  </Text>
                </View>
                <View style={styles.financialItem}>
                  <Text style={styles.financialLabel}>Pending Amount</Text>
                  <Text style={[styles.financialValue, styles.pending]}>
                    ₹{financial.pendingAmount?.toLocaleString() || 0}
                  </Text>
                </View>
              </View>
            </View>
          </View>
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 10,
    gap: 10,
  },
  tab: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#0a7ea4',
  },
  tabText: {
    fontSize: 14,
    color: '#687076',
    fontWeight: '600',
  },
  activeTabText: {
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 15,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
  },
  kpiCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  kpiValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#11181C',
    marginTop: 10,
  },
  kpiLabel: {
    fontSize: 12,
    color: '#687076',
    marginTop: 5,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#fff',
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
    marginBottom: 20,
    color: '#11181C',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#11181C',
  },
  occupied: {
    color: '#FF9800',
  },
  available: {
    color: '#4CAF50',
  },
  statLabel: {
    fontSize: 12,
    color: '#687076',
    marginTop: 5,
  },
  occupancyRate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0a7ea4',
    textAlign: 'center',
    marginTop: 10,
  },
  financialRow: {
    gap: 15,
  },
  financialItem: {
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  financialLabel: {
    fontSize: 14,
    color: '#687076',
    marginBottom: 5,
  },
  financialValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  revenue: {
    color: '#4CAF50',
  },
  pending: {
    color: '#FF9800',
  },
});

