import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';

export default function MessFeedbackScreen() {
    const [rating, setRating] = useState(0);
    const [feedback, setFeedback] = useState('');
    const [mealType, setMealType] = useState<'Breakfast' | 'Lunch' | 'Dinner'>('Lunch');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (rating === 0) {
            Alert.alert('Error', 'Please provide a rating');
            return;
        }
        setSubmitting(true);
        try {
            await api.submitMessFeedback({
                rating,
                feedback: feedback.trim() || undefined,
                mealType,
            });
            Alert.alert('Success', 'Feedback submitted successfully!');
            setRating(0);
            setFeedback('');
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to submit feedback');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <Text style={styles.title}>Mess Feedback</Text>
                    <Text style={styles.subtitle}>Help us improve the food quality</Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.label}>Select Meal</Text>
                    <View style={styles.mealSelector}>
                        {(['Breakfast', 'Lunch', 'Dinner'] as const).map((type) => (
                            <TouchableOpacity
                                key={type}
                                style={[
                                    styles.mealButton,
                                    mealType === type && styles.mealButtonActive
                                ]}
                                onPress={() => setMealType(type)}
                            >
                                <Text
                                    style={[
                                        styles.mealButtonText,
                                        mealType === type && styles.mealButtonTextActive
                                    ]}
                                >
                                    {type}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text style={[styles.label, { marginTop: 24 }]}>Rate Quality</Text>
                    <View style={styles.ratingContainer}>
                        {[1, 2, 3, 4, 5].map((star) => (
                            <TouchableOpacity
                                key={star}
                                onPress={() => setRating(star)}
                            >
                                <Ionicons
                                    name={star <= rating ? 'star' : 'star-outline'}
                                    size={40}
                                    color={star <= rating ? '#f59e0b' : '#d1d5db'}
                                />
                            </TouchableOpacity>
                        ))}
                    </View>
                    <Text style={styles.ratingText}>
                        {rating === 0 ? 'Select a rating' :
                            rating === 1 ? 'Poor' :
                                rating === 2 ? 'Fair' :
                                    rating === 3 ? 'Good' :
                                        rating === 4 ? 'Very Good' : 'Excellent'}
                    </Text>

                    <Text style={[styles.label, { marginTop: 24 }]}>Comments (Optional)</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Tell us more about your experience..."
                        multiline
                        numberOfLines={4}
                        value={feedback}
                        onChangeText={setFeedback}
                        textAlignVertical="top"
                    />

                    <TouchableOpacity
                        style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                        onPress={handleSubmit}
                        disabled={submitting}
                    >
                        {submitting ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.submitButtonText}>Submit Feedback</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
    },
    scrollContent: {
        padding: 20,
    },
    header: {
        marginBottom: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827',
    },
    subtitle: {
        fontSize: 14,
        color: '#6b7280',
        marginTop: 4,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 12,
    },
    mealSelector: {
        flexDirection: 'row',
        backgroundColor: '#f3f4f6',
        borderRadius: 8,
        padding: 4,
    },
    mealButton: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 6,
    },
    mealButtonActive: {
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1,
        elevation: 1,
    },
    mealButtonText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#6b7280',
    },
    mealButtonTextActive: {
        color: '#111827',
        fontWeight: '600',
    },
    ratingContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
        marginBottom: 8,
    },
    ratingText: {
        textAlign: 'center',
        color: '#6b7280',
        fontSize: 14,
        fontWeight: '500',
    },
    input: {
        backgroundColor: '#f9fafb',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 12,
        padding: 12,
        fontSize: 16,
        color: '#111827',
        minHeight: 100,
    },
    submitButton: {
        backgroundColor: '#3b82f6',
        borderRadius: 12,
        paddingVertical: 14,
        marginTop: 32,
        alignItems: 'center',
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    submitButtonDisabled: {
        opacity: 0.7,
    },
});
