import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MENU_ITEMS = [
  { label: 'Student Presence', icon: 'people-outline', screen: '/(owner)/presence', color: '#0a7ea4' },
  { label: 'Leave / Outpass', icon: 'calendar-outline', screen: '/(owner)/leave-requests', color: '#14b8a6' },
  { label: 'Maintenance', icon: 'construct-outline', screen: '/(owner)/maintenance', color: '#f97316' },
  { label: 'Rules & Policies', icon: 'document-text-outline', screen: '/(owner)/rules', color: '#4CAF50' },
  { label: 'Analytics & Reports', icon: 'analytics-outline', screen: '/(owner)/analytics', color: '#FF5722' },
  { label: 'Broadcast Messages', icon: 'chatbubbles-outline', screen: '/(owner)/broadcast', color: '#2196F3' },
  { label: 'Amenities Setup', icon: 'grid-outline', screen: '/(owner)/amenities', color: '#0a7ea4' },
  { label: 'Staff Management', icon: 'people-outline', screen: '/(owner)/staff', color: '#FF9800' },
  { label: 'Geo-Fence Setup', icon: 'location-outline', screen: '/(owner)/geo-fence', color: '#f44336' },
  { label: 'Fee Structure', icon: 'cash-outline', screen: '/(owner)/fee-structure', color: '#4CAF50' },
  { label: 'Templates', icon: 'document-outline', screen: '/(owner)/templates', color: '#2196F3' },
  { label: 'Audit Trail', icon: 'folder-open-outline', screen: '/(owner)/audit', color: '#607D8B' },
  { label: 'Support Tickets', icon: 'help-circle-outline', screen: '/(owner)/support', color: '#795548' },
  { label: 'Guest Visit Requests', icon: 'person-add-outline', screen: '/(owner)/visitors', color: '#9C27B0' },
];

export default function OwnerMoreScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();

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
      <View style={styles.header}>
        <Text style={styles.title}>More</Text>
        <Text style={styles.subtitle}>{user?.name || 'Owner'}</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.menuContainer}>
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
});
