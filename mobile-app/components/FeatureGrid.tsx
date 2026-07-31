import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface FeatureItem {
    label: string;
    href: string;
    description: string;
}

interface FeatureSection {
    title: string;
    color: string;
    icon: keyof typeof Ionicons.glyphMap;
    items: FeatureItem[];
}

const featureSections: FeatureSection[] = [
    {
        title: 'Location & Hostel',
        color: '#0a7ea4',
        icon: 'location',
        items: [
            { label: 'My Location & Hostel Map', href: '/(student)/map', description: 'See your location and hostel boundary on map' },
        ],
    },
    {
        title: 'Profile & Settings',
        color: '#3b82f6',
        icon: 'person',
        items: [
            { label: 'My Profile', href: '/(student)/profile', description: 'View and manage your profile' },
        ],
    },
    {
        title: 'Permissions & Requests',
        color: '#f59e0b',
        icon: 'shield-checkmark',
        items: [
            { label: 'Permission Requests', href: '/(student)/permissions', description: 'Request permissions and track status' },
            { label: 'Visitor Requests', href: '/(student)/visitors', description: 'Request visitor access' },
        ],
    },
    {
        title: 'Complaints & Support',
        color: '#ef4444',
        icon: 'document-text',
        items: [
            { label: 'Submit Complaint', href: '/(student)/complaints', description: 'Submit and track complaints' },
            { label: 'Violation History', href: '/(student)/violations', description: 'View your violation records' },
        ],
    },
    {
        title: 'Notifications',
        color: '#a855f7',
        icon: 'notifications',
        items: [
            { label: 'Notice Board', href: '/(student)/notifications', description: 'View announcements and notices' },
        ],
    },
    {
        title: 'Services',
        color: '#78716c',
        icon: 'restaurant',
        items: [
            { label: 'Mess Feedback', href: '/(student)/mess-feedback', description: 'Submit mess feedback' },
            { label: 'Fees & Payments', href: '/(student)/fees', description: 'View payment history and pay online (Razorpay) or at office' },
        ],
    },
];

export default function FeatureGrid() {
    const router = useRouter();

    return (
        <View style={styles.container}>
            {featureSections.map((section, sectionIndex) => (
                <View key={sectionIndex} style={styles.section}>
                    <View style={[styles.sectionHeader, { borderLeftColor: section.color }]}>
                        <View style={styles.sectionTitleRow}>
                            <Ionicons name={section.icon} size={18} color={section.color} />
                            <Text style={styles.sectionTitle}>{section.title}</Text>
                        </View>
                    </View>
                    <View style={styles.itemsGrid}>
                        {section.items.map((item, itemIndex) => (
                            <TouchableOpacity
                                key={itemIndex}
                                style={styles.featureCard}
                                onPress={() => router.push(item.href as any)}
                            >
                                <View style={styles.featureContent}>
                                    <Text style={styles.featureLabel}>{item.label}</Text>
                                    <Text style={styles.featureDescription} numberOfLines={2}>
                                        {item.description}
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        gap: 16,
    },
    section: {
        backgroundColor: '#fff',
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    sectionHeader: {
        padding: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
        borderLeftWidth: 4,
    },
    sectionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    itemsGrid: {
        padding: 12,
        gap: 8,
    },
    featureCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        backgroundColor: '#fff',
    },
    featureContent: {
        flex: 1,
        gap: 4,
    },
    featureLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    featureDescription: {
        fontSize: 12,
        color: '#6b7280',
        lineHeight: 16,
    },
});
