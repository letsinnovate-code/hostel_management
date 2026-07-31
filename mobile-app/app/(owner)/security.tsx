import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const OPTIONS = [
  { label: 'Geo-Fence Setup', path: '/(owner)/geo-fence' as const, icon: 'location-outline' as const, color: '#dc2626', description: 'Set hostel boundary for presence detection' },
  { label: 'Violations', path: '/(owner)/violations' as const, icon: 'warning-outline' as const, color: '#b45309', description: 'View and manage violation records' },
  { label: 'Gate Logs', path: '/(owner)/gate-logs' as const, icon: 'log-in-outline' as const, color: '#0a7ea4', description: 'Check-in and check-out by time' },
  { label: 'All Students (Map)', path: '/(owner)/students-map' as const, icon: 'map-outline' as const, color: '#15803d', description: 'See all students on the map' },
];

export default function SecurityScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Security</Text>
        <Text style={styles.subtitle}>Geo-fence, violations, gate logs and student map</Text>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {OPTIONS.map((item) => (
          <TouchableOpacity
            key={item.path}
            style={styles.card}
            onPress={() => router.push(item.path as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconWrap, { backgroundColor: item.color + '20' }]}>
              <Ionicons name={item.icon} size={28} color={item.color} />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{item.label}</Text>
              <Text style={styles.cardDesc}>{item.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#94a3b8" />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: { backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  iconWrap: { width: 52, height: 52, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  cardDesc: { fontSize: 13, color: '#64748b', marginTop: 4 },
});
