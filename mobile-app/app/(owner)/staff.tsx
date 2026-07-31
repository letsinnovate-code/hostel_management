import { useState, useEffect } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import api, { getApiErrorMessage } from '../../services/api';

const STAFF_ROLES = ['warden', 'cleaner', 'supervisor', 'security'] as const;
const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'on-leave', label: 'On Leave' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'exited', label: 'Exited' },
];
const ROLE_OPTIONS = [
  { value: 'all', label: 'All Roles' },
  { value: 'warden', label: 'Warden' },
  { value: 'cleaner', label: 'Cleaner' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'security', label: 'Security' },
];

function getRoleColor(role: string) {
  switch (role) {
    case 'warden': return '#1d4ed8';
    case 'cleaner': return '#7c3aed';
    case 'supervisor': return '#15803d';
    case 'security': return '#c2410c';
    default: return '#475569';
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'active': return '#15803d';
    case 'on-leave': return '#b45309';
    case 'suspended': return '#dc2626';
    case 'exited': return '#64748b';
    default: return '#64748b';
  }
}

function getRoleIcon(role: string): keyof typeof Ionicons.glyphMap {
  switch (role?.toLowerCase()) {
    case 'warden': return 'shield-outline';
    case 'cleaner': return 'sparkles-outline';
    case 'supervisor': return 'person-check-outline';
    case 'security': return 'lock-closed-outline';
    default: return 'person-outline';
  }
}

