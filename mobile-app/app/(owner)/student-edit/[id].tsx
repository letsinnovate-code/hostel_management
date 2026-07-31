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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import api from '../../../services/api';

export default function StudentEditScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hostels, setHostels] = useState<{ _id: string; name: string }[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    hostelId: '',
    roomId: '',
    studentId: '',
    status: 'active',
  });

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        const [userRes, hostelsRes] = await Promise.all([
          api.getUser(id),
          api.getHostels(),
        ]);
        const user = (userRes as any)?.data ?? userRes;
        const list = Array.isArray(hostelsRes) ? hostelsRes : (hostelsRes as any)?.data ?? [];
        setHostels(list);
        setForm({
          name: user.name ?? '',
          email: user.email ?? '',
          phone: user.phone ?? '',
          password: '',
          hostelId: typeof user.hostelId === 'object' ? user.hostelId?._id : user.hostelId ?? '',
          roomId: typeof user.roomId === 'object' ? user.roomId?._id : user.roomId ?? '',
          studentId: user.studentId ?? '',
          status: user.status ?? 'active',
        });
      } catch (error: any) {
        Alert.alert('Error', error?.message || 'Failed to load student');
        router.back();
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    if (!form.hostelId) {
      setRooms([]);
      return;
    }
    (async () => {
      try {
        const res = await api.getRooms({ hostelId: form.hostelId });
        const list = Array.isArray(res) ? res : (res as any)?.data ?? [];
        setRooms(list);
      } catch {
        setRooms([]);
      }
    })();
  }, [form.hostelId]);

  const handleSave = async () => {
    if (!id || !form.name?.trim() || !form.email?.trim() || !form.phone?.trim()) {
      Alert.alert('Required', 'Name, email and phone are required');
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        hostelId: form.hostelId || undefined,
        roomId: form.roomId || undefined,
        studentId: form.studentId?.trim() || undefined,
        status: form.status,
      };
      if (form.password?.trim()) payload.password = form.password;
      await api.updateUser(id, payload);
      Alert.alert('Success', 'Student updated', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to update student');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0a7ea4" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Name *</Text>
        <TextInput
          style={styles.input}
          value={form.name}
          onChangeText={(t) => setForm((f) => ({ ...f, name: t }))}
          placeholder="Full name"
          autoCapitalize="words"
        />
        <Text style={styles.label}>Email *</Text>
        <TextInput
          style={styles.input}
          value={form.email}
          onChangeText={(t) => setForm((f) => ({ ...f, email: t }))}
          placeholder="email@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          editable={false}
        />
        <Text style={styles.hint}>Email cannot be changed</Text>
        <Text style={styles.label}>Phone *</Text>
        <TextInput
          style={styles.input}
          value={form.phone}
          onChangeText={(t) => setForm((f) => ({ ...f, phone: t }))}
          placeholder="10-digit mobile"
          keyboardType="phone-pad"
        />
        <Text style={styles.label}>New password (leave blank to keep current)</Text>
        <TextInput
          style={styles.input}
          value={form.password}
          onChangeText={(t) => setForm((f) => ({ ...f, password: t }))}
          placeholder="••••••••"
          secureTextEntry
        />
        <Text style={styles.label}>Student ID</Text>
        <TextInput
          style={styles.input}
          value={form.studentId}
          onChangeText={(t) => setForm((f) => ({ ...f, studentId: t }))}
          placeholder="Roll / registration number"
        />
        <Text style={styles.label}>Status</Text>
        <View style={styles.statusRow}>
          {['active', 'on-leave', 'exited', 'suspended'].map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.chip, form.status === s && styles.chipActive]}
              onPress={() => setForm((f) => ({ ...f, status: s }))}
            >
              <Text style={[styles.chipText, form.status === s && styles.chipTextActive]}>{s.replace(/-/g, ' ')}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.label}>Hostel</Text>
        <View style={styles.pickerWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {hostels.map((h) => (
              <TouchableOpacity
                key={h._id}
                style={[styles.chip, form.hostelId === h._id && styles.chipActive]}
                onPress={() => setForm((f) => ({ ...f, hostelId: h._id, roomId: '' }))}
              >
                <Text style={[styles.chipText, form.hostelId === h._id && styles.chipTextActive]}>{h.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        <Text style={styles.label}>Room</Text>
        <View style={styles.pickerWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[styles.chip, !form.roomId && styles.chipActive]}
              onPress={() => setForm((f) => ({ ...f, roomId: '' }))}
            >
              <Text style={[styles.chipText, !form.roomId && styles.chipTextActive]}>None</Text>
            </TouchableOpacity>
            {rooms.map((r) => (
              <TouchableOpacity
                key={r._id}
                style={[styles.chip, form.roomId === r._id && styles.chipActive]}
                onPress={() => setForm((f) => ({ ...f, roomId: r._id }))}
              >
                <Text style={[styles.chipText, form.roomId === r._id && styles.chipTextActive]}>
                  {r.roomNumber || r.name || r._id}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        <TouchableOpacity style={styles.submitBtn} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Save Changes</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
  hint: { fontSize: 12, color: '#94a3b8', marginTop: -10, marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 14, fontSize: 16, marginBottom: 16, backgroundColor: '#fff' },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  pickerWrap: { marginBottom: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: '#f1f5f9', marginRight: 8 },
  chipActive: { backgroundColor: '#0a7ea4' },
  chipText: { fontSize: 14, color: '#475569' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  submitBtn: { marginTop: 12, paddingVertical: 16, borderRadius: 12, backgroundColor: '#0a7ea4', alignItems: 'center' },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
