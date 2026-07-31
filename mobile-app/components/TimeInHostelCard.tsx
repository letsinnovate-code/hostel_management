import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface TimeInHostelCardProps {
  /** Whether the student is currently inside the hostel */
  isInside: boolean;
  /** Start of current session (when they checked in). Used to compute elapsed time. */
  checkInTime: string | Date | null | undefined;
  /** Cumulative minutes already saved in DB for today (from previous sessions). */
  totalMinutesInside?: number;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

export default function TimeInHostelCard({ isInside, checkInTime, totalMinutesInside = 0 }: TimeInHostelCardProps) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!isInside || !checkInTime) {
      setElapsedMs(0);
      return;
    }
    const startMs = typeof checkInTime === 'string' ? new Date(checkInTime).getTime() : checkInTime.getTime();
    const tick = () => setElapsedMs(Math.max(0, Date.now() - startMs));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isInside, checkInTime]);

  const savedMs = (Number(totalMinutesInside) || 0) * 60 * 1000;
  const totalMs = savedMs + (isInside && checkInTime ? elapsedMs : 0);
  const displayText = totalMs > 0 ? formatElapsed(totalMs) : '—';
  const subText = isInside ? 'Time in hostel today' : 'Not inside hostel';

  return (
    <View style={styles.card}>
      <LinearGradient
        colors={['#f0fdf4', '#dcfce7']}
        style={styles.bgGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons
            name="time"
            size={32}
            color={isInside ? '#15803d' : '#94a3b8'}
          />
        </View>
        <View style={styles.textWrap}>
          <Text style={[styles.value, !isInside && styles.valueInactive]}>
            {displayText}
          </Text>
          <Text style={styles.label}>{subText}</Text>
        </View>
        {isInside && (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Live</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  bgGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(21, 128, 61, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  textWrap: {
    flex: 1,
  },
  value: {
    fontSize: 28,
    fontWeight: '700',
    color: '#15803d',
    letterSpacing: 0.5,
  },
  valueInactive: {
    color: '#94a3b8',
    fontWeight: '600',
  },
  label: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    fontWeight: '500',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(21, 128, 61, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  liveText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#15803d',
  },
});
