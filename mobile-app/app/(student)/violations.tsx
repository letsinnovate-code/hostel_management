import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Violation {
    id: string;
    type: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
    date: string;
    status: 'pending' | 'resolved' | 'appealed';
}

const mockViolations: Violation[] = [
    {
        id: '1',
        type: 'Late Check-in',
        description: 'Checked in after curfew time (11:00 PM)',
        severity: 'medium',
        date: '2026-01-10',
        status: 'resolved',
    },
    {
        id: '2',
        type: 'Noise Complaint',
        description: 'Loud music during quiet hours',
        severity: 'low',
        date: '2026-01-05',
        status: 'resolved',
    },
];

export default function ViolationsScreen() {
    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'high':
                return '#ef4444';
            case 'medium':
                return '#f59e0b';
            default:
                return '#3b82f6';
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'resolved':
                return '#10b981';
            case 'appealed':
                return '#6366f1';
            default:
                return '#f59e0b';
        }
    };

    const renderItem = ({ item }: { item: Violation }) => {
        const severityColor = getSeverityColor(item.severity);
        const statusColor = getStatusColor(item.status);

        return (
            <View style={[styles.card, { borderLeftColor: severityColor }]}>
                <View style={styles.cardHeader}>
                    <View style={styles.headerLeft}>
                        <View style={[styles.severityBadge, { backgroundColor: `${severityColor}20` }]}>
                            <Ionicons name="warning" size={20} color={severityColor} />
                        </View>
                        <View style={styles.titleSection}>
                            <Text style={styles.violationType}>{item.type}</Text>
                            <Text style={styles.violationDate}>
                                {new Date(item.date).toLocaleDateString('en-IN', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                })}
                            </Text>
                        </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20`, borderColor: statusColor }]}>
                        <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
                    </View>
                </View>

                <Text style={styles.description}>{item.description}</Text>

                <View style={styles.footer}>
                    <View style={styles.severityTag}>
                        <Text style={[styles.severityText, { color: severityColor }]}>
                            {item.severity.toUpperCase()} SEVERITY
                        </Text>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {mockViolations.length === 0 ? (
                <View style={styles.emptyState}>
                    <View style={styles.emptyIconContainer}>
                        <Ionicons name="checkmark-circle" size={64} color="#10b981" />
                    </View>
                    <Text style={styles.emptyTitle}>No Violations!</Text>
                    <Text style={styles.emptyText}>You have a clean record. Keep up the good work!</Text>
                </View>
            ) : (
                <>
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Violation History</Text>
                        <Text style={styles.headerSubtitle}>
                            {mockViolations.length} violation{mockViolations.length !== 1 ? 's' : ''} on record
                        </Text>
                    </View>

                    <FlatList
                        data={mockViolations}
                        renderItem={renderItem}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.listContent}
                    />
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
    },
    header: {
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#6b7280',
        marginTop: 4,
    },
    listContent: {
        padding: 16,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderLeftWidth: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    headerLeft: {
        flexDirection: 'row',
        gap: 12,
        flex: 1,
    },
    severityBadge: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    titleSection: {
        flex: 1,
    },
    violationType: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    violationDate: {
        fontSize: 12,
        color: '#6b7280',
        marginTop: 2,
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '600',
        textTransform: 'capitalize',
    },
    description: {
        fontSize: 14,
        color: '#4b5563',
        lineHeight: 20,
        marginBottom: 12,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    severityTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#f9fafb',
        borderRadius: 6,
    },
    severityText: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    emptyIconContainer: {
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 16,
        color: '#6b7280',
        textAlign: 'center',
    },
});
