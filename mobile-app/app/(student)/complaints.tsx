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

export default function ComplaintsScreen() {
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [formData, setFormData] = useState({
    complaintType: 'cleaning',
    title: '',
    description: '',
    priority: 'medium',
  });

  useEffect(() => {
    loadComplaints();
  }, []);

  const loadComplaints = async () => {
    setLoading(true);
    try {
      const response = await api.getComplaints();
      setComplaints(response.data || []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load complaints');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.title || !formData.description) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      await api.createComplaint(formData);
      Alert.alert('Success', 'Complaint submitted');
      setModalVisible(false);
      setFormData({
        complaintType: 'cleaning',
        title: '',
        description: '',
        priority: 'medium',
      });
      loadComplaints();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit complaint');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolved':
      case 'closed':
        return '#4CAF50';
      case 'in-progress':
        return '#2196F3';
      case 'open':
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
          <Text style={styles.addButtonText}>Raise Complaint</Text>
        </TouchableOpacity>

        {complaints.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No complaints yet</Text>
          </View>
        ) : (
          complaints.map((complaint) => (
            <View key={complaint._id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{complaint.title}</Text>
                <View
                  style={[styles.statusBadge, { backgroundColor: getStatusColor(complaint.status) }]}
                >
                  <Text style={styles.statusText}>{complaint.status.toUpperCase()}</Text>
                </View>
              </View>
              <Text style={styles.type}>{complaint.complaintType.toUpperCase()}</Text>
              <Text style={styles.description}>{complaint.description}</Text>
              <Text style={styles.date}>
                {new Date(complaint.createdAt).toLocaleDateString()}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Raise Complaint</Text>

            <TextInput
              style={styles.input}
              placeholder="Title"
              value={formData.title}
              onChangeText={(text) => setFormData({ ...formData, title: text })}
            />

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Description"
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              multiline
              numberOfLines={4}
            />

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
    flex: 1,
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
  type: {
    fontSize: 12,
    color: '#0a7ea4',
    marginBottom: 8,
    fontWeight: '500',
  },
  description: {
    fontSize: 14,
    color: '#687076',
    marginBottom: 8,
  },
  date: {
    fontSize: 12,
    color: '#999',
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
  textArea: {
    height: 100,
    textAlignVertical: 'top',
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

