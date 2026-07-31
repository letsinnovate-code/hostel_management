import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

export default function ProfileScreen() {
  const { user, updateUser, logout } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await api.getProfile();
      setProfile(response.data);
      setFormData({
        name: response.data.profile?.name || '',
        phone: response.data.profile?.phone || '',
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load profile');
    }
  };

  const handleSave = async () => {
    try {
      const response = await api.updateProfile(formData);
      updateUser(response.data.data);
      setEditing(false);
      Alert.alert('Success', 'Profile updated');
      loadProfile();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update profile');
    }
  };

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await logout();
      // Redirection is handled by RootLayout's auth listener
    } catch (error: any) {
      Alert.alert('Error', 'Failed to logout');
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        {!editing ? (
          <TouchableOpacity onPress={() => setEditing(true)}>
            <Text style={styles.editButton}>Edit</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={handleSave}>
            <Text style={styles.saveButton}>Save</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.field}>
          <Text style={styles.label}>Name</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
            />
          ) : (
            <Text style={styles.value}>{profile?.profile?.name || user?.name}</Text>
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{profile?.profile?.email || user?.email}</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Phone</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              value={formData.phone}
              onChangeText={(text) => setFormData({ ...formData, phone: text })}
              keyboardType="phone-pad"
            />
          ) : (
            <Text style={styles.value}>{profile?.profile?.phone || user?.phone}</Text>
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Role</Text>
          <Text style={styles.value}>{user?.role?.toUpperCase()}</Text>
        </View>

        {profile?.profile?.roomId && (
          <View style={styles.field}>
            <Text style={styles.label}>Room</Text>
            <Text style={styles.value}>
              {typeof profile.profile.roomId === 'object'
                ? profile.profile.roomId.roomNumber
                : 'N/A'}
            </Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[styles.logoutButton, loggingOut && { opacity: 0.7 }]}
        onPress={handleLogout}
        disabled={loggingOut}
      >
        {loggingOut ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.logoutButtonText}>Logout</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#11181C',
  },
  editButton: {
    color: '#0a7ea4',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    color: '#687076',
    marginBottom: 5,
    fontWeight: '500',
  },
  value: {
    fontSize: 16,
    color: '#11181C',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  logoutButton: {
    backgroundColor: '#f44336',
    margin: 15,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
