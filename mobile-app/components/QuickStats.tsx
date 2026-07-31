import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface StatsProps {
  pendingPermissions: number;
  unreadNotifications: number;
  violations: number;
  activeComplaints: number;
  pendingPayments?: number;
  pendingPaymentsAmount?: number;
}

const STATS = [
  {
    label: 'Pending Permissions',
    valueKey: 'pendingPermissions' as const,
    icon: 'shield-checkmark' as const,
    color: '#2563eb',
    bg: '#eff6ff',
  },
  {
    label: 'Unread Notifications',
    valueKey: 'unreadNotifications' as const,
    icon: 'notifications' as const,
    color: '#7c3aed',
    bg: '#f5f3ff',
  },
  {
    label: 'Violations',
    valueKey: 'violations' as const,
    icon: 'alert-circle' as const,
    color: '#dc2626',
    bg: '#fef2f2',
  },
  {
    label: 'Active Complaints',
    valueKey: 'activeComplaints' as const,
    icon: 'document-text' as const,
    color: '#059669',
    bg: '#ecfdf5',
  },
  {
    label: 'Pending Payments',
    valueKey: 'pendingPayments' as const,
    icon: 'card' as const,
    color: '#b45309',
    bg: '#fffbeb',
  },
];

export default function QuickStats({
  pendingPermissions,
  unreadNotifications,
  violations,
  activeComplaints,
  pendingPayments = 0,
}: StatsProps) {
  const values = {
    pendingPermissions,
    unreadNotifications,
    violations,
    activeComplaints,
    pendingPayments,
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.grid}>
        {STATS.map((stat, index) => {
          const value = values[stat.valueKey];
          return (
            <View key={index} style={styles.card}>
              <View style={[styles.iconCircle, { backgroundColor: stat.bg }]}>
                <Ionicons name={stat.icon} size={22} color={stat.color} />
              </View>
              <View style={styles.textBlock}>
                <Text style={styles.label} numberOfLines={2}>
                  {stat.label}
                </Text>
                <Text style={styles.value}>{value}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fafafa',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
    marginBottom: 2,
  },
  value: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
  },
});
