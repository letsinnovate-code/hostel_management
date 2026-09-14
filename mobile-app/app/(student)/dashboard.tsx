import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  TouchableOpacity,
  PanResponder,
  useWindowDimensions,
  AppState,
  AppStateStatus,
  Linking,
  Modal,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LocationService } from '../../services/LocationService';
import api from '../../services/api';
import * as Location from 'expo-location';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import StatusCard from '../../components/StatusCard';
import DashboardMap from '../../components/DashboardMap';
import DashboardSkeleton from '../../components/DashboardSkeleton';
import QuickStats from '../../components/QuickStats';
import TimeInHostelCard from '../../components/TimeInHostelCard';
import { RecentNotifications, RecentPermissions } from '../../components/RecentActivity';
import FeatureGrid from '../../components/FeatureGrid';
import { useNotificationsOverlay } from '../../contexts/NotificationsOverlayContext';
import { useRouter } from 'expo-router';

function isPointInsidePolygon(
  point: { latitude: number; longitude: number },
  polygon: Array<{ latitude: number; longitude: number }>
): boolean {
  if (polygon.length < 3) return false;
  const { latitude: x, longitude: y } = point;
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].latitude;
    const yi = polygon[i].longitude;
    const xj = polygon[j].latitude;
    const yj = polygon[j].longitude;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function haversineKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const R = 6371; // Earth radius in km
  const dLat = (b.latitude - a.latitude) * (Math.PI / 180);
  const dLon = (b.longitude - a.longitude) * (Math.PI / 180);
  const lat1 = a.latitude * (Math.PI / 180);
  const lat2 = b.latitude * (Math.PI / 180);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function getPolygonFromBoundary(boundary: any): Array<{ latitude: number; longitude: number }> {
  if (!boundary?.geoFence) return [];
  const bounds = boundary.geoFence.bounds;
  const polygonFromGeo = boundary.geoFence.polygon;
  if (boundary.geoFence.type === 'polygon' && polygonFromGeo && polygonFromGeo.length >= 3) {
    return polygonFromGeo.map((p: any) => ({ latitude: p.latitude, longitude: p.longitude }));
  }
  if (bounds && boundary.geoFence.type === 'rectangle') {
    return [
      { latitude: bounds.north, longitude: bounds.west },
      { latitude: bounds.north, longitude: bounds.east },
      { latitude: bounds.south, longitude: bounds.east },
      { latitude: bounds.south, longitude: bounds.west },
    ];
  }
  return [];
}

