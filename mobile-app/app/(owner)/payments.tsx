import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';

export default function PaymentsScreen() {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadPayments();
  }, [filter]);

  const loadPayments = async () => {
    setLoading(true);
    try {
      const status = filter === 'all' ? undefined : filter;
      const response = await api.getPayments({ status });
      setPayments(response.data || []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateInvoice = async (paymentId: string) => {
    try {
      const response = await api.generateInvoice(paymentId);
      Alert.alert('Success', `Invoice generated: ${response.data.invoiceId}`);
      loadPayments();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to generate invoice');
    }
  };

  const filters = [
    { label: 'All', value: 'all' },
    { label: 'Pending', value: 'pending' },
    { label: 'Paid', value: 'paid' },
    { label: 'Failed', value: 'failed' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.filterContainer}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[styles.filterButton, filter === f.value && styles.filterButtonActive]}
            onPress={() => setFilter(f.value)}
          >
            <Text
              style={[
                styles.filterText,
                filter === f.value && styles.filterTextActive,
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadPayments} />}
      >
        {payments.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No payments found</Text>
          </View>
        ) : (
          payments.map((payment) => (
            <View key={payment._id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.studentName}>
                    {payment.studentId?.name || 'Unknown Student'}
                  </Text>
                  <Text style={styles.paymentType}>{payment.type.toUpperCase()}</Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(payment.status) },
                  ]}
                >
                  <Text style={styles.statusText}>{payment.status.toUpperCase()}</Text>
                </View>
              </View>
              <Text style={styles.amount}>₹{payment.amount.toLocaleString()}</Text>
              <Text style={styles.date}>
                {new Date(payment.createdAt).toLocaleDateString()}
              </Text>
              {payment.invoiceId && (
                <Text style={styles.invoice}>Invoice: {payment.invoiceId}</Text>
              )}
              <View style={styles.actions}>
                {payment.status === 'paid' && !payment.invoiceId && (
                  <TouchableOpacity
                    style={styles.invoiceButton}
                    onPress={() => handleGenerateInvoice(payment._id)}
                  >
                    <Ionicons name="document-text" size={16} color="#fff" />
                    <Text style={styles.invoiceButtonText}>Generate Invoice</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'paid':
      return '#4CAF50';
    case 'pending':
      return '#FF9800';
    case 'failed':
      return '#f44336';
    default:
      return '#999';
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 10,
    gap: 10,
  },
  filterButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },
  filterButtonActive: {
    backgroundColor: '#0a7ea4',
  },
  filterText: {
    fontSize: 14,
    color: '#687076',
  },
  filterTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  card: {
    backgroundColor: '#fff',
    margin: 15,
    marginTop: 0,
    padding: 15,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  studentName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#11181C',
  },
  paymentType: {
    fontSize: 12,
    color: '#687076',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  amount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginVertical: 8,
  },
  date: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  invoice: {
    fontSize: 12,
    color: '#0a7ea4',
    marginTop: 4,
  },
  actions: {
    marginTop: 10,
  },
  invoiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a7ea4',
    padding: 10,
    borderRadius: 8,
    gap: 8,
  },
  invoiceButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

