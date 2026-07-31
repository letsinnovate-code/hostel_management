import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface Notification {
    id?: string;
    title: string;
    message?: string;
    content?: string;
    createdAt?: string;
    read?: boolean;
    type?: 'announcement' | 'alert' | 'info';
    priority?: 'high' | 'medium' | 'low';
}

interface Permission {
    id: string;
    type: string;
    reason?: string;
    description?: string;
    status: 'pending' | 'approved' | 'rejected';
    createdAt?: string;
}

interface RecentNotificationsProps {
    notifications: Notification[];
    onViewAll?: () => void;
}

interface RecentPermissionsProps {
    permissions: Permission[];
    onViewAll?: () => void;
}

export function RecentNotifications({ notifications, onViewAll }: RecentNotificationsProps) {
    const router = useRouter();

    const getNotificationIcon = (type?: string) => {
        switch (type) {
            case 'alert':
                return { name: 'warning', color: '#ef4444' };
            case 'announcement':
                return { name: 'megaphone', color: '#f59e0b' };
            default:
                return { name: 'information-circle', color: '#3b82f6' };
        }
    };

    return (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={styles.headerLeft}>
                    <Ionicons name="notifications" size={20} color="#a855f7" />
                    <Text style={styles.cardTitle}>Recent Notifications</Text>
                </View>
            </View>

            <View style={styles.list}>
                {notifications.length > 0 ? (
                    notifications.slice(0, 5).map((notification, index) => {
                        const icon = getNotificationIcon(notification.type);
                        return (
                            <View key={notification.id || index} style={styles.listItem}>
                                <View style={[styles.iconBadge, { backgroundColor: `${icon.color}20` }]}>
                                    <Ionicons name={icon.name as any} size={16} color={icon.color} />
                                </View>
                                <View style={styles.itemContent}>
                                    <Text style={styles.itemTitle} numberOfLines={1}>
                                        {notification.title}
                                    </Text>
                                    <Text style={styles.itemSubtitle} numberOfLines={2}>
                                        {notification.message || notification.content}
                                    </Text>
                                    {notification.createdAt && (
                                        <Text style={styles.itemDate}>
                                            {new Date(notification.createdAt).toLocaleDateString()}
                                        </Text>
                                    )}
                                </View>
                                {!notification.read && <View style={styles.unreadDot} />}
                            </View>
                        );
                    })
                ) : (
                    <Text style={styles.emptyText}>No recent notifications</Text>
                )}
            </View>

            {notifications.length > 0 && (
                <TouchableOpacity
                    style={styles.viewAllButton}
                    onPress={() => onViewAll?.() || router.push('/(student)/notifications')}
                >
                    <Text style={styles.viewAllText}>View All Notifications →</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

export function RecentPermissions({ permissions, onViewAll }: RecentPermissionsProps) {
    const router = useRouter();

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'approved':
                return '#10b981';
            case 'rejected':
                return '#ef4444';
            default:
                return '#f59e0b';
        }
    };

    return (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={styles.headerLeft}>
                    <Ionicons name="shield-checkmark" size={20} color="#f59e0b" />
                    <Text style={styles.cardTitle}>Recent Permissions</Text>
                </View>
            </View>

            <View style={styles.list}>
                {permissions.length > 0 ? (
                    permissions.slice(0, 3).map((permission, index) => {
                        const statusColor = getStatusColor(permission.status);
                        const key = permission._id ?? permission.id ?? `perm-${index}`;
                        return (
                            <View key={key} style={styles.listItem}>
                                <View style={[styles.iconBadge, { backgroundColor: `${statusColor}20` }]}>
                                    <Ionicons name="document-text" size={16} color={statusColor} />
                                </View>
                                <View style={styles.itemContent}>
                                    <View style={styles.permissionHeader}>
                                        <Text style={styles.itemTitle} numberOfLines={1}>
                                            {permission.type}
                                        </Text>
                                        <View
                                            style={[
                                                styles.statusBadge,
                                                { backgroundColor: `${statusColor}20`, borderColor: statusColor },
                                            ]}
                                        >
                                            <Text style={[styles.statusText, { color: statusColor }]}>
                                                {permission.status}
                                            </Text>
                                        </View>
                                    </View>
                                    <Text style={styles.itemSubtitle} numberOfLines={2}>
                                        {permission.reason || permission.description}
                                    </Text>
                                    {permission.createdAt && (
                                        <Text style={styles.itemDate}>
                                            {new Date(permission.createdAt).toLocaleDateString()}
                                        </Text>
                                    )}
                                </View>
                            </View>
                        );
                    })
                ) : (
                    <Text style={styles.emptyText}>No recent permissions</Text>
                )}
            </View>

            {permissions.length > 0 && (
                <TouchableOpacity
                    style={styles.viewAllButton}
                    onPress={() => onViewAll?.() || router.push('/(student)/permissions')}
                >
                    <Text style={styles.viewAllText}>View All Permissions →</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginVertical: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    list: {
        gap: 12,
    },
    listItem: {
        flexDirection: 'row',
        gap: 12,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f9fafb',
    },
    iconBadge: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    itemContent: {
        flex: 1,
        gap: 4,
    },
    itemTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    itemSubtitle: {
        fontSize: 13,
        color: '#6b7280',
        lineHeight: 18,
    },
    itemDate: {
        fontSize: 11,
        color: '#9ca3af',
        marginTop: 2,
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#3b82f6',
        marginTop: 4,
    },
    permissionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        borderWidth: 1,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '600',
        textTransform: 'capitalize',
    },
    emptyText: {
        textAlign: 'center',
        color: '#9ca3af',
        paddingVertical: 20,
        fontSize: 14,
    },
    viewAllButton: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f3f4f6',
        alignItems: 'center',
    },
    viewAllText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6366f1',
    },
});