export default function StudentDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { show: showNotificationsOverlay } = useNotificationsOverlay();
  const autoCheckInDoneRef = useRef(false);
  const COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes after checkout before check-in allowed
  const autoCheckInDisabledUntilRef = useRef(0);
  const [cooldownEndMs, setCooldownEndMs] = useState<number | null>(null); // for UI timer
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);

  // State
  const [status, setStatus] = useState<any>(null);
  const [boundary, setBoundary] = useState<any>(null);
  const [currentLocationForMap, setCurrentLocationForMap] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [locationPermission, setLocationPermission] = useState<{
    foregroundPermission: string;
    backgroundPermission: string;
  }>({ foregroundPermission: 'undetermined', backgroundPermission: 'undetermined' });
  const [checkInOutLoading, setCheckInOutLoading] = useState(false);
  const [stats, setStats] = useState({
    permissions: 0,
    notifications: 0,
    violations: 0,
    complaints: 0,
    pendingPayments: 0,
    pendingPaymentsAmount: 0,
  });
  const [notifications, setNotifications] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [violations, setViolations] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [pendingPaymentsList, setPendingPaymentsList] = useState<any[]>([]);
  const [activeModal, setActiveModal] = useState<'permissions' | 'violations' | 'complaints' | 'payments' | null>(null);
  const [payingFor, setPayingFor] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const { width: winWidth } = useWindowDimensions();

  const rightEdgeSwipe = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => g.moveX > winWidth - 40 && g.dx < -25,
      onPanResponderRelease: (_, g) => {
        if (g.dx < -40) showNotificationsOverlay();
      },
    })
  ).current;

  useEffect(() => {
    (async () => {
      try {
        await setupLocationTracking();
      } catch (_) {
        // Don't crash app if location setup fails
      }
    })();
    sendLocationThenLoadData();
  }, []);

  // Re-check location permission and start tracking when app becomes active (e.g. user enabled "Always" in Settings)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        LocationService.checkStatus().then((locStatus) => {
          setIsTracking(locStatus.isTracking);
          setLocationPermission({
            foregroundPermission: locStatus.foregroundPermission ?? 'undetermined',
            backgroundPermission: locStatus.backgroundPermission ?? 'undetermined',
          });
          if (locStatus.foregroundPermission === 'granted' && locStatus.backgroundPermission === 'granted' && !locStatus.isTracking) {
            LocationService.startTracking().then(() => setIsTracking(true)).catch(() => {});
          }
        }).catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

  // Real-time exit detection: when student is "inside", push location regularly so backend can auto check-out if they leave
  const isInsideRef = useRef(false);
  const cleanupRealTimeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const isInside = status?.status === 'inside';
    isInsideRef.current = isInside;

    if (!isInside) {
      if (cleanupRealTimeRef.current) {
        cleanupRealTimeRef.current();
        cleanupRealTimeRef.current = null;
      }
      return;
    }

    const sendLocation = async (coords: { latitude: number; longitude: number }, accuracy?: number) => {
      try {
        const res = await api.updateLocation(coords, accuracy);
        const data = (res as any)?.data ?? res;
        if (data && data.isInsideHostel === false && isInsideRef.current) {
          setStatus((prev: any) => (prev ? { ...prev, status: 'outside' } : { status: 'outside' }));
          loadData().catch(() => {});
        }
      } catch (_) {}
    };

    // 1) Interval fallback: every 60s send location (catches exit even if watch is delayed)
    const intervalMs = 60 * 1000;
    const intervalId = setInterval(() => {
      if (!isInsideRef.current) return;
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        .then((loc) => sendLocation(
          { latitude: loc.coords.latitude, longitude: loc.coords.longitude },
          loc.coords.accuracy ?? undefined
        ))
        .catch(() => {});
    }, intervalMs);

    // 2) Foreground watch: on every position update (every ~25m or 1 min), send to backend for immediate exit detection
    const stopWatch = LocationService.startForegroundWatch((coords, accuracy) => sendLocation(coords, accuracy));

    cleanupRealTimeRef.current = () => {
      clearInterval(intervalId);
      stopWatch();
    };

    return () => {
      if (cleanupRealTimeRef.current) {
        cleanupRealTimeRef.current();
        cleanupRealTimeRef.current = null;
      }
    };
  }, [status?.status]);

  // Auto check-in when student is checked out but opens the app and is inside the hostel
  useEffect(() => {
    if (autoCheckInDoneRef.current) return;
    if (Date.now() < autoCheckInDisabledUntilRef.current) return; // 2-min cooldown after checkout
    if (status?.status !== 'outside' || !boundary || !currentLocationForMap) return;
    const polygon = getPolygonFromBoundary(boundary);
    if (polygon.length < 3 || !isPointInsidePolygon(currentLocationForMap, polygon)) return;

    autoCheckInDoneRef.current = true;
    (async () => {
      try {
        await api.checkIn(currentLocationForMap, true);
        await loadData();
        showToast("You're inside the hostel. Checked in automatically.");
      } catch (_) {
        autoCheckInDoneRef.current = false;
      }
    })();
  }, [status?.status, boundary, currentLocationForMap]);

  const setupLocationTracking = async () => {
    try {
      const locStatus = await LocationService.checkStatus();
      setIsTracking(locStatus.isTracking);
      setLocationPermission({
        foregroundPermission: locStatus.foregroundPermission ?? 'undetermined',
        backgroundPermission: locStatus.backgroundPermission ?? 'undetermined',
      });

      if (locStatus.foregroundPermission === 'granted' && locStatus.backgroundPermission === 'granted') {
        await LocationService.startTracking();
        setIsTracking(true);
      }
    } catch (error) {
      console.error('Error setting up location tracking:', error);
    }
  };

  const handleEnableLocation = async () => {
    try {
      const result = await LocationService.requestPermissions();
      const locStatus = await LocationService.checkStatus();
      setLocationPermission({
        foregroundPermission: locStatus.foregroundPermission ?? 'undetermined',
        backgroundPermission: locStatus.backgroundPermission ?? 'undetermined',
      });
      if (result.status === 'granted') {
        await LocationService.startTracking();
        setIsTracking(true);
        await api.updateLocationPermission('granted');
        loadData();
        showToast('Background location enabled. You’ll be auto checked in when inside the hostel.');
      } else {
        await api.updateLocationPermission('denied');
        Alert.alert(
          'Allow “Always” location',
          'To get automatically checked in when you’re inside the hostel without opening the app, enable “Always” (or “All the time”) for this app in your device Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to request location permissions.');
    }
  };

  const hasPermissionLag =
    !isTracking ||
    locationPermission.foregroundPermission !== 'granted' ||
    locationPermission.backgroundPermission !== 'granted';

  // Load dashboard immediately; run location update in background (don't block UI)
  const sendLocationThenLoadData = () => {
    loadData();
    // Fire-and-forget: update location in background so next refresh has latest status
    (async () => {
      try {
        const { status: permStatus } = await Location.getForegroundPermissionsAsync();
        if (permStatus === 'granted') {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Low,
          });
          await api.updateLocation(
            { latitude: loc.coords.latitude, longitude: loc.coords.longitude },
            loc.coords.accuracy ?? undefined
          );
        }
      } catch (_) {}
    })();
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // Phase 1: only status + boundary – show main UI as soon as these are back (fast)
      const [statusRes, boundaryRes] = await Promise.all([
        api.getStatus().catch(() => null),
        api.getHostelBoundary().catch(() => null),
      ]);

      const data = statusRes?.data ?? statusRes;
      setStatus(data ?? null);
      if (data?.cooldownEndsAt != null) {
        const ms = typeof data.cooldownEndsAt === 'number' ? data.cooldownEndsAt : new Date(data.cooldownEndsAt).getTime();
        if (ms > Date.now()) {
          setCooldownEndMs(ms);
          autoCheckInDisabledUntilRef.current = ms;
        } else {
          setCooldownEndMs(null);
          autoCheckInDisabledUntilRef.current = 0;
        }
      } else {
        setCooldownEndMs(null);
        autoCheckInDisabledUntilRef.current = 0;
      }
      setBoundary(boundaryRes ?? null);

      // Hide skeleton immediately – rest loads in background
      setLoading(false);
      setRefreshing(false);

      // Phase 2: notifications, permissions, payments, violations, complaints, location – update UI as they arrive
      const applyNotifications = (res: any) => {
        const notifData = res?.data ?? res;
        const notifList = Array.isArray(notifData) ? notifData : [];
        const isRead = (n: any) => (n.read === true) || (Array.isArray(n.isRead) && n.isRead.length > 0);
        setNotifications(notifList.slice(0, 5));
        setStats((prev) => ({ ...prev, notifications: notifList.filter((n: any) => !isRead(n)).length || 0 }));
      };
      const applyPermissions = (res: any) => {
        const permData = res?.data ?? res;
        const permList = Array.isArray(permData) ? permData : [];
        setPermissions(permList);
        setStats((prev) => ({ ...prev, permissions: permList.filter((p: any) => p.status === 'pending').length || 0 }));
      };
      const applyPayments = (res: any) => {
        const paymentsList = Array.isArray(res) ? res : [];
        const pending = paymentsList.filter((p: any) => p.status === 'pending');
        const pendingAmount = pending.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
        setPendingPaymentsList(pending);
        setStats((prev) => ({
          ...prev,
          pendingPayments: pending.length,
          pendingPaymentsAmount: pendingAmount,
        }));
      };
      const applyViolations = (res: any) => {
        const vData = res?.data ?? res;
        const vList = Array.isArray(vData) ? vData : [];
        setViolations(vList);
        setStats((prev) => ({ ...prev, violations: vList.length }));
      };
      const applyComplaints = (res: any) => {
        const cData = res?.data ?? res;
        const cList = Array.isArray(cData) ? cData : [];
        const active = cList.filter((c: any) => c.status === 'open' || c.status === 'in-progress');
        setComplaints(cList);
        setStats((prev) => ({ ...prev, complaints: active.length }));
      };

      api.getNotifications().then(applyNotifications).catch(() => applyNotifications({ data: [] }));
      api.getPermissionRequests().then(applyPermissions).catch(() => applyPermissions({ data: [] }));
      api.getMyPayments().then(applyPayments).catch(() => applyPayments([]));
      api.getViolationHistory().then(applyViolations).catch(() => applyViolations({ data: [] }));
      api.getComplaints().then(applyComplaints).catch(() => applyComplaints({ data: [] }));

      Location.getForegroundPermissionsAsync()
        .then(({ status: perm }) =>
          perm === 'granted'
            ? Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low })
                .then((pos) => (pos?.coords ? { latitude: pos.coords.latitude, longitude: pos.coords.longitude } : null))
                .catch(() => null)
            : null
        )
        .catch(() => null)
        .then((locRes) => {
          if (locRes && boundaryRes?.hostel?.latitude != null && boundaryRes?.hostel?.longitude != null) {
            setCurrentLocationForMap(locRes);
          }
        });
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    sendLocationThenLoadData();
  };

  const getCurrentLocation = (): Promise<{ latitude: number; longitude: number; accuracy?: number; timestamp?: number }> => {
    return Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    }).then((pos) => ({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy ?? undefined,
      timestamp: pos.timestamp,
    }));
  };

  const handleCheckIn = async () => {
    setCheckInOutLoading(true);
    try {
      const loc = await getCurrentLocation();
      await api.checkIn(loc);
      await loadData();
    } catch (e: any) {
      Alert.alert('Check-in failed', e?.message || 'You must be inside the hostel boundary to check in.');
    } finally {
      setCheckInOutLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setCheckInOutLoading(true);
    try {
      const loc = await getCurrentLocation();
      const res = await api.checkOut(loc);
      // Use server cooldown end time so timer is accurate and survives refresh
      const data = res?.data ?? res;
      const endMs = data?.cooldownEndsAt != null
        ? (typeof data.cooldownEndsAt === 'number' ? data.cooldownEndsAt : new Date(data.cooldownEndsAt).getTime())
        : Date.now() + COOLDOWN_MS;
      autoCheckInDisabledUntilRef.current = endMs;
      setCooldownEndMs(endMs);
      setStatus((prev: any) => prev ? { ...prev, status: 'outside', cooldownEndsAt: endMs } : { status: 'outside', cooldownEndsAt: endMs });
      loadData().catch(() => {});
    } catch (e: any) {
      Alert.alert('Check-out failed', e?.message || 'You must be inside the hostel boundary to check out.');
    } finally {
      setCheckInOutLoading(false);
    }
  };

  // Cooldown timer: update every second and clear when done
  const [cooldownSecondsLeft, setCooldownSecondsLeft] = useState<number | null>(null);
  useEffect(() => {
    if (cooldownEndMs == null) {
      setCooldownSecondsLeft(null);
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((cooldownEndMs - Date.now()) / 1000));
      setCooldownSecondsLeft(left > 0 ? left : null);
      if (left <= 0) setCooldownEndMs(null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [cooldownEndMs]);

  return (
    <View style={[styles.wrapper, { paddingTop: insets.top }]}>
      {/* Right-edge swipe strip: swipe left to open notifications */}
      <View style={[styles.edgeSwipeStrip, { right: 0, top: insets.top, bottom: 0 }]} {...rightEdgeSwipe.panHandlers} />

      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Dashboard</Text>
        <TouchableOpacity
          onPress={showNotificationsOverlay}
          style={styles.notifButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="notifications-outline" size={24} color="#374151" />
          {stats.notifications > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{stats.notifications > 9 ? '9+' : stats.notifications}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading && !refreshing ? (
          <DashboardSkeleton />
        ) : (
          <>
            {hasPermissionLag && (
              <View style={styles.fixPermissionCard}>
                <Ionicons name="warning-outline" size={22} color="#b45309" />
                <View style={styles.fixPermissionContent}>
                  <Text style={styles.fixPermissionTitle}>Location permission needed</Text>
                  <Text style={styles.fixPermissionHint}>
                    Allow “Always” so you get auto check-in every 2 min without opening the app.
                  </Text>
                  <View style={styles.fixPermissionRow}>
                    <TouchableOpacity
                      style={styles.fixPermissionButton}
                      onPress={handleEnableLocation}
                      disabled={loading}
                    >
                      <Text style={styles.fixPermissionButtonText}>Fix permission</Text>
                    </TouchableOpacity>
                    {(locationPermission.foregroundPermission === 'denied' ||
                      locationPermission.backgroundPermission === 'denied') && (
                      <TouchableOpacity
                        style={styles.openSettingsButton}
                        onPress={() => Linking.openSettings()}
                      >
                        <Text style={styles.openSettingsButtonText}>Open Settings</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            )}
            <StatusCard
              status={status?.status === 'inside' ? 'inside' : 'outside'}
              room={status?.room ?? (typeof user?.roomId === 'object' && user?.roomId && 'roomNumber' in user.roomId ? (user.roomId as { roomNumber?: string }).roomNumber : undefined)}
              hostel={status?.hostel ?? (typeof user?.hostelId === 'object' && user?.hostelId && 'name' in user.hostelId ? (user.hostelId as { name?: string }).name : undefined)}
              lastUpdate={status?.lastUpdate ? new Date(status.lastUpdate).toLocaleString() : undefined}
              distanceKm={
                status?.status !== 'inside' &&
                currentLocationForMap &&
                boundary?.hostel?.latitude != null &&
                boundary?.hostel?.longitude != null
                  ? haversineKm(currentLocationForMap, { latitude: boundary.hostel.latitude, longitude: boundary.hostel.longitude })
                  : null
              }
              isTracking={isTracking}
              onEnableLocation={handleEnableLocation}
              onCheckIn={handleCheckIn}
              onCheckOut={handleCheckOut}
              checkInOutLoading={checkInOutLoading}
              loading={loading}
              checkInCooldownSeconds={cooldownSecondsLeft}
            />

            <DashboardMap boundary={boundary} currentLocation={currentLocationForMap} height={168} showLegend />

            <TimeInHostelCard
              isInside={status?.status === 'inside'}
              checkInTime={status?.checkInTime ?? null}
              totalMinutesInside={status?.totalMinutesInside}
            />

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Overview</Text>
              <QuickStats
                pendingPermissions={stats.permissions}
                unreadNotifications={stats.notifications}
                violations={stats.violations}
                activeComplaints={stats.complaints}
                pendingPayments={stats.pendingPayments}
                pendingPaymentsAmount={stats.pendingPaymentsAmount}
                onCardPress={(key) => {
                  if (key === 'unreadNotifications') { showNotificationsOverlay(); return; }
                  if (key === 'pendingPermissions') setActiveModal('permissions');
                  else if (key === 'violations') setActiveModal('violations');
                  else if (key === 'activeComplaints') setActiveModal('complaints');
                  else if (key === 'pendingPayments') setActiveModal('payments');
                }}
              />
            </View>

            {stats.pendingPayments > 0 && (
              <TouchableOpacity
                style={styles.paymentsCard}
                onPress={() => router.push('/(student)/fees')}
                activeOpacity={0.8}
              >
                <View style={styles.paymentsCardLeft}>
                  <Ionicons name="card-outline" size={24} color="#b45309" />
                  <View>
                    <Text style={styles.paymentsCardTitle}>Pending payments</Text>
                    <Text style={styles.paymentsCardSubtitle}>
                      {stats.pendingPayments} due · ₹{stats.pendingPaymentsAmount.toLocaleString()}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#64748b" />
              </TouchableOpacity>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent Activity</Text>
              <RecentNotifications notifications={notifications} onViewAll={showNotificationsOverlay} />
              <View style={styles.permSpacer} />
              <RecentPermissions permissions={permissions} />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick Access</Text>
              <FeatureGrid />
            </View>
          </>
        )}
      </ScrollView>

      {/* Detail Modal for Overview Cards */}
      <Modal
        visible={activeModal !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {activeModal === 'permissions' && 'Pending Permissions'}
                {activeModal === 'violations' && 'Violations'}
                {activeModal === 'complaints' && 'Complaints'}
                {activeModal === 'payments' && 'Pending Payments'}
              </Text>
              <TouchableOpacity onPress={() => setActiveModal(null)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {/* Permissions */}
              {activeModal === 'permissions' && (
                permissions.filter((p: any) => p.status === 'pending').length === 0
                  ? <Text style={styles.modalEmpty}>No pending permissions</Text>
                  : permissions.filter((p: any) => p.status === 'pending').map((p: any) => (
                    <View key={p._id} style={styles.modalCard}>
                      <View style={styles.modalCardRow}>
                        <View style={[styles.modalDot, { backgroundColor: '#2563eb' }]} />
                        <Text style={styles.modalCardTitle}>
                          {(p.permissionType || 'permission').replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                        </Text>
                        <View style={[styles.modalBadge, { backgroundColor: '#fef3c7' }]}>
                          <Text style={[styles.modalBadgeText, { color: '#b45309' }]}>Pending</Text>
                        </View>
                      </View>
                      {p.reason ? <Text style={styles.modalCardDesc}>{p.reason}</Text> : null}
                      <Text style={styles.modalCardDate}>
                        {p.requestedDate ? new Date(p.requestedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                        {p.returnDate ? ` → ${new Date(p.returnDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                      </Text>
                    </View>
                  ))
              )}

              {/* Violations */}
              {activeModal === 'violations' && (
                violations.length === 0
                  ? <Text style={styles.modalEmpty}>No violations on record 🎉</Text>
                  : violations.map((v: any) => {
                    const sevColor = v.severity === 'high' ? '#dc2626' : v.severity === 'medium' ? '#f59e0b' : '#3b82f6';
                    return (
                      <View key={v._id} style={[styles.modalCard, { borderLeftWidth: 3, borderLeftColor: sevColor }]}>
                        <View style={styles.modalCardRow}>
                          <Ionicons name="warning" size={18} color={sevColor} />
                          <Text style={styles.modalCardTitle}>
                            {(v.violationType || v.type || 'Violation').replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                          </Text>
                          {v.severity && (
                            <View style={[styles.modalBadge, { backgroundColor: `${sevColor}18` }]}>
                              <Text style={[styles.modalBadgeText, { color: sevColor }]}>{v.severity?.toUpperCase()}</Text>
                            </View>
                          )}
                        </View>
                        {v.description ? <Text style={styles.modalCardDesc}>{v.description}</Text> : null}
                        <Text style={styles.modalCardDate}>
                          {v.createdAt ? new Date(v.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                          {v.status ? ` · ${v.status}` : ''}
                        </Text>
                      </View>
                    );
                  })
              )}

              {/* Complaints */}
              {activeModal === 'complaints' && (
                complaints.length === 0
                  ? <Text style={styles.modalEmpty}>No complaints</Text>
                  : complaints.map((c: any) => {
                    const statusColor = c.status === 'resolved' || c.status === 'closed' ? '#059669'
                      : c.status === 'in-progress' ? '#2563eb' : '#f59e0b';
                    return (
                      <View key={c._id} style={styles.modalCard}>
                        <View style={styles.modalCardRow}>
                          <Ionicons name="document-text" size={18} color={statusColor} />
                          <Text style={[styles.modalCardTitle, { flex: 1 }]} numberOfLines={1}>{c.title}</Text>
                          <View style={[styles.modalBadge, { backgroundColor: `${statusColor}18` }]}>
                            <Text style={[styles.modalBadgeText, { color: statusColor }]}>
                              {(c.status || 'open').toUpperCase()}
                            </Text>
                          </View>
                        </View>
                        {c.complaintType ? (
                          <Text style={styles.modalCardType}>{c.complaintType.toUpperCase()}</Text>
                        ) : null}
                        {c.description ? <Text style={styles.modalCardDesc} numberOfLines={3}>{c.description}</Text> : null}
                        <Text style={styles.modalCardDate}>
                          {c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                        </Text>
                      </View>
                    );
                  })
              )}

              {/* Pending Payments */}
              {activeModal === 'payments' && (
                pendingPaymentsList.length === 0
                  ? <Text style={styles.modalEmpty}>No pending payments</Text>
                  : pendingPaymentsList.map((p: any) => (
                    <View key={p._id} style={[styles.modalCard, { borderLeftWidth: 3, borderLeftColor: '#b45309' }]}>
                      <View style={styles.modalCardRow}>
                        <Ionicons name="card" size={18} color="#b45309" />
                        <Text style={styles.modalCardTitle}>₹{Number(p.amount).toLocaleString()} · {p.type || 'Fee'}</Text>
                      </View>
                      {(p.planId?.name || p.planId?.durationMonths) ? (
                        <Text style={styles.modalCardDesc}>
                          Plan: {p.planId.name ?? `${p.planId.durationMonths} month${p.planId.durationMonths !== 1 ? 's' : ''}`}
                        </Text>
                      ) : null}
                      {p.periodStart && p.periodEnd ? (
                        <Text style={styles.modalCardDate}>
                          Period: {new Date(p.periodStart).toLocaleDateString()} – {new Date(p.periodEnd).toLocaleDateString()}
                        </Text>
                      ) : null}
                      {p.dueDate && (
                        <Text style={[styles.modalCardDate, { color: '#b45309' }]}>Due: {new Date(p.dueDate).toLocaleDateString()}</Text>
                      )}
                      <TouchableOpacity
                        style={styles.payButton}
                        activeOpacity={0.8}
                        disabled={!!payingFor}
                        onPress={async () => {
                          setPayingFor(p._id);
                          try {
                            const res = await api.createRazorpayOrderForPayment(p._id);
                            const data = (res as any)?.data ?? res;
                            if (data?.orderId && data?.keyId) {
                              // Close modal and navigate to fees page for full payment flow
                              setActiveModal(null);
                              router.push('/(student)/fees');
                            } else {
                              Alert.alert('Pay at office', `Razorpay not configured. Pay ₹${Number(p.amount).toLocaleString()} at the hostel office.`);
                            }
                          } catch (e: any) {
                            if (e?.response?.status === 503 || e.message?.includes('not configured')) {
                              Alert.alert('Pay at office', `Pay ₹${Number(p.amount).toLocaleString()} at the hostel office.`);
                            } else {
                              Alert.alert('Error', e.message || 'Failed to start payment');
                            }
                          } finally {
                            setPayingFor(null);
                          }
                        }}
                      >
                        {payingFor === p._id ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Ionicons name="card" size={16} color="#fff" style={{ marginRight: 6 }} />
                            <Text style={styles.payButtonText}>Pay ₹{Number(p.amount).toLocaleString()}</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  ))
              )}
              <View style={{ height: 24 }} />
            </ScrollView>

            {/* View All button for permissions, violations, complaints */}
            {activeModal === 'permissions' && (
              <TouchableOpacity style={styles.modalViewAll} onPress={() => { setActiveModal(null); router.push('/(student)/permissions'); }}>
                <Text style={styles.modalViewAllText}>View All Permissions</Text>
                <Ionicons name="chevron-forward" size={18} color="#2563eb" />
              </TouchableOpacity>
            )}
            {activeModal === 'violations' && (
              <TouchableOpacity style={styles.modalViewAll} onPress={() => { setActiveModal(null); router.push('/(student)/violations'); }}>
                <Text style={styles.modalViewAllText}>View All Violations</Text>
                <Ionicons name="chevron-forward" size={18} color="#2563eb" />
              </TouchableOpacity>
            )}
            {activeModal === 'complaints' && (
              <TouchableOpacity style={styles.modalViewAll} onPress={() => { setActiveModal(null); router.push('/(student)/complaints'); }}>
                <Text style={styles.modalViewAllText}>View All Complaints</Text>
                <Ionicons name="chevron-forward" size={18} color="#2563eb" />
              </TouchableOpacity>
            )}
            {activeModal === 'payments' && (
              <TouchableOpacity style={styles.modalViewAll} onPress={() => { setActiveModal(null); router.push('/(student)/fees'); }}>
                <Text style={styles.modalViewAllText}>View All Payments</Text>
                <Ionicons name="chevron-forward" size={18} color="#2563eb" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  edgeSwipeStrip: {
    position: 'absolute',
    width: 28,
    zIndex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  notifButton: {
    position: 'relative',
    padding: 6,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 12,
    paddingBottom: 28,
  },
  fixPermissionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fffbeb',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
    gap: 12,
  },
  fixPermissionContent: {
    flex: 1,
  },
  fixPermissionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  fixPermissionHint: {
    fontSize: 13,
    color: '#78716c',
    marginTop: 4,
    lineHeight: 18,
  },
  fixPermissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  fixPermissionButton: {
    backgroundColor: '#b45309',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  fixPermissionButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  openSettingsButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#b45309',
  },
  openSettingsButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#b45309',
  },
  section: {
    marginTop: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  permSpacer: {
    height: 10,
  },
  paymentsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  paymentsCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  paymentsCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  paymentsCardSubtitle: {
    fontSize: 12,
    color: '#b45309',
    marginTop: 2,
  },
  // Detail Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalScroll: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  modalEmpty: {
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 32,
    marginBottom: 32,
  },
  modalCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  modalCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  modalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  modalCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  modalBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 'auto',
  },
  modalBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  modalCardType: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 4,
  },
  modalCardDesc: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 4,
  },
  modalCardDate: {
    fontSize: 11,
    color: '#94a3b8',
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0c2458',
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 10,
  },
  payButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  modalViewAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 4,
  },
  modalViewAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
    marginTop: 2,
  },
});
