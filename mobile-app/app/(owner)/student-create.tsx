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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';

export default function StudentCreateScreen() {
  const router = useRouter();
  const [hostels, setHostels] = useState<{ _id: string; name: string }[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    hostelId: '',
    roomId: '',
    studentId: '',
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getHostels();
        const list = Array.isArray(res) ? res : (res as any)?.data ?? [];
        setHostels(list);
        if (list.length > 0 && !form.hostelId) setForm((f) => ({ ...f, hostelId: list[0]._id }));
      } catch {
        setHostels([]);
      }
    })();
  }, []);

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

  const handleCreate = async () => {
    if (!form.name?.trim() || !form.email?.trim() || !form.phone?.trim()) {
      Alert.alert('Required', 'Please enter name, email and phone');
      return;
    }
    if (!form.password?.trim()) {
      Alert.alert('Required', 'Please set a password for the student');
      return;
    }
    setLoading(true);
    try {
      await api.createUser({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        password: form.password,
        role: 'student',
        status: 'active',
        hostelId: form.hostelId || undefined,
        roomId: form.roomId || undefined,
        studentId: form.studentId?.trim() || undefined,
      });
      Alert.alert('Success', 'Student created. A welcome email has been sent.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to create student');
    } finally {
      setLoading(false);
    }
  };

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
        />
        <Text style={styles.label}>Phone *</Text>
        <TextInput
          style={styles.input}
          value={form.phone}
          onChangeText={(t) => setForm((f) => ({ ...f, phone: t }))}
          placeholder="10-digit mobile"
          keyboardType="phone-pad"
        />
        <Text style={styles.label}>Password *</Text>
        <TextInput
          style={styles.input}
          value={form.password}
          onChangeText={(t) => setForm((f) => ({ ...f, password: t }))}
          placeholder="Temporary password (sent in welcome email)"
          secureTextEntry
        />
        <Text style={styles.label}>Student ID (optional)</Text>
        <TextInput
          style={styles.input}
          value={form.studentId}
          onChangeText={(t) => setForm((f) => ({ ...f, studentId: t }))}
          placeholder="Roll / registration number"
        />
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
        <Text style={styles.label}>Room (optional)</Text>
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
        <TouchableOpacity style={styles.submitBtn} onPress={handleCreate} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Create Student</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 14, fontSize: 16, marginBottom: 16, backgroundColor: '#fff' },
  pickerWrap: { marginBottom: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: '#f1f5f9', marginRight: 8 },
  chipActive: { backgroundColor: '#0a7ea4' },
  chipText: { fontSize: 14, color: '#475569' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  submitBtn: { marginTop: 12, paddingVertical: 16, borderRadius: 12, backgroundColor: '#0a7ea4', alignItems: 'center' },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
