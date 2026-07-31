import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const cards = [
  {
    title: 'Leave / Outpass',
    subtitle: 'Apply for leave or night-out',
    icon: 'calendar-outline' as const,
    color: '#0a7ea4',
    screen: '/(student)/leave',
  },
  {
    title: 'Room Maintenance',
    subtitle: 'Request repairs (lights, plumbing, etc.)',
    icon: 'construct-outline' as const,
    color: '#059669',
    screen: '/(student)/maintenance',
  },
  {
    title: 'Fee & Dues',
    subtitle: 'View fees, pay online or at office',
    icon: 'wallet-outline' as const,
    color: '#7c3aed',
    screen: '/(student)/fees',
  },
];

export default function ServicesScreen() {
  const router = useRouter();

  return (
    <ScrollView contentContainerStyle={styles.container} style={styles.scroll}>
      <Text style={styles.title}>Services</Text>
      <Text style={styles.subtitle}>Leave, maintenance & fee payments</Text>
      {cards.map((card) => (
        <TouchableOpacity
          key={card.screen}
          style={styles.card}
          onPress={() => router.push(card.screen as any)}
          activeOpacity={0.8}
        >
          <View style={[styles.iconWrap, { backgroundColor: card.color + '20' }]}>
            <Ionicons name={card.icon} size={28} color={card.color} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>{card.title}</Text>
            <Text style={styles.cardSubtitle}>{card.subtitle}</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#94a3b8" />
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  container: {
    padding: 20,
    paddingBottom: 32,
    backgroundColor: '#f8fafc',
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
    marginBottom: 24,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  cardText: { flex: 1 },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0f172a',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
});
