import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    TextInput,
    Modal,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    Keyboard,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import { getApiErrorMessage } from '../../services/api';

function formatVisitDateTime(isoOrEmpty: string): string {
    if (!isoOrEmpty) return '';
    const d = new Date(isoOrEmpty);
    if (isNaN(d.getTime())) return isoOrEmpty;
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

interface Visitor {
    _id: string;
    visitorName: string;
    visitorPhone: string;
    purpose: string;
    visitDate?: string;
    status: 'pending' | 'approved' | 'rejected' | 'completed';
    rejectionReason?: string;
    createdAt: string;
    approvedBy?: { name: string };
}

export default function VisitorsScreen() {
    const [visitors, setVisitors] = useState<Visitor[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        purpose: '',
        visitDate: '',
        idProof: '',
    });
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [visitDateForPicker, setVisitDateForPicker] = useState<Date>(() => {
        const d = new Date();
        d.setMinutes(0, 0, 0);
        d.setHours(d.getHours() + 1, 0, 0, 0);
        return d;
    });

    const loadVisitors = useCallback(async () => {
        try {
            const res = await api.getVisitorRequests();
            const data = res?.data ?? res;
            setVisitors(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error('Failed to load visitor requests:', e);
            setVisitors([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadVisitors();
    }, [loadVisitors]);

    const onRefresh = () => {
        setRefreshing(true);
        loadVisitors();
    };

    const openDatePicker = () => {
        if (formData.visitDate) {
            const parsed = new Date(formData.visitDate);
            if (!isNaN(parsed.getTime())) setVisitDateForPicker(parsed);
        }
        setShowDatePicker(true);
    };

    const onVisitDateChange = (_: any, date?: Date) => {
        if (Platform.OS === 'android') setShowDatePicker(false);
        if (date) {
            setVisitDateForPicker(date);
            setFormData((prev) => ({ ...prev, visitDate: date.toISOString() }));
        }
    };

    const handleSubmit = async () => {
        if (!formData.name || !formData.phone || !formData.purpose || !formData.visitDate) {
            Alert.alert('Error', 'Please fill visitor name, phone, purpose and visit date.');
            return;
        }
        setSubmitting(true);
        try {
            const payload: Record<string, string> = {
                visitorName: formData.name.trim(),
                visitorPhone: formData.phone.trim(),
                purpose: formData.purpose.trim(),
                visitDate: formData.visitDate.trim(),
            };
            if (formData.idProof.trim()) payload.visitorIdProof = formData.idProof.trim();
            const res = await api.createVisitorRequest(payload);
            const created = res?.data ?? res;
            if (created?._id) {
                setVisitors([created as Visitor, ...visitors]);
                setModalVisible(false);
                setFormData({ name: '', phone: '', purpose: '', visitDate: '', idProof: '' });
                const next = new Date();
                next.setMinutes(0, 0, 0);
                next.setHours(next.getHours() + 1, 0, 0, 0);
                setVisitDateForPicker(next);
                setShowDatePicker(false);
                Alert.alert('Success', 'Visitor request submitted. You will be notified when the owner approves or rejects it.');
            } else {
                Alert.alert('Error', 'Request submitted but response was invalid.');
            }
        } catch (e: any) {
            Alert.alert('Error', getApiErrorMessage(e));
        } finally {
            setSubmitting(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'approved':
                return '#10b981';
            case 'rejected':
                return '#ef4444';
            default:
                return '#f59e0b';
        }
    };

    const renderItem = ({ item }: { item: Visitor }) => {
        const statusColor = getStatusColor(item.status);
        const name = item.visitorName ?? (item as any).name ?? 'Visitor';
        const phone = item.visitorPhone ?? (item as any).phone ?? '';
        const visitDate = item.visitDate ?? item.createdAt;

        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <View style={styles.visitorInfo}>
                        <View style={styles.avatarContainer}>
                            <Ionicons name="person" size={24} color="#6366f1" />
                        </View>
                        <View style={styles.nameSection}>
                            <Text style={styles.visitorName}>{name}</Text>
                            <Text style={styles.visitorPhone}>{phone}</Text>
                        </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20`, borderColor: statusColor }]}>
                        <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
                    </View>
                </View>
                <View style={styles.cardBody}>
                    <View style={styles.infoRow}>
                        <Ionicons name="document-text-outline" size={16} color="#6b7280" />
                        <Text style={styles.infoLabel}>Purpose:</Text>
                        <Text style={styles.infoValue}>{item.purpose}</Text>
                    </View>
                    {visitDate && (
                        <View style={styles.infoRow}>
                            <Ionicons name="calendar-outline" size={16} color="#6b7280" />
                            <Text style={styles.infoLabel}>Visit:</Text>
                            <Text style={styles.infoValue}>{formatVisitDateTime(visitDate)}</Text>
                        </View>
                    )}
                    <View style={styles.infoRow}>
                        <Ionicons name="time-outline" size={16} color="#6b7280" />
                        <Text style={styles.infoLabel}>Requested:</Text>
                        <Text style={styles.infoValue}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                    </View>
                    {item.status === 'rejected' && item.rejectionReason && (
                        <View style={styles.infoRow}>
                            <Ionicons name="alert-circle-outline" size={16} color="#ef4444" />
                            <Text style={styles.infoLabel}>Reason:</Text>
                            <Text style={[styles.infoValue, { color: '#ef4444' }]}>{item.rejectionReason}</Text>
                        </View>
                    )}
                </View>
            </View>
        );
    };

    if (loading && visitors.length === 0) {
        return (
            <View style={[styles.container, styles.centered]}>
                <ActivityIndicator size="large" color="#6366f1" />
                <Text style={styles.loadingText}>Loading visitor requests...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <FlatList
                data={visitors}
                renderItem={renderItem}
                keyExtractor={(item) => item._id}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6366f1']} />}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons name="people-outline" size={48} color="#9ca3af" />
                        <Text style={styles.emptyText}>No visitor requests yet</Text>
                        <Text style={styles.emptyHint}>Tap + to request guest visit permission</Text>
                    </View>
                }
            />

            <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
                <Ionicons name="add" size={28} color="#fff" />
            </TouchableOpacity>

            <Modal visible={modalVisible} animationType="slide" transparent>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalContainer}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
                >
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Request Visitor Access</Text>
                                <TouchableOpacity onPress={() => { setModalVisible(false); setShowDatePicker(false); Keyboard.dismiss(); }}>
                                    <Ionicons name="close" size={24} color="#6b7280" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView
                                style={styles.formScroll}
                                contentContainerStyle={styles.formScrollContent}
                                keyboardShouldPersistTaps="handled"
                                showsVerticalScrollIndicator={false}
                            >
                                <View style={styles.form}>
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>Visitor Name</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Enter visitor name"
                                            value={formData.name}
                                            onChangeText={(text) => setFormData((prev) => ({ ...prev, name: text }))}
                                        />
                                    </View>

                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>Phone Number</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="+91 XXXXX XXXXX"
                                            keyboardType="phone-pad"
                                            value={formData.phone}
                                            onChangeText={(text) => setFormData((prev) => ({ ...prev, phone: text }))}
                                        />
                                    </View>

                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>Purpose of Visit</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="e.g., Family Visit"
                                            value={formData.purpose}
                                            onChangeText={(text) => setFormData((prev) => ({ ...prev, purpose: text }))}
                                        />
                                    </View>

                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>Visit Date & Time</Text>
                                        <TouchableOpacity style={styles.dateTimeButton} onPress={openDatePicker} activeOpacity={0.7}>
                                            <Ionicons name="calendar-outline" size={20} color="#6366f1" />
                                            <Text style={[styles.dateTimeButtonText, !formData.visitDate && styles.dateTimePlaceholder]}>
                                                {formData.visitDate ? formatVisitDateTime(formData.visitDate) : 'Select date and time'}
                                            </Text>
                                            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
                                        </TouchableOpacity>
                                    </View>

                                    {showDatePicker && (
                                        <View style={styles.pickerWrap}>
                                            <DateTimePicker
                                                value={visitDateForPicker}
                                                mode="datetime"
                                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                                onChange={onVisitDateChange}
                                                minimumDate={new Date()}
                                            />
                                            {Platform.OS === 'ios' && (
                                                <TouchableOpacity style={styles.pickerDone} onPress={() => setShowDatePicker(false)}>
                                                    <Text style={styles.pickerDoneText}>Done</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    )}

                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>ID proof (optional)</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="e.g. Aadhaar last 4 digits"
                                            value={formData.idProof}
                                            onChangeText={(text) => setFormData((prev) => ({ ...prev, idProof: text }))}
                                        />
                                    </View>

                                    <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={submitting}>
                                        <Text style={styles.submitButtonText}>{submitting ? 'Submitting...' : 'Submit Request'}</Text>
                                    </TouchableOpacity>
                                </View>
                            </ScrollView>
                        </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
    },
    listContent: {
        padding: 16,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
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
    visitorInfo: {
        flexDirection: 'row',
        gap: 12,
        flex: 1,
    },
    avatarContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#eef2ff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    nameSection: {
        flex: 1,
    },
    visitorName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    visitorPhone: {
        fontSize: 13,
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
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'capitalize',
    },
    cardBody: {
        gap: 8,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    infoLabel: {
        fontSize: 13,
        color: '#6b7280',
        fontWeight: '500',
    },
    infoValue: {
        fontSize: 13,
        color: '#111827',
        flex: 1,
    },
    centered: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        color: '#6b7280',
        fontSize: 14,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 60,
    },
    emptyText: {
        marginTop: 12,
        color: '#6b7280',
        fontSize: 16,
    },
    emptyHint: {
        marginTop: 8,
        color: '#9ca3af',
        fontSize: 13,
    },
    fab: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#6366f1',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        maxHeight: '85%',
    },
    formScroll: {
        flex: 1,
        maxHeight: '100%',
    },
    formScrollContent: {
        paddingBottom: 24,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
    },
    form: {
        gap: 16,
    },
    inputGroup: {
        gap: 8,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    input: {
        backgroundColor: '#f9fafb',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 12,
        padding: 12,
        fontSize: 16,
        color: '#111827',
    },
    dateTimeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#f9fafb',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 12,
        padding: 12,
    },
    dateTimeButtonText: {
        flex: 1,
        fontSize: 16,
        color: '#111827',
    },
    dateTimePlaceholder: {
        color: '#9ca3af',
    },
    pickerWrap: {
        marginBottom: 8,
    },
    pickerDone: {
        alignSelf: 'flex-end',
        paddingVertical: 8,
        paddingHorizontal: 16,
        marginTop: 4,
    },
    pickerDoneText: {
        fontSize: 16,
        color: '#6366f1',
        fontWeight: '600',
    },
    submitButton: {
        backgroundColor: '#6366f1',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 8,
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
