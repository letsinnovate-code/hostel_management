import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import api from '../../services/api';

export default function WardenPermissionsScreen() {
  const [permissions, setPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    setLoading(true);
    try {
      const response = await api.getPendingPermissions();
      setPermissions(response.data || []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load permissions');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (permissionId: string) => {
    try {
      await api.approvePermission(permissionId);
      Alert.alert('Success', 'Permission approved');
      loadPermissions();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to approve');
    }
  };

  const handleReject = async (permissionId: string) => {
    // Note: Alert.prompt is iOS only, for cross-platform use a modal with TextInput
    // For now, using a simple rejection with default reason
    try {
      await api.rejectPermission(permissionId, 'Rejected by warden');
      Alert.alert('Success', 'Permission rejected');
      loadPermissions();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to reject');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadPermissions} />}
    >
      {permissions.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No pending permissions</Text>
        </View>
      ) : (
        permissions.map((permission) => (
          <View key={permission._id} style={styles.card}>
            <Text style={styles.studentName}>
              {permission.studentId?.name || 'Unknown Student'}
            </Text>
            <Text style={styles.type}>
              {permission.permissionType.replace('-', ' ').toUpperCase()}
            </Text>
            <Text style={styles.reason}>{permission.reason}</Text>
            <Text style={styles.date}>
              {new Date(permission.requestedDate).toLocaleDateString()}
            </Text>
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.button, styles.approveButton]}
                onPress={() => handleApprove(permission._id)}
              >
                <Text style={styles.buttonText}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.rejectButton]}
                onPress={() => handleReject(permission._id)}
              >
                <Text style={styles.buttonText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
    padding: 15,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  studentName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#11181C',
  },
  type: {
    fontSize: 12,
    color: '#0a7ea4',
    marginBottom: 8,
    fontWeight: '500',
  },
  reason: {
    fontSize: 14,
    color: '#687076',
    marginBottom: 8,
  },
  date: {
    fontSize: 12,
    color: '#999',
    marginBottom: 15,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  approveButton: {
    backgroundColor: '#4CAF50',
  },
  rejectButton: {
    backgroundColor: '#f44336',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

