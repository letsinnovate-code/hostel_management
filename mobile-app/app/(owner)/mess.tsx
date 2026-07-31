import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../services/api';

type MessSchedule = {
  _id: string;
  mealType: string;
  title?: string;
  items?: string[];
  startTime: string;
  endTime: string;
  dayOfWeek?: number | null;
  active: boolean;
};

const MEAL_TYPES = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snacks', label: 'Snacks' },
];

export default function OwnerMessScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [hostels, setHostels] = useState<{ _id: string; name: string }[]>([]);
  const [selectedHostelId, setSelectedHostelId] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<MessSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    mealType: 'breakfast',
    title: '',
    itemsText: '',
    startTime: '07:00',
    endTime: '09:00',
  });

  const loadHostels = useCallback(async () => {
    try {
      const res = await api.getHostels();
      const data = res?.data ?? res;
      const list = Array.isArray(data) ? data : (data?.hostels ?? []);
      setHostels(list);
      if (list.length > 0 && !selectedHostelId) setSelectedHostelId(list[0]._id);
    } catch {
      setHostels([]);
    }
  }, [selectedHostelId]);

  const loadSchedules = useCallback(async () => {
    if (!selectedHostelId) return;
    try {
      const data = await api.getMessSchedules(selectedHostelId);
      setSchedules(Array.isArray(data) ? data : []);
    } catch {
      setSchedules([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedHostelId]);

  React.useEffect(() => {
    loadHostels();
  }, []);

  React.useEffect(() => {
    if (selectedHostelId) {
      setLoading(true);
      loadSchedules();
    }
  }, [selectedHostelId, loadSchedules]);

  const onRefresh = () => {
    setRefreshing(true);
    loadHostels().then(() => loadSchedules());
  };

  const openAdd = () => {
    setEditingId(null);
    setForm({
      mealType: 'breakfast',
      title: '',
      itemsText: '',
      startTime: '07:00',
      endTime: '09:00',
    });
    setModalVisible(true);
  };

  const openEdit = (s: MessSchedule) => {
    setEditingId(s._id);
    setForm({
      mealType: s.mealType,
      title: s.title || '',
      itemsText: (s.items || []).join('\n'),
      startTime: s.startTime || '07:00',
      endTime: s.endTime || '09:00',
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!selectedHostelId) return;
    const items = form.itemsText
      .split(/[\n,]+/)
      .map((x) => x.trim())
      .filter(Boolean);
    setSaving(true);
    try {
      if (editingId) {
        await api.updateMessSchedule(selectedHostelId, editingId, {
          mealType: form.mealType,
          title: form.title || undefined,
          items,
          startTime: form.startTime,
          endTime: form.endTime,
        });
        Alert.alert('Success', 'Schedule updated');
      } else {
        await api.createMessSchedule(selectedHostelId, {
          mealType: form.mealType,
          title: form.title || undefined,
          items,
          startTime: form.startTime,
          endTime: form.endTime,
        });
        Alert.alert('Success', 'Schedule added');
      }
      setModalVisible(false);
      loadSchedules();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    if (!selectedHostelId) return;
    Alert.alert('Delete', 'Remove this mess schedule?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteMessSchedule(selectedHostelId, id);
            loadSchedules();
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to delete');
          }
        },
      },
    ]);
  };

  const selectedHostel = hostels.find((h) => h._id === selectedHostelId);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mess Schedule</Text>
      </View>

      {hostels.length > 1 && (
        <View style={styles.pickerRow}>
          <Text style={styles.pickerLabel}>Hostel</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hostelChips}>
            {hostels.map((h) => (
              <TouchableOpacity
                key={h._id}
                style={[styles.chip, selectedHostelId === h._id && styles.chipActive]}
                onPress={() => setSelectedHostelId(h._id)}
              >
                <Text style={[styles.chipText, selectedHostelId === h._id && styles.chipTextActive]} numberOfLines={1}>
                  {h.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#0a7ea4" />
          </View>
        ) : (
          <>
            <TouchableOpacity style={styles.addButton} onPress={openAdd}>
              <Ionicons name="add-circle-outline" size={24} color="#fff" />
              <Text style={styles.addButtonText}>Add meal slot</Text>
            </TouchableOpacity>

            {schedules.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="restaurant-outline" size={48} color="#94a3b8" />
                <Text style={styles.emptyText}>No mess schedule yet. Add meal timings and items.</Text>
              </View>
            ) : (
              schedules.map((s) => (
                <View key={s._id} style={styles.card}>
                  <View style={styles.cardRow}>
                    <Text style={styles.mealTitle}>{s.title || s.mealType}</Text>
                    <View style={styles.cardActions}>
                      <TouchableOpacity onPress={() => openEdit(s)} hitSlop={8}>
                        <Ionicons name="pencil" size={20} color="#0a7ea4" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDelete(s._id)} hitSlop={8}>
                        <Ionicons name="trash-outline" size={20} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text style={styles.timeText}>
                    {s.startTime} – {s.endTime}
                  </Text>
                  {s.items && s.items.length > 0 && (
                    <Text style={styles.itemsText} numberOfLines={3}>
                      {s.items.join(' • ')}
                    </Text>
                  )}
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{editingId ? 'Edit' : 'Add'} meal slot</Text>
            <Text style={styles.inputLabel}>Meal type</Text>
            <View style={styles.mealTypeRow}>
              {MEAL_TYPES.map((m) => (
                <TouchableOpacity
                  key={m.value}
                  style={[styles.mealTypeBtn, form.mealType === m.value && styles.mealTypeBtnActive]}
                  onPress={() => setForm((f) => ({ ...f, mealType: m.value }))}
                >
                  <Text style={[styles.mealTypeBtnText, form.mealType === m.value && styles.mealTypeBtnTextActive]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.inputLabel}>Title (optional)</Text>
            <TextInput
              style={styles.input}
              value={form.title}
              onChangeText={(t) => setForm((f) => ({ ...f, title: t }))}
              placeholder="e.g. Breakfast"
            />
            <Text style={styles.inputLabel}>Start time</Text>
            <TextInput
              style={styles.input}
              value={form.startTime}
              onChangeText={(t) => setForm((f) => ({ ...f, startTime: t }))}
              placeholder="07:00"
            />
            <Text style={styles.inputLabel}>End time</Text>
            <TextInput
              style={styles.input}
              value={form.endTime}
              onChangeText={(t) => setForm((f) => ({ ...f, endTime: t }))}
              placeholder="09:00"
            />
            <Text style={styles.inputLabel}>Items (one per line or comma-separated)</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={form.itemsText}
              onChangeText={(t) => setForm((f) => ({ ...f, itemsText: t }))}
              placeholder="Rice, Dal, Curry"
              multiline
              numberOfLines={4}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backBtn: {
    padding: 4,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  pickerRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  pickerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
  },
  hostelChips: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  chipActive: {
    backgroundColor: '#0a7ea4',
  },
  chipText: {
    fontSize: 14,
    color: '#475569',
  },
  chipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  centered: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0a7ea4',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 12,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mealTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0f172a',
    textTransform: 'capitalize',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 16,
  },
  timeText: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  itemsText: {
    fontSize: 13,
    color: '#475569',
    marginTop: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '85%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#cbd5e1',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#0f172a',
    marginBottom: 16,
  },
  inputMultiline: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  mealTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  mealTypeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  mealTypeBtnActive: {
    backgroundColor: '#0a7ea4',
  },
  mealTypeBtnText: {
    fontSize: 14,
    color: '#475569',
  },
  mealTypeBtnTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#0a7ea4',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
