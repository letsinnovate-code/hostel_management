import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.88, 360);

export interface NotificationItem {
  id: string;
  title: string;
  message?: string;
  content?: string;
  createdAt?: string;
  read?: boolean;
  type?: 'announcement' | 'alert' | 'info';
}

interface NotificationsDrawerProps {
  visible: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  loading?: boolean;
  onMarkRead?: (id: string) => void;
  onRefresh?: () => void;
  /** Safe area top inset so header clears status bar */
  topInset?: number;
}

function getIcon(type?: string) {
  switch (type) {
    case 'alert': return { name: 'warning' as const, color: '#ef4444' };
    case 'announcement': return { name: 'megaphone' as const, color: '#f59e0b' };
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

export default function NotificationsDrawer({
  visible,
  onClose,
  notifications,
  loading,
  onMarkRead,
  onRefresh,
  topInset = 0,
}: NotificationsDrawerProps) {
  const translateX = useRef(new Animated.Value(DRAWER_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: visible ? 0 : DRAWER_WIDTH,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }),
      Animated.timing(backdropOpacity, {
        toValue: visible ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible]);

  const renderItem = ({ item }: { item: NotificationItem }) => {
    const icon = getIcon(item.type);
    return (
      <TouchableOpacity
        style={[styles.notifCard, !item.read && styles.unreadCard]}
        activeOpacity={0.8}
        onPress={() => {
          if (!item.read && onMarkRead) onMarkRead(item.id);
        }}
      >
        <View style={[styles.iconBg, { backgroundColor: `${icon.color}20` }]}>
          <Ionicons name={icon.name} size={20} color={icon.color} />
        </View>
        <View style={styles.notifBody}>
          <Text style={[styles.notifTitle, !item.read && styles.unreadTitle]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.notifMessage} numberOfLines={2}>
            {item.message || item.content || ''}
          </Text>
          <Text style={styles.notifDate}>{formatDate(item.createdAt)}</Text>
        </View>
        {!item.read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} pointerEvents={visible ? 'auto' : 'none'} />
      </TouchableWithoutFeedback>
      <Animated.View style={[styles.drawer, { width: DRAWER_WIDTH, transform: [{ translateX }] }]}>
        <View style={[styles.drawerHeader, { paddingTop: topInset + 12 }]}>
          <Text style={styles.drawerTitle}>Notifications</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={24} color="#64748b" />
          </TouchableOpacity>
        </View>
        {loading && notifications.length === 0 ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color="#7c3aed" />
          </View>
        ) : (
          <FlatList
            data={notifications}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="notifications-off-outline" size={40} color="#94a3b8" />
                <Text style={styles.emptyText}>No notifications</Text>
              </View>
            }
            onRefresh={onRefresh}
            refreshing={loading}
          />
        )}
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 16,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  drawerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  closeBtn: {
    padding: 4,
  },
  listContent: {
    padding: 12,
    paddingBottom: 32,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 48,
  },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  unreadCard: {
    backgroundColor: '#f8fafc',
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  iconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notifBody: {
    flex: 1,
    minWidth: 0,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 2,
  },
  unreadTitle: {
    color: '#0f172a',
    fontWeight: '700',
  },
  notifMessage: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  notifDate: {
    fontSize: 11,
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
    paddingTop: 48,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 15,
    color: '#94a3b8',
  },
});

export { DRAWER_WIDTH };
