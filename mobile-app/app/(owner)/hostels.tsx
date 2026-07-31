import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';

function formatAddress(address: any) {
  if (!address) return 'Address not available';
  if (typeof address === 'string') return address;
  if (address.formattedAddress) return address.formattedAddress;
  const parts = [];
  if (address.street) parts.push(address.street);
  if (address.city) parts.push(address.city);
  if (address.state) parts.push(address.state);
  if (address.pincode) parts.push(address.pincode);
  if (address.country && address.country !== 'India') parts.push(address.country);
  return parts.length > 0 ? parts.join(', ') : 'Address not available';
}

function getCoverImage(hostel: any) {
  if (hostel.coverImage) return hostel.coverImage;
  if (hostel.images && Array.isArray(hostel.images) && hostel.images.length > 0) return hostel.images[0];
  return null;
}

function getTypeColor(type: string) {
  switch (type?.toLowerCase()) {
    case 'boys': return { bg: '#dbeafe', text: '#1e40af' };
    case 'girls': return { bg: '#fce7f3', text: '#9d174d' };
    case 'co-ed': return { bg: '#f3e8ff', text: '#6b21a8' };
    default: return { bg: '#f1f5f9', text: '#475569' };
  }
}

function getStatusColor(status: string) {
  switch (status?.toLowerCase()) {
    case 'active': return { bg: '#dcfce7', text: '#166534' };
    case 'inactive': return { bg: '#f1f5f9', text: '#475569' };
    case 'maintenance': return { bg: '#fef3c7', text: '#b45309' };
    default: return { bg: '#f1f5f9', text: '#475569' };
  }
}

