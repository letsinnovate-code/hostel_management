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
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';

const STATUS_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'On Leave', value: 'on-leave' },
  { label: 'Exited', value: 'exited' },
];

function presenceLabel(presence: string) {
  if (presence === 'inside') return 'Checked in';
  if (presence === 'outside') return 'Checked out';
  return 'Unknown';
}

function presenceColor(presence: string) {
  if (presence === 'inside') return '#15803d';
  if (presence === 'outside') return '#b45309';
  return '#64748b';
}

export default function PresenceScreen() {
  const router = useRouter();
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [hostelId, setHostelId] = useState<string | null>(null);
  const [hostels, setHostels] = useState<{ _id: string; name: string }[]>([]);

  const loadHostels = async () => {
    try {
      const res = await api.getHostels();
      const list = Array.isArray(res) ? res : (res as any)?.data ?? [];
      setHostels(list);
      if (list.length > 0 && !hostelId) setHostelId(list[0]._id);
    } catch {
      setHostels([]);
    }
  };

  const loadStudents = async () => {
    setLoading(true);
    try {
      const list = await api.getStudentsWithAttendance(hostelId || undefined);
      const normalized = Array.isArray(list) ? list : [];
      const filtered =
        filter === 'all' ? normalized : normalized.filter((s) => (s.status || 'active') === filter);
      setStudents(filtered);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to load students');
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHostels();
  }, []);

  useEffect(() => {
    if (hostelId || hostels.length === 0) loadStudents();
  }, [hostelId, filter]);

  const handleApprove = async (studentId: string) => {
    try {
      await api.approveStudentOnboarding(studentId);
      Alert.alert('Success', 'Student approved');
      loadStudents();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to approve');
    }
  };

  const handleStatusChange = async (studentId: string, status: string) => {
    try {
      await api.updateStudentStatus(studentId, status);
      Alert.alert('Success', 'Status updated');
      loadStudents();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to update status');
    }
  };

  return (
    <View style={styles.container}>
      {hostels.length > 1 && (
        <View style={styles.pickerRow}>
          <Text style={styles.pickerLabel}>Hostel</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hostelChips}>
            {hostels.map((h) => (
              <TouchableOpacity
                key={h._id}
                style={[styles.chip, hostelId === h._id && styles.chipActive]}
                onPress={() => setHostelId(h._id)}
              >
                <Text style={[styles.chipText, hostelId === h._id && styles.chipTextActive]}>{h.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[styles.filterBtn, filter === f.value && styles.filterBtnActive]}
            onPress={() => setFilter(f.value)}
          >
            <Text style={[styles.filterBtnText, filter === f.value && styles.filterBtnTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadStudents} />}
      >
        {loading && students.length === 0 ? (
          <ActivityIndicator size="large" color="#0a7ea4" style={styles.loader} />
        ) : students.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={48} color="#94a3b8" />
            <Text style={styles.emptyText}>No students match the current filters</Text>
            <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/(owner)/student-create' as any)}>
              <Text style={styles.addBtnText}>Add Student</Text>
            </TouchableOpacity>
          </View>
        ) : (
          students.map((student) => (
            <TouchableOpacity
              key={student._id}
              style={styles.card}
              onPress={() => router.push(`/(owner)/student-edit/${student._id}` as any)}
              activeOpacity={0.8}
            >
              <View style={styles.cardHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{(student.name || 'S').charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.cardMain}>
                  <Text style={styles.name}>{student.name}</Text>
                  <Text style={styles.email}>{student.email}</Text>
                  <Text style={styles.meta}>
                    {typeof student.hostelId === 'object' ? student.hostelId?.name : ''}
                    {typeof student.roomId === 'object' && student.roomId?.roomNumber
                      ? ` · Room ${student.roomId.roomNumber}`
                      : ''}
                  </Text>
                </View>
                <View style={[styles.presenceBadge, { backgroundColor: presenceColor(student.presenceStatus || '') + '20' }]}>
                  <Text style={[styles.presenceText, { color: presenceColor(student.presenceStatus || '') }]}>
                    {presenceLabel(student.presenceStatus || '')}
                  </Text>
                </View>
              </View>
              <View style={styles.actions}>
                {student.status === 'pending' && (
                  <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(student._id)}>
                    <Text style={styles.approveBtnText}>Approve</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.statusBtn}
                  onPress={() =>
                    Alert.alert('Change status', 'Select status', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Active', onPress: () => handleStatusChange(student._id, 'active') },
                      { text: 'On Leave', onPress: () => handleStatusChange(student._id, 'on-leave') },
                      { text: 'Exited', onPress: () => handleStatusChange(student._id, 'exited') },
                    ])
                  }
                >
                  <Text style={styles.statusBtnText}>Change status</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(owner)/student-create' as any)}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  pickerRow: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  pickerLabel: { fontSize: 12, color: '#64748b', marginBottom: 6 },
  hostelChips: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9' },
  chipActive: { backgroundColor: '#0a7ea4' },
  chipText: { fontSize: 14, color: '#475569' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 8, backgroundColor: '#fff' },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9' },
  filterBtnActive: { backgroundColor: '#0a7ea4' },
  filterBtnText: { fontSize: 13, color: '#64748b' },
  filterBtnTextActive: { color: '#fff', fontWeight: '600' },
  scroll: { flex: 1 },
  loader: { marginTop: 40 },
  empty: { alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 15, color: '#64748b', marginTop: 12, textAlign: 'center' },
  addBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#0a7ea4', borderRadius: 10 },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  card: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 12, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#0a7ea4', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  cardMain: { flex: 1, marginLeft: 12 },
  name: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  email: { fontSize: 13, color: '#64748b', marginTop: 2 },
  meta: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  presenceBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  presenceText: { fontSize: 12, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  approveBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: '#22c55e', alignItems: 'center' },
  approveBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  statusBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: '#0a7ea4', alignItems: 'center' },
  statusBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  fab: { position: 'absolute', right: 20, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#0a7ea4', alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
});
