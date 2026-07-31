import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Modal,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import api from '../../services/api';
import { API_BASE_URL } from '../../constants/config';

let RazorpayCheckout: any = null;
try {
  const Razorpay = require('react-native-razorpay');
  RazorpayCheckout = Razorpay?.default ?? Razorpay;
  if (typeof RazorpayCheckout?.open !== 'function') RazorpayCheckout = null;
} catch {
  RazorpayCheckout = null;
}
const isRazorpayAvailable = RazorpayCheckout != null && typeof RazorpayCheckout.open === 'function';

export default function FeesScreen() {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payingFor, setPayingFor] = useState<string | null>(null);
  const [webViewCheckout, setWebViewCheckout] = useState<{
    orderId: string;
    keyId: string;
    amount: number;
    description: string;
  } | null>(null);

  const load = async () => {
    try {
      const payRes = await api.getMyPayments();
      setPayments(Array.isArray(payRes) ? payRes : []);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load');
      setPayments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openRazorpayAndVerify = async (
    orderId: string,
    keyId: string,
    amount: number,
    description: string
  ) => {
    if (isRazorpayAvailable && RazorpayCheckout?.open) {
      const amountPaise = Math.round(amount * 100);
      const options: any = {
        order_id: orderId,
        key_id: keyId,
        amount: amountPaise,
        currency: 'INR',
        name: 'Hostel Payment',
        description: description || 'Fee payment',
      };
      if (Platform.OS === 'android') {
        options.theme = { color: '#7c3aed' };
      }
      try {
        const data = await RazorpayCheckout.open(options);
        const paymentId = data?.razorpay_payment_id;
        const signature = data?.razorpay_signature;
        if (!paymentId || !signature) {
          Alert.alert('Payment', 'Payment was cancelled or incomplete.');
          return;
        }
        await api.verifyRazorpayPayment({
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature,
        });
        Alert.alert('Success', 'Payment completed successfully.');
        load();
      } catch (err: any) {
        if (err?.code === 2 || err?.description === 'Payment cancelled') {
          return;
        }
        const msg = err?.description || err?.message || String(err);
        if (msg.includes("'open' of null") || msg.includes('open of null')) {
          setWebViewCheckout({ orderId, keyId, amount, description });
        } else {
          Alert.alert('Payment failed', msg || 'Please try again or pay at office.');
        }
      }
      return;
    }
    setWebViewCheckout({ orderId, keyId, amount, description });
  };

  const handleWebViewMessage = async (event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.cancelled) {
        setWebViewCheckout(null);
        return;
      }
      if (data.success) {
        setWebViewCheckout(null);
        Alert.alert('Success', 'Payment completed successfully.');
        load();
        return;
      }
      if (data.razorpay_payment_id && data.razorpay_signature && data.razorpay_order_id) {
        setWebViewCheckout(null);
        await api.verifyRazorpayPayment({
          razorpay_order_id: data.razorpay_order_id,
          razorpay_payment_id: data.razorpay_payment_id,
          razorpay_signature: data.razorpay_signature,
        });
        Alert.alert('Success', 'Payment completed successfully.');
        load();
      }
    } catch {
      setWebViewCheckout(null);
    }
  };

  const handlePayPending = async (p: any) => {
    setPayingFor(p._id);
    try {
      const res = await api.createRazorpayOrderForPayment(p._id);
      const data = (res as any)?.data ?? res;
      if (data?.orderId && data?.keyId) {
        const description = `${p.type || 'Payment'}${p.planId?.name ? ` · ${p.planId.name}` : ''}`;
        await openRazorpayAndVerify(
          data.orderId,
          data.keyId,
          Number(p.amount),
          description
        );
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
  };

  const pending = payments.filter((p: any) => p.status === 'pending');
  const paid = payments.filter((p: any) => p.status === 'paid');

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <Text style={styles.sectionTitle}>Payment history</Text>
        {loading ? (
          <ActivityIndicator size="large" color="#7c3aed" style={{ marginTop: 24 }} />
        ) : paid.length === 0 && pending.length === 0 ? (
          <Text style={styles.emptyText}>No payments yet</Text>
        ) : (
          <>
            {pending.length > 0 && (
              <>
                <Text style={styles.subSection}>Pending</Text>
                {pending.map((p) => (
                  <View key={p._id} style={styles.payCard}>
                    <View style={styles.payCardRow}>
                      <Text style={styles.payCardTitle}>₹{Number(p.amount).toLocaleString()} · {p.type}</Text>
                      <Text style={styles.payCardStatus}>Due</Text>
                    </View>
                    {(p.planId?.name || p.planId?.durationMonths) ? (
                      <Text style={styles.payCardPlan}>
                        Plan: {p.planId.name ?? `${p.planId.durationMonths} month${p.planId.durationMonths !== 1 ? 's' : ''}`}
                        {typeof p.planId.amount === 'number' ? ` · ₹${Number(p.planId.amount).toLocaleString()}` : ''}
                      </Text>
                    ) : null}
                    {p.periodStart && p.periodEnd ? (
                      <Text style={styles.payCardPeriod}>
                        Period: {new Date(p.periodStart).toLocaleDateString()} – {new Date(p.periodEnd).toLocaleDateString()}
                      </Text>
                    ) : null}
                    {p.dueDate && (
                      <Text style={styles.payCardDue}>Due: {new Date(p.dueDate).toLocaleDateString()}</Text>
                    )}
                    <TouchableOpacity
                      style={styles.razorpayBtn}
                      onPress={() => handlePayPending(p)}
                      disabled={!!payingFor}
                    >
                      <Ionicons name="card" size={18} color="#fff" style={{ marginRight: 6 }} />
                      <Text style={styles.razorpayBtnText}>
                        {payingFor === p._id ? 'Opening...' : 'Pay using Razorpay'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}
            {paid.length > 0 && (
              <>
                <Text style={styles.subSection}>Paid</Text>
                {paid.map((p) => (
                  <View key={p._id} style={[styles.payCard, styles.payCardPaid]}>
                    <Text style={styles.payCardTitle}>₹{Number(p.amount).toLocaleString()} · {p.type}</Text>
                    {(p.planId?.name || p.planId?.durationMonths) ? (
                      <Text style={styles.payCardPlan}>
                        Plan: {p.planId.name ?? `${p.planId.durationMonths} month${p.planId.durationMonths !== 1 ? 's' : ''}`}
                        {typeof p.planId.amount === 'number' ? ` · ₹${Number(p.planId.amount).toLocaleString()}` : ''}
                      </Text>
                    ) : null}
                    {p.periodStart && p.periodEnd ? (
                      <Text style={styles.payCardPeriod}>
                        Period: {new Date(p.periodStart).toLocaleDateString()} – {new Date(p.periodEnd).toLocaleDateString()}
                      </Text>
                    ) : null}
                    <Text style={styles.payCardDate}>
                      Paid: {p.paidDate ? new Date(p.paidDate).toLocaleDateString() : '—'}
                      {p.transactionId ? ` · ${String(p.transactionId).slice(0, 12)}…` : ''}
                    </Text>
                  </View>
                ))}
              </>
            )}
          </>
        )}

        <View style={styles.note}>
          <Ionicons name="information-circle-outline" size={20} color="#64748b" />
          <Text style={styles.noteText}>
            Pay pending dues using Razorpay (UPI, card, netbanking) or visit the hostel office with the amount.
          </Text>
        </View>
      </ScrollView>

      {webViewCheckout && (
        <Modal visible={!!webViewCheckout} animationType="slide" onRequestClose={() => setWebViewCheckout(null)}>
          <View style={styles.webViewContainer}>
            <TouchableOpacity
              style={styles.webViewClose}
              onPress={() => setWebViewCheckout(null)}
            >
              <Ionicons name="close" size={28} color="#0f172a" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.browserPayBtn}
              onPress={() => {
                const base = API_BASE_URL.replace(/\/+$/, '');
                const url = base + '/razorpay-checkout?' +
                  'order_id=' + encodeURIComponent(webViewCheckout.orderId) +
                  '&key_id=' + encodeURIComponent(webViewCheckout.keyId) +
                  '&amount=' + encodeURIComponent(webViewCheckout.amount) +
                  '&name=' + encodeURIComponent('Hostel Payment') +
                  '&description=' + encodeURIComponent(webViewCheckout.description) +
                  '&callback_url=' + encodeURIComponent(base + '/razorpay-callback');
                Linking.openURL(url).catch(() => {});
              }}
            >
              <Text style={styles.browserPayBtnText}>Pay in browser (if payment doesn’t open)</Text>
            </TouchableOpacity>
            <WebView
              source={{
                uri:
                  API_BASE_URL.replace(/\/+$/, '') +
                  '/razorpay-checkout?' +
                  'order_id=' + encodeURIComponent(webViewCheckout.orderId) +
                  '&key_id=' + encodeURIComponent(webViewCheckout.keyId) +
                  '&amount=' + encodeURIComponent(webViewCheckout.amount) +
                  '&name=' + encodeURIComponent('Hostel Payment') +
                  '&description=' + encodeURIComponent(webViewCheckout.description) +
                  '&callback_url=' + encodeURIComponent(API_BASE_URL.replace(/\/+$/, '') + '/razorpay-callback'),
              }}
              onMessage={handleWebViewMessage}
              javaScriptEnabled
              domStorageEnabled
              style={styles.webView}
              originWhitelist={['https://*', 'http://*']}
            />
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scrollContent: { padding: 20, paddingBottom: 32 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
  subSection: { fontSize: 14, fontWeight: '600', color: '#64748b', marginTop: 12, marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#64748b' },
  payCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#fef3c7',
  },
  payCardPaid: { borderColor: '#d1fae5' },
  payCardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  payCardTitle: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  payCardStatus: { fontSize: 12, color: '#d97706', marginTop: 4 },
  payCardPlan: { fontSize: 11, color: '#64748b', marginTop: 2 },
  payCardPeriod: { fontSize: 11, color: '#64748b', marginTop: 2 },
  payCardDue: { fontSize: 11, color: '#64748b', marginTop: 4 },
  payCardDate: { fontSize: 12, color: '#059669', marginTop: 4 },
  razorpayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0c2458',
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 10,
  },
  razorpayBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 24, padding: 12, backgroundColor: '#f1f5f9', borderRadius: 10 },
  noteText: { flex: 1, fontSize: 12, color: '#64748b' },
  webViewContainer: { flex: 1, backgroundColor: '#fff', paddingTop: Platform.OS === 'ios' ? 48 : 24 },
  webViewClose: { position: 'absolute', top: Platform.OS === 'ios' ? 48 : 24, right: 16, zIndex: 10, padding: 8 },
  browserPayBtn: { padding: 10, marginHorizontal: 16, marginBottom: 8, backgroundColor: '#e0e7ff', borderRadius: 8, zIndex: 10 },
  browserPayBtnText: { fontSize: 12, color: '#3730a3', textAlign: 'center', fontWeight: '600' },
  webView: { flex: 1 },
});
