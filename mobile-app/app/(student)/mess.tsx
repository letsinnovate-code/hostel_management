import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';

type MessItem = {
  _id: string;
  mealType: string;
  title?: string;
  items?: string[];
  startTime: string;
  endTime: string;
  dayOfWeek?: number | null;
};

const MEAL_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatTime(t: string) {
  if (!t) return '';
  const [h, m] = String(t).split(':');
  const hour = parseInt(h, 10);
  const min = m ? parseInt(m, 10) : 0;
  const am = hour < 12;
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${min.toString().padStart(2, '0')} ${am ? 'AM' : 'PM'}`;
}

/** "HH:mm" -> minutes since midnight */
function timeToMinutes(t: string): number {
  const [h, m] = String(t || '00:00').split(':').map((x) => parseInt(x, 10));
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

type MealStatus = 'past' | 'current' | 'upcoming';

function getMealStatus(startTime: string, endTime: string): MealStatus {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (mins > end) return 'past';
  if (mins >= start && mins <= end) return 'current';
  return 'upcoming';
}

export default function MessScreen() {
  const router = useRouter();
  const [schedule, setSchedule] = useState<MessItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.getMessSchedule();
      setSchedule(Array.isArray(data) ? data : []);
    } catch {
      setSchedule([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  // Show today's meals: day-specific (dayOfWeek) + daily (dayOfWeek null). Sort by start time.
  const todayDay = new Date().getDay(); // 0 = Sunday, 6 = Saturday
  const todaySchedules = schedule
    .filter((s) => s.dayOfWeek == null || s.dayOfWeek === todayDay)
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  const dayName = DAY_NAMES[todayDay];

  // Next upcoming meal (first with status 'upcoming' or 'current')
  const nextMeal = todaySchedules.find(
    (s) => getMealStatus(s.startTime, s.endTime) !== 'past'
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0a7ea4" />
        <Text style={styles.loadingText}>Loading mess schedule...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.title}>Mess & Food</Text>
        <Text style={styles.subtitle}>Meal timings and menu for your hostel</Text>
        {schedule.length > 0 && (
          <Text style={styles.todayLabel}>{"Today's meals — "}{dayName}</Text>
        )}

        {nextMeal && (
          <View style={styles.nextBanner}>
            <Ionicons name="time" size={18} color="#0a7ea4" />
            <Text style={styles.nextBannerText}>
              {getMealStatus(nextMeal.startTime, nextMeal.endTime) === 'current'
                ? 'Now: '
                : 'Up next: '}
              {nextMeal.title || MEAL_LABELS[nextMeal.mealType] || nextMeal.mealType}
              {' · '}
              {formatTime(nextMeal.startTime)} – {formatTime(nextMeal.endTime)}
            </Text>
          </View>
        )}

        {schedule.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="restaurant-outline" size={56} color="#94a3b8" />
            <Text style={styles.emptyTitle}>No schedule yet</Text>
            <Text style={styles.emptyText}>Your hostel has not added mess timings. Check back later.</Text>
          </View>
        ) : todaySchedules.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={56} color="#94a3b8" />
            <Text style={styles.emptyTitle}>No meals for today</Text>
            <Text style={styles.emptyText}>Schedule is set for other days. Pull to refresh.</Text>
          </View>
        ) : (
          todaySchedules.map((item) => {
            const status = getMealStatus(item.startTime, item.endTime);
            const isPast = status === 'past';
            const isCurrent = status === 'current';
            const isUpcoming = status === 'upcoming';
            const isNext = nextMeal?._id === item._id;

            return (
              <View
                key={item._id}
                style={[
                  styles.card,
                  isPast && styles.cardPast,
                  isCurrent && styles.cardCurrent,
                  isUpcoming && isNext && styles.cardUpcoming,
                ]}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleRow}>
                    <Ionicons
                      name={isPast ? 'restaurant-outline' : 'restaurant'}
                      size={24}
                      color={isPast ? '#94a3b8' : isCurrent ? '#059669' : '#0a7ea4'}
                    />
                    <Text
                      style={[
                        styles.mealTitle,
                        isPast && styles.mealTitlePast,
                      ]}
                      numberOfLines={1}
                    >
                      {item.title || MEAL_LABELS[item.mealType] || item.mealType}
                    </Text>
                  </View>
                  <View style={[styles.badge, isPast && styles.badgePast, isCurrent && styles.badgeCurrent, isUpcoming && styles.badgeUpcoming]}>
                    <Text style={[styles.badgeText, isPast && styles.badgeTextPast]}>
                      {isPast ? 'Ended' : isCurrent ? 'Now serving' : isNext ? 'Up next' : 'Later'}
                    </Text>
                  </View>
                </View>
                <View style={[styles.timeRow, isPast && styles.timeRowPast]}>
                  <Ionicons name="time-outline" size={18} color={isPast ? '#94a3b8' : '#64748b'} />
                  <Text style={[styles.timeText, isPast && styles.timeTextPast]}>
                    {formatTime(item.startTime)} – {formatTime(item.endTime)}
                  </Text>
                </View>
                {item.items && item.items.length > 0 && (
                  <View style={styles.itemsWrap}>
                    <Text style={[styles.itemsLabel, isPast && styles.itemsLabelPast]}>Served:</Text>
                    {item.items.map((food, i) => (
                      <Text key={i} style={[styles.itemBullet, isPast && styles.itemBulletPast]}>
                        • {food}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            );
          })
        )}

        <TouchableOpacity
          style={styles.feedbackButton}
          onPress={() => router.push('/(student)/mess-feedback')}
          activeOpacity={0.8}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={22} color="#fff" />
          <Text style={styles.feedbackButtonText}>Give Mess Feedback</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748b',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
  },
  todayLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0a7ea4',
    marginBottom: 8,
  },
  nextBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#e0f2fe',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  nextBannerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0c4a6e',
    flex: 1,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#475569',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 8,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardPast: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    opacity: 0.85,
  },
  cardCurrent: {
    borderLeftWidth: 4,
    borderLeftColor: '#059669',
    borderColor: '#d1fae5',
    backgroundColor: '#f0fdf4',
  },
  cardUpcoming: {
    borderLeftWidth: 4,
    borderLeftColor: '#0a7ea4',
    borderColor: '#e0f2fe',
    backgroundColor: '#f0f9ff',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  mealTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    flex: 1,
  },
  mealTitlePast: {
    color: '#64748b',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgePast: {
    backgroundColor: '#f1f5f9',
  },
  badgeCurrent: {
    backgroundColor: '#059669',
  },
  badgeUpcoming: {
    backgroundColor: '#0a7ea4',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  badgeTextPast: {
    color: '#64748b',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  timeText: {
    fontSize: 14,
    color: '#64748b',
  },
  timeRowPast: {},
  timeTextPast: {
    color: '#94a3b8',
  },
  itemsWrap: {
    marginTop: 4,
  },
  itemsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 4,
  },
  itemsLabelPast: {
    color: '#94a3b8',
  },
  itemBullet: {
    fontSize: 14,
    color: '#475569',
    marginLeft: 4,
    marginBottom: 2,
  },
  itemBulletPast: {
    color: '#94a3b8',
  },
  feedbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0a7ea4',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
  },
  feedbackButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
