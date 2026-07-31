import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import api, { getApiErrorMessage } from '../../../services/api';

const TABS = [
  { id: 'basic', label: 'Basic', icon: 'home-outline' as const },
  { id: 'pricing', label: 'Pricing', icon: 'wallet-outline' as const },
  { id: 'images', label: 'Images', icon: 'images-outline' as const },
];

const AMENITIES = ['WiFi', 'AC', 'TV', 'Attached Bathroom', 'Balcony', 'Study Table', 'Wardrobe', 'Geyser'];

const defaultForm = {
  roomNumber: '',
  blockId: '',
  floorNumber: 1,
  capacity: 2,
  category: 'Standard',
  status: 'available',
  pricing: { monthly: 0, yearly: 0, perBed: 0 },
  amenities: [] as string[],
  description: '',
};

export default function RoomEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('basic');
  const [form, setForm] = useState(defaultForm);
  const [hostels, setHostels] = useState<any[]>([]);
  const [selectedHostelId, setSelectedHostelId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [hostelsRes, roomRes] = await Promise.all([
        api.getHostels(),
        api.getRoom(id),
      ]);
      const hostelsList = Array.isArray(hostelsRes) ? hostelsRes : hostelsRes?.data ?? [];
      setHostels(hostelsList);
      const room = roomRes as any;
      if (room) {
        const blockIdVal = typeof room.blockId === 'string'
          ? room.blockId
          : room.blockId?._id || room.blockId?.name || '';
        const hostelIdVal = room.hostelId
          ? (typeof room.hostelId === 'object' ? room.hostelId?._id : room.hostelId)
          : hostelsList[0]?._id || hostelsList[0]?.id;
        setSelectedHostelId(String(hostelIdVal || ''));
        setForm({
          roomNumber: room.roomNumber || '',
          blockId: blockIdVal,
          floorNumber: room.floorNumber ?? 1,
          capacity: room.capacity ?? 2,
          category: room.category || 'Standard',
          status: room.status || 'available',
          pricing: {
            monthly: room.pricing?.monthly ?? 0,
            yearly: room.pricing?.yearly ?? 0,
            perBed: room.pricing?.perBed ?? 0,
          },
          amenities: room.amenities || [],
          description: room.description || '',
        });
      }
    } catch (e: any) {
      Alert.alert('Error', getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const pickImages = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo library access to add room images.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.length)
        setImageUris((prev) => [...prev, ...result.assets!.map((a) => a.uri)]);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to pick images');
    }
  };

  const removeNewImage = (i: number) => setImageUris((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    const roomNumber = form.roomNumber?.trim();
    if (!roomNumber) {
      Alert.alert('Required', 'Please enter room number');
      setActiveTab('basic');
      return;
    }
    if (!selectedHostelId) {
      Alert.alert('Required', 'Please select a hostel');
      setActiveTab('basic');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        roomNumber,
        hostelId: selectedHostelId,
        blockId: form.blockId?.trim() || undefined,
        floorNumber: Number(form.floorNumber) || 1,
        capacity: Number(form.capacity) || 2,
        category: form.category,
        status: form.status,
        description: form.description?.trim() || undefined,
        amenities: form.amenities,
        pricing: {
          monthly: Number(form.pricing.monthly) || 0,
          yearly: Number(form.pricing.yearly) || Number(form.pricing.monthly) * 12,
          perBed: Number(form.pricing.perBed) || (form.capacity > 0 ? Number(form.pricing.monthly) / form.capacity : 0),
        },
      };
      await api.updateRoom(id!, payload);
      if (imageUris.length > 0) {
        setUploadingImages(true);
        const fd = new FormData();
        imageUris.forEach((uri, index) => {
          const name = uri.split('/').pop() || `image_${index}.jpg`;
          const match = /\.(\w+)$/.exec(name);
          const type = match ? `image/${match[1]}` : 'image/jpeg';
          fd.append('images', { uri, name, type } as any);
        });
        await api.uploadRoomImages(id!, fd);
        setUploadingImages(false);
      }
      Alert.alert('Success', 'Room updated successfully', [
        { text: 'View Room', onPress: () => router.replace(`/(owner)/room-detail/${id}` as any) },
        { text: 'Back', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const toggleAmenity = (a: string) => {
    setForm((f) => ({
      ...f,
      amenities: f.amenities.includes(a) ? f.amenities.filter((x) => x !== a) : [...f.amenities, a],
    }));
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0a7ea4" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Room</Text>
        <Text style={styles.headerSubtitle}>Update room details</Text>
      </View>

      <View style={styles.tabs}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tab, activeTab === t.id && styles.tabActive]}
            onPress={() => setActiveTab(t.id)}
          >
            <Ionicons name={t.icon} size={18} color={activeTab === t.id ? '#0a7ea4' : '#64748b'} />
            <Text style={[styles.tabText, activeTab === t.id && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {activeTab === 'basic' && (
          <View style={styles.section}>
            <Text style={styles.label}>Room Number *</Text>
            <TextInput
              style={styles.input}
              value={form.roomNumber}
              onChangeText={(t) => setForm({ ...form, roomNumber: t })}
              placeholder="e.g. 101"
              placeholderTextColor="#94a3b8"
            />
            <Text style={styles.label}>Hostel *</Text>
            <TouchableOpacity
              style={styles.picker}
              onPress={() => {
                const opts = hostels.map((h) => ({ label: h.name, id: String(h._id || h.id) }));
                Alert.alert('Select Hostel', undefined, [
                  ...opts.map((o) => ({ text: o.label, onPress: () => setSelectedHostelId(o.id) })),
                  { text: 'Cancel', style: 'cancel' },
                ]);
              }}
            >
              <Text style={styles.pickerText}>
                {hostels.find((h) => (h._id || h.id) === selectedHostelId)?.name ?? 'Select hostel'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#64748b" />
            </TouchableOpacity>
            <Text style={styles.label}>Block (optional)</Text>
            <TextInput
              style={styles.input}
              value={form.blockId}
              onChangeText={(t) => setForm({ ...form, blockId: t })}
              placeholder="e.g. Block A"
              placeholderTextColor="#94a3b8"
            />
            <Text style={styles.label}>Floor Number *</Text>
            <TextInput
              style={styles.input}
              value={String(form.floorNumber)}
              onChangeText={(t) => setForm({ ...form, floorNumber: parseInt(t, 10) || 1 })}
              keyboardType="number-pad"
              placeholderTextColor="#94a3b8"
            />
            <Text style={styles.label}>Capacity *</Text>
            <TextInput
              style={styles.input}
              value={String(form.capacity)}
              onChangeText={(t) => setForm({ ...form, capacity: parseInt(t, 10) || 2 })}
              keyboardType="number-pad"
              placeholderTextColor="#94a3b8"
            />
            <Text style={styles.label}>Category *</Text>
            <View style={styles.chipRow}>
              {['Standard', 'AC', 'Non-AC', 'Deluxe'].map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.chip, form.category === c && styles.chipActive]}
                  onPress={() => setForm({ ...form, category: c })}
                >
                  <Text style={[styles.chipText, form.category === c && styles.chipTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>Status *</Text>
            <View style={styles.chipRow}>
              {['available', 'occupied', 'maintenance'].map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.chip, form.status === s && styles.chipActive]}
                  onPress={() => setForm({ ...form, status: s })}
                >
                  <Text style={[styles.chipText, form.status === s && styles.chipTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={form.description}
              onChangeText={(t) => setForm({ ...form, description: t })}
              placeholder="Room description..."
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={3}
            />
            <Text style={styles.label}>Amenities</Text>
            <View style={styles.chipRowWrap}>
              {AMENITIES.map((a) => (
                <TouchableOpacity
                  key={a}
                  style={[styles.chip, form.amenities.includes(a) && styles.chipActive]}
                  onPress={() => toggleAmenity(a)}
                >
                  <Text style={[styles.chipText, form.amenities.includes(a) && styles.chipTextActive]}>{a}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {activeTab === 'pricing' && (
          <View style={styles.section}>
            <Text style={styles.label}>Monthly Rent (₹)</Text>
            <TextInput
              style={styles.input}
              value={form.pricing.monthly ? String(form.pricing.monthly) : ''}
              onChangeText={(t) => {
                const m = Number(t) || 0;
                setForm({
                  ...form,
                  pricing: {
                    ...form.pricing,
                    monthly: m,
                    perBed: form.capacity > 0 ? m / form.capacity : 0,
                  },
                });
              }}
              keyboardType="decimal-pad"
              placeholderTextColor="#94a3b8"
            />
            <Text style={styles.label}>Yearly Rent (₹)</Text>
            <TextInput
              style={styles.input}
              value={form.pricing.yearly ? String(form.pricing.yearly) : ''}
              onChangeText={(t) => setForm({ ...form, pricing: { ...form.pricing, yearly: Number(t) || 0 } })}
              keyboardType="decimal-pad"
              placeholderTextColor="#94a3b8"
            />
            <Text style={styles.label}>Per Bed (₹)</Text>
            <TextInput
              style={styles.input}
              value={form.pricing.perBed ? String(form.pricing.perBed) : ''}
              onChangeText={(t) => setForm({ ...form, pricing: { ...form.pricing, perBed: Number(t) || 0 } })}
              keyboardType="decimal-pad"
              placeholderTextColor="#94a3b8"
            />
          </View>
        )}

        {activeTab === 'images' && (
          <View style={styles.section}>
            <Text style={styles.label}>Add more photos (optional)</Text>
            <TouchableOpacity style={styles.addImageBtn} onPress={pickImages}>
              <Ionicons name="add-circle-outline" size={40} color="#0a7ea4" />
              <Text style={styles.addImageText}>Add images</Text>
            </TouchableOpacity>
            <View style={styles.imageList}>
              {imageUris.map((uri, i) => (
                <View key={i} style={styles.imageWrap}>
                  <Image source={{ uri }} style={styles.thumb} />
                  <TouchableOpacity style={styles.removeImage} onPress={() => removeNewImage(i)}>
                    <Ionicons name="close-circle" size={28} color="#dc2626" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
            <Text style={styles.hint}>Existing images can be managed from the room detail screen.</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitBtn, (saving || uploadingImages) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={saving || uploadingImages}
        >
          {(saving || uploadingImages) ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="save-outline" size={22} color="#fff" />
              <Text style={styles.submitText}>Save Changes</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  backBtn: { marginBottom: 8 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  headerSubtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 8, gap: 4 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#0a7ea4' },
  tabText: { fontSize: 14, color: '#64748b', fontWeight: '500' },
  tabTextActive: { color: '#0a7ea4', fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 24 },
  section: { backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 12 },
  label: { fontSize: 14, fontWeight: '600', color: '#475569' },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: '#0f172a' },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  picker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12 },
  pickerText: { fontSize: 16, color: '#0f172a' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipRowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#f1f5f9' },
  chipActive: { backgroundColor: '#0a7ea4' },
  chipText: { fontSize: 14, color: '#64748b', fontWeight: '500' },
  chipTextActive: { color: '#fff' },
  addImageBtn: { alignItems: 'center', justifyContent: 'center', padding: 24, borderWidth: 2, borderStyle: 'dashed', borderColor: '#cbd5e1', borderRadius: 12 },
  addImageText: { marginTop: 8, fontSize: 14, color: '#64748b' },
  imageList: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  imageWrap: { position: 'relative' },
  thumb: { width: 80, height: 80, borderRadius: 8 },
  removeImage: { position: 'absolute', top: -8, right: -8 },
  hint: { fontSize: 13, color: '#64748b', marginTop: 8 },
  footer: { padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#0a7ea4', paddingVertical: 14, borderRadius: 10 },
  submitBtnDisabled: { opacity: 0.7 },
  submitText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
