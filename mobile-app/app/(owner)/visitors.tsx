import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import { getApiErrorMessage } from '../../services/api';

interface VisitorRequest {
  _id: string;
  visitorName: string;
  visitorPhone: string;
  purpose: string;
  visitDate?: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  rejectionReason?: string;
  createdAt: string;
  visitingStudentId?: { name: string; roomId?: { roomNumber?: string }; hostelId?: { name?: string } };
  approvedBy?: { name: string };
}

export default function OwnerVisitorsScreen() {
  const [visitors, setVisitors] = useState<VisitorRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending'>('pending');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ visitor: VisitorRequest | null; reason: string }>({ visitor: null, reason: '' });

  const loadVisitors = useCallback(async () => {
    try {
      const data = await api.getOwnerVisitorRequests();
      setVisitors(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load visitor requests:', e);
      setVisitors([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadVisitors();
  }, [loadVisitors]);

  const onRefresh = () => {
    setRefreshing(true);
    loadVisitors();
  };

  const handleApprove = async (visitor: VisitorRequest) => {
    if (visitor.status !== 'pending') return;
    setActionLoading(visitor._id);
    try {
      await api.approveOwnerVisitorRequest(visitor._id);
      Alert.alert('Approved', 'The student will be notified that their guest visit has been approved.');
      loadVisitors();
    } catch (e: any) {
      Alert.alert('Error', getApiErrorMessage(e));
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectModal.visitor) return;
    setActionLoading(rejectModal.visitor._id);
    try {
      await api.rejectOwnerVisitorRequest(rejectModal.visitor._id, rejectModal.reason || 'Not specified');
      Alert.alert('Rejected', 'The student will be notified with the reason.');
      setRejectModal({ visitor: null, reason: '' });
      loadVisitors();
    } catch (e: any) {
      Alert.alert('Error', getApiErrorMessage(e));
    } finally {
      setActionLoading(null);
    }
  };

  const openRejectModal = (visitor: VisitorRequest) => {
    setRejectModal({ visitor, reason: '' });
  };

  const filtered = filter === 'pending' ? visitors.filter((v) => v.status === 'pending') : visitors;
  const pendingCount = visitors.filter((v) => v.status === 'pending').length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
      case 'completed':
        return '#10b981';
      case 'rejected':
        return '#ef4444';
      default:
        return '#f59e0b';
    }
  };

  if (loading && visitors.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#0a7ea4" />
        <Text style={styles.loadingText}>Loading guest visit requests...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'pending' && styles.filterBtnActive]}
          onPress={() => setFilter('pending')}
        >
          <Text style={[styles.filterText, filter === 'pending' && styles.filterTextActive]}>Pending</Text>
          {pendingCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingCount}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'all' && styles.filterBtnActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>All</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0a7ea4']} />}
      >
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={48} color="#9ca3af" />
            <Text style={styles.emptyText}>
              {filter === 'pending' ? 'No pending guest visit requests' : 'No guest visit requests yet'}
            </Text>
          </View>
        ) : (
          filtered.map((v) => (
            <View key={v._id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.visitorName}>{v.visitorName}</Text>
                  <Text style={styles.visitorPhone}>{v.visitorPhone}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(v.status) + '20' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(v.status) }]}>{v.status}</Text>
                </View>
              </View>
              <Text style={styles.purpose}>{v.purpose}</Text>
              {v.visitDate && (
                <Text style={styles.meta}>Visit date: {new Date(v.visitDate).toLocaleDateString()}</Text>
              )}
              {v.visitingStudentId && (
                <Text style={styles.meta}>
                  Student: {typeof v.visitingStudentId === 'object' && v.visitingStudentId.name}
                  {v.visitingStudentId?.roomId && typeof v.visitingStudentId.roomId === 'object' && ` · Room ${(v.visitingStudentId.roomId as any).roomNumber || 'N/A'}`}
                </Text>
              )}
              <Text style={styles.meta}>Requested: {new Date(v.createdAt).toLocaleString()}</Text>
              {v.status === 'rejected' && v.rejectionReason && (
                <Text style={styles.rejectReason}>Reason: {v.rejectionReason}</Text>
              )}
              {v.status === 'pending' && (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.approveBtn]}
                    onPress={() => handleApprove(v)}
                    disabled={!!actionLoading}
                  >
                    {actionLoading === v._id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle" size={20} color="#fff" />
                        <Text style={styles.actionBtnText}>Approve</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.rejectBtn]}
                    onPress={() => openRejectModal(v)}
                    disabled={!!actionLoading}
                  >
                    <Ionicons name="close-circle" size={20} color="#fff" />
                    <Text style={styles.actionBtnText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={!!rejectModal.visitor} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reject guest visit request</Text>
            <Text style={styles.modalHint}>Optionally provide a reason (the student will be notified):</Text>
            <TextInput
              style={styles.reasonInput}
              placeholder="e.g. Outside visiting hours"
              placeholderTextColor="#9ca3af"
              value={rejectModal.reason}
              onChangeText={(text) => setRejectModal((prev) => ({ ...prev, reason: text }))}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setRejectModal({ visitor: null, reason: '' })}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalRejectBtn} onPress={handleRejectSubmit} disabled={!!actionLoading}>
                <Text style={styles.modalRejectText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#6b7280', fontSize: 14 },
  filterRow: { flexDirection: 'row', padding: 16, gap: 12 },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
  filterBtnActive: { backgroundColor: '#0a7ea4' },
  filterText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  filterTextActive: { color: '#fff' },
  badge: { backgroundColor: '#ef4444', marginLeft: 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  empty: { alignItems: 'center', paddingTop: 48 },
  emptyText: { marginTop: 12, color: '#6b7280', fontSize: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  visitorName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  visitorPhone: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  purpose: { fontSize: 14, color: '#374151', marginBottom: 4 },
  meta: { fontSize: 12, color: '#6b7280', marginBottom: 2 },
  rejectReason: { fontSize: 12, color: '#ef4444', marginTop: 6 },
  actions: { flexDirection: 'row', marginTop: 12, gap: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8 },
  approveBtn: { backgroundColor: '#10b981' },
  rejectBtn: { backgroundColor: '#ef4444' },
  actionBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 },
  modalHint: { fontSize: 13, color: '#6b7280', marginBottom: 12 },
  reasonInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalActions: { flexDirection: 'row', marginTop: 20, gap: 12 },
  modalCancelBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8, backgroundColor: '#f3f4f6' },
  modalCancelText: { color: '#6b7280', fontWeight: '600' },
  modalRejectBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8, backgroundColor: '#ef4444' },
  modalRejectText: { color: '#fff', fontWeight: '600' },
});
