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
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';

export default function AmenitiesScreen() {
  const [hostels, setHostels] = useState<any[]>([]);
  const [selectedHostel, setSelectedHostel] = useState<any>(null);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [newAmenity, setNewAmenity] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadHostels();
  }, []);

  const loadHostels = async () => {
    try {
      const response = await api.getHostels();
      setHostels(response.data || []);
      if (response.data && response.data.length > 0) {
        setSelectedHostel(response.data[0]);
        setAmenities(response.data[0].amenities || []);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load hostels');
    }
  };

  const handleAddAmenity = async () => {
    if (!newAmenity.trim()) {
      Alert.alert('Error', 'Please enter an amenity name');
      return;
    }

    if (!selectedHostel) {
      Alert.alert('Error', 'Please select a hostel');
      return;
    }

    try {
      const updatedAmenities = [...amenities, newAmenity.trim()];
      await api.updateHostelAmenities(selectedHostel._id, updatedAmenities);
      setAmenities(updatedAmenities);
      setNewAmenity('');
      Alert.alert('Success', 'Amenity added');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add amenity');
    }
  };

  const handleRemoveAmenity = async (amenity: string) => {
    if (!selectedHostel) return;

    try {
      const updatedAmenities = amenities.filter((a) => a !== amenity);
      await api.updateHostelAmenities(selectedHostel._id, updatedAmenities);
      setAmenities(updatedAmenities);
      Alert.alert('Success', 'Amenity removed');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to remove amenity');
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
                selectedHostel?._id === hostel._id && styles.hostelButtonActive,
              ]}
              onPress={() => {
                setSelectedHostel(hostel);
                setAmenities(hostel.amenities || []);
              }}
            >
              <Text
                style={[
                  styles.hostelButtonText,
                  selectedHostel?._id === hostel._id && styles.hostelButtonTextActive,
                ]}
              >
                {hostel.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.addContainer}>
          <TextInput
            style={styles.input}
            placeholder="Add new amenity"
            value={newAmenity}
            onChangeText={setNewAmenity}
            onSubmitEditing={handleAddAmenity}
          />
          <TouchableOpacity style={styles.addButton} onPress={handleAddAmenity}>
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {amenities.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No amenities configured</Text>
          </View>
        ) : (
          amenities.map((amenity, index) => (
            <View key={index} style={styles.card}>
              <Text style={styles.amenityText}>{amenity}</Text>
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => handleRemoveAmenity(amenity)}
              >
                <Ionicons name="close-circle" size={24} color="#f44336" />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
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
  addContainer: {
    flexDirection: 'row',
    padding: 15,
    gap: 10,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  addButton: {
    backgroundColor: '#0a7ea4',
    padding: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  amenityText: {
    fontSize: 16,
    color: '#11181C',
    flex: 1,
  },
  removeButton: {
    padding: 5,
  },
});

