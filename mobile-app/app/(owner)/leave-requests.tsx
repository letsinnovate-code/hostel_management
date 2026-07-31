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

function formatType(t: string) {
  if (!t) return '—';
  return t.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function LeaveRequestsScreen() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [acting, setActing] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const loadLeave = async () => {
    setLoading(true);
    try {
      const data = await api.getLeaveRequests(undefined, statusFilter || undefined);
      setList(Array.isArray(data) ? data : []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeave();
  }, [statusFilter]);

  const handleApprove = async (permissionId: string) => {
    setActing(permissionId);
    try {
      await api.approveLeaveRequest(permissionId);
      Alert.alert('Success', 'Leave request approved');
      loadLeave();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to approve');
    } finally {
      setActing(null);
    }
  };

  const handleReject = async () => {
    if (!rejectId) return;
    setActing(rejectId);
    try {
      await api.rejectLeaveRequest(rejectId, rejectReason);
      setRejectId(null);
      setRejectReason('');
      Alert.alert('Done', 'Leave request rejected');
      loadLeave();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to reject');
    } finally {
      setActing(null);
    }
  };

  const statusOptions = [
    { label: 'All', value: '' },
    { label: 'Pending', value: 'pending' },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        {statusOptions.map((opt) => (
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
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadLeave} />}
      >
        {loading && list.length === 0 ? (
          <ActivityIndicator size="large" color="#0a7ea4" style={styles.loader} />
        ) : list.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={48} color="#94a3b8" />
            <Text style={styles.emptyText}>No leave requests</Text>
          </View>
        ) : (
          list.map((p: any) => {
            const studentName = p.studentId?.name ?? 'Student';
            const statusStyle =
              p.status === 'approved' ? styles.badgeGreen : p.status === 'rejected' ? styles.badgeRed : styles.badgeAmber;
            return (
              <View key={p._id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.name}>{studentName}</Text>
                  <View style={[styles.badge, statusStyle]}>
                    <Text style={styles.badgeText}>{(p.status || 'pending').toUpperCase()}</Text>
                  </View>
                </View>
                <Text style={styles.type}>{formatType(p.permissionType || '')}</Text>
                {p.reason ? <Text style={styles.reason}>{p.reason}</Text> : null}
                <Text style={styles.dates}>
                  From: {p.requestedDate ? new Date(p.requestedDate).toLocaleDateString() : '—'}
                  {p.returnDate ? ` — To: ${new Date(p.returnDate).toLocaleDateString()}` : ''}
                </Text>
                {p.rejectionReason ? (
                  <Text style={styles.rejection}>Rejection: {p.rejectionReason}</Text>
                ) : null}
                {p.status === 'pending' && (
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={styles.approveBtn}
                      onPress={() => handleApprove(p._id)}
                      disabled={!!acting}
                    >
                      <Ionicons name="checkmark" size={18} color="#fff" />
                      <Text style={styles.actionBtnText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.rejectBtn}
                      onPress={() => setRejectId(p._id)}
                      disabled={!!acting}
                    >
                      <Ionicons name="close" size={18} color="#fff" />
                      <Text style={styles.actionBtnText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={!!rejectId} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Reject leave request</Text>
            <TextInput
              style={styles.input}
              placeholder="Reason (optional)"
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setRejectId(null); setRejectReason(''); }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.rejectConfirmBtn} onPress={handleReject} disabled={!!acting}>
                <Text style={styles.actionBtnText}>Reject</Text>
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
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  name: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeGreen: { backgroundColor: '#dcfce7' },
  badgeRed: { backgroundColor: '#fee2e2' },
  badgeAmber: { backgroundColor: '#fef3c7' },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#0f172a' },
  type: { fontSize: 13, color: '#64748b', marginBottom: 4 },
  reason: { fontSize: 14, color: '#475569', marginBottom: 4 },
  dates: { fontSize: 12, color: '#94a3b8', marginBottom: 4 },
  rejection: { fontSize: 12, color: '#dc2626', marginTop: 4 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  approveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8, backgroundColor: '#22c55e' },
  rejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8, backgroundColor: '#dc2626' },
  actionBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalBox: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#0f172a', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 15, minHeight: 80, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  cancelBtnText: { fontSize: 15, color: '#64748b', fontWeight: '600' },
  rejectConfirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#dc2626', alignItems: 'center' },
});
