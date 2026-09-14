import { useEffect } from 'react';
import { View, TouchableOpacity, BackHandler } from 'react-native';
import { Tabs, useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HapticTab } from '../../components/haptic-tab';
import TabSwipeHandler from '../../components/TabSwipeHandler';
import { NotificationsOverlayProvider } from '../../contexts/NotificationsOverlayContext';
import NotificationsScreenOverlay from '../../components/NotificationsScreenOverlay';

/**
 * Back button component for hidden tab screens.
 * Navigates back in history if possible, otherwise falls back to parentTab.
 */
function BackButton({ parentTab }: { parentTab: string }) {
  const router = useRouter();
  const handlePress = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.navigate(parentTab as any);
    }
  };
  return (
    <TouchableOpacity
      onPress={handlePress}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      style={{ paddingLeft: 8 }}
    >
      <Ionicons name="chevron-back" size={26} color="#0a7ea4" />
    </TouchableOpacity>
  );
}

// Screens accessible from the "More" tab
const moreBackButton = () => <BackButton parentTab="/(student)/more" />;
// Screens accessible from the "Services" tab
const servicesBackButton = () => <BackButton parentTab="/(student)/services" />;
// Screens accessible from the "Mess" tab
const messFeedbackBackButton = () => <BackButton parentTab="/(student)/mess" />;
// Screens accessible from the "Dashboard" tab
const dashboardBackButton = () => <BackButton parentTab="/(student)/dashboard" />;

export default function StudentLayout() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 56 + insets.bottom;
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const onHardwareBack = () => {
      const current = pathname?.split('/').filter(Boolean).pop() || '';

      // Services sub-screens -> go back or return to Services
      if (['leave', 'maintenance', 'fees'].includes(current)) {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.navigate('/(student)/services');
        }
        return true;
      }

      // More sub-screens -> go back or return to More
      if (['permissions', 'visitors', 'violations', 'complaints', 'profile', 'support'].includes(current)) {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.navigate('/(student)/more');
        }
        return true;
      }

      // Mess Feedback screen -> go back or return to Mess
      if (current === 'mess-feedback') {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.navigate('/(student)/mess');
        }
        return true;
      }

      // Main tabs (dashboard, map, mess, services, more)
      // Return false to let Android exit/minimize the app normally, without redirecting to dashboard
      return false;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => sub.remove();
  }, [pathname, router]);

  return (
    <NotificationsOverlayProvider>
      <View style={{ flex: 1 }}>
      <Tabs
      backBehavior="none"
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
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="briefcase-outline" size={size} color={color} />
          ),
        }}
      />
      {/* Hidden screens reachable from More tab */}
      <Tabs.Screen
        name="notifications"
        options={{ href: null, title: 'Notifications', headerLeft: moreBackButton }}
      />
      <Tabs.Screen
        name="permissions"
        options={{ href: null, title: 'Permissions', headerLeft: moreBackButton }}
      />
      <Tabs.Screen
        name="visitors"
        options={{ href: null, title: 'Visitor Requests', headerLeft: moreBackButton }}
      />
      <Tabs.Screen
        name="violations"
        options={{ href: null, title: 'Violations', headerLeft: moreBackButton }}
      />
      <Tabs.Screen
        name="complaints"
        options={{ href: null, title: 'Complaints', headerLeft: moreBackButton }}
      />
      <Tabs.Screen
        name="profile"
        options={{ href: null, title: 'Profile', headerLeft: moreBackButton }}
      />
      <Tabs.Screen
        name="mess-feedback"
        options={{ href: null, title: 'Mess Feedback', headerLeft: messFeedbackBackButton }}
      />
      <Tabs.Screen
        name="support"
        options={{ href: null, title: 'Support Tickets', headerLeft: moreBackButton }}
      />
      {/* Hidden screens reachable from Services tab */}
      <Tabs.Screen
        name="leave"
        options={{ href: null, title: 'Leave', headerLeft: servicesBackButton }}
      />
      <Tabs.Screen
        name="maintenance"
        options={{ href: null, title: 'Maintenance', headerLeft: servicesBackButton }}
      />
      <Tabs.Screen
        name="fees"
        options={{ href: null, title: 'Fees', headerLeft: servicesBackButton }}
      />
      {/* More tab */}
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="ellipsis-horizontal" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
      <TabSwipeHandler />
      <NotificationsScreenOverlay />
      </View>
    </NotificationsOverlayProvider>
  );
}
