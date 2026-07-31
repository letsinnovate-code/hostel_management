import React from 'react';
import { View, StyleSheet } from 'react-native';
import Skeleton from './Skeleton';

export default function DashboardSkeleton() {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Skeleton width={160} height={32} borderRadius={8} />
        <Skeleton width={200} height={18} borderRadius={6} style={{ marginTop: 8 }} />
      </View>

      {/* Status Card skeleton */}
      <View style={styles.card}>
        <View style={styles.statusRow}>
          <Skeleton width={88} height={88} borderRadius={44} />
          <View style={styles.statusInfo}>
            <Skeleton width={120} height={12} borderRadius={4} />
            <Skeleton width={140} height={24} borderRadius={6} style={{ marginTop: 8 }} />
            <Skeleton width={160} height={12} borderRadius={4} style={{ marginTop: 8 }} />
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.statsRow}>
          <Skeleton width="48%" height={64} borderRadius={12} />
          <Skeleton width="48%" height={64} borderRadius={12} />
        </View>
        <View style={styles.trackingRow}>
          <Skeleton width="70%" height={40} borderRadius={12} />
          <Skeleton width={100} height={40} borderRadius={12} />
        </View>
      </View>

      {/* Map placeholder */}
      <View style={styles.section}>
        <Skeleton width={180} height={14} borderRadius={4} style={{ marginBottom: 8 }} />
        <Skeleton width="100%" height={200} borderRadius={12} />
      </View>

      {/* Time in hostel card skeleton */}
      <View style={styles.section}>
        <View style={styles.timeInHostelCard}>
          <Skeleton width={52} height={52} borderRadius={26} />
          <View style={styles.timeInHostelText}>
            <Skeleton width={120} height={28} borderRadius={8} />
            <Skeleton width={100} height={14} borderRadius={6} style={{ marginTop: 8 }} />
          </View>
        </View>
      </View>

      {/* Overview skeleton */}
      <View style={styles.section}>
        <Skeleton width={100} height={18} borderRadius={4} style={{ marginBottom: 12 }} />
        <View style={styles.overviewCard}>
          <View style={styles.statsGrid}>
            {[1, 2, 3, 4].map((i) => (
              <View key={i} style={styles.overviewStatRow}>
                <Skeleton width={44} height={44} borderRadius={22} />
                <View style={styles.overviewStatText}>
                  <Skeleton width={90} height={12} borderRadius={4} />
                  <Skeleton width={48} height={22} borderRadius={6} style={{ marginTop: 6 }} />
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Recent Activity */}
      <View style={styles.section}>
        <Skeleton width={140} height={18} borderRadius={4} style={{ marginBottom: 12 }} />
        <Skeleton width="100%" height={100} borderRadius={12} />
        <Skeleton width="100%" height={100} borderRadius={12} style={{ marginTop: 12 }} />
      </View>

      {/* Quick Access */}
      <View style={styles.section}>
        <Skeleton width={120} height={18} borderRadius={4} style={{ marginBottom: 12 }} />
        <View style={styles.featureGrid}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} width="48%" height={72} borderRadius={12} />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginBottom: 20,
  },
  statusInfo: {
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  trackingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  section: {
    marginTop: 24,
  },
  timeInHostelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  timeInHostelText: {
    flex: 1,
    marginLeft: 16,
  },
  overviewCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  overviewStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '47%',
  },
  overviewStatText: {
    flex: 1,
    marginLeft: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
});
