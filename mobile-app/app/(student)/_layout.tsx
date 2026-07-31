import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HapticTab } from '../../components/haptic-tab';
import TabSwipeHandler from '../../components/TabSwipeHandler';
import { NotificationsOverlayProvider } from '../../contexts/NotificationsOverlayContext';
import NotificationsScreenOverlay from '../../components/NotificationsScreenOverlay';

export default function StudentLayout() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 56 + insets.bottom;

  return (
    <NotificationsOverlayProvider>
      <View style={{ flex: 1 }}>
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
          fontSize: 12,
          fontWeight: '500',
        },
        tabBarButton: (props) => <HapticTab {...props} />,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Location',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="location-outline" size={size} color={color} />
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
        name="services"
        options={{
          title: 'Services',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="briefcase-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{ href: null, title: 'Notifications' }}
      />
      <Tabs.Screen
        name="leave"
        options={{ href: null, title: 'Leave' }}
      />
      <Tabs.Screen
        name="maintenance"
        options={{ href: null, title: 'Maintenance' }}
      />
      <Tabs.Screen
        name="fees"
        options={{ href: null, title: 'Fees' }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="ellipsis-horizontal" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="mess-feedback"
        options={{ href: null, title: 'Mess Feedback' }}
      />
      <Tabs.Screen
        name="permissions"
        options={{ href: null, title: 'Permissions' }}
      />
      <Tabs.Screen
        name="visitors"
        options={{ href: null, title: 'Visitor Requests' }}
      />
      <Tabs.Screen
        name="violations"
        options={{ href: null, title: 'Violations' }}
      />
      <Tabs.Screen
        name="complaints"
        options={{ href: null, title: 'Complaints' }}
      />
      <Tabs.Screen
        name="profile"
        options={{ href: null, title: 'Profile' }}
      />
    </Tabs>
      <TabSwipeHandler />
      <NotificationsScreenOverlay />
      </View>
    </NotificationsOverlayProvider>
  );
}
