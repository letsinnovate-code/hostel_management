import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useNotificationsOverlay } from '../../contexts/NotificationsOverlayContext';

/**
 * Notifications tab route: when navigated to (e.g. FCM deep link),
 * open the overlay and go to dashboard so the overlay appears on top.
 */
export default function NotificationsRedirect() {
  const router = useRouter();
  const { show } = useNotificationsOverlay();

  useEffect(() => {
    show();
    router.replace('/(student)/dashboard');
  }, [show, router]);

  return null;
}
