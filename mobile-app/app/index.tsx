import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

export default function LandingPage() {
  const { user, loading, token } = useAuth();
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    if (!loading) {
      if (token && user) {
        // Automatically move to dashboard if already logged in
        const navigateToRole = () => {
          switch (user.role) {
            case 'student':
              router.replace('/(student)/dashboard');
              break;
            case 'warden':
              router.replace('/(warden)/dashboard');
              break;
            case 'cleaner':
            case 'supervisor':
              router.replace('/(cleaner)/tasks');
              break;
            case 'owner':
              router.replace('/(owner)/dashboard');
              break;
            default:
              setCheckingAuth(false);
          }
        };

        const timer = setTimeout(navigateToRole, 100);
        return () => clearTimeout(timer);
      } else {
        setCheckingAuth(false);
      }
    }
  }, [user, loading, token, router]);

  if (checkingAuth) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={['#0a7ea4', '#075985']}
          style={StyleSheet.absoluteFill}
        />
        <Text style={styles.loadingText}>HostelZify</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#ffffff', '#f0f9ff']}
        style={StyleSheet.absoluteFill}
      />

      {/* Decorative Circles */}
      <View style={[styles.circle, { top: -100, right: -100, backgroundColor: '#e0f2fe' }]} />
      <View style={[styles.circle, { bottom: -50, left: -100, width: 300, height: 300, backgroundColor: '#f0f9ff' }]} />

      <View style={styles.content}>
        <View style={styles.heroSection}>
          <View style={styles.logoContainer}>
            <LinearGradient
              colors={['#0a7ea4', '#38bdf8']}
              style={styles.logoGradient}
            >
              <Ionicons name="business" size={40} color="#fff" />
            </LinearGradient>
          </View>

          <Text style={styles.brandName}>HostelZify</Text>
          <Text style={styles.title}>Smart Living, Better Managed.</Text>
          <Text style={styles.description}>
            Experience the future of hostel management with real-time tracking, digital permissions, and automated security.
          </Text>
        </View>

        <View style={styles.featuresContainer}>
          <View style={styles.featureRow}>
            <FeatureIcon name="location" color="#0ea5e9" label="Real-time Tracking" />
            <FeatureIcon name="shield-checkmark" color="#10b981" label="Secure Access" />
            <FeatureIcon name="notifications" color="#a855f7" label="Instant Alerts" />
          </View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.getStartedButton}
            onPress={() => router.push('/(auth)/login')}
          >
            <LinearGradient
              colors={['#0a7ea4', '#0284c7']}
              style={styles.buttonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.buttonText}>Get Started</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.footerText}>
            Join thousands of students and owners today.
          </Text>
        </View>
      </View>
    </View>
  );
}

function FeatureIcon({ name, color, label }: { name: any, color: string, label: string }) {
  return (
    <View style={styles.featureItem}>
      <View style={[styles.featureIconBox, { backgroundColor: `${color}15` }]}>
        <Ionicons name={name} size={24} color={color} />
      </View>
      <Text style={styles.featureLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 30,
    justifyContent: 'space-between',
    paddingVertical: height * 0.1,
  },
  circle: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
    opacity: 0.6,
  },
  heroSection: {
    alignItems: 'center',
    marginTop: 20,
  },
  logoContainer: {
    marginBottom: 24,
    shadowColor: '#0a7ea4',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  logoGradient: {
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0a7ea4',
    marginBottom: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    lineHeight: 44,
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 10,
  },
  featuresContainer: {
    marginVertical: 40,
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  featureItem: {
    alignItems: 'center',
    gap: 8,
  },
  featureIconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    gap: 20,
  },
  getStartedButton: {
    width: '100%',
    shadowColor: '#0a7ea4',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  footerText: {
    fontSize: 14,
    color: '#9ca3af',
    fontWeight: '500',
  },
});
