import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface StatusCardProps {
    /** Only 2 states: 'inside' | 'outside'. Unknown/null treated as outside. */
    status: 'inside' | 'outside' | string;
    room?: string;
    hostel?: string;
    lastUpdate?: string;
    /** Distance in km from hostel when outside. Shown as "X km away" */
    distanceKm?: number | null;
    isTracking?: boolean;
    onEnableLocation?: () => void;
    onCheckIn?: () => void;
    onCheckOut?: () => void;
    checkInOutLoading?: boolean;
    loading?: boolean;
    /** Seconds remaining until check-in is allowed again after checkout (2-min cooldown). When set, Check In is disabled and timer is shown. */
    checkInCooldownSeconds?: number | null;
}

function formatCooldown(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function StatusCard({
    status,
    room,
    hostel,
    lastUpdate,
    distanceKm,
    isTracking,
    onEnableLocation,
    onCheckIn,
    onCheckOut,
    checkInOutLoading,
    loading,
    checkInCooldownSeconds,
}: StatusCardProps) {
    const isInside = status === 'inside';
    const statusColor = isInside ? '#10b981' : '#f59e0b';
    const statusBg = isInside ? '#ecfdf5' : '#fffbeb';
    const statusText = isInside ? 'Inside Hostel' : (distanceKm != null ? `Outside Hostel · ${distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m away` : `${distanceKm.toFixed(1)} km away`}` : 'Outside Hostel');
    const statusIcon = isInside ? 'home' : 'walk';

    return (
        <View style={styles.card}>
            {/* Background decoration */}
            <LinearGradient
                colors={['#f8fafc', '#f1f5f9']}
                style={styles.bgGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />

            <View style={styles.content}>
                <View style={styles.mainStatusContainer}>
                    <View style={[styles.statusCircle, { borderColor: statusColor, backgroundColor: statusBg }]}>
                        <Ionicons name={statusIcon as any} size={48} color={statusColor} />
                    </View>
                    <View style={styles.statusInfo}>
                        <Text style={styles.statusLabel}>Current Presencess</Text>
                        <Text style={[styles.statusValueText, { color: statusColor }]}>{statusText}</Text>
                        <View style={styles.lastUpdateRow}>
                            <Ionicons name="time-outline" size={14} color="#6b7280" />
                            <Text style={styles.lastUpdateText}>
                                {lastUpdate ? `Updated: ${lastUpdate}` : 'Awaiting location update...'}
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.statsGrid}>
                    <View style={styles.statItem}>
                        <View style={styles.statHeader}>
                            <Ionicons name="bed-outline" size={14} color="#6366f1" />
                            <Text style={styles.statLabelSmall}>Room</Text>
                        </View>
                        <Text style={styles.statValue}>{room || 'N/A'}</Text>
                    </View>
                    <View style={styles.statItem}>
                        <View style={styles.statHeader}>
                            <Ionicons name="business-outline" size={14} color="#6366f1" />
                            <Text style={styles.statLabelSmall}>Hostel</Text>
                        </View>
                        <Text style={styles.statValue}>{hostel || 'N/A'}</Text>
                    </View>
                </View>

                {/* Check-in / Check-out: location-based. Check-out only when inside. 2-min cooldown after checkout. */}
                {(onCheckIn || onCheckOut) && (
                    <View style={styles.checkInOutRow}>
                        {isInside && onCheckOut && (
                            <TouchableOpacity
                                style={[styles.checkOutButton, checkInOutLoading && styles.buttonDisabled]}
                                onPress={onCheckOut}
                                disabled={checkInOutLoading}
                            >
                                <Ionicons name="exit-outline" size={20} color="#fff" />
                                <Text style={styles.checkOutButtonText}>Check Out</Text>
                            </TouchableOpacity>
                        )}
                        {!isInside && onCheckIn && (
                            <>
                                {checkInCooldownSeconds != null && checkInCooldownSeconds > 0 ? (
                                    <View style={styles.cooldownBanner}>
                                        <Ionicons name="time-outline" size={20} color="#f59e0b" />
                                        <Text style={styles.cooldownText}>
                                            You can check in again in {formatCooldown(checkInCooldownSeconds)}
                                        </Text>
                                    </View>
                                ) : (
                                    <TouchableOpacity
                                        style={[styles.checkInButton, checkInOutLoading && styles.buttonDisabled]}
                                        onPress={onCheckIn}
                                        disabled={checkInOutLoading}
                                    >
                                        <Ionicons name="enter-outline" size={20} color="#fff" />
                                        <Text style={styles.checkInButtonText}>Check In</Text>
                                    </TouchableOpacity>
                                )}
                            </>
                        )}
                    </View>
                )}

                <View style={styles.trackingContainer}>
                    {!isTracking && onEnableLocation && (
                        <>
                            <Text style={styles.trackingHint}>
                                Enable background location to get automatically checked in when you’re inside the hostel without opening the app.
                            </Text>
                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={onEnableLocation}
                                disabled={loading}
                            >
                                <Text style={styles.actionButtonText}>Enable auto check-in</Text>
                                <Ionicons name="location-outline" size={18} color="#fff" />
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#fff',
        borderRadius: 24,
        marginVertical: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 6,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    bgGradient: {
        ...StyleSheet.absoluteFillObject,
    },
    content: {
        padding: 24,
    },
    mainStatusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 20,
        marginBottom: 20,
    },
    statusCircle: {
        width: 88,
        height: 88,
        borderRadius: 44,
        borderWidth: 4,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    statusInfo: {
        flex: 1,
    },
    statusLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    statusValueText: {
        fontSize: 24,
        fontWeight: '800',
        marginVertical: 4,
    },
    lastUpdateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    lastUpdateText: {
        fontSize: 12,
        color: '#94a3b8',
    },
    divider: {
        height: 1,
        backgroundColor: '#f1f5f9',
        marginBottom: 20,
    },
    statsGrid: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 20,
    },
    statItem: {
        flex: 1,
        padding: 12,
        backgroundColor: '#f8fafc',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    statHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    statLabelSmall: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748b',
    },
    statValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
    },
    trackingContainer: {
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: 10,
    },
    trackingHint: {
        fontSize: 13,
        color: '#64748b',
        lineHeight: 18,
    },
    trackingIndicator: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        gap: 8,
    },
    pulse: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    trackingText: {
        fontSize: 13,
        fontWeight: '600',
    },
    actionButton: {
        backgroundColor: '#6366f1',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        gap: 6,
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    actionButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },
    checkInOutRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    checkInButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: '#10b981',
        gap: 8,
    },
    checkOutButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: '#f59e0b',
        gap: 8,
    },
    checkInButtonText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
    },
    checkOutButtonText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    cooldownBanner: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: '#fffbeb',
        borderWidth: 1,
        borderColor: '#fcd34d',
    },
    cooldownText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#b45309',
    },
});
