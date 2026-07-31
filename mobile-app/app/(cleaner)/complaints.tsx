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

export default function CleanerComplaintsScreen() {
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadComplaints();
  }, []);

  const loadComplaints = async () => {
    setLoading(true);
    try {
      const response = await api.getAssignedComplaints();
      setComplaints(response.data || []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load complaints');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (complaintId: string, status: string) => {
    try {
      await api.updateComplaintStatus(complaintId, status);
      Alert.alert('Success', 'Status updated');
      loadComplaints();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update status');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadComplaints} />}
    >
      {complaints.map((complaint) => (
        <View key={complaint._id} style={styles.card}>
          <Text style={styles.title}>{complaint.title}</Text>
          <Text style={styles.description}>{complaint.description}</Text>
          <Text style={styles.type}>{complaint.complaintType.toUpperCase()}</Text>
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.inProgressButton]}
              onPress={() => handleUpdateStatus(complaint._id, 'in-progress')}
            >
              <Text style={styles.buttonText}>In Progress</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.resolvedButton]}
              onPress={() => handleUpdateStatus(complaint._id, 'resolved')}
            >
              <Text style={styles.buttonText}>Resolved</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#11181C',
  },
  description: {
    fontSize: 14,
    color: '#687076',
    marginBottom: 8,
  },
  type: {
    fontSize: 12,
    color: '#0a7ea4',
    marginBottom: 15,
    fontWeight: '500',
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
  inProgressButton: {
    backgroundColor: '#2196F3',
  },
  resolvedButton: {
    backgroundColor: '#4CAF50',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

