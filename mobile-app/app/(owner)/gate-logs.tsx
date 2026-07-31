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
function formatTime(date: string | Date) {
  if (!date) return '—';
  return new Date(date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
}

export default function GateLogsScreen() {
  const router = useRouter();
  const today = toDateString(new Date());
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [hostels, setHostels] = useState<any[]>([]);
  const [hostelId, setHostelId] = useState<string | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | 'in' | 'out'>('all');

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
      .getGateLogs({ hostelId: hostelId || undefined, from: dateFrom, to: dateTo })
      .then((evs) => {
        if (!cancelled) setEvents(Array.isArray(evs) ? evs : []);
      })
      .catch((e) => {
        if (!cancelled) {
          Alert.alert('Error', getApiErrorMessage(e));
          setEvents([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [dateFrom, dateTo, hostelId]);

  const goPrev = () => {
    setDateFrom((f) => addDays(f, -1));
    setDateTo((t) => addDays(t, -1));
  };
  const goNext = () => {
    setDateFrom((f) => addDays(f, 1));
    setDateTo((t) => addDays(t, 1));
  };
  const setToday = () => {
    setDateFrom(today);
    setDateTo(today);
  };
  const canGoNext = dateTo < today;
  const filtered = events.filter((e) => {
    if (typeFilter === 'in') return e.type === 'in';
    if (typeFilter === 'out') return e.type === 'out';
    return true;
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.title}>Gate Logs</Text>
        <Text style={styles.subtitle}>Check-in and check-out by time</Text>
      </View>

      {hostels.length > 1 && (
        <View style={styles.hostelRow}>
          <Text style={styles.label}>Hostel</Text>
          <TouchableOpacity
            style={styles.picker}
            onPress={() =>
              Alert.alert('Hostel', undefined, hostels.map((h) => ({ text: h.name, onPress: () => setHostelId(h._id || h.id) })))
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
          <Text style={styles.rangeLabel}>
            {dateFrom === dateTo
              ? new Date(dateFrom + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
              : `${new Date(dateFrom + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${new Date(dateTo + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`}
          </Text>
          <TouchableOpacity style={[styles.navBtn, !canGoNext && styles.navBtnDisabled]} onPress={goNext} disabled={loading || !canGoNext}>
            <Ionicons name="chevron-forward" size={24} color="#0f172a" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.todayBtn} onPress={setToday} disabled={dateFrom === today && dateTo === today}>
          <Text style={styles.todayBtnText}>Today</Text>
        </TouchableOpacity>
        <View style={styles.filterRow}>
          {(['all', 'in', 'out'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.filterChip, typeFilter === t && styles.filterChipActive]}
              onPress={() => setTypeFilter(t)}
            >
              <Text style={[styles.filterChipText, typeFilter === t && styles.filterChipTextActive]}>{t === 'all' ? 'All' : t === 'in' ? 'In' : 'Out'}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0a7ea4" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="log-in-outline" size={56} color="#cbd5e1" />
          <Text style={styles.emptyText}>No gate events in this range</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {filtered.map((e: any, i: number) => (
            <View key={e.time + (e.studentId ?? '') + i} style={styles.row}>
              <View style={[styles.typeBadge, e.type === 'in' ? styles.typeIn : styles.typeOut]}>
                <Text style={styles.typeBadgeText}>{e.type === 'in' ? 'IN' : 'OUT'}</Text>
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.studentName}>{e.studentName ?? '—'}</Text>
                <Text style={styles.studentEmail}>{e.studentEmail || e.studentNumber || ''}</Text>
              </View>
              <Text style={styles.timeText}>{formatTime(e.time)}</Text>
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
  todayBtn: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#e2e8f0', borderRadius: 8, marginBottom: 12 },
  todayBtnText: { fontSize: 14, fontWeight: '600', color: '#475569' },
  filterRow: { flexDirection: 'row', gap: 10 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: '#f1f5f9' },
  filterChipActive: { backgroundColor: '#0a7ea4' },
  filterChipText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  filterChipTextActive: { color: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { fontSize: 15, color: '#64748b', marginTop: 12 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 14, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginRight: 12 },
  typeIn: { backgroundColor: '#dcfce7' },
  typeOut: { backgroundColor: '#fef3c7' },
  typeBadgeText: { fontSize: 12, fontWeight: '700', color: '#0f172a' },
  rowBody: { flex: 1 },
  studentName: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  studentEmail: { fontSize: 13, color: '#64748b', marginTop: 2 },
  timeText: { fontSize: 14, fontWeight: '600', color: '#475569' },
});
