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

export default function TemplatesScreen() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [hostels, setHostels] = useState<any[]>([]);
  const [selectedHostel, setSelectedHostel] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [formData, setFormData] = useState({
    hostelId: '',
    templateType: 'sms',
    name: '',
    subject: '',
    body: '',
  });

  useEffect(() => {
    loadHostels();
  }, []);

  useEffect(() => {
    if (selectedHostel) {
      loadTemplates();
    }
  }, [selectedHostel]);

  const loadHostels = async () => {
    try {
      const response = await api.getHostels();
      setHostels(response.data || []);
      if (response.data && response.data.length > 0) {
        setSelectedHostel(response.data[0]._id);
        setFormData({ ...formData, hostelId: response.data[0]._id });
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load hostels');
    }
  };

  const loadTemplates = async () => {
    if (!selectedHostel) return;
    setLoading(true);
    try {
      const response = await api.getTemplates(selectedHostel);
      setTemplates(response.data || []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.body) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      await api.createTemplate(formData);
      Alert.alert('Success', 'Template created successfully');
      setModalVisible(false);
      setFormData({
        ...formData,
        name: '',
        subject: '',
        body: '',
      });
      loadTemplates();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create template');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.filterContainer}>
        <Text style={styles.filterLabel}>Select Hostel:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {hostels.map((hostel) => (
            <TouchableOpacity
              key={hostel._id}
              style={[
                styles.hostelButton,
                selectedHostel === hostel._id && styles.hostelButtonActive,
              ]}
              onPress={() => setSelectedHostel(hostel._id)}
            >
              <Text
                style={[
                  styles.hostelButtonText,
                  selectedHostel === hostel._id && styles.hostelButtonTextActive,
                ]}
              >
                {hostel.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadTemplates} />}
      >
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            if (!selectedHostel) {
              Alert.alert('Error', 'Please select a hostel first');
              return;
            }
            setFormData({ ...formData, hostelId: selectedHostel });
            setModalVisible(true);
          }}
        >
          <Ionicons name="document-text" size={24} color="#fff" />
          <Text style={styles.addButtonText}>Create Template</Text>
        </TouchableOpacity>

        {templates.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No templates found</Text>
          </View>
        ) : (
          templates.map((template) => (
            <View key={template._id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{template.name}</Text>
                <View style={styles.typeBadge}>
                  <Text style={styles.typeText}>{template.templateType.toUpperCase()}</Text>
                </View>
              </View>
              {template.subject && <Text style={styles.subject}>{template.subject}</Text>}
              <Text style={styles.body}>{template.body}</Text>
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
            <Text style={styles.modalTitle}>Create Template</Text>
            <TextInput
              style={styles.input}
              placeholder="Template Name *"
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="Subject (for email)"
              value={formData.subject}
              onChangeText={(text) => setFormData({ ...formData, subject: text })}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Body/Content *"
              value={formData.body}
              onChangeText={(text) => setFormData({ ...formData, body: text })}
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
  filterContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
    color: '#11181C',
  },
  hostelButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    marginRight: 10,
  },
  hostelButtonActive: {
    backgroundColor: '#0a7ea4',
  },
  hostelButtonText: {
    fontSize: 14,
    color: '#687076',
  },
  hostelButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
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
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#11181C',
    flex: 1,
  },
  typeBadge: {
    backgroundColor: '#0a7ea4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  subject: {
    fontSize: 14,
    fontWeight: '500',
    color: '#687076',
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    color: '#687076',
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

