import React, { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { useNotificationsOverlay } from '../contexts/NotificationsOverlayContext';

export interface NotificationItem {
  id: string;
  title: string;
  message?: string;
  content?: string;
  createdAt?: string;
  read?: boolean;
  type?: 'announcement' | 'alert' | 'info';
}

function getIcon(type?: string, title?: string) {
  const t = (title || '').toLowerCase();
  if (t.includes('auto check-in') || t.includes('check-in')) return { name: 'checkmark-circle' as const, color: '#22c55e' };
  if (t.includes('violation')) return { name: 'warning' as const, color: '#ef4444' };
  if (t.includes('approval') || t.includes('leave') || t.includes('request')) return { name: 'document-text' as const, color: '#8b5cf6' };
  if (t.includes('fee') || t.includes('payment') || t.includes('due')) return { name: 'card' as const, color: '#f59e0b' };
  switch (type) {
    case 'alert': return { name: 'warning' as const, color: '#ef4444' };
    case 'announcement': return { name: 'megaphone' as const, color: '#f59e0b' };
    case 'emergency': return { name: 'alert-circle' as const, color: '#dc2626' };
    default: return { name: 'information-circle' as const, color: '#3b82f6' };
  }
}

function formatDate(createdAt?: string) {
  if (!createdAt) return '';
  const d = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

export default function NotificationsScreenOverlay() {
  const router = useRouter();
  const { user } = useAuth();
  const { isVisible, hide } = useNotificationsOverlay();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getNotifications();
      const data = res?.data ?? res;
      const raw = Array.isArray(data) ? data : (data && Array.isArray(data.notifications) ? data.notifications : []);
      const list: NotificationItem[] = raw.map((n: any) => {
        const read = n.read === true || (Array.isArray(n.isRead) && n.isRead.some((r: any) => (r.userId?._id ?? r.userId)?.toString() === user?.id));
        return {
          id: n._id || n.id,
          title: n.title,
          message: n.message,
          content: n.message,
          createdAt: n.createdAt,
          read,
          type: n.type,
        };
      });
      setNotifications(list);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (isVisible) loadNotifications();
  }, [isVisible, loadNotifications]);

  const closeOverlay = useCallback(() => {
    hide();
    router.replace('/(student)/dashboard');
  }, [hide, router]);

  const handleMarkRead = useCallback(async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch {}
  }, []);

  const handleDismiss = useCallback(async (id: string) => {
    try {
      await api.dismissNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch {}
  }, []);

  const handleClearAll = useCallback(async () => {
    if (notifications.length === 0) return;
    const ids = notifications.map((n) => n.id);
    setNotifications([]);
    try {
      await Promise.all(ids.map((id) => api.dismissNotification(id).catch(() => {})));
    } catch {}
  }, [notifications]);

  useEffect(() => {
    if (!isVisible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      hide();
      router.replace('/(student)/dashboard');
      return true;
    });
    return () => sub.remove();
  }, [isVisible, hide, router]);

  const renderItem = ({ item }: { item: NotificationItem }) => {
    const icon = getIcon(item.type, item.title);
    return (
      <View style={[styles.card, !item.read && styles.unreadCard]}>
        <TouchableOpacity
          style={styles.cardTouchable}
          activeOpacity={0.8}
          onPress={() => { if (!item.read) handleMarkRead(item.id); }}
        >
          <View style={[styles.iconBg, { backgroundColor: `${icon.color}20` }]}>
            <Ionicons name={icon.name} size={20} color={icon.color} />
          </View>
          <View style={styles.body}>
            <Text style={[styles.title, !item.read && styles.unreadTitle]} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.message} numberOfLines={2}>{item.message || item.content || ''}</Text>
            <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
          </View>
          {!item.read && <View style={styles.unreadDot} />}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.dismissBtn}
          onPress={() => handleDismiss(item.id)}
          hitSlop={8}
        >
          <Ionicons name="close-circle-outline" size={22} color="#94a3b8" />
        </TouchableOpacity>
      </View>
    );
  };

  if (!isVisible) return null;

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <View style={styles.overlay}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={closeOverlay} style={styles.backBtn} hitSlop={12}>
            <Ionicons name="chevron-back" size={28} color="#0f172a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          {notifications.length > 0 ? (
            <TouchableOpacity onPress={handleClearAll} style={styles.clearAllBtn} hitSlop={8}>
              <Text style={styles.clearAllText}>Clear all</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.headerRight} />
          )}
        </View>
        {loading && notifications.length === 0 ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#7c3aed" />
          </View>
        ) : (
          <FlatList
            data={notifications}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="notifications-off-outline" size={48} color="#94a3b8" />
                <Text style={styles.emptyText}>No notifications</Text>
              </View>
            }
            onRefresh={() => { setRefreshing(true); loadNotifications(); }}
            refreshing={refreshing}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    zIndex: 1000,
    elevation: 1000,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    padding: 4,
    marginRight: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
  headerRight: {
    width: 36,
  },
  clearAllBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  clearAllText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0a7ea4',
  },
  listContent: {
    padding: 16,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    padding: 14,
    paddingRight: 8,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  cardTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    minWidth: 0,
  },
  dismissBtn: {
    padding: 4,
    marginLeft: 4,
  },
  unreadCard: {
    backgroundColor: '#f8fafc',
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  iconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 2,
  },
  unreadTitle: {
    color: '#0f172a',
    fontWeight: '700',
  },
  message: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  date: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3b82f6',
    marginLeft: 8,
    marginTop: 6,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: '#94a3b8',
  },
});
