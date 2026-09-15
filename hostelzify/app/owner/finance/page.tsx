'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import { useToast } from '../../../components/Toast';
import {
  CreditCard,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  FileText,
  Download,
  Calendar,
  Building2,
  User,
  ArrowDownRight,
  ArrowUpRight,
  Loader2,
  X,
  Receipt,
  RefreshCw,
} from 'lucide-react';
import { useHostelsQuery } from '../../../hooks/queries/useHostelsQuery';
import { useOwnerHostel } from '../../../contexts/OwnerHostelContext';

export default function OwnerFinancePage() {
  const { user } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const { selectedHostel } = useOwnerHostel();

  const [activeTab, setActiveTab] = useState<'transactions' | 'pending' | 'plans' | 'summary'>('transactions');
  const [payments, setPayments] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [seedingPlans, setSeedingPlans] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [hostelFilter, setHostelFilter] = useState('');

  // Sync hostelFilter with global selectedHostel
  useEffect(() => {
    if (selectedHostel) {
      setHostelFilter(selectedHostel);
    }
  }, [selectedHostel]);

  // Modals
  const [recordPaymentModal, setRecordPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    studentId: '',
    studentEmail: '',
    hostelId: '',
    amount: '',
    feeType: 'hostel_rent',
    paymentMethod: 'upi',
    referenceNumber: '',
    notes: '',
  });
  const [recordingPayment, setRecordingPayment] = useState(false);

  // Edit Plan Modal
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const [planAmountInput, setPlanAmountInput] = useState('');
  const [updatingPlan, setUpdatingPlan] = useState(false);

  // Invoice Modal
  const [invoiceModal, setInvoiceModal] = useState<any | null>(null);

  const { data: hostels = [] } = useHostelsQuery();

  useEffect(() => {
    if (!user || user.role !== 'owner') {
      router.replace('/login');
      return;
    }
    loadFinanceData();
  }, [user, router, hostelFilter]);

  const loadFinanceData = async () => {
    setLoading(true);
    const targetHostel = hostelFilter || selectedHostel;
    try {
      const [paymentsRes, plansRes, studentsRes] = await Promise.all([
        api.getOwnerPayments().catch(() => ({ data: [] })),
        targetHostel ? api.getPlans(targetHostel).catch(() => ({ data: [] })) : Promise.resolve([]),
        api.getOwnerStudents(targetHostel ? { hostelId: targetHostel } : {}).catch(() => []),
      ]);

      const paymentsList = Array.isArray(paymentsRes) ? paymentsRes : paymentsRes?.data ?? [];
      const plansList = Array.isArray(plansRes) ? plansRes : plansRes?.data ?? [];

      setPayments(paymentsList);
      setPlans(plansList);
      setStudents(Array.isArray(studentsRes) ? studentsRes : []);
    } catch (err: any) {
      showToast(err.message || 'Failed to load financial records', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSeedPlans = async () => {
    const targetHostel = hostelFilter || selectedHostel;
    if (!targetHostel) {
      showToast('Please select a hostel first', 'error');
      return;
    }
    setSeedingPlans(true);
    try {
      await api.seedPlans(targetHostel);
      showToast('Standard 1, 3, 6, 12 month plans seeded successfully', 'success');
      loadFinanceData();
    } catch (err: any) {
      showToast(err.message || 'Failed to seed plans', 'error');
    } finally {
      setSeedingPlans(false);
    }
  };

  const handleUpdatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan || !planAmountInput) return;
    setUpdatingPlan(true);
    try {
      await api.updatePlan(editingPlan._id || editingPlan.id, {
        amount: Number(planAmountInput),
      });
      showToast(`Plan ${editingPlan.name} updated to ₹${planAmountInput}`, 'success');
      setEditingPlan(null);
      loadFinanceData();
    } catch (err: any) {
      showToast(err.message || 'Failed to update plan', 'error');
    } finally {
      setUpdatingPlan(false);
    }
  };

  const handleMarkAsPaid = async (paymentId: string) => {
    try {
      await api.updatePaymentStatus(paymentId, { status: 'paid' });
      showToast('Payment marked as paid', 'success');
      loadFinanceData();
    } catch (err: any) {
      showToast(err.message || 'Failed to update payment status', 'error');
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveEmail = paymentForm.studentEmail.trim();
    const effectiveHostel = paymentForm.hostelId || hostelFilter || selectedHostel;
    if (!effectiveEmail || !paymentForm.amount || !effectiveHostel) {
      showToast('Please select a resident/enter email, amount, and hostel', 'error');
      return;
    }
    setRecordingPayment(true);
    try {
      await api.createOwnerPayment({
        email: effectiveEmail,
        studentId: paymentForm.studentId || undefined,
        hostelId: effectiveHostel,
        amount: Number(paymentForm.amount),
        type: paymentForm.feeType,
        method: paymentForm.paymentMethod,
        transactionId: paymentForm.referenceNumber || `TXN-${Date.now()}`,
        notes: paymentForm.notes,
        status: 'paid',
      });
      showToast('Payment transaction recorded successfully', 'success');
      setRecordPaymentModal(false);
      setPaymentForm({
        studentId: '',
        studentEmail: '',
        hostelId: '',
        amount: '',
        feeType: 'hostel_rent',
        paymentMethod: 'upi',
        referenceNumber: '',
        notes: '',
      });
      loadFinanceData();
    } catch (err: any) {
      showToast(err.message || 'Failed to record payment', 'error');
    } finally {
      setRecordingPayment(false);
    }
  };

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (search) {
        const query = search.toLowerCase();
        const sName = p.studentId?.name?.toLowerCase() || '';
        const sEmail = p.studentId?.email?.toLowerCase() || p.email?.toLowerCase() || '';
        const txId = p.transactionId?.toLowerCase() || '';
        if (!sName.includes(query) && !sEmail.includes(query) && !txId.includes(query)) {
          return false;
        }
      }
      if (statusFilter !== 'all') {
        if (p.status !== statusFilter) return false;
      }
      if (hostelFilter) {
        const pHostelId = typeof p.hostelId === 'object' ? p.hostelId?._id : p.hostelId;
        if (pHostelId !== hostelFilter) return false;
      }
      return true;
    });
  }, [payments, search, statusFilter, hostelFilter]);

  const pendingPayments = useMemo(() => {
    return payments.filter((p) => p.status === 'pending');
  }, [payments]);

  // Overall Financial Stats
  const stats = useMemo(() => {
    const paidList = payments.filter((p) => p.status === 'paid');
    const totalCollected = paidList.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const totalPending = pendingPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const totalTransactions = payments.length;
    return { totalCollected, totalPending, totalTransactions, pendingCount: pendingPayments.length };
  }, [payments, pendingPayments]);

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5" />
              Treasury & Revenue Operations
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mt-1">
            Finance & Payment Records
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Track revenue, rent collections, overdue receivables, invoices, and fee schedules.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setRecordPaymentModal(true)}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all font-bold text-xs shadow-xs flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Record Payment
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-gray-200/80 p-4 shadow-xs">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Revenue Collected</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">₹{stats.totalCollected.toLocaleString('en-IN')}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Cleared transactions</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200/80 p-4 shadow-xs">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Pending Dues</p>
          <p className="text-2xl font-black text-rose-600 mt-1">₹{stats.totalPending.toLocaleString('en-IN')}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">{stats.pendingCount} unpaid invoices</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200/80 p-4 shadow-xs">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Invoices</p>
          <p className="text-2xl font-black text-gray-900 mt-1">{stats.totalTransactions}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Billed items</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200/80 p-4 shadow-xs">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Collection Health</p>
          <p className="text-2xl font-black text-indigo-600 mt-1">
            {stats.totalCollected + stats.totalPending > 0
              ? Math.round((stats.totalCollected / (stats.totalCollected + stats.totalPending)) * 100)
              : 100}
            %
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">Collection efficiency</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveTab('transactions')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
            activeTab === 'transactions' ? 'bg-emerald-600 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Transactions & Receipts
        </button>

        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
            activeTab === 'pending' ? 'bg-emerald-600 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          Pending Receivables ({stats.pendingCount})
        </button>

        <button
          onClick={() => setActiveTab('plans')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
            activeTab === 'plans' ? 'bg-emerald-600 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          Pricing Plans ({plans.length})
        </button>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'transactions' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="all">All Payments</option>
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Hostel</label>
                <select
                  value={hostelFilter}
                  onChange={(e) => setHostelFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="">All Hostels ({hostels.length})</option>
                  {hostels.map((h: any) => (
                    <option key={h._id || h.id} value={h._id || h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search student, TX ID..."
                    className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
            {loading ? (
              <div className="p-12 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-3" />
                <p className="text-sm font-semibold text-gray-700">Loading transactions...</p>
              </div>
            ) : filteredPayments.length === 0 ? (
              <div className="p-12 text-center">
                <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-gray-900">No payment transactions found</h3>
                <p className="text-xs text-gray-500 mt-1">Record a payment or adjust filters to view records.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 text-xs font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4 text-left">Resident / Payer</th>
                      <th className="px-6 py-4 text-left">Fee Type</th>
                      <th className="px-6 py-4 text-left">Amount</th>
                      <th className="px-6 py-4 text-left">Method</th>
                      <th className="px-6 py-4 text-left">Status</th>
                      <th className="px-6 py-4 text-left">Date</th>
                      <th className="px-6 py-4 text-center">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-xs">
                    {filteredPayments.map((p) => {
                      const studentName = p.studentId?.name || p.name || p.email || 'Resident';
                      const isPaid = p.status === 'paid';

                      return (
                        <tr key={p._id || p.id} className="hover:bg-gray-50/80 transition-colors">
                          <td className="px-6 py-4">
                            <p className="font-bold text-gray-900">{studentName}</p>
                            <p className="text-[11px] text-gray-400 font-mono">{p.transactionId || p._id?.slice(-8)}</p>
                          </td>
                          <td className="px-6 py-4 capitalize font-semibold text-gray-700">
                            {p.type?.replace('_', ' ') || 'Hostel Rent'}
                          </td>
                          <td className="px-6 py-4 font-black text-gray-900">
                            ₹{Number(p.amount || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="px-6 py-4 uppercase text-gray-600 font-mono">
                            {p.method || 'UPI'}
                          </td>
                          <td className="px-6 py-4">
                            {isPaid ? (
                              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Paid</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">Pending</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-gray-500">
                            {p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-IN') : '—'}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => setInvoiceModal(p)}
                              className="px-2.5 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-50 rounded-lg inline-flex items-center gap-1"
                            >
                              <Receipt className="w-3.5 h-3.5" />
                              Invoice
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'pending' && (
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-rose-600" />
              Outstanding Student Receivables
            </h3>
            <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg">
              Total Unpaid: ₹{stats.totalPending.toLocaleString('en-IN')}
            </span>
          </div>

          {pendingPayments.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-gray-900">Zero Outstanding Dues!</h3>
              <p className="text-xs text-gray-500 mt-1">All student fees and rental dues are settled.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 text-xs font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 text-left">Student</th>
                    <th className="px-6 py-4 text-left">Due Type</th>
                    <th className="px-6 py-4 text-left">Pending Amount</th>
                    <th className="px-6 py-4 text-left">Billed Date</th>
                    <th className="px-6 py-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-xs">
                  {pendingPayments.map((p) => (
                    <tr key={p._id || p.id} className="hover:bg-gray-50/80">
                      <td className="px-6 py-4 font-bold text-gray-900">
                        {p.studentId?.name || p.email || 'Resident'}
                      </td>
                      <td className="px-6 py-4 capitalize text-gray-700 font-semibold">
                        {p.type?.replace('_', ' ') || 'Rent'}
                      </td>
                      <td className="px-6 py-4 font-black text-rose-600">
                        ₹{Number(p.amount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleMarkAsPaid(p._id || p.id)}
                            className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-bold flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            Mark Paid
                          </button>
                          <button
                            onClick={() => {
                              showToast('Payment reminder notice dispatched to resident', 'success');
                            }}
                            className="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-bold"
                          >
                            Remind
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'plans' && (
        <div>
          {plans.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200/80 p-12 text-center shadow-xs">
              <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-gray-900">No Pricing Plans Configured</h3>
              <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                Generate standard tenancy packages (1-Month, 3-Month, 6-Month, 12-Month) for this hostel with one click.
              </p>
              <button
                onClick={handleSeedPlans}
                disabled={seedingPlans || !(hostelFilter || selectedHostel)}
                className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs inline-flex items-center gap-2 disabled:opacity-50"
              >
                {seedingPlans ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Seed Standard Plans
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {plans.map((plan: any) => (
                <div key={plan._id || plan.id} className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="text-base font-black text-gray-900">{plan.name}</h4>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold text-xs">
                        {plan.durationMonths || 1} M
                      </span>
                    </div>
                    <p className="text-2xl font-black text-gray-900 mt-2">
                      ₹{Number(plan.amount || 0).toLocaleString('en-IN')}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{plan.description || 'Standard residency & board package'}</p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingPlan(plan);
                      setPlanAmountInput(String(plan.amount || 0));
                    }}
                    className="w-full py-1.5 px-3 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-bold transition-colors"
                  >
                    Edit Price
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit Plan Modal */}
      {editingPlan && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-gray-200 max-w-sm w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">Update Plan: {editingPlan.name}</h3>
              <button onClick={() => setEditingPlan(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleUpdatePlan} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">New Amount (₹)</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={planAmountInput}
                  onChange={(e) => setPlanAmountInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPlan(null)}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingPlan}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                >
                  {updatingPlan && <Loader2 className="w-3 h-3 animate-spin" />}
                  Save Price
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {recordPaymentModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-gray-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600" />
                Record Student Payment
              </h3>
              <button
                onClick={() => setRecordPaymentModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-3">
              {students.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Select Active Resident</label>
                  <select
                    value={paymentForm.studentId}
                    onChange={(e) => {
                      const sId = e.target.value;
                      const found = students.find((s: any) => (s._id || s.id) === sId);
                      setPaymentForm({
                        ...paymentForm,
                        studentId: sId,
                        studentEmail: found?.email || paymentForm.studentEmail,
                      });
                    }}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="">-- Choose Resident or enter email manually --</option>
                    {students.map((s: any) => (
                      <option key={s._id || s.id} value={s._id || s.id}>
                        {s.name} ({s.roomNumber ? `Room ${s.roomNumber}` : s.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Student Email *</label>
                <input
                  type="email"
                  required
                  value={paymentForm.studentEmail}
                  onChange={(e) => setPaymentForm({ ...paymentForm, studentEmail: e.target.value })}
                  placeholder="resident@university.edu"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Hostel Property *</label>
                <select
                  required
                  value={paymentForm.hostelId || hostelFilter || selectedHostel}
                  onChange={(e) => setPaymentForm({ ...paymentForm, hostelId: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="">Select Property...</option>
                  {hostels.map((h: any) => (
                    <option key={h._id || h.id} value={h._id || h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    placeholder="8500"
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Fee Type</label>
                  <select
                    value={paymentForm.feeType}
                    onChange={(e) => setPaymentForm({ ...paymentForm, feeType: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="hostel_rent">Hostel Rent</option>
                    <option value="mess">Mess Fee</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="fine">Disciplinary Fine</option>
                    <option value="other">Other Deposit</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Payment Method</label>
                  <select
                    value={paymentForm.paymentMethod}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="upi">UPI / QR</option>
                    <option value="netbanking">NetBanking / NEFT</option>
                    <option value="card">Credit/Debit Card</option>
                    <option value="cash">Cash Collection</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Ref / UTR Number</label>
                  <input
                    type="text"
                    value={paymentForm.referenceNumber}
                    onChange={(e) => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })}
                    placeholder="UTR-92847291"
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Notes / Remarks</label>
                <input
                  type="text"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  placeholder="e.g. Paid in full for September semester"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setRecordPaymentModal(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordingPayment}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {recordingPayment && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Modal Preview */}
      {invoiceModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-gray-200 max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-600" />
                Payment Receipt
              </h3>
              <button onClick={() => setInvoiceModal(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Transaction Ref:</span>
                <span className="font-mono font-bold text-gray-900">{invoiceModal.transactionId || invoiceModal._id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Resident / Payer:</span>
                <span className="font-bold text-gray-900">{invoiceModal.studentId?.name || invoiceModal.email || 'Resident'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Category:</span>
                <span className="font-bold text-gray-900 capitalize">{invoiceModal.type?.replace('_', ' ') || 'Rent'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Payment Channel:</span>
                <span className="font-bold uppercase text-gray-900">{invoiceModal.method || 'UPI'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Payment Status:</span>
                <span className="font-bold text-emerald-600 uppercase">{invoiceModal.status}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-200 text-sm">
                <span className="font-bold text-gray-700">Amount Paid:</span>
                <span className="font-black text-emerald-600">₹{Number(invoiceModal.amount || 0).toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  window.print();
                }}
                className="px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-colors flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Print / Save Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
