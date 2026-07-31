import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';

export default function PermissionsScreen() {
  const [permissions, setPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [formData, setFormData] = useState({
    permissionType: 'late-entry',
    reason: '',
    requestedDate: '',
    returnDate: '',
  });

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    setLoading(true);
    try {
      const response = await api.getPermissionRequests();
      setPermissions(response.data || []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load permissions');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.reason || !formData.requestedDate) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      await api.createPermissionRequest(formData);
      Alert.alert('Success', 'Permission request submitted');
      setModalVisible(false);
      setFormData({
        permissionType: 'late-entry',
        reason: '',
        requestedDate: '',
        returnDate: '',
      });
      loadPermissions();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit request');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return '#4CAF50';
      case 'rejected':
        return '#f44336';
      case 'pending':
        return '#FF9800';
      default:
        return '#999';
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add-circle" size={24} color="#fff" />
          <Text style={styles.addButtonText}>Request Permission</Text>
        </TouchableOpacity>

        {permissions.map((permission) => (
          <View key={permission._id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>
                {permission.permissionType.replace('-', ' ').toUpperCase()}
              </Text>
              <View
                style={[styles.statusBadge, { backgroundColor: getStatusColor(permission.status) }]}
              >
                <Text style={styles.statusText}>{permission.status.toUpperCase()}</Text>
              </View>
            </View>
            <Text style={styles.reason}>{permission.reason}</Text>
            <Text style={styles.date}>
              Requested: {new Date(permission.requestedDate).toLocaleDateString()}
            </Text>
            {permission.returnDate && (
              <Text style={styles.date}>
                Return: {new Date(permission.returnDate).toLocaleDateString()}
              </Text>
            )}
            {permission.rejectionReason && (
              <Text style={styles.rejectionReason}>
                Reason: {permission.rejectionReason}
              </Text>
            )}
          </View>
        ))}
      </ScrollView>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Request Permission</Text>

            <TextInput
              style={styles.input}
              placeholder="Reason"
              value={formData.reason}
              onChangeText={(text) => setFormData({ ...formData, reason: text })}
              multiline
            />

            <TextInput
              style={styles.input}
              placeholder="Requested Date (YYYY-MM-DD)"
              value={formData.requestedDate}
              onChangeText={(text) => setFormData({ ...formData, requestedDate: text })}
            />

            {formData.permissionType === 'leave' && (
              <TextInput
                style={styles.input}
                placeholder="Return Date (YYYY-MM-DD)"
                value={formData.returnDate}
                onChangeText={(text) => setFormData({ ...formData, returnDate: text })}
              />
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton]}
                onPress={handleSubmit}
              >
                <Text style={styles.submitButtonText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a7ea4',
    margin: 15,
    padding: 15,
    borderRadius: 8,
    gap: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#11181C',
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
  reason: {
    fontSize: 14,
    color: '#687076',
    marginBottom: 8,
  },
  date: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  rejectionReason: {
    fontSize: 12,
    color: '#f44336',
    marginTop: 8,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
  },
  cancelButtonText: {
    color: '#11181C',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#0a7ea4',
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

