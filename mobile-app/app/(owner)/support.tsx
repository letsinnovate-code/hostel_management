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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';

export default function SupportScreen() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    priority: 'medium',
  });

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const response = await api.getSupportTickets();
      setTickets(response.data || []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load support tickets');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.subject || !formData.description) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      await api.createSupportTicket(formData);
      Alert.alert('Success', 'Support ticket created successfully');
      setModalVisible(false);
      setFormData({
        subject: '',
        description: '',
        priority: 'medium',
      });
      loadTickets();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create ticket');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return '#f44336';
      case 'high':
        return '#FF9800';
      case 'medium':
        return '#2196F3';
      case 'low':
        return '#4CAF50';
      default:
        return '#999';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return '#2196F3';
      case 'in-progress':
        return '#FF9800';
      case 'resolved':
        return '#4CAF50';
      case 'closed':
        return '#999';
      default:
        return '#999';
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadTickets} />}
      >
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add-circle" size={24} color="#fff" />
          <Text style={styles.addButtonText}>Create Support Ticket</Text>
        </TouchableOpacity>

        {tickets.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No support tickets found</Text>
          </View>
        ) : (
          tickets.map((ticket) => (
            <View key={ticket._id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.ticketNumber}>
                  {ticket.ticketNumber || `#${ticket._id.slice(-6)}`}
                </Text>
                <View
                  style={[
                    styles.priorityBadge,
                    { backgroundColor: getPriorityColor(ticket.priority) },
                  ]}
                >
                  <Text style={styles.priorityText}>{ticket.priority.toUpperCase()}</Text>
                </View>
              </View>
              <Text style={styles.subject}>{ticket.subject}</Text>
              <Text style={styles.description}>{ticket.description}</Text>
              <View style={styles.footer}>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(ticket.status) },
                  ]}
                >
                  <Text style={styles.statusText}>{ticket.status.toUpperCase()}</Text>
                </View>
                <Text style={styles.date}>
                  {new Date(ticket.createdAt).toLocaleDateString()}
                </Text>
              </View>
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
          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Support Ticket</Text>
            <TextInput
              style={styles.input}
              placeholder="Subject *"
              value={formData.subject}
              onChangeText={(text) => setFormData({ ...formData, subject: text })}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Description *"
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              multiline
              numberOfLines={6}
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
                onPress={handleCreate}
              >
                <Text style={styles.submitButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
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
    alignItems: 'center',
    marginBottom: 8,
  },
  ticketNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0a7ea4',
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  subject: {
    fontSize: 18,
    fontWeight: '600',
    color: '#11181C',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#687076',
    marginBottom: 10,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    maxHeight: '90%',
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
    height: 120,
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

