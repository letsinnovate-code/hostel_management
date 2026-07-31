import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import api, { getApiErrorMessage } from '../../services/api';

const DEFAULT_REGION = {
  latitude: 28.6139,
  longitude: 77.209,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

export default function StudentsMapScreen() {
  const router = useRouter();
  const [students, setStudents] = useState<any[]>([]);
  const [hostels, setHostels] = useState<any[]>([]);
  const [hostelId, setHostelId] = useState<string | null>(null);
  const [hostelCenter, setHostelCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getHostels();
        const list = Array.isArray(res) ? res : (res as any)?.data ?? [];
        setHostels(list);
        if (list.length > 0 && !hostelId) setHostelId(list[0]._id || list[0].id);
      } catch {
        setHostels([]);
      }
    })();
  }, []);

  useEffect(() => {
    if (!hostelId) {
      setStudents([]);
      setHostelCenter(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.getStudentLocations({ hostelId }),
      api.getHostel(hostelId),
    ])
      .then(([locationsRes, hostelRes]) => {
        if (cancelled) return;
        const raw = (locationsRes as any)?.data ?? locationsRes;
        const list = Array.isArray(raw) ? raw : [];
        setStudents(list);
        const hostel = (hostelRes as any)?.data ?? hostelRes;
        const lat = hostel?.address?.coordinates?.latitude;
        const lng = hostel?.address?.coordinates?.longitude;
        if (lat != null && lng != null) {
          setHostelCenter({ lat: Number(lat), lng: Number(lng) });
        } else {
          setHostelCenter(null);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          Alert.alert('Error', getApiErrorMessage(e));
          setStudents([]);
          setHostelCenter(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [hostelId]);

  const studentsWithLocation = students.filter(
    (s) => s.currentLocation?.latitude != null && s.currentLocation?.longitude != null
  );
  const region = hostelCenter
    ? {
        latitude: hostelCenter.lat,
        longitude: hostelCenter.lng,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }
    : DEFAULT_REGION;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.title}>All Students (Map)</Text>
        <Text style={styles.subtitle}>Student locations for selected hostel</Text>
      </View>

      {hostels.length > 1 && (
        <View style={styles.hostelRow}>
          <Text style={styles.label}>Hostel</Text>
          <TouchableOpacity
            style={styles.picker}
            onPress={() =>
              Alert.alert(
                'Hostel',
                undefined,
                hostels.map((h) => ({ text: h.name, onPress: () => setHostelId(h._id || h.id) }))
              )
            }
          >
            <Text style={styles.pickerText}>{hostels.find((h) => (h._id || h.id) === hostelId)?.name ?? 'Select'}</Text>
            <Ionicons name="chevron-down" size={20} color="#64748b" />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.mapWrap}>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#0a7ea4" />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : (
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={region}
            region={region}
            showsUserLocation={false}
            onMapReady={() => {
              if (hostelCenter && mapRef.current) {
                mapRef.current.animateToRegion(region, 300);
              }
            }}
          >
            {hostelCenter && (
              <Marker
                coordinate={{ latitude: hostelCenter.lat, longitude: hostelCenter.lng }}
                title="Hostel"
                pinColor="#0a7ea4"
              />
            )}
            {studentsWithLocation.map((s) => (
              <Marker
                key={s._id}
                coordinate={{
                  latitude: Number(s.currentLocation.latitude),
                  longitude: Number(s.currentLocation.longitude),
                }}
                title={s.name ?? 'Student'}
                description={s.email ?? s.studentId ?? ''}
                pinColor="#15803d"
              />
            ))}
          </MapView>
        )}
      </View>
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {studentsWithLocation.length} student(s) with location · {students.length} total in hostel
        </Text>
      </View>
    </View>
  );
}

const { width, height } = Dimensions.get('window');
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: { backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  backBtn: { marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  hostelRow: { padding: 16, paddingTop: 12 },
  label: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 8 },
  picker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: '#fff' },
  pickerText: { fontSize: 16, color: '#0f172a' },
  mapWrap: { flex: 1, minHeight: 300 },
  map: { width: '100%', height: '100%', minHeight: 300 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 300 },
  loadingText: { marginTop: 8, fontSize: 14, color: '#64748b' },
  footer: { padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  footerText: { fontSize: 13, color: '#64748b', textAlign: 'center' },
});
