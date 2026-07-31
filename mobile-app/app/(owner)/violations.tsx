import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api, { getApiErrorMessage } from '../../services/api';

function toDateString(d: Date) {
  return d.toISOString().slice(0, 10);
}
function addDays(dateStr: string, delta: number) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + delta);
  return toDateString(d);
}
function daysBetween(from: string, to: string) {
  const a = new Date(from + 'T12:00:00').getTime();
  const b = new Date(to + 'T12:00:00').getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000)) + 1;
}
function formatRangeLabel(from: string, to: string) {
  if (from === to) return new Date(from + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  return `${new Date(from + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${new Date(to + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}
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
  return labels[type] || (type ? type.replace(/-/g, ' ') : 'Violation');
}
function formatTime(date: string | Date) {
  if (!date) return '—';
  return new Date(date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
function getStudentName(v: any) {
  if (!v?.studentId) return 'Unknown';
  return typeof v.studentId === 'object' ? v.studentId.name : 'Student';
}
function dedupeViolations(violations: any[]): any[] {
  const seen = new Set<string>();
  return violations.filter((v) => {
    const sid = (v?.studentId && (typeof v.studentId === 'object' ? v.studentId._id : v.studentId)) ?? '';
    const type = v?.violationType ?? '';
    const createdAt = v?.createdAt ? new Date(v.createdAt).getTime() : 0;
    const key = `${sid}|${type}|${Math.floor(createdAt / 60000)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function groupByDay(violations: any[]): { date: string; list: any[] }[] {
  const byDay: Record<string, any[]> = {};
  for (const v of violations) {
    const dateStr = v?.createdAt ? toDateString(new Date(v.createdAt)) : '';
    if (!dateStr) continue;
    if (!byDay[dateStr]) byDay[dateStr] = [];
    byDay[dateStr].push(v);
  }
  return Object.keys(byDay)
    .sort()
    .reverse()
    .map((date) => ({ date, list: byDay[date] }));
}

export default function ViolationsScreen() {
  const router = useRouter();
  const today = toDateString(new Date());
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [hostels, setHostels] = useState<any[]>([]);
  const [hostelId, setHostelId] = useState<string | null>(null);
  const [violations, setViolations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getHostels();
        const list = Array.isArray(res) ? res : (res as any)?.data ?? [];
        setHostels(list);
        if (list.length > 0 && !hostelId) setHostelId(list[0]._id || list[0].id);
      } catch {
        setHostels([]);
      }
    })();
  }, []);

  useEffect(() => {
    if (!dateFrom || !dateTo) return;
    let cancelled = false;
    setLoading(true);
    api
      .getRecentViolations(hostelId || undefined, 500, dateFrom, dateTo)
      .then((raw) => {
        if (!cancelled) setViolations(dedupeViolations(Array.isArray(raw) ? raw : []));
      })
      .catch((e) => {
        if (!cancelled) {
          Alert.alert('Error', getApiErrorMessage(e));
          setViolations([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [dateFrom, dateTo, hostelId]);

  const rangeDays = daysBetween(dateFrom, dateTo);
  const goPrev = () => {
    setDateFrom((f) => addDays(f, -rangeDays));
    setDateTo((t) => addDays(t, -rangeDays));
  };
  const goNext = () => {
    setDateFrom((f) => addDays(f, rangeDays));
    setDateTo((t) => addDays(t, rangeDays));
  };
  const setToday = () => {
    setDateFrom(today);
    setDateTo(today);
  };
  const canGoNext = dateTo < today;
  const byDay = groupByDay(violations);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.title}>Violations</Text>
        <Text style={styles.subtitle}>View violation records by day</Text>
      </View>

      {hostels.length > 1 && (
        <View style={styles.hostelRow}>
          <Text style={styles.label}>Hostel</Text>
          <TouchableOpacity
            style={styles.picker}
            onPress={() =>
              Alert.alert(
                'Hostel',
                undefined,
                hostels.map((h) => ({ text: h.name, onPress: () => setHostelId(h._id || h.id) }))
              )
            }
          >
            <Text style={styles.pickerText}>{hostels.find((h) => (h._id || h.id) === hostelId)?.name ?? 'Select'}</Text>
            <Ionicons name="chevron-down" size={20} color="#64748b" />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.rangeCard}>
        <View style={styles.rangeRow}>
          <TouchableOpacity style={styles.navBtn} onPress={goPrev} disabled={loading}>
            <Ionicons name="chevron-back" size={24} color="#0f172a" />
          </TouchableOpacity>
          <Text style={styles.rangeLabel} numberOfLines={2}>{formatRangeLabel(dateFrom, dateTo)}</Text>
          <TouchableOpacity style={[styles.navBtn, !canGoNext && styles.navBtnDisabled]} onPress={goNext} disabled={loading || !canGoNext}>
            <Ionicons name="chevron-forward" size={24} color="#0f172a" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.todayBtn} onPress={setToday} disabled={dateFrom === today && dateTo === today}>
          <Text style={styles.todayBtnText}>Today</Text>
        </TouchableOpacity>
        <Text style={styles.totalText}>Total: {violations.length} violation(s)</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#dc2626" />
        </View>
      ) : byDay.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="checkmark-circle-outline" size={56} color="#cbd5e1" />
          <Text style={styles.emptyText}>No violations in this range</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {byDay.map(({ date, list }) => (
            <View key={date} style={styles.dayCard}>
              <Text style={styles.dayTitle}>
                {new Date(date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>
              {list.map((v: any, i: number) => (
                <View key={v._id || i} style={styles.violationRow}>
                  <View style={styles.violationDot} />
                  <View style={styles.violationBody}>
                    <Text style={styles.violationStudent}>{getStudentName(v)}</Text>
                    <Text style={styles.violationType}>{formatViolationType(v.violationType)}</Text>
                    <Text style={styles.violationTime}>{formatTime(v.createdAt)}</Text>
                  </View>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: { backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  backBtn: { marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  hostelRow: { padding: 16, paddingTop: 12 },
  label: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 8 },
  picker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: '#fff' },
  pickerText: { fontSize: 16, color: '#0f172a' },
  rangeCard: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 8, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  rangeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  navBtn: { padding: 8 },
  navBtnDisabled: { opacity: 0.5 },
  rangeLabel: { flex: 1, textAlign: 'center', fontSize: 14, fontWeight: '600', color: '#475569' },
  todayBtn: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#e2e8f0', borderRadius: 8 },
  todayBtnText: { fontSize: 14, fontWeight: '600', color: '#475569' },
  totalText: { fontSize: 13, color: '#64748b', marginTop: 12, textAlign: 'center' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { fontSize: 15, color: '#64748b', marginTop: 12 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  dayCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  dayTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
  violationRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  violationDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#dc2626', marginTop: 6, marginRight: 12 },
  violationBody: { flex: 1 },
  violationStudent: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  violationType: { fontSize: 14, color: '#64748b', marginTop: 2 },
  violationTime: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
});
