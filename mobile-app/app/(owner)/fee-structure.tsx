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

export default function FeeStructureScreen() {
  const [feeStructures, setFeeStructures] = useState<any[]>([]);
  const [hostels, setHostels] = useState<any[]>([]);
  const [selectedHostel, setSelectedHostel] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [formData, setFormData] = useState({
    hostelId: '',
    name: '',
    description: '',
  });

  useEffect(() => {
    loadHostels();
  }, []);

  useEffect(() => {
    if (selectedHostel) {
      loadFeeStructures();
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

  const loadFeeStructures = async () => {
    if (!selectedHostel) return;
    setLoading(true);
    try {
      const response = await api.getFeeStructures(selectedHostel);
      setFeeStructures(response.data || []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load fee structures');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.name) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      await api.createFeeStructure(formData);
      Alert.alert('Success', 'Fee structure created successfully');
      setModalVisible(false);
      setFormData({ ...formData, name: '', description: '' });
      loadFeeStructures();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create fee structure');
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
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadFeeStructures} />}
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
          <Ionicons name="add-circle" size={24} color="#fff" />
          <Text style={styles.addButtonText}>Create Fee Structure</Text>
        </TouchableOpacity>

        {feeStructures.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No fee structures found</Text>
          </View>
        ) : (
          feeStructures.map((structure) => (
            <View key={structure._id} style={styles.card}>
              <Text style={styles.cardTitle}>{structure.name}</Text>
              {structure.description && (
                <Text style={styles.description}>{structure.description}</Text>
              )}
              {structure.components && structure.components.length > 0 && (
                <View style={styles.components}>
                  {structure.components.map((comp: any, idx: number) => (
                    <View key={idx} style={styles.component}>
                      <Text style={styles.componentName}>{comp.name}</Text>
                      <Text style={styles.componentAmount}>₹{comp.amount}</Text>
                    </View>
                  ))}
                </View>
              )}
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
            <Text style={styles.modalTitle}>Create Fee Structure</Text>
            <TextInput
              style={styles.input}
              placeholder="Name *"
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
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
  cardTitle: {
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
  components: {
    marginTop: 10,
  },
  component: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 5,
  },
  componentName: {
    fontSize: 14,
    color: '#11181C',
  },
  componentAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
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

