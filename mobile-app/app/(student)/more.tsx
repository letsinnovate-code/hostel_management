import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../contexts/AuthContext';
import { useNotificationsOverlay } from '../../contexts/NotificationsOverlayContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { STORAGE_KEYS } from '../../constants/config';
import api from '../../services/api';
import FirebaseNotificationService from '../../services/FirebaseNotificationService';

const MENU_ITEMS = [
  { label: 'Profile', icon: 'person-outline', screen: '/(student)/profile', color: '#0a7ea4' },
  { label: 'Mess Feedback', icon: 'restaurant-outline', screen: '/(student)/mess-feedback', color: '#f59e0b' },
  { label: 'Permissions', icon: 'document-text-outline', screen: '/(student)/permissions', color: '#6366f1' },
  { label: 'Visitor Requests', icon: 'people-outline', screen: '/(student)/visitors', color: '#10b981' },
  { label: 'Violations', icon: 'shield-outline', screen: '/(student)/violations', color: '#ef4444' },
  { label: 'Complaints', icon: 'alert-circle-outline', screen: '/(student)/complaints', color: '#8b5cf6' },
  { label: 'Support Tickets', icon: 'help-circle-outline', screen: '/(student)/support', color: '#795548' },
];

export default function StudentMoreScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { show: showNotifications } = useNotificationsOverlay();
  const insets = useSafeAreaInsets();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [notificationsToggling, setNotificationsToggling] = useState(false);
  const [togglingOn, setTogglingOn] = useState(false);

  const loadNotificationsPreference = useCallback(async () => {
    try {
      const value = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED);
      setNotificationsEnabled(value !== 'false');
    } catch {
      setNotificationsEnabled(true);
    } finally {
      setNotificationsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotificationsPreference();
  }, [loadNotificationsPreference]);

  const handleNotificationsToggle = async (value: boolean) => {
    setNotificationsToggling(true);
    setTogglingOn(value);
    try {
      if (value) {
        const token = await FirebaseNotificationService.getTokenAsync();
        if (token) {
          await api.registerPushToken(token);
          await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED, 'true');
          setNotificationsEnabled(true);
        } else {
          setNotificationsEnabled(false);
          if (Platform.OS !== 'web') {
            Alert.alert(
              'Could not enable notifications',
              'Please allow notifications in device settings and try again, or use a development build (FCM does not work in Expo Go).'
            );
          }
        }
      } else {
        await api.clearPushToken();
        await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED, 'false');
        setNotificationsEnabled(false);
      }
    } catch (e) {
      console.error('Notifications toggle error:', e);
      setNotificationsEnabled(!value);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setNotificationsToggling(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => {
        logout();
        router.replace('/(auth)/login');
      }},
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Modal
        visible={notificationsToggling}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.overlay}>
          <View style={styles.overlayCard}>
            <ActivityIndicator size="large" color="#7c3aed" style={styles.overlaySpinner} />
            <Text style={styles.overlayText}>
              {togglingOn ? 'Turning on notifications…' : 'Turning off…'}
            </Text>
          </View>
        </View>
      </Modal>

      <View style={styles.header}>
        <Text style={styles.title}>More</Text>
        <Text style={styles.subtitle}>{user?.name || 'Student'}</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.menuContainer}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => showNotifications()}
            activeOpacity={0.7}
          >
            <View style={[styles.iconWrapper, { backgroundColor: '#a855f720' }]}>
              <Ionicons name="notifications-outline" size={22} color="#a855f7" />
            </View>
            <Text style={styles.menuLabel}>Notifications</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
          <View style={styles.menuItem}>
            <View style={[styles.iconWrapper, { backgroundColor: '#a855f720' }]}>
              <Ionicons name="notifications-outline" size={22} color="#a855f7" />
            </View>
            <Text style={styles.menuLabel}>Push Notifications</Text>
            {notificationsLoading ? (
              <ActivityIndicator size="small" color="#a855f7" />
            ) : (
              <Switch
                value={notificationsEnabled}
                onValueChange={handleNotificationsToggle}
                disabled={notificationsToggling}
                trackColor={{ false: '#d1d5db', true: '#c4b5fd' }}
                thumbColor={notificationsEnabled ? '#7c3aed' : '#9ca3af'}
              />
            )}
          </View>
          {MENU_ITEMS.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={() => router.push(item.screen as any)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrapper, { backgroundColor: `${item.color}20` }]}>
                <Ionicons name={item.icon as any} size={22} color={item.color} />
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.7}>
          <View style={[styles.iconWrapper, { backgroundColor: '#fee2e2' }]}>
            <Ionicons name="log-out-outline" size={22} color="#ef4444" />
          </View>
          <Text style={styles.logoutText}>Logout</Text>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#11181C',
  },
  subtitle: {
    fontSize: 16,
    color: '#687076',
    marginTop: 5,
  },
  scrollView: {
    flex: 1,
  },
  menuContainer: {
    backgroundColor: '#fff',
    margin: 15,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 3,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#11181C',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 15,
    marginBottom: 30,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 3,
  },
  logoutText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 28,
    paddingHorizontal: 32,
    alignItems: 'center',
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  overlaySpinner: {
    marginBottom: 16,
  },
  overlayText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
  },
});
