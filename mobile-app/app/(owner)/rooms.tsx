import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api, { getApiErrorMessage } from '../../services/api';

const HOSTEL_ALL = '';
const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'available', label: 'Available' },
  { value: 'occupied', label: 'Occupied' },
  { value: 'maintenance', label: 'Maintenance' },
];
const CATEGORY_OPTIONS = [
  { value: '', label: 'All Categories' },
  { value: 'Standard', label: 'Standard' },
  { value: 'AC', label: 'AC' },
  { value: 'Non-AC', label: 'Non-AC' },
  { value: 'Deluxe', label: 'Deluxe' },
];

function getStatusColor(status: string) {
  switch (status) {
    case 'available':
      return '#22c55e';
    case 'occupied':
      return '#3b82f6';
    case 'maintenance':
      return '#eab308';
    default:
      return '#64748b';
  }
}

function getOccupancy(room: any) {
  const studentsCount = Array.isArray(room.students) ? room.students.length : 0;
  return studentsCount > 0 ? studentsCount : (room.currentOccupancy ?? 0);
}

export default function RoomsScreen() {
  const router = useRouter();
  const [rooms, setRooms] = useState<any[]>([]);
  const [hostels, setHostels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    hostelId: HOSTEL_ALL,
    status: '',
    category: '',
    search: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [hostelsRes, roomsRes] = await Promise.all([
        api.getHostels(),
        api.getRooms({
          hostelId: filters.hostelId || undefined,
          status: filters.status || undefined,
          category: filters.category || undefined,
        }),
      ]);
      const hostelsList = Array.isArray(hostelsRes) ? hostelsRes : hostelsRes?.data ?? [];
      const roomsList = Array.isArray(roomsRes) ? roomsRes : roomsRes ?? [];
      setHostels(hostelsList);
      setRooms(roomsList);
    } catch (e: any) {
      Alert.alert('Error', getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters.hostelId, filters.status, filters.category]);

  const filteredRooms = rooms.filter((room) => {
    if (filters.search.trim()) {
      const q = filters.search.toLowerCase();
      const roomNum = (room.roomNumber ?? '').toLowerCase();
      const blockStr = typeof room.blockId === 'string'
        ? room.blockId
        : (room.blockId?.name ?? '').toLowerCase();
      if (!roomNum.includes(q) && !blockStr.includes(q)) return false;
    }
    return true;
  });

  const handleDelete = (room: any) => {
    Alert.alert(
      'Delete Room',
      `Delete room ${room.roomNumber}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteRoom(room._id || room.id);
              loadData();
            } catch (e: any) {
              Alert.alert('Error', getApiErrorMessage(e));
            }
          },
        },
      ]
    );
  };

  const hostelName = (room: any) => {
    const h = room.hostelId;
    if (!h) return '—';
    return typeof h === 'object' && h?.name ? h.name : String(h);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} />}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Room Management</Text>
          <Text style={styles.headerSubtitle}>Manage all rooms across your hostels</Text>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => router.push('/(owner)/room-create' as any)}
          >
            <Ionicons name="add" size={22} color="#fff" />
            <Text style={styles.createButtonText}>Create Room</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.filtersCard}>
          <Text style={styles.filterLabel}>Hostel</Text>
          <View style={styles.pickerRow}>
            <Ionicons name="business-outline" size={18} color="#64748b" />
            <View style={styles.pickerWrap}>
              <TouchableOpacity
                style={styles.picker}
                onPress={() => {
                  const options = [
                    { label: 'All Hostels', value: HOSTEL_ALL },
                    ...hostels.map((h) => ({
                      label: h.name,
                      value: h._id || h.id,
                    })),
                  ];
                  Alert.alert(
                    'Select Hostel',
                    undefined,
                    [
                      ...options.map((o) => ({
                        text: o.label,
                        onPress: () => setFilters((f) => ({ ...f, hostelId: o.value })),
                      })),
                      { text: 'Cancel', style: 'cancel' },
                    ]
                  );
                }}
              >
                <Text style={styles.pickerText}>
                  {filters.hostelId
                    ? hostels.find((h) => (h._id || h.id) === filters.hostelId)?.name ?? 'Select'
                    : 'All Hostels'}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#64748b" />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.filterLabel}>Status</Text>
          <View style={styles.pickerRow}>
            <Ionicons name="flag-outline" size={18} color="#64748b" />
            <View style={styles.pickerWrap}>
              <TouchableOpacity
                style={styles.picker}
                onPress={() => {
                  Alert.alert(
                    'Status',
                    undefined,
                    STATUS_OPTIONS.map((o) => ({
                      text: o.label,
                      onPress: () => setFilters((f) => ({ ...f, status: o.value })),
                    }))
                  );
                }}
              >
                <Text style={styles.pickerText}>
                  {STATUS_OPTIONS.find((o) => o.value === filters.status)?.label ?? 'All Status'}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#64748b" />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.filterLabel}>Category</Text>
          <View style={styles.pickerRow}>
            <Ionicons name="pricetag-outline" size={18} color="#64748b" />
            <View style={styles.pickerWrap}>
              <TouchableOpacity
                style={styles.picker}
                onPress={() => {
                  Alert.alert(
                    'Category',
                    undefined,
                    CATEGORY_OPTIONS.map((o) => ({
                      text: o.label,
                      onPress: () => setFilters((f) => ({ ...f, category: o.value })),
                    }))
                  );
                }}
              >
                <Text style={styles.pickerText}>
                  {CATEGORY_OPTIONS.find((o) => o.value === filters.category)?.label ??
                    'All Categories'}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#64748b" />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.filterLabel}>Search</Text>
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={20} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Room number or block..."
              placeholderTextColor="#94a3b8"
              value={filters.search}
              onChangeText={(t) => setFilters((f) => ({ ...f, search: t }))}
            />
          </View>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#0a7ea4" />
          </View>
        ) : filteredRooms.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="bed-outline" size={56} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>No rooms found</Text>
            <Text style={styles.emptySubtext}>
              Get started by creating your first room
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.push('/(owner)/room-create' as any)}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.emptyButtonText}>Create Room</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.list}>
            {filteredRooms.map((room) => {
              const occupancy = getOccupancy(room);
              const capacity = room.capacity ?? 0;
              const status = room.status || 'available';
              return (
                <TouchableOpacity
                  key={room._id || room.id}
                  style={styles.card}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/(owner)/room-detail/${room._id || room.id}` as any)}
                >
                  <View style={styles.cardTop}>
                    <Text style={styles.roomNumber}>{room.roomNumber}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(status) }]}>
                      <Text style={styles.statusText}>{status}</Text>
                    </View>
                  </View>
                  <Text style={styles.hostelName}>{hostelName(room)}</Text>
                  <Text style={styles.meta}>
                    Floor {room.floorNumber ?? '—'}
                    {room.blockId ? ` · ${typeof room.blockId === 'object' ? room.blockId?.name : room.blockId}` : ''}
                  </Text>
                  <View style={styles.row}>
                    <Text style={styles.categoryBadge}>{room.category || 'Standard'}</Text>
                    <Text style={styles.capacity}>
                      {occupancy}/{capacity}
                    </Text>
                  </View>
                  <Text style={styles.pricing}>
                    ₹{room.pricing?.monthly ?? 0}/mo
                    {room.pricing?.yearly ? ` · ₹${room.pricing.yearly}/yr` : ''}
                  </Text>
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        router.push(`/(owner)/room-detail/${room._id || room.id}` as any);
                      }}
                    >
                      <Ionicons name="eye-outline" size={20} color="#0a7ea4" />
                      <Text style={styles.actionText}>View</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        router.push(`/(owner)/room-edit/${room._id || room.id}` as any);
                      }}
                    >
                      <Ionicons name="pencil-outline" size={20} color="#16a34a" />
                      <Text style={[styles.actionText, { color: '#16a34a' }]}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleDelete(room);
                      }}
                    >
                      <Ionicons name="trash-outline" size={20} color="#dc2626" />
                      <Text style={[styles.actionText, { color: '#dc2626' }]}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  scrollView: { flex: 1 },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  headerSubtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0a7ea4',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginTop: 12,
  },
  createButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  filtersCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  filterLabel: { fontSize: 13, fontWeight: '600', color: '#475569' },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pickerWrap: { flex: 1 },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  pickerText: { fontSize: 15, color: '#0f172a' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 15, color: '#0f172a' },
  centered: { padding: 40, alignItems: 'center' },
  empty: {
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#334155', marginTop: 12 },
  emptySubtext: { fontSize: 14, color: '#64748b', marginTop: 6 },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0a7ea4',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 16,
  },
  emptyButtonText: { color: '#fff', fontWeight: '600' },
  list: { padding: 16, paddingTop: 0, gap: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  roomNumber: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  hostelName: { fontSize: 14, color: '#475569', marginBottom: 2 },
  meta: { fontSize: 13, color: '#64748b', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  categoryBadge: { fontSize: 12, color: '#0a7ea4', fontWeight: '600' },
  capacity: { fontSize: 13, color: '#64748b' },
  pricing: { fontSize: 14, fontWeight: '600', color: '#16a34a', marginBottom: 12 },
  actions: { flexDirection: 'row', gap: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: 14, color: '#0a7ea4', fontWeight: '500' },
});
