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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';

const CATEGORIES = [
  { value: 'lights', label: 'Lights' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'other', label: 'Other' },
];

export default function MaintenanceScreen() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'lights',
  });

  const load = async () => {
    try {
      const res = await api.getComplaints();
      const raw = (res as any)?.data ?? (Array.isArray(res) ? res : []);
      const arr = Array.isArray(raw) ? raw : [];
      setList(arr.filter((c: any) => c.complaintType === 'maintenance'));
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
    const title = (formData.title || formData.category).trim();
    if (!title || !formData.description?.trim()) {
      Alert.alert('Error', 'Please add a title and description');
      return;
    }
    setSubmitting(true);
    try {
      await api.createComplaint({
        complaintType: 'maintenance',
        title: title || CATEGORIES.find((c) => c.value === formData.category)?.label || 'Maintenance',
        description: formData.description.trim(),
        priority: 'medium',
      });
      Alert.alert('Success', 'Maintenance request submitted. We will update the status soon.');
      setModalVisible(false);
      setFormData({ title: '', description: '', category: 'lights' });
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'resolved' || status === 'closed') return '#059669';
    if (status === 'in-progress' || status === 'assigned') return '#0a7ea4';
    return '#d97706';
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Ionicons name="construct-outline" size={24} color="#fff" />
          <Text style={styles.addBtnText}>Request repair</Text>
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator size="large" color="#059669" style={{ marginTop: 24 }} />
        ) : list.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="hammer-outline" size={56} color="#94a3b8" />
            <Text style={styles.emptyText}>No maintenance requests yet</Text>
          </View>
        ) : (
          list.map((c) => (
            <View key={c._id} style={styles.card}>
              <View style={styles.cardRow}>
                <Text style={styles.cardTitle}>{c.title}</Text>
                <View style={[styles.badge, { backgroundColor: getStatusColor(c.status) }]}>
                  <Text style={styles.badgeText}>{c.status}</Text>
                </View>
              </View>
              <Text style={styles.desc}>{c.description}</Text>
              <Text style={styles.date}>{new Date(c.createdAt).toLocaleDateString()}</Text>
              {c.resolutionNotes ? (
                <Text style={styles.notes}>Resolution: {c.resolutionNotes}</Text>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Room maintenance</Text>
            {CATEGORIES.map((t) => (
              <TouchableOpacity
                key={t.value}
                style={[styles.catBtn, formData.category === t.value && styles.catBtnActive]}
                onPress={() => setFormData({ ...formData, category: t.value })}
              >
                <Text style={[styles.catBtnText, formData.category === t.value && styles.catBtnTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
            <TextInput
              style={styles.input}
              placeholder="Short title (e.g. Broken bulb in room)"
              value={formData.title}
              onChangeText={(t) => setFormData({ ...formData, title: t })}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Description *"
              value={formData.description}
              onChangeText={(t) => setFormData({ ...formData, description: t })}
              multiline
              numberOfLines={4}
            />
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
    backgroundColor: '#059669',
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
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  desc: { fontSize: 14, color: '#475569', marginBottom: 6 },
  date: { fontSize: 12, color: '#64748b' },
  notes: { fontSize: 12, color: '#059669', marginTop: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  catBtn: { padding: 10, borderRadius: 8, marginBottom: 6, backgroundColor: '#f1f5f9' },
  catBtnActive: { backgroundColor: '#059669' },
  catBtnText: { fontSize: 14, color: '#475569', textAlign: 'center' },
  catBtnTextActive: { color: '#fff', fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#e2e8f0',color: '#000', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 15 },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  modalRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancelModalBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#f1f5f9', alignItems: 'center' },
  cancelModalText: { fontWeight: '600', color: '#475569' },
  submitModalBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#059669', alignItems: 'center' },
  submitModalText: { fontWeight: '600', color: '#fff' },
});
