import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface SidebarProps {
  visible: boolean;
  onClose: () => void;
}

const { width } = Dimensions.get('window');

export default function Sidebar({ visible, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-width)).current;

  const menuItems = [
    {
      title: 'Dashboard',
      icon: 'home',
      screen: '/(owner)/dashboard',
      color: '#0a7ea4',
    },
    {
      title: 'System & Hostel Setup',
      icon: 'business',
      screen: null,
      color: '#0a7ea4',
      subItems: [
        { label: 'Manage Hostels', screen: 'hostels' },
        { label: 'Room Configuration', screen: 'rooms' },
        { label: 'Amenities Setup', screen: 'amenities' },
      ],
    },
    {
      title: 'Rule Engine & Policies',
      icon: 'settings',
      screen: null,
      color: '#4CAF50',
      subItems: [
        { label: 'Curfew Rules', screen: 'curfew-rules' },
        { label: 'Late Entry Rules', screen: 'late-entry' },
        { label: 'Leave Policies', screen: 'leave-policies' },
        { label: 'Discipline Matrix', screen: 'discipline' },
      ],
    },
    {
      title: 'User Management',
      icon: 'people',
      screen: null,
      color: '#FF9800',
      subItems: [
        { label: 'Create Roles', screen: 'roles' },
        { label: 'Staff Management', screen: 'staff' },
        { label: 'Permission Control', screen: 'permissions' },
        { label: 'Guest Visit Requests', screen: 'visitors' },
      ],
    },
    {
      title: 'Student Management',
      icon: 'school',
      screen: null,
      color: '#9C27B0',
      subItems: [
        { label: 'Student Onboarding', screen: 'students' },
        { label: 'Bulk Upload', screen: 'bulk-upload' },
        { label: 'Room Allocation', screen: 'room-allocation' },
        { label: 'Status Control', screen: 'student-status' },
      ],
    },
    {
      title: 'Security & Presence',
      icon: 'shield-checkmark',
      screen: null,
      color: '#f44336',
      subItems: [
        { label: 'Geo-Fence Setup', screen: 'geo-fence' },
        { label: 'Emergency Protocol', screen: 'emergency' },
        { label: 'Presence Policy', screen: 'presence' },
      ],
    },
    {
      title: 'Finance & Payments',
      icon: 'cash',
      screen: null,
      color: '#4CAF50',
      subItems: [
        { label: 'Fee Structure', screen: 'fee-structure' },
        { label: 'Payments', screen: 'payments' },
        { label: 'Invoices', screen: 'invoices' },
        { label: 'Fine Collection', screen: 'fines' },
        { label: 'Revenue Reports', screen: 'revenue' },
      ],
    },
    {
      title: 'Communication',
      icon: 'chatbubbles',
      screen: null,
      color: '#2196F3',
      subItems: [
        { label: 'Broadcast Messages', screen: 'broadcast' },
        { label: 'Templates', screen: 'templates' },
        { label: 'Parent Notifications', screen: 'parent-notifications' },
      ],
    },
    {
      title: 'Analytics & Reports',
      icon: 'analytics',
      screen: null,
      color: '#FF5722',
      subItems: [
        { label: 'Attendance Reports', screen: 'attendance-reports' },
        { label: 'Violation Trends', screen: 'violation-trends' },
        { label: 'Staff Performance', screen: 'staff-performance' },
        { label: 'Occupancy Reports', screen: 'occupancy' },
        { label: 'Financial Reports', screen: 'financial-reports' },
      ],
    },
    {
      title: 'Compliance & Audit',
      icon: 'document-text',
      screen: null,
      color: '#607D8B',
      subItems: [
        { label: 'Export Data', screen: 'export' },
        { label: 'Audit Trail', screen: 'audit' },
        { label: 'Consent Records', screen: 'consent' },
        { label: 'Policy History', screen: 'policy-history' },
      ],
    },
    {
      title: 'System Governance',
      icon: 'cog',
      screen: null,
      color: '#795548',
      subItems: [
        { label: 'Dashboard KPIs', screen: 'kpis' },
        { label: 'System Logs', screen: 'logs' },
        { label: 'Backup & Restore', screen: 'backup' },
        { label: 'Support Tickets', screen: 'support' },
      ],
    },
  ];

  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const toggleExpand = (title: string) => {
    setExpandedItems((prev) =>
      prev.includes(title)
        ? prev.filter((item) => item !== title)
        : [...prev, title]
    );
  };

  const handleNavigation = (screen: string | null) => {
    if (screen) {
      onClose();
      if (screen.startsWith('/')) {
        router.push(screen as any);
      } else {
        // Handle sub-item navigation
        // For now, just show alert
        // You can implement actual navigation later
      }
    }
  };

  const handleLogout = () => {
    logout();
    onClose();
    router.replace('/(auth)/login');
  };

  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -width,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.sidebar,
            { paddingTop: insets.top },
            {
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.userInfo}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={24} color="#fff" />
              </View>
              <View>
                <Text style={styles.userName}>{user?.name || 'Owner'}</Text>
                <Text style={styles.userRole}>{user?.role?.toUpperCase()}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#11181C" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.menuContainer} showsVerticalScrollIndicator={false}>
            {menuItems.map((item, index) => (
              <View key={index}>
                <TouchableOpacity
                  style={[
                    styles.menuItem,
                    pathname === item.screen && styles.activeMenuItem,
                  ]}
                  onPress={() => {
                    if (item.subItems) {
                      toggleExpand(item.title);
                    } else if (item.screen) {
                      onClose();
                      router.push(item.screen as any);
                    }
                  }}
                >
                  <View style={styles.menuItemLeft}>
                    <Ionicons
                      name={item.icon as any}
                      size={22}
                      color={item.color}
                    />
                    <Text style={styles.menuItemText}>{item.title}</Text>
                  </View>
                  {item.subItems && (
                    <Ionicons
                      name={
                        expandedItems.includes(item.title)
                          ? 'chevron-up'
                          : 'chevron-down'
                      }
                      size={20}
                      color="#999"
                    />
                  )}
                </TouchableOpacity>

                {item.subItems && expandedItems.includes(item.title) && (
                  <View style={styles.subMenu}>
                    {item.subItems.map((subItem, subIndex) => (
                      <TouchableOpacity
                        key={subIndex}
                        style={styles.subMenuItem}
                        onPress={() => {
                  onClose();
                  // Map screen names to actual routes
                  const screenMap: { [key: string]: string } = {
                    'hostels': '/(owner)/hostels',
                    'rooms': '/(owner)/rooms',
                    'students': '/(owner)/students',
                    'payments': '/(owner)/payments',
                    'rules': '/(owner)/rules',
                    'curfew-rules': '/(owner)/rules',
                    'late-entry': '/(owner)/rules',
                    'leave-policies': '/(owner)/rules',
                    'attendance-reports': '/(owner)/analytics',
                    'occupancy': '/(owner)/analytics',
                    'financial-reports': '/(owner)/analytics',
                    'broadcast': '/(owner)/broadcast',
                    'templates': '/(owner)/templates',
                    'amenities': '/(owner)/amenities',
                    'staff': '/(owner)/staff',
                    'geo-fence': '/(owner)/geo-fence',
                    'fee-structure': '/(owner)/fee-structure',
                    'audit': '/(owner)/audit',
                    'support': '/(owner)/support',
                    'visitors': '/(owner)/visitors',
                  };
                  const route = screenMap[subItem.screen] || `/(owner)/${subItem.screen}`;
                  router.push(route as any);
                }}
                      >
                        <Text style={styles.subMenuItemText}>{subItem.label}</Text>
                        <Ionicons name="chevron-forward" size={16} color="#999" />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: insets.bottom }]}>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={22} color="#f44336" />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
        <TouchableOpacity
          style={styles.overlayTouchable}
          activeOpacity={1}
          onPress={onClose}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
  },
  overlayTouchable: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sidebar: {
    width: 280,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0a7ea4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#11181C',
  },
  userRole: {
    fontSize: 12,
    color: '#687076',
    marginTop: 2,
  },
  closeButton: {
    padding: 5,
  },
  menuContainer: {
    flex: 1,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  activeMenuItem: {
    backgroundColor: '#f5f5f5',
    borderLeftWidth: 3,
    borderLeftColor: '#0a7ea4',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuItemText: {
    fontSize: 16,
    color: '#11181C',
    marginLeft: 12,
  },
  subMenu: {
    backgroundColor: '#f9f9f9',
  },
  subMenuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    paddingLeft: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  subMenuItemText: {
    fontSize: 14,
    color: '#687076',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    padding: 15,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  logoutText: {
    fontSize: 16,
    color: '#f44336',
    marginLeft: 12,
    fontWeight: '600',
  },
});

