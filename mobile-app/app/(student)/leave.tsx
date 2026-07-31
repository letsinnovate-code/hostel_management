import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import api from '../../services/api';

function toYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const LEAVE_TYPES = [
  { value: 'leave', label: 'Leave' },
  { value: 'overnight', label: 'Night out' },
  { value: 'multi-day', label: 'Multi-day' },
];

export default function LeaveScreen() {
  const router = useRouter();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    permissionType: 'leave',
    reason: '',
    requestedDate: '',
    returnDate: '',
  });
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  const load = async () => {
    try {
      const res = await api.getPermissionRequests();
      const raw = (res as any)?.data ?? (Array.isArray(res) ? res : []);
      const arr = Array.isArray(raw) ? raw : [];
      setList(arr.filter((p: any) => ['leave', 'overnight', 'multi-day'].includes(p.permissionType)));
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load');
      setList([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async () => {
    if (!formData.reason?.trim() || !formData.requestedDate?.trim()) {
      Alert.alert('Error', 'Please fill reason and requested date');
      return;
    }
    setSubmitting(true);
    try {
      await api.createPermissionRequest({
        permissionType: formData.permissionType,
        reason: formData.reason.trim(),
        requestedDate: formData.requestedDate,
        returnDate: formData.returnDate || undefined,
      });
      Alert.alert('Success', 'Leave request submitted. Owner will approve or reject.');
      setModalVisible(false);
      setFormData({ permissionType: 'leave', reason: '', requestedDate: '', returnDate: '' });
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const cancelRequest = async (id: string) => {
    try {
      await api.cancelPermissionRequest(id);
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to cancel');
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'approved') return '#059669';
    if (status === 'rejected') return '#dc2626';
    return '#d97706';
  };

  const formatType = (t: string) => t.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Ionicons name="add-circle" size={24} color="#fff" />
          <Text style={styles.addBtnText}>Apply for leave / night-out</Text>
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator size="large" color="#0a7ea4" style={{ marginTop: 24 }} />
        ) : list.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={56} color="#94a3b8" />
            <Text style={styles.emptyText}>No leave requests yet</Text>
          </View>
        ) : (
          list.map((p) => (
            <View key={p._id} style={styles.card}>
              <View style={styles.cardRow}>
                <Text style={styles.cardType}>{formatType(p.permissionType)}</Text>
                <View style={[styles.badge, { backgroundColor: getStatusColor(p.status) }]}>
                  <Text style={styles.badgeText}>{p.status}</Text>
                </View>
              </View>
              <Text style={styles.reason}>{p.reason}</Text>
              <Text style={styles.date}>From: {new Date(p.requestedDate).toLocaleDateString()}</Text>
              {p.returnDate && (
                <Text style={styles.date}>To: {new Date(p.returnDate).toLocaleDateString()}</Text>
              )}
              {p.rejectionReason ? (
                <Text style={styles.rej}>{p.rejectionReason}</Text>
              ) : null}
              {p.status === 'pending' && (
                <TouchableOpacity style={styles.cancelBtn} onPress={() => cancelRequest(p._id)}>
                  <Text style={styles.cancelBtnText}>Cancel request</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Apply leave / night-out</Text>
            {LEAVE_TYPES.map((t) => (
              <TouchableOpacity
                key={t.value}
                style={[styles.typeBtn, formData.permissionType === t.value && styles.typeBtnActive]}
                onPress={() => setFormData({ ...formData, permissionType: t.value })}
              >
                <Text style={[styles.typeBtnText, formData.permissionType === t.value && styles.typeBtnTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
            <TextInput
              style={styles.input}
              placeholder="Reason *"
              value={formData.reason}
              onChangeText={(t) => setFormData({ ...formData, reason: t })}
              multiline
            />
            <Text style={styles.dateLabel}>From date *</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowFromPicker(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="calendar-outline" size={20} color="#0a7ea4" />
              <Text style={[styles.dateButtonText, !formData.requestedDate && styles.dateButtonPlaceholder]}>
                {formData.requestedDate
                  ? new Date(formData.requestedDate + 'T12:00:00').toLocaleDateString(undefined, { dateStyle: 'medium' })
                  : 'Select from date'}
              </Text>
              <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
            </TouchableOpacity>
            {showFromPicker && (
              <View style={styles.pickerWrap}>
                <DateTimePicker
                  value={formData.requestedDate ? new Date(formData.requestedDate + 'T12:00:00') : new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  minimumDate={new Date()}
                  onChange={(_, d) => {
                    if (d) setFormData((prev) => ({ ...prev, requestedDate: toYYYYMMDD(d) }));
                    if (Platform.OS === 'android') setShowFromPicker(false);
                  }}
                />
                {Platform.OS === 'ios' && (
                  <TouchableOpacity style={styles.pickerDone} onPress={() => setShowFromPicker(false)}>
                    <Text style={styles.pickerDoneText}>Done</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <Text style={styles.dateLabel}>To date (optional)</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowToPicker(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="calendar-outline" size={20} color="#0a7ea4" />
              <Text style={[styles.dateButtonText, !formData.returnDate && styles.dateButtonPlaceholder]}>
                {formData.returnDate
                  ? new Date(formData.returnDate + 'T12:00:00').toLocaleDateString(undefined, { dateStyle: 'medium' })
                  : 'Select return date'}
              </Text>
              <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
            </TouchableOpacity>
            {showToPicker && (
              <View style={styles.pickerWrap}>
                <DateTimePicker
                  value={
                    formData.returnDate
                      ? new Date(formData.returnDate + 'T12:00:00')
                      : formData.requestedDate
                        ? new Date(formData.requestedDate + 'T12:00:00')
                        : new Date()
                  }
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  minimumDate={
                    formData.requestedDate
                      ? new Date(formData.requestedDate + 'T12:00:00')
                      : new Date()
                  }
                  onChange={(_, d) => {
                    if (d) setFormData((prev) => ({ ...prev, returnDate: toYYYYMMDD(d) }));
                    if (Platform.OS === 'android') setShowToPicker(false);
                  }}
                />
                {Platform.OS === 'ios' && (
                  <TouchableOpacity style={styles.pickerDone} onPress={() => setShowToPicker(false)}>
                    <Text style={styles.pickerDoneText}>Done</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            <View style={styles.modalRow}>
              <TouchableOpacity style={styles.cancelModalBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelModalText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitModalBtn} onPress={handleSubmit} disabled={submitting}>
                <Text style={styles.submitModalText}>{submitting ? 'Submitting...' : 'Submit'}</Text>
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
  scrollContent: { padding: 20, paddingBottom: 32 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0a7ea4',
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 16, color: '#64748b', marginTop: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardType: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  reason: { fontSize: 14, color: '#475569', marginBottom: 6 },
  date: { fontSize: 12, color: '#64748b', marginBottom: 2 },
  rej: { fontSize: 12, color: '#dc2626', marginTop: 6, fontStyle: 'italic' },
  cancelBtn: { marginTop: 10 },
  cancelBtnText: { fontSize: 14, color: '#dc2626' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  typeBtn: { padding: 12, borderRadius: 8, marginBottom: 8, backgroundColor: '#f1f5f9' },
  typeBtnActive: { backgroundColor: '#0a7ea4' },
  typeBtnText: { fontSize: 14, color: '#475569', textAlign: 'center' },
  typeBtnTextActive: { color: '#fff', fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, color: '#000', padding: 12, marginBottom: 12, fontSize: 15 },
  dateLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  dateButtonText: { fontSize: 15, color: '#0f172a', flex: 1 },
  dateButtonPlaceholder: { color: '#94a3b8' },
  pickerWrap: { marginBottom: 12 },
  pickerDone: { marginTop: 8, padding: 12, backgroundColor: '#0a7ea4', borderRadius: 10, alignItems: 'center' },
  pickerDoneText: { color: '#fff', fontWeight: '600' },
  modalRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancelModalBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#f1f5f9', alignItems: 'center' },
  cancelModalText: { fontWeight: '600', color: '#475569' },
  submitModalBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#0a7ea4', alignItems: 'center' },
  submitModalText: { fontWeight: '600', color: '#fff' },
});
