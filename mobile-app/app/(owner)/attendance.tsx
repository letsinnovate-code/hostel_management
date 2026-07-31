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
  if (from === to) {
    return new Date(from + 'T12:00:00').toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
  return `${new Date(from + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${new Date(to + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

type DayAttendance = {
  date: string;
  students: { name: string; email: string; studentNumber?: string; totalMinutesInside: number; totalTimeFormatted: string }[];
};

export default function AttendanceScreen() {
  const router = useRouter();
  const today = toDateString(new Date());
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [hostels, setHostels] = useState<any[]>([]);
  const [hostelId, setHostelId] = useState<string | null>(null);
  const [dailyAttendance, setDailyAttendance] = useState<DayAttendance[]>([]);
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
    if (!hostelId || !dateFrom || !dateTo) {
      setDailyAttendance([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .getDailyAttendance({ hostelId, from: dateFrom, to: dateTo })
      .then((data) => {
        if (!cancelled) setDailyAttendance(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        if (!cancelled) {
          Alert.alert('Error', getApiErrorMessage(e));
          setDailyAttendance([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hostelId, dateFrom, dateTo]);

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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.title}>Attendance</Text>
        <Text style={styles.subtitle}>Time in hostel per student by day</Text>
      </View>

      {hostels.length > 1 && (
        <View style={styles.hostelRow}>
          <Text style={styles.label}>Hostel</Text>
          <TouchableOpacity
            style={styles.picker}
            onPress={() => {
              Alert.alert(
                'Select Hostel',
                undefined,
                [
                  ...hostels.map((h) => ({
                    text: h.name,
                    onPress: () => setHostelId(h._id || h.id),
                  })),
                  { text: 'Cancel', style: 'cancel' },
                ]
              );
            }}
          >
            <Text style={styles.pickerText}>
              {hostels.find((h) => (h._id || h.id) === hostelId)?.name ?? 'Select'}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#64748b" />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.rangeCard}>
        <View style={styles.rangeRow}>
          <TouchableOpacity
            style={[styles.navBtn, loading && styles.navBtnDisabled]}
            onPress={goPrev}
            disabled={loading}
          >
            <Ionicons name="chevron-back" size={24} color="#0f172a" />
          </TouchableOpacity>
          <Text style={styles.rangeLabel} numberOfLines={2}>
            {formatRangeLabel(dateFrom, dateTo)}
          </Text>
          <TouchableOpacity
            style={[styles.navBtn, (loading || !canGoNext) && styles.navBtnDisabled]}
            onPress={goNext}
            disabled={loading || !canGoNext}
          >
            <Ionicons name="chevron-forward" size={24} color="#0f172a" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[styles.todayBtn, (dateFrom === today && dateTo === today) && styles.todayBtnDisabled]}
          onPress={setToday}
          disabled={dateFrom === today && dateTo === today}
        >
          <Text style={styles.todayBtnText}>Today</Text>
        </TouchableOpacity>
      </View>

      {!hostelId ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Select a hostel to see attendance</Text>
        </View>
      ) : loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#0a7ea4" />
        </View>
      ) : dailyAttendance.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No data for this range</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {dailyAttendance.map((day) => (
            <View key={day.date} style={styles.dayCard}>
              <Text style={styles.dayTitle}>
                {new Date(day.date + 'T12:00:00').toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>
              {(day.students ?? []).map((s: any, i: number) => (
                <View key={s.studentId?._id ?? s.email ?? i} style={styles.studentRow}>
                  <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>{s.name || '—'}</Text>
                    <Text style={styles.studentEmail}>{s.email || '—'}</Text>
                  </View>
                  <Text style={styles.timeText}>{s.totalTimeFormatted || '0m'}</Text>
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
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  pickerText: { fontSize: 16, color: '#0f172a' },
  rangeCard: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 8, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  rangeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  navBtn: { padding: 8 },
  navBtnDisabled: { opacity: 0.5 },
  rangeLabel: { flex: 1, textAlign: 'center', fontSize: 14, fontWeight: '600', color: '#475569' },
  todayBtn: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#e2e8f0', borderRadius: 8 },
  todayBtnDisabled: { opacity: 0.6 },
  todayBtnText: { fontSize: 14, fontWeight: '600', color: '#475569' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { fontSize: 15, color: '#64748b' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  dayCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  dayTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
  studentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  studentEmail: { fontSize: 13, color: '#64748b' },
  timeText: { fontSize: 15, fontWeight: '600', color: '#0a7ea4' },
});
