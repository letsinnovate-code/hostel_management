'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import {
  CreditCard,
  DollarSign,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
  Receipt,
  FileText,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { format } from 'date-fns';

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface PaymentRecord {
  _id: string;
  type: string;
  amount: number;
  dueDate?: string;
  status: 'paid' | 'pending' | 'overdue' | 'cancelled';
  paidDate?: string;
  paymentMethod?: string;
  transactionId?: string;
  razorpayOrderId?: string;
  periodStart?: string;
  periodEnd?: string;
  createdAt: string;
}

interface FeeStructureItem {
  _id: string;
  name: string;
  type: string;
  amount: number;
  frequency: string;
}

export default function StudentPaymentsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [feeStructures, setFeeStructures] = useState<FeeStructureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [customPayModal, setCustomPayModal] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [customType, setCustomType] = useState('hostel_rent');
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);

  useEffect(() => {
    if (!user) {
      router.replace('/login');
      return;
    }
    loadData();

    // Load Razorpay script safely without duplicate DOM injection
    if (typeof window !== 'undefined') {
      if (window.Razorpay) {
        setRazorpayLoaded(true);
      } else {
        const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
        if (!existingScript) {
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.async = true;
          script.onload = () => setRazorpayLoaded(true);
          document.body.appendChild(script);
        } else {
          existingScript.addEventListener('load', () => setRazorpayLoaded(true));
          if (window.Razorpay) setRazorpayLoaded(true);
        }
      }
    }
  }, [user, router]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [paymentsRes, feeRes] = await Promise.allSettled([
        api.getMyPayments(),
        api.getMyFeeStructure(),
      ]);

      if (paymentsRes.status === 'fulfilled') {
        const data = (paymentsRes.value as any)?.data ?? paymentsRes.value ?? [];
        setPayments(Array.isArray(data) ? data : []);
      }
      if (feeRes.status === 'fulfilled') {
        const data = (feeRes.value as any)?.data ?? feeRes.value ?? [];
        setFeeStructures(Array.isArray(data) ? data : []);
      }
    } catch (error: any) {
      console.error('Failed to load payments data:', error);
      toast.error('Could not load payment information');
    } finally {
      setLoading(false);
    }
  };

  const handlePayExisting = async (payment: PaymentRecord) => {
    if (!window.Razorpay) {
      toast.error('Payment gateway is loading. Please try again in a moment.');
      return;
    }

    setPayingId(payment._id);
    try {
      // 1. Create order on backend
      const res = await api.createOrderForExistingPayment(payment._id);
      const orderData = res?.data ?? res;

      if (!orderData?.orderId || !orderData?.keyId) {
        throw new Error('Could not initiate payment order');
      }

      // 2. Launch Razorpay modal
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'Hostelzify Living',
        description: `Payment for ${payment.type.replace('_', ' ').toUpperCase()}`,
        order_id: orderData.orderId,
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: user?.phone || '',
        },
        theme: {
          color: '#2563eb',
        },
        handler: async (response: any) => {
          try {
            const verifyRes = await api.verifyRazorpayPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            if (verifyRes.success || verifyRes.data) {
              toast.success('Payment successful! Your receipt has been generated.');
              loadData();
            } else {
              toast.error(verifyRes.message || 'Payment verification failed');
            }
          } catch (err: any) {
            toast.error(err.message || 'Failed to verify payment');
          }
        },
        modal: {
          ondismiss: () => {
            setPayingId(null);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (resp: any) => {
        toast.error(`Payment failed: ${resp.error?.description || 'Transaction declined'}`);
        setPayingId(null);
      });
      rzp.open();
    } catch (error: any) {
      console.error('Payment initiation error:', error);
      toast.error(error.message || 'Payment could not be started');
      setPayingId(null);
    }
  };

  const handlePayCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(customAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (!window.Razorpay) {
      toast.error('Payment gateway is loading. Please try again.');
      return;
    }

    setPayingId('custom');
    try {
      const res = await api.createRazorpayOrder(amountNum, customType);
      const orderData = res?.data ?? res;

      if (!orderData?.orderId || !orderData?.keyId) {
        throw new Error('Could not initiate payment order');
      }

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'Hostelzify Living',
        description: `Direct payment for ${customType.replace('_', ' ').toUpperCase()}`,
        order_id: orderData.orderId,
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: user?.phone || '',
        },
        theme: {
          color: '#2563eb',
        },
        handler: async (response: any) => {
          try {
            const verifyRes = await api.verifyRazorpayPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            if (verifyRes.success || verifyRes.data) {
              toast.success('Payment successful! Receipt generated.');
              setCustomPayModal(false);
              setCustomAmount('');
              loadData();
            } else {
              toast.error(verifyRes.message || 'Payment verification failed');
            }
          } catch (err: any) {
            toast.error(err.message || 'Failed to verify payment');
          }
        },
        modal: {
          ondismiss: () => {
            setPayingId(null);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (resp: any) => {
        toast.error(`Payment failed: ${resp.error?.description || 'Declined'}`);
        setPayingId(null);
      });
      rzp.open();
    } catch (error: any) {
      console.error('Custom payment error:', error);
      toast.error(error.message || 'Failed to initialize payment');
      setPayingId(null);
    }
  };

  const pendingPayments = payments.filter((p) => p.status === 'pending' || p.status === 'overdue');
  const paidPayments = payments.filter((p) => p.status === 'paid');
  const totalPending = pendingPayments.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const totalPaid = paidPayments.reduce((acc, curr) => acc + (curr.amount || 0), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <CreditCard className="w-7 h-7 text-blue-600" />
            Fees & Payments
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your hostel dues, view fee breakdown, and make secure online payments.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setCustomPayModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm transition-all shadow-blue-200"
          >
            <Sparkles className="w-4 h-4" />
            Pay Custom Amount
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pending Dues</span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-gray-900">₹{totalPending.toLocaleString('en-IN')}</p>
            <p className="text-xs text-amber-600 font-medium mt-1">
              {pendingPayments.length} pending invoice{pendingPayments.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Paid</span>
            <div className="p-2 rounded-lg bg-green-50 text-green-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-gray-900">₹{totalPaid.toLocaleString('en-IN')}</p>
            <p className="text-xs text-green-600 font-medium mt-1">
              {paidPayments.length} completed payment{paidPayments.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Living Plan</span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-lg font-bold text-gray-900 truncate">
              {user?.planId?.name || 'Standard Living'}
            </p>
            <p className="text-xs text-blue-600 font-medium mt-1">
              {user?.planId?.durationMonths ? `${user.planId.durationMonths} Months Plan` : 'Monthly Cycle'}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Payment Gateway</span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-sm font-bold text-gray-900">Razorpay 256-Bit</p>
            <p className="text-xs text-emerald-600 font-medium mt-1">UPI · Cards · Netbanking</p>
          </div>
        </div>
      </div>

      {/* Pending Dues Section */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              Action Required: Pending Invoices
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Clear your outstanding hostel, mess, or maintenance charges on time.
            </p>
          </div>
          {pendingPayments.length > 0 && (
            <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full">
              {pendingPayments.length} Due
            </span>
          )}
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
            Loading invoices...
          </div>
        ) : pendingPayments.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-gray-900">All caught up!</h3>
            <p className="text-sm text-gray-500 mt-1">You have no pending dues at this time.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {pendingPayments.map((p) => (
              <div key={p._id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50 transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 capitalize">
                      {p.type.replace('_', ' ')}
                    </span>
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                      p.status === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {p.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 flex items-center gap-3">
                    {p.dueDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        Due by: {format(new Date(p.dueDate), 'dd MMM yyyy')}
                      </span>
                    )}
                    {p.periodStart && p.periodEnd && (
                      <span>
                        Period: {format(new Date(p.periodStart), 'dd MMM')} - {format(new Date(p.periodEnd), 'dd MMM yyyy')}
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-4 self-end sm:self-center">
                  <span className="text-xl font-bold text-gray-900">
                    ₹{p.amount?.toLocaleString('en-IN')}
                  </span>
                  <button
                    onClick={() => handlePayExisting(p)}
                    disabled={payingId === p._id}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 shadow-sm shadow-blue-200 disabled:opacity-50"
                  >
                    {payingId === p._id ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        Pay Now
                        <ArrowUpRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fee Structure Reference */}
      {feeStructures.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            Hostel Fee Structure Reference
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {feeStructures.map((f) => (
              <div key={f._id} className="p-3 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-900">{f.name}</p>
                  <p className="text-[11px] text-gray-500 capitalize">{f.frequency} · {f.type.replace('_', ' ')}</p>
                </div>
                <span className="text-sm font-bold text-blue-600">₹{f.amount?.toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment History Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-gray-600" />
            Payment History & Receipts
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">Complete record of your past transactions.</p>
        </div>

        {paidPayments.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No completed payments on record yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs font-semibold uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3">Fee Type</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Paid Date</th>
                  <th className="px-5 py-3">Method</th>
                  <th className="px-5 py-3">Transaction ID</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paidPayments.map((payment) => (
                  <tr key={payment._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-gray-900 capitalize">
                      {payment.type.replace('_', ' ')}
                    </td>
                    <td className="px-5 py-3.5 font-bold text-gray-900">
                      ₹{payment.amount?.toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">
                      {payment.paidDate ? format(new Date(payment.paidDate), 'dd MMM yyyy, hh:mm a') : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 uppercase text-xs font-semibold">
                      {payment.paymentMethod || 'UPI / Razorpay'}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 font-mono text-xs">
                      {payment.transactionId || payment.razorpayOrderId || '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle2 className="w-3 h-3" />
                        Paid
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Custom Amount Modal */}
      {customPayModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-900 text-lg">Pay Custom Amount</h3>
              <button
                onClick={() => setCustomPayModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handlePayCustom} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Payment Type
                </label>
                <select
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="hostel_rent">Hostel Rent</option>
                  <option value="mess">Mess Fee</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="fine">Fine / Penalty</option>
                  <option value="other">Other / Security Deposit</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Amount (₹ INR)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-400 font-bold">₹</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="e.g. 5000"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    required
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-700 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>You will be redirected to the secure Razorpay payment modal to complete checkout via UPI, Google Pay, PhonePe, or Card.</span>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCustomPayModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={payingId === 'custom'}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {payingId === 'custom' ? 'Opening Gateway...' : 'Proceed to Pay'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
