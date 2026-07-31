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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';

export default function StudentsScreen() {
  const router = useRouter();
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadStudents();
  }, [filter]);

  const loadStudents = async () => {
    setLoading(true);
    try {
      const status = filter === 'all' ? undefined : filter;
      const response = await api.getUsers({ role: 'student', status });
      const data = (response as any)?.data ?? response;
      setStudents(Array.isArray(data) ? data : []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (studentId: string) => {
    try {
      await api.approveStudentOnboarding(studentId);
      Alert.alert('Success', 'Student approved');
      loadStudents();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to approve student');
    }
  };

  const handleStatusChange = async (studentId: string, status: string) => {
    try {
      await api.updateStudentStatus(studentId, status);
      Alert.alert('Success', 'Student status updated');
      loadStudents();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update status');
    }
  };

  const filters = [
    { label: 'All', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'On Leave', value: 'on-leave' },
    { label: 'Exited', value: 'exited' },
  ];

  const quickActions = [
    { label: 'Check Attendance', path: '/(owner)/attendance' as const, icon: 'calendar-outline' as const },
    { label: 'Presence', path: '/(owner)/presence' as const, icon: 'people-outline' as const },
    { label: 'Leave Requests', path: '/(owner)/leave-requests' as const, icon: 'document-text-outline' as const },
    { label: 'Maintenance', path: '/(owner)/maintenance' as const, icon: 'construct-outline' as const },
  ];

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.addStudentBtn}
        onPress={() => router.push('/(owner)/student-create' as any)}
      >
        <Ionicons name="person-add" size={22} color="#fff" />
        <Text style={styles.addStudentBtnText}>Add Student</Text>
      </TouchableOpacity>

      <View style={styles.quickActionsCard}>
        <Text style={styles.quickActionsTitle}>Student management</Text>
        <View style={styles.quickActionsGrid}>
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.path}
              style={styles.quickActionBtn}
              onPress={() => router.push(action.path as any)}
              activeOpacity={0.7}
            >
              <Ionicons name={action.icon} size={24} color="#0a7ea4" />
              <Text style={styles.quickActionLabel} numberOfLines={2}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* <View style={styles.filterContainer}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[styles.filterButton, filter === f.value && styles.filterButtonActive]}
            onPress={() => setFilter(f.value)}
          >
            <Text
              style={[
                styles.filterText,
                filter === f.value && styles.filterTextActive,
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View> */}

      {/* <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadStudents} />}
      >
        {students.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No students found</Text>
          </View>
        ) : (
          students.map((student) => (
            <TouchableOpacity
              key={student._id}
              style={styles.card}
              onPress={() => router.push(`/(owner)/student-edit/${student._id}` as any)}
              activeOpacity={0.8}
            >
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.studentName}>{student.name}</Text>
                  <Text style={styles.studentId}>{student.studentId || 'N/A'}</Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(student.status) },
                  ]}
                >
                  <Text style={styles.statusText}>{student.status?.toUpperCase()}</Text>
                </View>
              </View>
              <Text style={styles.email}>{student.email}</Text>
              <Text style={styles.phone}>{student.phone}</Text>
              {student.roomId && (
                <Text style={styles.room}>
                  Room: {typeof student.roomId === 'object' ? student.roomId.roomNumber : 'N/A'}
                </Text>
              )}
              <View style={styles.actions}>
                {student.status === 'pending' && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.approveButton]}
                    onPress={() => handleApprove(student._id)}
                  >
                    <Text style={styles.actionButtonText}>Approve</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.actionButton, styles.statusButton]}
                  onPress={() => {
                    Alert.alert(
                      'Change Status',
                      'Select new status:',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Active',
                          onPress: () => handleStatusChange(student._id, 'active'),
                        },
                        {
                          text: 'On Leave',
                          onPress: () => handleStatusChange(student._id, 'on-leave'),
                        },
                        {
                          text: 'Exited',
                          onPress: () => handleStatusChange(student._id, 'exited'),
                        },
                      ]
                    );
                  }}
                >
                  <Text style={styles.actionButtonText}>Change Status</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView> */}
    </View>
  );
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active':
      return '#4CAF50';
    case 'on-leave':
      return '#FF9800';
    case 'exited':
      return '#999';
    case 'pending':
      return '#2196F3';
    default:
      return '#999';
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  addStudentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0a7ea4',
    margin: 16,
    marginBottom: 0,
    padding: 14,
    borderRadius: 12,
  },
  addStudentBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  quickActionsCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  quickActionsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 12,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickActionBtn: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  quickActionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    flex: 1,
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 10,
    gap: 10,
  },
  filterButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },
  filterButtonActive: {
    backgroundColor: '#0a7ea4',
  },
  filterText: {
    fontSize: 14,
    color: '#687076',
  },
  filterTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  card: {
    backgroundColor: '#fff',
    margin: 15,
    marginTop: 0,
    padding: 15,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  studentName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#11181C',
  },
  studentId: {
    fontSize: 12,
    color: '#687076',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  email: {
    fontSize: 14,
    color: '#687076',
    marginBottom: 4,
  },
  phone: {
    fontSize: 14,
    color: '#687076',
    marginBottom: 4,
  },
  room: {
    fontSize: 14,
    color: '#0a7ea4',
    marginBottom: 10,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  actionButton: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  approveButton: {
    backgroundColor: '#4CAF50',
  },
  statusButton: {
    backgroundColor: '#0a7ea4',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});

