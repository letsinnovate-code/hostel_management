import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { Alert } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { ToastProvider } from '../contexts/ToastContext';
import FirebaseNotificationService from '../services/FirebaseNotificationService';

// Register FCM background handler as early as possible (required by Firebase)
FirebaseNotificationService.setupBackgroundHandler();

function MainLayout() {
  const { user, loading, token } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inProtectedGroup = ['(student)', '(warden)', '(cleaner)', '(owner)'].includes(segments[0] as string);

    if (!token && inProtectedGroup) {
      // Redirect to login if user is not authenticated and trying to access protected routes
      router.replace('/(auth)/login');
    } else if (token && inAuthGroup) {
      // Redirect to index (which handles role-based routing) if user is authenticated and in auth group
      router.replace('/');
    }
  }, [token, loading, segments]);

  // FCM: foreground messages and notification opened (for students)
  useEffect(() => {
    if (!token || user?.role !== 'student') return;
    const navigateFromNotification = (remoteMessage: any) => {
      const screen = remoteMessage?.data?.screen;
      if (screen === 'AttendanceScreen' || screen === 'Dashboard') router.replace('/(student)/dashboard');
      else if (screen === 'Notifications') router.replace('/(student)/notifications');
      else if (screen === 'violations') router.replace('/(student)/violations');
      else if (screen === 'leave') router.replace('/(student)/leave');
    };
    FirebaseNotificationService.getInitialNotification().then((remoteMessage) => {
      if (remoteMessage) navigateFromNotification(remoteMessage);
    });
    const unsubForeground = FirebaseNotificationService.setupForegroundHandler((remoteMessage) => {
      const data = remoteMessage?.data || {};
      const notif = remoteMessage?.notification;
      const title = notif?.title || data?.title || 'Notification';
      const body = notif?.body || data?.body || '';
      if (data?.type === 'leave_approved' || data?.type === 'leave_rejected') {
        Alert.alert(title, body || (data.type === 'leave_approved' ? 'Your leave request has been approved.' : 'Your leave request was not approved.'), [
          { text: 'View', onPress: () => router.replace('/(student)/leave') },
          { text: 'OK' },
        ]);
      }
    });
    const unsubOpened = FirebaseNotificationService.onNotificationOpenedApp(navigateFromNotification);
    return () => {
      unsubForeground();
      unsubOpened();
    };
  }, [token, user?.role]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(student)" />
      <Stack.Screen name="(warden)" />
      <Stack.Screen name="(cleaner)" />
      <Stack.Screen name="(owner)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <ToastProvider>
            <MainLayout />
          </ToastProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
