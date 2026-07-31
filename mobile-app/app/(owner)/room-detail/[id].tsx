import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import api, { getApiErrorMessage } from '../../../services/api';

function getStatusColor(status: string) {
  switch (status) {
    case 'available': return '#22c55e';
    case 'occupied': return '#3b82f6';
    case 'maintenance': return '#eab308';
    default: return '#64748b';
  }
}

function getOccupancy(room: any) {
  const n = Array.isArray(room?.students) ? room.students.length : 0;
  return n > 0 ? n : (room?.currentOccupancy ?? 0);
}

export default function RoomDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [room, setRoom] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const loadRoom = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await api.getRoom(id);
      setRoom(data ?? null);
    } catch (e: any) {
      Alert.alert('Error', getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoom();
  }, [id]);

  const handleDelete = () => {
    Alert.alert(
      'Delete Room',
      `Delete room ${room?.roomNumber}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteRoom(id!);
              router.replace('/(owner)/rooms' as any);
            } catch (e: any) {
              Alert.alert('Error', getApiErrorMessage(e));
            }
          },
        },
      ]
    );
  };

  const handleImageUpload = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo library access to upload images.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.length) return;
      setUploading(true);
      const fd = new FormData();
      result.assets.forEach((asset, i) => {
        const name = asset.uri.split('/').pop() || `img_${i}.jpg`;
        const match = /\.(\w+)$/.exec(name);
        const type = match ? `image/${match[1]}` : 'image/jpeg';
        fd.append('images', { uri: asset.uri, name, type } as any);
      });
      await api.uploadRoomImages(id!, fd);
      loadRoom();
    } catch (e: any) {
      Alert.alert('Error', getApiErrorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteImage = (imageUrl: string) => {
    Alert.alert('Delete Image', 'Remove this image?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteRoomImage(id!, imageUrl);
            loadRoom();
          } catch (e: any) {
            Alert.alert('Error', getApiErrorMessage(e));
          }
        },
      },
    ]);
  };

  const handleSetCover = async (imageUrl: string) => {
    try {
      await api.setRoomCoverImage(id!, imageUrl);
      loadRoom();
    } catch (e: any) {
      Alert.alert('Error', getApiErrorMessage(e));
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0a7ea4" />
      </View>
    );
  }

  if (!room) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFound}>Room not found</Text>
        <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>Back to Rooms</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const coverImage = room.coverImage || (room.images?.length ? room.images[0] : null);
  const occupancy = getOccupancy(room);
  const status = room.status || 'available';
  const hostelName = room.hostelId
    ? (typeof room.hostelId === 'object' && room.hostelId?.name ? room.hostelId.name : String(room.hostelId))
    : '—';

  return (
    <ScrollView style={styles.container}>
      <View style={styles.hero}>
        {coverImage ? (
          <Image source={{ uri: coverImage }} style={styles.coverImage} />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Ionicons name="bed-outline" size={64} color="rgba(255,255,255,0.6)" />
          </View>
        )}
        <View style={styles.heroOverlay} />
        <View style={styles.heroContent}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.heroHostel}>{hostelName}</Text>
          <View style={styles.heroRow}>
            <Text style={styles.heroTitle}>Room {room.roomNumber}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(status) }]}>
              <Text style={styles.statusText}>{status}</Text>
            </View>
          </View>
          <Text style={styles.heroMeta}>
            {room.blockId ? `${typeof room.blockId === 'object' ? room.blockId?.name : room.blockId} · ` : ''}
            Floor {room.floorNumber} · {occupancy}/{room.capacity}
          </Text>
          <View style={styles.heroActions}>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => router.push(`/(owner)/room-edit/${id}` as any)}
            >
              <Ionicons name="pencil" size={18} color="#0f172a" />
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={18} color="#fff" />
              <Text style={styles.deleteBtnText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Assigned Students</Text>
        <Text style={styles.sectionSubtitle}>
          {occupancy} / {room.capacity} occupied
        </Text>
        {room.students?.length > 0 ? (
          room.students.map((s: any) => (
            <TouchableOpacity
              key={s._id || s.id}
              style={styles.studentCard}
              onPress={() => router.push(`/(owner)/student-edit/${s._id || s.id}` as any)}
            >
              <View style={styles.studentAvatar}>
                <Text style={styles.studentAvatarText}>{(s.name || 'S').charAt(0)}</Text>
              </View>
              <View style={styles.studentInfo}>
                <Text style={styles.studentName}>{s.name}</Text>
                <Text style={styles.studentEmail} numberOfLines={1}>{s.email}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyBox}>
            <Ionicons name="people-outline" size={40} color="#cbd5e1" />
            <Text style={styles.emptyText}>No students assigned</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Photo Gallery</Text>
          <TouchableOpacity
            style={styles.uploadBtn}
            onPress={handleImageUpload}
            disabled={uploading}
          >
            <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
            <Text style={styles.uploadBtnText}>{uploading ? 'Uploading...' : 'Upload'}</Text>
          </TouchableOpacity>
        </View>
        {room.images?.length > 0 ? (
          <View style={styles.gallery}>
            {room.images.map((url: string, index: number) => (
              <View key={index} style={styles.galleryItem}>
                <Image source={{ uri: url }} style={styles.galleryImage} />
                {room.coverImage === url && (
                  <View style={styles.coverTag}>
                    <Ionicons name="star" size={12} color="#fff" />
                    <Text style={styles.coverTagText}>Cover</Text>
                  </View>
                )}
                <View style={styles.galleryActions}>
                  <TouchableOpacity
                    style={styles.galleryActionBtn}
                    onPress={() => handleSetCover(url)}
                  >
                    <Text style={styles.galleryActionText}>Set Cover</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.galleryActionBtn, styles.galleryActionBtnDanger]}
                    onPress={() => handleDeleteImage(url)}
                  >
                    <Ionicons name="trash-outline" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyBox}>
            <Ionicons name="images-outline" size={40} color="#cbd5e1" />
            <Text style={styles.emptyText}>No images. Upload to showcase this room.</Text>
            <TouchableOpacity style={styles.uploadBtnSecondary} onPress={handleImageUpload} disabled={uploading}>
              <Text style={styles.uploadBtnSecondaryText}>Upload</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {room.description ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.bodyText}>{room.description}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Basic Information</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Block</Text>
          <Text style={styles.infoValue}>
            {room.blockId ? (typeof room.blockId === 'object' ? room.blockId?.name : room.blockId) : '—'}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Floor</Text>
          <Text style={styles.infoValue}>Floor {room.floorNumber}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Capacity</Text>
          <Text style={styles.infoValue}>{occupancy} / {room.capacity}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pricing</Text>
        <View style={styles.pricingCard}>
          <Text style={styles.pricingLabel}>Monthly</Text>
          <Text style={styles.pricingValue}>₹{room.pricing?.monthly?.toLocaleString() ?? 0}/mo</Text>
        </View>
        {room.pricing?.perBed ? (
          <View style={styles.pricingCard}>
            <Text style={styles.pricingLabel}>Per Bed</Text>
            <Text style={styles.pricingValue}>₹{room.pricing.perBed.toLocaleString()}/bed</Text>
          </View>
        ) : null}
      </View>

      {room.amenities?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Amenities</Text>
          <View style={styles.amenityWrap}>
            {room.amenities.map((a: string, i: number) => (
              <View key={i} style={styles.amenityChip}>
                <Text style={styles.amenityChipText}>{a}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={styles.bottomPad} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  notFound: { fontSize: 16, color: '#64748b' },
  backLink: { marginTop: 12 },
  backLinkText: { fontSize: 16, color: '#0a7ea4', fontWeight: '600' },
  hero: { height: 260, position: 'relative', backgroundColor: '#0f172a' },
  coverImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  coverPlaceholder: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center',
  },
  heroOverlay: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: 180,
    backgroundColor: 'transparent',
  },
  heroContent: {
    position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: 20,
  },
  backBtn: { alignSelf: 'flex-start', marginBottom: 8 },
  heroHostel: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginBottom: 4 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  heroTitle: { fontSize: 26, fontWeight: '800', color: '#fff' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  heroMeta: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginBottom: 12 },
  heroActions: { flexDirection: 'row', gap: 10 },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.95)', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10,
  },
  editBtnText: { fontWeight: '600', color: '#0f172a', fontSize: 15 },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(220,38,38,0.9)', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10,
  },
  deleteBtnText: { fontWeight: '600', color: '#fff', fontSize: 15 },
  section: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 16, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  sectionSubtitle: { fontSize: 14, color: '#64748b', marginTop: 4, marginBottom: 12 },
  emptyBox: { alignItems: 'center', paddingVertical: 24 },
  emptyText: { fontSize: 14, color: '#64748b', marginTop: 8 },
  studentCard: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#f8fafc', borderRadius: 10, marginBottom: 8 },
  studentAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#0a7ea4', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  studentAvatarText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  studentEmail: { fontSize: 13, color: '#64748b' },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0a7ea4', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8 },
  uploadBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  uploadBtnSecondary: { marginTop: 12, paddingVertical: 10, paddingHorizontal: 20, backgroundColor: '#e2e8f0', borderRadius: 8, alignSelf: 'center' },
  uploadBtnSecondaryText: { color: '#0f172a', fontWeight: '600' },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  galleryItem: { width: '30%', aspectRatio: 1, position: 'relative', borderRadius: 8, overflow: 'hidden' },
  galleryImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  coverTag: { position: 'absolute', top: 6, left: 6, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#0a7ea4', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 6 },
  coverTagText: { fontSize: 10, color: '#fff', fontWeight: '600' },
  galleryActions: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: 6, padding: 6, backgroundColor: 'rgba(0,0,0,0.6)' },
  galleryActionBtn: { flex: 1, paddingVertical: 6, backgroundColor: '#0a7ea4', borderRadius: 6, alignItems: 'center' },
  galleryActionBtnDanger: { flex: 0, paddingHorizontal: 10, backgroundColor: '#dc2626' },
  galleryActionText: { fontSize: 11, color: '#fff', fontWeight: '600' },
  bodyText: { fontSize: 15, color: '#475569', lineHeight: 22 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  infoLabel: { fontSize: 14, color: '#64748b' },
  infoValue: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  pricingCard: { backgroundColor: '#f0fdf4', padding: 14, borderRadius: 10, marginBottom: 10 },
  pricingLabel: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  pricingValue: { fontSize: 18, fontWeight: '700', color: '#16a34a' },
  amenityWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amenityChip: { backgroundColor: '#eff6ff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  amenityChipText: { fontSize: 13, color: '#1e40af', fontWeight: '500' },
  bottomPad: { height: 32 },
});
