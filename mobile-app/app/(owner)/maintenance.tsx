import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';

const STATUS_OPTIONS = ['open', 'assigned', 'in-progress', 'resolved', 'closed'];

export default function MaintenanceScreen() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);
  const [modal, setModal] = useState<{ id: string; status: string; notes: string } | null>(null);

  const loadMaintenance = async () => {
    setLoading(true);
    try {
      const data = await api.getMaintenanceComplaints(undefined, statusFilter || undefined);
      setList(Array.isArray(data) ? data : []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMaintenance();
  }, [statusFilter]);

  const handleUpdateStatus = async () => {
    if (!modal) return;
    setUpdating(modal.id);
    try {
      await api.updateComplaintStatus(modal.id, modal.status, modal.notes);
      setModal(null);
      Alert.alert('Success', 'Status updated');
      loadMaintenance();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to update');
    } finally {
      setUpdating(null);
    }
  };

  const statusColor: Record<string, string> = {
    open: '#b45309',
    assigned: '#0a7ea4',
    'in-progress': '#0a7ea4',
    resolved: '#15803d',
    closed: '#64748b',
  };

  const filterOptions = [
    { label: 'All', value: '' },
    { label: 'Open', value: 'open' },
    { label: 'In progress', value: 'in-progress' },
    { label: 'Resolved', value: 'resolved' },
    { label: 'Closed', value: 'closed' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        {filterOptions.map((opt) => (
          <TouchableOpacity
            key={opt.value || 'all'}
            style={[styles.filterBtn, statusFilter === opt.value && styles.filterBtnActive]}
            onPress={() => setStatusFilter(opt.value)}
          >
            <Text style={[styles.filterText, statusFilter === opt.value && styles.filterTextActive]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadMaintenance} />}
      >
        {loading && list.length === 0 ? (
          <ActivityIndicator size="large" color="#0a7ea4" style={styles.loader} />
        ) : list.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="construct-outline" size={48} color="#94a3b8" />
            <Text style={styles.emptyText}>No maintenance requests</Text>
          </View>
        ) : (
          list.map((c: any) => (
            <View key={c._id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.title}>{c.title}</Text>
                <View style={[styles.badge, { backgroundColor: (statusColor[c.status] || '#64748b') + '20' }]}>
                  <Text style={[styles.badgeText, { color: statusColor[c.status] || '#64748b' }]}>
                    {(c.status || 'open').replace(/-/g, ' ')}
                  </Text>
                </View>
              </View>
              {c.description ? <Text style={styles.desc}>{c.description}</Text> : null}
              <Text style={styles.meta}>
                {c.raisedBy?.name ?? 'Student'}
                {c.roomId?.roomNumber ? ` · Room ${c.roomId.roomNumber}` : ''}
                {' · '}{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}
              </Text>
              {c.resolutionNotes ? (
                <Text style={styles.resolution}>Resolution: {c.resolutionNotes}</Text>
              ) : null}
              <TouchableOpacity
                style={styles.updateBtn}
                onPress={() => setModal({ id: c._id, status: c.status || 'open', notes: c.resolutionNotes || '' })}
              >
                <Text style={styles.updateBtnText}>Update status</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={!!modal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Update status</Text>
            <View style={styles.selectWrap}>
              {STATUS_OPTIONS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.optionBtn, modal?.status === s && styles.optionBtnActive]}
                  onPress={() => modal && setModal({ ...modal, status: s })}
                >
                  <Text style={[styles.optionText, modal?.status === s && styles.optionTextActive]}>{s.replace(/-/g, ' ')}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.input}
              placeholder="Resolution notes (optional)"
              value={modal?.notes ?? ''}
              onChangeText={(text) => modal && setModal({ ...modal, notes: text })}
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModal(null)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleUpdateStatus} disabled={!!updating}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9' },
  filterBtnActive: { backgroundColor: '#0a7ea4' },
  filterText: { fontSize: 13, color: '#64748b' },
  filterTextActive: { color: '#fff', fontWeight: '600' },
  scroll: { flex: 1 },
  loader: { marginTop: 40 },
  empty: { alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 15, color: '#64748b', marginTop: 12 },
  card: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 12, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  title: { fontSize: 16, fontWeight: '600', color: '#0f172a', flex: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  desc: { fontSize: 14, color: '#475569', marginBottom: 6 },
  meta: { fontSize: 12, color: '#94a3b8', marginBottom: 4 },
  resolution: { fontSize: 13, color: '#15803d', marginTop: 6 },
  updateBtn: { marginTop: 12, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#0a7ea4', alignItems: 'center' },
  updateBtnText: { fontSize: 14, fontWeight: '600', color: '#0a7ea4' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalBox: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#0f172a', marginBottom: 12 },
  selectWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  optionBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#f1f5f9' },
  optionBtnActive: { backgroundColor: '#0a7ea4' },
  optionText: { fontSize: 13, color: '#64748b' },
  optionTextActive: { color: '#fff', fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 15, minHeight: 80, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  cancelBtnText: { fontSize: 15, color: '#64748b', fontWeight: '600' },
  saveBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#22c55e', alignItems: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