export default function StaffScreen() {
  const [staff, setStaff] = useState<any[]>([]);
  const [hostels, setHostels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [hostelFilter, setHostelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'warden',
    roles: ['warden'] as string[],
    hostelId: '',
    status: 'active' as 'active' | 'on-leave' | 'exited' | 'suspended',
  });

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const cacheBust = Date.now();
      const allStaffPromises = STAFF_ROLES.map((role) =>
        api.getUsers({ role, _: cacheBust })
      );
      const [hostelsRes, ...roleResponses] = await Promise.all([
        api.getHostels(),
        ...allStaffPromises,
      ]);
      const raw = (hostelsRes as any)?.data ?? hostelsRes;
      const hostelsArray = Array.isArray(raw) ? raw : [];
      setHostels(hostelsArray.length > 0 ? hostelsArray : hostels);

      const combined = ([] as any[]).concat(
        ...roleResponses.map((r: any) => (Array.isArray(r) ? r : r?.data ?? []))
      );
      const seen = new Set<string>();
      const deduped = combined.filter((m: any) => {
        const id = m?._id;
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      const normalized = deduped.map((m: any) => ({
        ...m,
        roles: Array.isArray(m.role) ? m.role : [m.role].filter(Boolean),
        role: Array.isArray(m.role) ? m.role[0] : m.role,
      }));
      setStaff(normalized);
    } catch (e: any) {
      Alert.alert('Error', getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleRole = (r: string) => {
    const current = formData.roles || [];
    const next = current.includes(r)
      ? current.filter((x) => x !== r)
      : [...current, r];
    if (next.length === 0) return;
    setFormData({ ...formData, roles: next, role: next[0] });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      phone: '',
      role: 'warden',
      roles: ['warden'],
      hostelId: hostels.length > 0 ? (hostels[0]._id || hostels[0].id) : '',
      status: 'active',
    });
    setEditingStaff(null);
  };

  const openCreate = () => {
    resetForm();
    if (hostels.length > 0 && !formData.hostelId)
      setFormData((f) => ({ ...f, hostelId: hostels[0]._id || hostels[0].id }));
    setModalVisible(true);
  };

  const openEdit = (member: any) => {
    const roles = member.roles ?? (Array.isArray(member.role) ? member.role : [member.role].filter(Boolean));
    setEditingStaff(member);
    setFormData({
      name: member.name ?? '',
      email: member.email ?? '',
      password: '',
      phone: member.phone ?? '',
      role: roles[0] ?? member.role,
      roles: roles.length ? roles : ['warden'],
      hostelId: member.hostelId?._id ?? member.hostelId ?? '',
      status: member.status ?? 'active',
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.name?.trim() || !formData.email?.trim() || !formData.phone?.trim()) {
      Alert.alert('Required', 'Please fill Name, Email and Phone');
      return;
    }
    if ((formData.roles?.length ?? 0) === 0) {
      Alert.alert('Required', 'Select at least one role');
      return;
    }
    if (!editingStaff && !formData.password?.trim()) {
      Alert.alert('Required', 'Password is required for new staff');
      return;
    }
    setSubmitting(true);
    try {
      const roles = formData.roles?.length ? formData.roles : [formData.role];
      const payload: any = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        role: roles,
        roles,
        hostelId: formData.hostelId || undefined,
        status: formData.status,
      };
      if (editingStaff) {
        if (formData.password?.trim()) payload.password = formData.password.trim();
        await api.updateUser(editingStaff._id, payload);
        Alert.alert('Success', 'Staff member updated');
        setStaff((prev) =>
          prev.map((m) =>
            m._id === editingStaff._id
              ? {
                  ...m,
                  name: payload.name,
                  email: payload.email,
                  phone: payload.phone,
                  role: roles[0],
                  roles,
                  hostelId: formData.hostelId
                    ? hostels.find((h) => (h._id || h.id) === formData.hostelId) ?? m.hostelId
                    : undefined,
                  status: payload.status,
                }
              : m
          )
        );
      } else {
        payload.password = formData.password?.trim();
        await api.createUser(payload);
        Alert.alert('Success', 'Staff member created');
        loadData(true);
      }
      setModalVisible(false);
      resetForm();
    } catch (e: any) {
      Alert.alert('Error', getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (member: any) => {
    Alert.alert(
      'Delete Staff',
      `Delete ${member.name}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteUser(member._id);
              Alert.alert('Success', 'Staff member deleted');
              loadData(true);
            } catch (e: any) {
              Alert.alert('Error', getApiErrorMessage(e));
            }
          },
        },
      ]
    );
  };

  const handleResetPassword = (member: any) => {
    Alert.alert(
      'Reset Password',
      `Reset password for ${member.name}? A new password will be generated.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          onPress: async () => {
            setResettingPassword(member._id);
            try {
              const newPassword =
                Math.random().toString(36).slice(-8) +
                Math.random().toString(36).slice(-8).toUpperCase() +
                '123';
              await api.updateUser(member._id, { password: newPassword });
              Alert.alert('Password reset', `New password: ${newPassword}\nShare it securely with the staff member.`);
            } catch (e: any) {
              Alert.alert('Error', getApiErrorMessage(e));
            } finally {
              setResettingPassword(null);
            }
          },
        },
      ]
    );
  };

  const filteredStaff = staff.filter((member) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      (member.name ?? '').toLowerCase().includes(q) ||
      (member.email ?? '').toLowerCase().includes(q) ||
      (member.phone ?? '').includes(searchTerm);
    const roles = member.roles ?? (Array.isArray(member.role) ? member.role : [member.role].filter(Boolean));
    const matchesRole = roleFilter === 'all' || roles.includes(roleFilter);
    const matchesHostel =
      hostelFilter === 'all' ||
      (hostelFilter === 'unassigned' && !member.hostelId) ||
      (member.hostelId?._id ?? member.hostelId) === hostelFilter;
    const matchesStatus = statusFilter === 'all' || member.status === statusFilter;
    return matchesSearch && matchesRole && matchesHostel && matchesStatus;
  });

  const staffByRole = {
    warden: filteredStaff.filter((s) => (s.roles ?? [s.role]).includes('warden')).length,
    cleaner: filteredStaff.filter((s) => (s.roles ?? [s.role]).includes('cleaner')).length,
    supervisor: filteredStaff.filter((s) => (s.roles ?? [s.role]).includes('supervisor')).length,
    security: filteredStaff.filter((s) => (s.roles ?? [s.role]).includes('security')).length,
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => loadData()} />}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Staff Management</Text>
          <Text style={styles.headerSubtitle}>Manage wardens, cleaners, supervisors and security</Text>
          <TouchableOpacity style={styles.addButton} onPress={openCreate}>
            <Ionicons name="person-add" size={22} color="#fff" />
            <Text style={styles.addButtonText}>Add Staff Member</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total</Text>
            <Text style={styles.statValue}>{filteredStaff.length}</Text>
            <Ionicons name="people-outline" size={28} color="#94a3b8" style={styles.statIcon} />
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#1d4ed8' }]}>
            <Text style={styles.statLabel}>Wardens</Text>
            <Text style={[styles.statValue, { color: '#1d4ed8' }]}>{staffByRole.warden}</Text>
            <Ionicons name="shield-outline" size={28} color="#1d4ed8" style={styles.statIcon} />
          </View>
        </View>
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { borderLeftColor: '#7c3aed' }]}>
            <Text style={styles.statLabel}>Cleaners</Text>
            <Text style={[styles.statValue, { color: '#7c3aed' }]}>{staffByRole.cleaner}</Text>
            <Ionicons name="sparkles-outline" size={28} color="#7c3aed" style={styles.statIcon} />
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#15803d' }]}>
            <Text style={styles.statLabel}>Supervisors</Text>
            <Text style={[styles.statValue, { color: '#15803d' }]}>{staffByRole.supervisor}</Text>
            <Ionicons name="person-check-outline" size={28} color="#15803d" style={styles.statIcon} />
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#c2410c' }]}>
            <Text style={styles.statLabel}>Security</Text>
            <Text style={[styles.statValue, { color: '#c2410c' }]}>{staffByRole.security}</Text>
            <Ionicons name="lock-closed-outline" size={28} color="#c2410c" style={styles.statIcon} />
          </View>
        </View>

        {/* Filters */}
        <View style={styles.filtersCard}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search name, email, phone..."
            placeholderTextColor="#94a3b8"
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={styles.picker}
              onPress={() =>
                Alert.alert(
                  'Role',
                  undefined,
                  ROLE_OPTIONS.map((o) => ({
                    text: o.label,
                    onPress: () => setRoleFilter(o.value),
                  }))
                )
              }
            >
              <Text style={styles.pickerText}>{ROLE_OPTIONS.find((r) => r.value === roleFilter)?.label ?? 'Role'}</Text>
              <Ionicons name="chevron-down" size={18} color="#64748b" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.picker}
              onPress={() =>
                Alert.alert(
                  'Status',
                  undefined,
                  STATUS_OPTIONS.map((o) => ({
                    text: o.label,
                    onPress: () => setStatusFilter(o.value),
                  }))
                )
              }
            >
              <Text style={styles.pickerText}>{STATUS_OPTIONS.find((s) => s.value === statusFilter)?.label ?? 'Status'}</Text>
              <Ionicons name="chevron-down" size={18} color="#64748b" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.picker}
            onPress={() =>
              Alert.alert(
                'Hostel',
                undefined,
                [
                  { text: 'All Hostels', onPress: () => setHostelFilter('all') },
                  { text: 'Unassigned', onPress: () => setHostelFilter('unassigned') },
                  ...hostels.map((h) => ({
                    text: h.name,
                    onPress: () => setHostelFilter(h._id || h.id),
                  })),
                  { text: 'Cancel', style: 'cancel' },
                ]
              )
            }
          >
            <Text style={styles.pickerText}>
              {hostelFilter === 'all'
                ? 'All Hostels'
                : hostelFilter === 'unassigned'
                  ? 'Unassigned'
                  : hostels.find((h) => (h._id || h.id) === hostelFilter)?.name ?? 'Hostel'}
            </Text>
            <Ionicons name="chevron-down" size={18} color="#64748b" />
          </TouchableOpacity>
        </View>

        {/* List */}
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#0a7ea4" />
          </View>
        ) : filteredStaff.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={56} color="#cbd5e1" />
            <Text style={styles.emptyText}>No staff members found</Text>
            <TouchableOpacity style={styles.emptyButton} onPress={openCreate}>
              <Text style={styles.emptyButtonText}>Add your first staff member</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.list}>
            {filteredStaff.map((member) => {
              const roles = member.roles ?? (Array.isArray(member.role) ? member.role : [member.role].filter(Boolean));
              const primaryRole = roles[0] ?? member.role;
              return (
                <View key={member._id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={styles.avatar}>
                      <Ionicons name={getRoleIcon(primaryRole)} size={24} color="#64748b" />
                    </View>
                    <View style={styles.cardMain}>
                      <Text style={styles.staffName}>{member.name}</Text>
                      <Text style={styles.staffEmail}>{member.email}</Text>
                      {member.phone ? (
                        <Text style={styles.staffPhone}>{member.phone}</Text>
                      ) : null}
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(member.status ?? 'active') }]}>
                      <Text style={styles.statusText}>{member.status === 'on-leave' ? 'On Leave' : (member.status ?? 'active')}</Text>
                    </View>
                  </View>
                  <View style={styles.roleRow}>
                    {roles.map((r: string) => (
                      <View key={r} style={[styles.roleBadge, { backgroundColor: getRoleColor(r) + '20' }]}>
                        <Text style={[styles.roleBadgeText, { color: getRoleColor(r) }]}>
                          {r === 'security' ? 'Security' : r.charAt(0).toUpperCase() + r.slice(1)}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <Text style={styles.hostelText}>
                    Hostel: {member.hostelId?.name ?? (member.hostelId ? '—' : 'Unassigned')}
                  </Text>
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => handleResetPassword(member)}
                      disabled={resettingPassword === member._id}
                    >
                      {resettingPassword === member._id ? (
                        <ActivityIndicator size="small" color="#15803d" />
                      ) : (
                        <Ionicons name="lock-closed-outline" size={20} color="#15803d" />
                      )}
                      <Text style={[styles.actionBtnText, { color: '#15803d' }]}>Reset PW</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(member)}>
                      <Ionicons name="pencil-outline" size={20} color="#0a7ea4" />
                      <Text style={[styles.actionBtnText, { color: '#0a7ea4' }]}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(member)}>
                      <Ionicons name="trash-outline" size={20} color="#dc2626" />
                      <Text style={[styles.actionBtnText, { color: '#dc2626' }]}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingStaff ? 'Edit Staff Member' : 'Add Staff Member'}</Text>
              <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Full name"
                placeholderTextColor="#94a3b8"
                value={formData.name}
                onChangeText={(t) => setFormData({ ...formData, name: t })}
              />
              <Text style={styles.label}>Email *</Text>
              <TextInput
                style={styles.input}
                placeholder="email@example.com"
                placeholderTextColor="#94a3b8"
                value={formData.email}
                onChangeText={(t) => setFormData({ ...formData, email: t })}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Text style={styles.label}>Phone *</Text>
              <TextInput
                style={styles.input}
                placeholder="+91 9876543210"
                placeholderTextColor="#94a3b8"
                value={formData.phone}
                onChangeText={(t) => setFormData({ ...formData, phone: t })}
                keyboardType="phone-pad"
              />
              <Text style={styles.label}>Password {editingStaff ? '(leave blank to keep)' : '*'}</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder={editingStaff ? 'Leave blank to keep' : 'Password'}
                  placeholderTextColor="#94a3b8"
                  value={formData.password}
                  onChangeText={(t) => setFormData({ ...formData, password: t })}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color="#64748b" />
                </TouchableOpacity>
              </View>
              <Text style={styles.label}>Roles * (select at least one)</Text>
              <View style={styles.rolesRow}>
                {STAFF_ROLES.map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.roleChip, formData.roles?.includes(r) && styles.roleChipActive]}
                    onPress={() => toggleRole(r)}
                  >
                    <Text style={[styles.roleChipText, formData.roles?.includes(r) && styles.roleChipTextActive]}>
                      {r === 'security' ? 'Security' : r.charAt(0).toUpperCase() + r.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.label}>Hostel</Text>
              <TouchableOpacity
                style={styles.picker}
                onPress={() =>
                  Alert.alert(
                    'Hostel',
                    undefined,
                    hostels.length === 0
                      ? [{ text: 'OK' }]
                      : [
                          { text: 'Unassigned', onPress: () => setFormData({ ...formData, hostelId: '' }) },
                          ...hostels.map((h) => ({
                            text: h.name,
                            onPress: () => setFormData({ ...formData, hostelId: h._id || h.id }),
                          })),
                          { text: 'Cancel', style: 'cancel' },
                        ]
                  )
                }
              >
                <Text style={styles.pickerText}>
                  {formData.hostelId
                    ? hostels.find((h) => (h._id || h.id) === formData.hostelId)?.name ?? 'Select'
                    : 'Unassigned'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#64748b" />
              </TouchableOpacity>
              <Text style={styles.label}>Status</Text>
              <TouchableOpacity
                style={styles.picker}
                onPress={() =>
                  Alert.alert(
                    'Status',
                    undefined,
                    [
                      { text: 'Active', onPress: () => setFormData({ ...formData, status: 'active' }) },
                      { text: 'On Leave', onPress: () => setFormData({ ...formData, status: 'on-leave' }) },
                      { text: 'Suspended', onPress: () => setFormData({ ...formData, status: 'suspended' }) },
                      { text: 'Exited', onPress: () => setFormData({ ...formData, status: 'exited' }) },
                      { text: 'Cancel', style: 'cancel' },
                    ]
                  )
                }
              >
                <Text style={styles.pickerText}>
                  {formData.status === 'on-leave' ? 'On Leave' : formData.status.charAt(0).toUpperCase() + formData.status.slice(1)}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#64748b" />
              </TouchableOpacity>
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setModalVisible(false); resetForm(); }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                onPress={handleSave}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>{editingStaff ? 'Update' : 'Create'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  scrollView: { flex: 1 },
  header: { backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  headerSubtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0a7ea4',
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
  },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 16 },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#94a3b8',
    position: 'relative',
  },
  statLabel: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  statValue: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginTop: 4 },
  statIcon: { position: 'absolute', right: 10, top: 14 },
  filtersCard: { backgroundColor: '#fff', margin: 16, padding: 16, borderRadius: 12, gap: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  searchInput: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: '#0f172a' },
  filterRow: { flexDirection: 'row', gap: 10 },
  picker: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  pickerText: { fontSize: 15, color: '#0f172a' },
  centered: { padding: 40, alignItems: 'center' },
  empty: { alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 16, color: '#64748b', marginTop: 12 },
  emptyButton: { marginTop: 16 },
  emptyButtonText: { fontSize: 16, color: '#0a7ea4', fontWeight: '600' },
  list: { padding: 16, paddingTop: 0, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  cardMain: { flex: 1 },
  staffName: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  staffEmail: { fontSize: 14, color: '#64748b', marginTop: 2 },
  staffPhone: { fontSize: 14, color: '#64748b', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  roleBadgeText: { fontSize: 12, fontWeight: '600' },
  hostelText: { fontSize: 13, color: '#64748b', marginBottom: 12 },
  actions: { flexDirection: 'row', gap: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionBtnText: { fontSize: 14, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, width: '100%', maxWidth: 400, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  modalScroll: { padding: 16, maxHeight: 400 },
  label: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: '#0f172a', marginBottom: 14 },
  passwordRow: { position: 'relative', marginBottom: 14 },
  passwordInput: { paddingRight: 48 },
  eyeBtn: { position: 'absolute', right: 12, top: 10 },
  rolesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  roleChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: '#f1f5f9' },
  roleChipActive: { backgroundColor: '#0a7ea4' },
  roleChipText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  roleChipTextActive: { color: '#fff' },
  modalFooter: { flexDirection: 'row', gap: 12, padding: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#f1f5f9', alignItems: 'center' },
  cancelBtnText: { fontSize: 16, fontWeight: '600', color: '#475569' },
  submitBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#0a7ea4', alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
