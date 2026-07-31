import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HapticTab } from '../../components/haptic-tab';

export default function OwnerLayout() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 56 + insets.bottom;

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: '#0a7ea4',
        tabBarInactiveTintColor: '#687076',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#e5e5e5',
          paddingBottom: insets.bottom + 8,
          paddingTop: 8,
          height: tabBarHeight,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
        tabBarButton: (props) => <HapticTab {...props} />,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Home',
          headerTitle: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="students"
        options={{
          title: 'Students',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="staff"
        options={{
          title: 'Staff',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          title: 'Payments',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="wallet-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="mess"
        options={{
          title: 'Mess',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="restaurant-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="security"
        options={{
          title: 'Security',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="shield-checkmark-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="hostels"
        options={{ href: null, title: 'Hostels' }}
      />
      <Tabs.Screen
        name="more"
        options={{ href: null, title: 'More' }}
      />
      <Tabs.Screen
        name="hostel-detail"
        options={{ href: null, title: 'Hostel Details' }}
      />
      <Tabs.Screen
        name="hostel-create"
        options={{ href: null, title: 'Create Hostel' }}
      />
      <Tabs.Screen
        name="rooms"
        options={{ href: null, title: 'Room Management' }}
      />
      <Tabs.Screen
        name="room-create"
        options={{ href: null, title: 'Create Room' }}
      />
      <Tabs.Screen
        name="room-detail/[id]"
        options={{ href: null, title: 'Room Details' }}
      />
      <Tabs.Screen
        name="room-edit/[id]"
        options={{ href: null, title: 'Edit Room' }}
      />
      <Tabs.Screen
        name="amenities"
        options={{ href: null, title: 'Amenities Setup' }}
      />
      <Tabs.Screen
        name="analytics"
        options={{ href: null, title: 'Analytics & Reports' }}
      />
      <Tabs.Screen
        name="broadcast"
        options={{ href: null, title: 'Broadcast Messages' }}
      />
      <Tabs.Screen
        name="fee-structure"
        options={{ href: null, title: 'Fee Structure' }}
      />
      <Tabs.Screen
        name="geo-fence"
        options={{ href: null, title: 'Geo-Fence Setup' }}
      />
      <Tabs.Screen
        name="violations"
        options={{ href: null, title: 'Violations' }}
      />
      <Tabs.Screen
        name="gate-logs"
        options={{ href: null, title: 'Gate Logs' }}
      />
      <Tabs.Screen
        name="students-map"
        options={{ href: null, title: 'All Students (Map)' }}
      />
      <Tabs.Screen
        name="rules"
        options={{ href: null, title: 'Rules & Policies' }}
      />
      <Tabs.Screen
        name="support"
        options={{ href: null, title: 'Support Tickets' }}
      />
      <Tabs.Screen
        name="templates"
        options={{ href: null, title: 'Templates' }}
      />
      <Tabs.Screen
        name="audit"
        options={{ href: null, title: 'Audit Trail' }}
      />
      <Tabs.Screen
        name="visitors"
        options={{ href: null, title: 'Guest Visit Requests' }}
      />
      <Tabs.Screen
        name="attendance"
        options={{ href: null, title: 'Attendance' }}
      />
      <Tabs.Screen
        name="presence"
        options={{ href: null, title: 'Student Presence' }}
      />
      <Tabs.Screen
        name="leave-requests"
        options={{ href: null, title: 'Leave Requests' }}
      />
      <Tabs.Screen
        name="maintenance"
        options={{ href: null, title: 'Maintenance' }}
      />
      <Tabs.Screen
        name="student-create"
        options={{ href: null, title: 'Add Student' }}
      />
      <Tabs.Screen
        name="student-edit/[id]"
        options={{ href: null }}
      />
    </Tabs>
  );
}
