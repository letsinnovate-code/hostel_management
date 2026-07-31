import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

function formatViolationType(type: string) {
  const labels: Record<string, string> = {
    'improper-checkout': 'Left without checking out',
    curfew: 'Curfew breach',
    'late-entry': 'Late entry',
    'unauthorized-visitor': 'Unauthorized visitor',
    noise: 'Noise',
    damage: 'Damage',
    other: 'Other',
  };
  return labels[type] || type?.replace(/-/g, ' ') || 'Violation';
}

function formatViolationDate(date: string | Date) {
  if (!date) return '—';
  const d = new Date(date);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStudentId(v: any): string | null {
  if (!v?.studentId) return null;
  return typeof v.studentId === 'object' ? v.studentId._id : v.studentId;
}

function getStudentName(v: any): string {
  if (!v?.studentId) return 'Unknown';
  return typeof v.studentId === 'object' ? v.studentId.name : 'Student';
}

function dedupeViolations(violations: any[]): any[] {
  const seen = new Set<string>();
  return violations.filter((v) => {
    const studentId = getStudentId(v) ?? '';
    const type = v?.violationType ?? '';
    const createdAt = v?.createdAt ? new Date(v.createdAt).getTime() : 0;
    const key = `${studentId}|${type}|${Math.floor(createdAt / 60000)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const QUICK_ACTIONS = [
  { label: 'Check Attendance', screen: '/(owner)/attendance', icon: 'calendar-outline' as const, color: '#14b8a6' },
  { label: 'Manage Hostels', screen: '/(owner)/hostels', icon: 'business-outline' as const, color: '#0ea5e9' },
  { label: 'Rooms', screen: '/(owner)/rooms', icon: 'bed-outline' as const, color: '#22c55e' },
  { label: 'Students', screen: '/(owner)/students', icon: 'people-outline' as const, color: '#6366f1' },
  { label: 'Payments', screen: '/(owner)/payments', icon: 'wallet-outline' as const, color: '#10b981' },
  { label: 'Notice Board', screen: '/(owner)/broadcast', icon: 'megaphone-outline' as const, color: '#8b5cf6' },
  { label: 'Analytics', screen: '/(owner)/analytics', icon: 'bar-chart-outline' as const, color: '#f97316' },
];

export default function OwnerDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [kpis, setKpis] = useState<any>(null);
  const [occupancy, setOccupancy] = useState<any>(null);
  const [recentViolations, setRecentViolations] = useState<any[]>([]);
  const [messFeedback, setMessFeedback] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboardData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [kpisRes, occupancyRes, financialRes, violationsRes] = await Promise.all([
        api.getDashboardKPIs().catch(() => ({ data: null })),
        api.getOccupancyReport().catch(() => ({ data: null })),
        api.getFinancialReport().catch(() => ({ data: null })),
        api.getRecentViolations(undefined, 50).catch(() => []),
      ]);
      const kpisData = kpisRes?.data ?? kpisRes ?? null;
      setKpis(kpisData);
      setOccupancy(occupancyRes?.data ?? occupancyRes ?? null);
      const rawViolations = Array.isArray(violationsRes) ? violationsRes : (violationsRes as any)?.data ?? [];
      setRecentViolations(dedupeViolations(rawViolations));
      const feedbackRes = await api.getMessFeedback(undefined, 10).catch(() => []);
      setMessFeedback(Array.isArray(feedbackRes) ? feedbackRes : (feedbackRes as any)?.data ?? []);
    } catch (error: any) {
      console.error('Failed to load dashboard:', error);
      if (!silent) Alert.alert('Error', error?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData(true);
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#0a7ea4" />
        <Text style={styles.loadingText}>Loading dashboard…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.subtitle}>Welcome back, {user?.name || 'Owner'}</Text>
      </View>

      {/* Key metrics */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Key metrics</Text>
        <View style={styles.kpiGrid}>
          <View style={[styles.kpiCard, styles.kpiBlue]}>
            <Ionicons name="people-outline" size={20} color="#1d4ed8" />
            <Text style={styles.kpiValue}>{kpis?.totalStudents ?? 0}</Text>
            <Text style={styles.kpiLabel}>Students</Text>
          </View>
          <View style={[styles.kpiCard, styles.kpiGreen]}>
            <Ionicons name="bed-outline" size={20} color="#15803d" />
            <Text style={styles.kpiValue}>
              {kpis?.totalOccupied ?? kpis?.occupiedRooms ?? 0}
              {kpis?.totalCapacity != null ? `/${kpis.totalCapacity}` : ''}
            </Text>
            <Text style={styles.kpiLabel}>Occupancy</Text>
          </View>
          <View style={[styles.kpiCard, styles.kpiPurple]}>
            <Ionicons name="wallet-outline" size={20} color="#6d28d9" />
            <Text style={styles.kpiValue}>₹{(kpis?.totalRevenue ?? 0).toLocaleString()}</Text>
            <Text style={styles.kpiLabel}>Revenue</Text>
          </View>
          <View style={[styles.kpiCard, styles.kpiAmber]}>
            <Ionicons name="warning-outline" size={20} color="#b45309" />
            <Text style={styles.kpiValue}>{kpis?.totalViolations ?? 0}</Text>
            <Text style={styles.kpiLabel}>Violations</Text>
          </View>
        </View>
      </View>

      {/* Occupancy overview */}
      {(occupancy || kpis) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Occupancy</Text>
          <View style={styles.occupancyRow}>
            <View style={styles.occItem}>
              <Text style={styles.occValue}>{occupancy?.totalRooms ?? kpis?.totalRooms ?? 0}</Text>
              <Text style={styles.occLabel}>Total rooms</Text>
            </View>
            <View style={styles.occItem}>
              <Text style={[styles.occValue, { color: '#15803d' }]}>
                {kpis?.fullyOccupiedRooms ?? occupancy?.occupiedRooms ?? 0}
              </Text>
              <Text style={styles.occLabel}>Filled</Text>
            </View>
            <View style={styles.occItem}>
              <Text style={[styles.occValue, { color: '#ea580c' }]}>{kpis?.partiallyOccupiedRooms ?? 0}</Text>
              <Text style={styles.occLabel}>Partial</Text>
            </View>
            <View style={styles.occItem}>
              <Text style={[styles.occValue, { color: '#0ea5e9' }]}>{kpis?.emptyRooms ?? occupancy?.availableRooms ?? 0}</Text>
              <Text style={styles.occLabel}>Available</Text>
            </View>
          </View>
          <Text style={styles.occupancyRate}>
            Overall: {kpis?.overallOccupancyRate ?? occupancy?.occupancyRate ?? 0}%
          </Text>
        </View>
      )}

      {/* Recent violations */}
      {recentViolations.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Recent violations</Text>
            <TouchableOpacity onPress={() => router.push('/(owner)/analytics' as any)}>
              <Text style={styles.linkText}>View all</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.card}>
            {recentViolations.slice(0, 3).map((v: any) => (
              <TouchableOpacity
                key={v._id}
                style={styles.violationRow}
                onPress={() => router.push('/(owner)/students' as any)}
                activeOpacity={0.7}
              >
                <View style={styles.violationContent}>
                  <View style={styles.violationMeta}>
                    <View style={styles.violationBadge}>
                      <Text style={styles.violationBadgeText}>{formatViolationType(v.violationType)}</Text>
                    </View>
                    <Text style={styles.violationDate}>{formatViolationDate(v.createdAt)}</Text>
                  </View>
                  {v.description?.trim() ? (
                    <Text style={styles.violationDesc} numberOfLines={2}>{v.description.trim()}</Text>
                  ) : null}
                  <Text style={styles.violationStudent}>{getStudentName(v)}</Text>
                </View>
                {getStudentId(v) ? (
                  <Ionicons name="chevron-forward" size={18} color="#0a7ea4" />
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Mess feedback */}
      {messFeedback.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Mess feedback</Text>
            <TouchableOpacity onPress={() => router.push('/(owner)/more' as any)}>
              <Text style={styles.linkText}>View all</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.card, styles.messCard]}>
            {messFeedback.slice(0, 5).map((f: any) => {
              const studentName = f.raisedBy?.name ?? 'Student';
              const dateStr = f.createdAt
                ? new Date(f.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '—';
              const meal = f.mealType || (f.title && String(f.title).replace(/Mess Feedback \(([^)]*)\)/, '$1')) || '—';
              return (
                <View key={f._id} style={styles.feedbackRow}>
                  <View style={styles.feedbackMeta}>
                    {f.rating != null && (
                      <View style={styles.stars}>
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Ionicons
                            key={i}
                            name={i <= f.rating ? 'star' : 'star-outline'}
                            size={14}
                            color="#f59e0b"
                          />
                        ))}
                      </View>
                    )}
                    <Text style={styles.feedbackDate}>{dateStr}</Text>
                    {meal !== '—' && (
                      <View style={styles.mealBadge}>
                        <Text style={styles.mealBadgeText}>{meal}</Text>
                      </View>
                    )}
                  </View>
                  {f.description && f.description !== 'No comment' && (
                    <Text style={styles.feedbackDesc} numberOfLines={2}>{f.description}</Text>
                  )}
                  <Text style={styles.feedbackStudent}>{studentName}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickList}>
          {QUICK_ACTIONS.map((action, index) => (
            <TouchableOpacity
              key={index}
              style={styles.quickItem}
              onPress={() => router.push(action.screen as any)}
              activeOpacity={0.7}
            >
              <View style={[styles.quickIconWrap, { backgroundColor: `${action.color}20` }]}>
                <Ionicons name={action.icon} size={22} color={action.color} />
              </View>
              <Text style={styles.quickLabel}>{action.label}</Text>
              <Ionicons name="chevron-forward" size={22} color="#0a7ea4" />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.bottomPad} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
  },
  content: {
    paddingBottom: 24,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  section: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0a7ea4',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpiCard: {
    width: '48%',
    minWidth: 140,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  kpiBlue: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  kpiGreen: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  kpiPurple: {
    backgroundColor: '#f5f3ff',
    borderColor: '#ddd6fe',
  },
  kpiAmber: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 6,
  },
  kpiLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  occupancyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  occItem: {
    alignItems: 'center',
  },
  occValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  occLabel: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  occupancyRate: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  messCard: {
    borderColor: '#fed7aa',
    backgroundColor: '#fff7ed',
  },
  violationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  violationContent: {
    flex: 1,
  },
  violationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  violationBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  violationBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
  },
  violationDate: {
    fontSize: 11,
    color: '#64748b',
  },
  violationDesc: {
    fontSize: 13,
    color: '#475569',
    marginTop: 4,
  },
  violationStudent: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
    marginTop: 6,
  },
  feedbackRow: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#ffedd5',
  },
  feedbackMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  stars: {
    flexDirection: 'row',
    gap: 2,
  },
  feedbackDate: {
    fontSize: 11,
    color: '#64748b',
  },
  mealBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  mealBadgeText: {
    fontSize: 11,
    color: '#475569',
  },
  feedbackDesc: {
    fontSize: 13,
    color: '#475569',
    marginTop: 4,
  },
  feedbackStudent: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
    marginTop: 6,
  },
  quickList: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  quickItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  quickIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  quickLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#0f172a',
  },
  bottomPad: {
    height: 24,
  },
});