export default function HostelsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [hostels, setHostels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadHostels = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await api.getHostels();
      const data = Array.isArray(response) ? response : (response as any)?.data ?? [];
      setHostels(data);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to load hostels');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadHostels();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadHostels(true);
  };

  const openView = (hostel: any) => {
    router.push({ pathname: '/(owner)/hostel-detail', params: { id: hostel._id || hostel.id } } as any);
  };

  const openEdit = (hostel: any) => {
    router.push({ pathname: '/(owner)/hostel-detail', params: { id: hostel._id || hostel.id, edit: '1' } } as any);
  };

  if (loading && hostels.length === 0) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#0a7ea4" />
        <Text style={styles.loadingText}>Loading hostels...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Manage Hostels</Text>
          <Text style={styles.subtitle}>
            {hostels.length} {hostels.length === 1 ? 'hostel' : 'hostels'} total
          </Text>
        </View>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => router.push('/(owner)/hostel-create' as any)}
        >
          <Ionicons name="add" size={22} color="#fff" />
          <Text style={styles.createButtonText}>Create Hostel</Text>
        </TouchableOpacity>
      </View>

      {hostels.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="business-outline" size={64} color="#94a3b8" />
          </View>
          <Text style={styles.emptyTitle}>No hostels found</Text>
          <Text style={styles.emptySubtitle}>Get started by creating your first hostel</Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => router.push('/(owner)/hostel-create' as any)}
          >
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.emptyButtonText}>Create Your First Hostel</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          {hostels.map((hostel, index) => {
            const key = hostel._id || hostel.id || `hostel-${index}`;
            const coverImage = getCoverImage(hostel);
            const capacity = hostel.capacity || 0;
            const occupied = hostel.currentOccupancy || 0;
            const occupancyRate = capacity ? Math.round((occupied / capacity) * 100) : 0;
            const typeStyle = getTypeColor(hostel.type);
            const statusStyle = getStatusColor(hostel.status);

            return (
              <View key={key} style={styles.card}>
                {/* Cover Image */}
                <View style={styles.imageWrap}>
                  {coverImage ? (
                    <Image source={{ uri: coverImage }} style={styles.cardImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.placeholderImage}>
                      <Ionicons name="business-outline" size={48} color="rgba(255,255,255,0.7)" />
                    </View>
                  )}
                  <View style={styles.badges}>
                    {hostel.type && (
                      <View style={[styles.badge, { backgroundColor: typeStyle.bg }]}>
                        <Text style={[styles.badgeText, { color: typeStyle.text }]}>
                          {(hostel.type + '').charAt(0).toUpperCase() + (hostel.type + '').slice(1)}
                        </Text>
                      </View>
                    )}
                    {hostel.status && (
                      <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
                        <Text style={[styles.badgeText, { color: statusStyle.text }]}>
                          {(hostel.status + '').charAt(0).toUpperCase() + (hostel.status + '').slice(1)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Content */}
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{hostel.name || 'Unnamed Hostel'}</Text>
                  <View style={styles.addressRow}>
                    <Ionicons name="location-outline" size={16} color="#94a3b8" />
                    <Text style={styles.addressText} numberOfLines={2}>{formatAddress(hostel.address)}</Text>
                  </View>

                  <View style={styles.statsRow}>
                    <View style={styles.stat}>
                      <Ionicons name="people-outline" size={18} color="#64748b" />
                      <View>
                        <Text style={styles.statLabel}>Capacity</Text>
                        <Text style={styles.statValue}>{capacity || 'N/A'}</Text>
                      </View>
                    </View>
                    <View style={styles.stat}>
                      <Ionicons name="bed-outline" size={18} color="#64748b" />
                      <View>
                        <Text style={styles.statLabel}>Occupied</Text>
                        <Text style={styles.statValue}>{occupied}</Text>
                      </View>
                    </View>
                  </View>

                  {capacity > 0 && (
                    <View style={styles.progressWrap}>
                      <View style={styles.progressLabels}>
                        <Text style={styles.progressLabel}>Occupancy</Text>
                        <Text style={styles.progressPct}>{occupancyRate}%</Text>
                      </View>
                      <View style={styles.progressBar}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: `${Math.min(occupancyRate, 100)}%`,
                              backgroundColor: occupancyRate >= 90 ? '#ef4444' : occupancyRate >= 70 ? '#eab308' : '#22c55e',
                            },
                          ]}
                        />
                      </View>
                    </View>
                  )}

                  <View style={styles.actions}>
                    <TouchableOpacity style={styles.viewButton} onPress={() => openView(hostel)}>
                      <Ionicons name="eye-outline" size={18} color="#475569" />
                      <Text style={styles.viewButtonText}>View</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.editButton} onPress={() => openEdit(hostel)}>
                      <Ionicons name="create-outline" size={18} color="#fff" />
                      <Text style={styles.editButtonText}>Edit</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}
          <View style={styles.bottomPad} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#64748b' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0a7ea4',
    borderRadius: 10,
  },
  createButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyIconWrap: { marginBottom: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#0f172a', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#64748b', marginBottom: 24, textAlign: 'center' },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#0a7ea4',
    borderRadius: 10,
  },
  emptyButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  imageWrap: { height: 180, backgroundColor: '#0ea5e9', position: 'relative' },
  cardImage: { width: '100%', height: '100%' },
  placeholderImage: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: '#0ea5e9' },
  badges: { position: 'absolute', top: 12, left: 12, flexDirection: 'column', gap: 6 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  cardContent: { padding: 16 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 12 },
  addressText: { flex: 1, fontSize: 13, color: '#64748b', lineHeight: 18 },
  statsRow: { flexDirection: 'row', gap: 20, marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statLabel: { fontSize: 11, color: '#64748b' },
  statValue: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  progressWrap: { marginBottom: 14 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  progressLabel: { fontSize: 12, color: '#64748b' },
  progressPct: { fontSize: 12, fontWeight: '600', color: '#0f172a' },
  progressBar: { height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  actions: { flexDirection: 'row', gap: 10 },
  viewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  viewButtonText: { fontSize: 14, fontWeight: '600', color: '#475569' },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#0a7ea4',
  },
  editButtonText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  bottomPad: { height: 16 },
});
