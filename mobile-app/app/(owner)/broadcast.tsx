import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api, { getApiErrorMessage } from '../../services/api';

export default function BroadcastScreen() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [sending, setSending] = useState(false);
  const [hostelId, setHostelId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'announcement',
    targetAudience: 'all',
    priority: 'medium',
  });

  const loadHostelsAndNotifications = async () => {
    setLoading(true);
    try {
      const hostelsRes = await api.getHostels();
      const hostelsList = Array.isArray(hostelsRes) ? hostelsRes : (hostelsRes as any)?.data ?? [];
      const firstId = hostelsList[0]?._id ?? hostelsList[0]?.id;
      if (firstId) setHostelId(firstId);
      if (!firstId) {
        setNotifications([]);
        return;
      }
      const notifRes = await api.getOwnerNotifications(firstId);
      const raw = (notifRes as any)?.data ?? notifRes;
      setNotifications(Array.isArray(raw) ? raw : []);
    } catch (e: any) {
      Alert.alert('Error', getApiErrorMessage(e));
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHostelsAndNotifications();
  }, []);

  const loadNotifications = async () => {
    if (!hostelId) return;
    try {
      const notifRes = await api.getOwnerNotifications(hostelId);
      const raw = (notifRes as any)?.data ?? notifRes;
      setNotifications(Array.isArray(raw) ? raw : []);
    } catch (_) {
      setNotifications([]);
    }
  };

  const handleSend = async () => {
    if (!formData.title?.trim() || !formData.message?.trim()) {
      Alert.alert('Required', 'Please enter title and message');
      return;
    }
    if (!hostelId) {
      Alert.alert('Error', 'No hostel. Create a hostel first.');
      return;
    }
    setSending(true);
    try {
      await api.sendBroadcast({
        title: formData.title.trim(),
        message: formData.message.trim(),
        type: formData.type,
        targetAudience: formData.targetAudience,
        priority: formData.priority,
        hostelId,
      });
      Alert.alert('Success', 'Notice sent successfully');
      setModalVisible(false);
      setFormData({ title: '', message: '', type: 'announcement', targetAudience: 'all', priority: 'medium' });
      loadHostelsAndNotifications();
    } catch (e: any) {
      Alert.alert('Error', getApiErrorMessage(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notice Board</Text>
        <Text style={styles.headerSubtitle}>Purely for notices — send and manage messages. No check-in/check-out or violations here.</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
          <Ionicons name="megaphone-outline" size={22} color="#fff" />
          <Text style={styles.addButtonText}>Send Notice</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadHostelsAndNotifications} />}
      >
        {!hostelId ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Create a hostel first to send notices</Text>
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="notifications-outline" size={56} color="#cbd5e1" />
            <Text style={styles.emptyText}>No notices yet</Text>
            <Text style={styles.emptySubtext}>Tap "Send Notice" to create your first notice</Text>
          </View>
        ) : (
          notifications.map((notification) => (
            <View key={notification._id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{notification.title}</Text>
                <View style={styles.typeBadge}>
                  <Text style={styles.typeText}>{(notification.type || 'announcement').toUpperCase()}</Text>
                </View>
              </View>
              <Text style={styles.message}>{notification.message}</Text>
              <View style={styles.meta}>
                <Text style={styles.metaText}>{notification.targetAudience || 'all'}</Text>
                <Text style={styles.metaText}> · </Text>
                <Text style={styles.metaText}>{new Date(notification.createdAt).toLocaleDateString()}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Send Notice</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="Notice title"
                placeholderTextColor="#94a3b8"
                value={formData.title}
                onChangeText={(t) => setFormData({ ...formData, title: t })}
              />
              <Text style={styles.label}>Message *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Your message"
                placeholderTextColor="#94a3b8"
                value={formData.message}
                onChangeText={(t) => setFormData({ ...formData, message: t })}
                multiline
                numberOfLines={5}
              />
              <Text style={styles.label}>Type</Text>
              <View style={styles.chipRow}>
                {['announcement', 'alert', 'reminder', 'emergency'].map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.chip, formData.type === t && styles.chipActive]}
                    onPress={() => setFormData({ ...formData, type: t })}
                  >
                    <Text style={[styles.chipText, formData.type === t && styles.chipTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.label}>Priority</Text>
              <View style={styles.chipRow}>
                {['low', 'medium', 'high', 'urgent'].map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.chip, formData.priority === p && styles.chipActive]}
                    onPress={() => setFormData({ ...formData, priority: p })}
                  >
                    <Text style={[styles.chipText, formData.priority === p && styles.chipTextActive]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.label}>Target audience</Text>
              <View style={styles.chipRow}>
                {['all', 'students', 'staff', 'wardens'].map((a) => (
                  <TouchableOpacity
                    key={a}
                    style={[styles.chip, formData.targetAudience === a && styles.chipActive]}
                    onPress={() => setFormData({ ...formData, targetAudience: a })}
                  >
                    <Text style={[styles.chipText, formData.targetAudience === a && styles.chipTextActive]}>{a}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, sending && styles.submitBtnDisabled]}
                onPress={handleSend}
                disabled={sending}
              >
                <Text style={styles.submitBtnText}>{sending ? 'Sending…' : 'Send Notice'}</Text>
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
  header: { backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  headerSubtitle: { fontSize: 13, color: '#64748b', marginTop: 4, marginBottom: 12 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0a7ea4',
    paddingVertical: 14,
    borderRadius: 12,
  },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  empty: { alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 16, color: '#64748b' },
  emptySubtext: { fontSize: 14, color: '#94a3b8', marginTop: 8 },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a', flex: 1 },
  typeBadge: { backgroundColor: '#0a7ea4', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  typeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  message: { fontSize: 14, color: '#475569', marginBottom: 8 },
  meta: { flexDirection: 'row', flexWrap: 'wrap' },
  metaText: { fontSize: 12, color: '#94a3b8' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  modalScroll: { padding: 16, maxHeight: 360 },
  label: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, fontSize: 16, color: '#0f172a', marginBottom: 14 },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#f1f5f9' },
  chipActive: { backgroundColor: '#0a7ea4' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  chipTextActive: { color: '#fff' },
  modalFooter: { flexDirection: 'row', gap: 12, padding: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#f1f5f9', alignItems: 'center' },
  cancelBtnText: { fontSize: 16, fontWeight: '600', color: '#475569' },
  submitBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#0a7ea4', alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
