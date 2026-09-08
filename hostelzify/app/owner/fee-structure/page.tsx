'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, isOwnerUser } from '../../../contexts/AuthContext';
import { useOwnerHostel } from '../../../contexts/OwnerHostelContext';
import api from '../../../services/api';
import { DollarSign, Plus, ChevronLeft, Building2, CreditCard, X, Calendar, Loader2, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useConfirmModal } from '../../../components/ConfirmModal';
import toast from 'react-hot-toast';

const FEE_TYPES = [
  { value: 'hostel_rent', label: 'Hostel rent' },
  { value: 'mess', label: 'Mess' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'fine', label: 'Fine' },
  { value: 'other', label: 'Other' },
];

const FREQUENCIES = [
  { value: 'one-time', label: 'One-time' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

const APPLICABLE_TO = [
  { value: 'all', label: 'All students' },
  { value: 'room_category', label: 'By room category (AC / Non-AC / etc.)' },
  { value: 'specific_rooms', label: 'Specific rooms only' },
];

const ROOM_CATEGORIES = ['AC', 'Non-AC', 'Deluxe', 'Standard'];

function PlanRow({ plan, updating, onSaveAmount }: { plan: any; updating: boolean; onSaveAmount: (amount: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(plan.amount ?? 0));
  const handleSave = () => {
    const n = Number(value);
    if (!Number.isNaN(n) && n >= 0) {
      onSaveAmount(n);
      setEditing(false);
    }
  };
  return (
    <tr>
      <td className="px-4 py-3 text-sm font-medium text-gray-900">{plan.name}</td>
      <td className="px-4 py-3 text-sm text-gray-600">Plan</td>
      <td className="px-4 py-3 text-sm text-gray-600">{plan.durationMonths} month{plan.durationMonths !== 1 ? 's' : ''}</td>
      <td className="px-4 py-3">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              className="w-28 px-2 py-1 border border-gray-300 rounded text-sm"
              autoFocus
            />
            <button type="button" onClick={handleSave} disabled={updating} className="text-sm text-indigo-600 hover:underline disabled:opacity-50">Save</button>
            <button type="button" onClick={() => { setEditing(false); setValue(String(plan.amount ?? 0)); }} className="text-sm text-gray-500">Cancel</button>
          </div>
        ) : (
          <span className="text-sm text-gray-900">₹{Number(plan.amount || 0).toLocaleString()}</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-gray-400">—</td>
      <td className="px-4 py-3 text-right">
        {!editing && (
          <button type="button" onClick={() => setEditing(true)} className="text-sm text-indigo-600 hover:underline">Edit amount</button>
        )}
      </td>
    </tr>
  );
}

export default function OwnerFeeStructurePage() {
  const { user } = useAuth();
  const { selectedHostel: selectedHostelId } = useOwnerHostel();
  const router = useRouter();
  const { confirm } = useConfirmModal();
  const [fees, setFees] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loadingFees, setLoadingFees] = useState(false);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('');
  const [feeModalOpen, setFeeModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feeForm, setFeeForm] = useState({
    name: '',
    type: 'hostel_rent',
    amount: '',
    frequency: 'monthly',
    applicableTo: 'all' as 'all' | 'room_category' | 'specific_rooms',
    roomCategories: [] as string[],
    roomIds: [] as string[],
  });
  const [paymentForm, setPaymentForm] = useState({
    studentId: '',
    type: 'hostel_rent',
    amount: '',
    dueDate: '',
    periodStart: '',
    periodEnd: '',
  });
  const [students, setStudents] = useState<{ _id: string; name: string; roomId?: { _id: string; roomNumber?: string; category?: string }; planId?: { _id: string; name?: string; amount?: number; durationMonths?: number } }[]>([]);
  const [rooms, setRooms] = useState<{ _id: string; roomNumber: string; category?: string }[]>([]);
  const [applicableFeeHint, setApplicableFeeHint] = useState<string | null>(null);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [seedingPlans, setSeedingPlans] = useState(false);
  const [updatingPlanId, setUpdatingPlanId] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !isOwnerUser(user)) {
      router.replace('/login');
      return;
    }
  }, [user, router]);

  useEffect(() => {
    if (!user) return;
    if (selectedHostelId) {
      loadFees();
      loadPlans();
    }
    loadPayments();
  }, [user, selectedHostelId]);

  useEffect(() => {
    if (!user) return;
    loadPayments();
  }, [paymentStatusFilter]);

  useEffect(() => {
    if (selectedHostelId) {
      loadStudents();
      loadRooms();
    }
  }, [selectedHostelId]);

  // When student + type selected: prefer student's plan amount for hostel_rent, else applicable fee by room
  useEffect(() => {
    if (!selectedHostelId || !paymentForm.studentId || !paymentForm.type) {
      setApplicableFeeHint(null);
      return;
    }
    const student = students.find((s) => s._id === paymentForm.studentId);
    if (paymentForm.type === 'hostel_rent' && student?.planId && typeof student.planId.amount === 'number') {
      setPaymentForm((prev) => ({ ...prev, amount: String(student.planId!.amount) }));
      setApplicableFeeHint(`Student's plan: ${student.planId.name ?? ''}`);
      return;
    }
    let cancelled = false;
    api.getApplicableFeeForStudent(selectedHostelId, paymentForm.studentId, paymentForm.type)
      .then((res: any) => {
        if (cancelled) return;
        const data = (res?.data ?? res) ?? null;
        if (data && typeof data.amount === 'number') {
          setPaymentForm((prev) => ({ ...prev, amount: String(data.amount) }));
          setApplicableFeeHint(data.name ? `As per room: ${data.name}` : 'As per fee structure for this room');
        } else if (data && typeof data === 'object' && !Array.isArray(data)) {
          const byType = data[paymentForm.type];
          if (byType && typeof byType.amount === 'number') {
            setPaymentForm((prev) => ({ ...prev, amount: String(byType.amount) }));
            setApplicableFeeHint(byType.name ? `As per room: ${byType.name}` : 'As per fee structure for this room');
          } else {
            setApplicableFeeHint(null);
          }
        } else {
          setApplicableFeeHint(null);
        }
      })
      .catch(() => {
        if (!cancelled) setApplicableFeeHint(null);
      });
    return () => { cancelled = true; };
  }, [selectedHostelId, paymentForm.studentId, paymentForm.type, students]);

  const loadFees = async () => {
    if (!selectedHostelId) return;
    setLoadingFees(true);
    try {
      const res = await api.getFeeStructures(selectedHostelId);
      const data = (res as any)?.data ?? res ?? [];
      setFees(Array.isArray(data) ? data : []);
    } catch {
      setFees([]);
    } finally {
      setLoadingFees(false);
    }
  };

  const loadPayments = async () => {
    setLoadingPayments(true);
    try {
      const params: any = {};
      if (selectedHostelId) params.hostelId = selectedHostelId;
      if (paymentStatusFilter) params.status = paymentStatusFilter;
      const res = await api.getPayments(params);
      const data = (res as any)?.data ?? res ?? [];
      setPayments(Array.isArray(data) ? data : []);
    } catch {
      setPayments([]);
    } finally {
      setLoadingPayments(false);
    }
  };

  const loadStudents = async () => {
    if (!selectedHostelId) return;
    try {
      const res = await api.getUsers({ hostelId: selectedHostelId, role: 'student' });
      const data = (res as any)?.data ?? res ?? [];
      const arr = Array.isArray(data) ? data : [];
      setStudents(arr.map((u: any) => ({
        _id: u._id || u.id,
        name: u.name || 'Student',
        roomId: u.roomId ? { _id: u.roomId._id || u.roomId, roomNumber: u.roomId.roomNumber, category: u.roomId.category } : undefined,
        planId: u.planId ? { _id: u.planId._id || u.planId, name: u.planId.name, amount: u.planId.amount, durationMonths: u.planId.durationMonths } : undefined,
      })));
    } catch {
      setStudents([]);
    }
  };

  const loadRooms = async () => {
    if (!selectedHostelId) return;
    try {
      const res = await api.getRooms({ hostelId: selectedHostelId });
      const data = (res as any)?.data ?? res ?? [];
      const arr = Array.isArray(data) ? data : [];
      setRooms(arr.map((r: any) => ({ _id: r._id || r.id, roomNumber: r.roomNumber || '', category: r.category })));
    } catch {
      setRooms([]);
    }
  };

  const loadPlans = async () => {
    if (!selectedHostelId) return;
    setLoadingPlans(true);
    try {
      const res = await api.getPlans(selectedHostelId);
      const data = (res as any)?.data ?? res ?? [];
      setPlans(Array.isArray(data) ? data : []);
    } catch {
      setPlans([]);
    } finally {
      setLoadingPlans(false);
    }
  };

  const handleSeedPlans = async () => {
    if (!selectedHostelId) return;
    setSeedingPlans(true);
    try {
      await api.seedPlans(selectedHostelId);
      toast.success('Fee plans seeded successfully');
      loadPlans();
    } catch (err: any) {
      toast.error(err.message || 'Failed to seed plans');
    } finally {
      setSeedingPlans(false);
    }
  };

  const handleUpdatePlanAmount = async (planId: string, amount: number) => {
    setUpdatingPlanId(planId);
    try {
      await api.updatePlan(planId, { amount });
      toast.success('Plan amount updated');
      loadPlans();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
    } finally {
      setUpdatingPlanId(null);
    }
  };

  const handleAddFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHostelId || !feeForm.name.trim() || !feeForm.amount) return;
    if (feeForm.applicableTo === 'room_category' && feeForm.roomCategories.length === 0) {
      toast.error('Select at least one room category');
      return;
    }
    if (feeForm.applicableTo === 'specific_rooms' && feeForm.roomIds.length === 0) {
      toast.error('Select at least one room');
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        hostelId: selectedHostelId,
        name: feeForm.name.trim(),
        type: feeForm.type,
        amount: Number(feeForm.amount),
        frequency: feeForm.frequency,
        applicableTo: feeForm.applicableTo,
      };
      if (feeForm.applicableTo === 'room_category') payload.roomCategories = feeForm.roomCategories;
      if (feeForm.applicableTo === 'specific_rooms') payload.roomIds = feeForm.roomIds;
      await api.createFeeStructure(payload);
      toast.success('Fee structure added');
      setFeeModalOpen(false);
      setFeeForm({ name: '', type: 'hostel_rent', amount: '', frequency: 'monthly', applicableTo: 'all', roomCategories: [], roomIds: [] });
      loadFees();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add');
    } finally {
      setSaving(false);
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHostelId || !paymentForm.studentId || !paymentForm.amount) return;
    const student = students.find((s) => s._id === paymentForm.studentId);
    const planId = student?.planId?._id && paymentForm.type === 'hostel_rent' ? student.planId._id : undefined;
    setSaving(true);
    try {
      await api.createPayment({
        studentId: paymentForm.studentId,
        hostelId: selectedHostelId,
        type: paymentForm.type,
        amount: Number(paymentForm.amount),
        dueDate: paymentForm.dueDate || undefined,
        periodStart: paymentForm.periodStart ? new Date(paymentForm.periodStart).toISOString() : undefined,
        periodEnd: paymentForm.periodEnd ? new Date(paymentForm.periodEnd).toISOString() : undefined,
        planId: planId || undefined,
      });
      toast.success('Payment entry created');
      setPaymentModalOpen(false);
      setPaymentForm({ studentId: '', type: 'hostel_rent', amount: '', dueDate: '', periodStart: '', periodEnd: '' });
      setApplicableFeeHint(null);
      loadPayments();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkPaid = async (paymentId: string) => {
    setMarkingPaid(paymentId);
    try {
      await api.updatePaymentStatus(paymentId, { status: 'paid', paymentMethod: 'cash' });
      toast.success('Marked as paid');
      loadPayments();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
    } finally {
      setMarkingPaid(null);
    }
  };

  const handleDeletePayment = async (p: { _id: string; studentId?: { name?: string }; type?: string; amount?: number }) => {
    const ok = await confirm({
      title: 'Delete payment',
      message: `Delete this payment (${p.studentId?.name ?? 'Student'} — ${p.type ?? ''} ₹${Number(p.amount || 0).toLocaleString()})? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      confirmButtonClass: 'bg-red-600 hover:bg-red-700',
    });
    if (!ok) return;
    setDeletingPaymentId(p._id);
    try {
      await api.deletePayment(p._id);
      toast.success('Payment record removed');
      loadPayments();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    } finally {
      setDeletingPaymentId(null);
    }
  };

  const formatType = (t: string) => FEE_TYPES.find((f) => f.value === t)?.label ?? t;

  const formatAppliesTo = (f: any) => {
    if (f.applicableTo === 'all') return 'All';
    if (f.applicableTo === 'room_category' && f.roomCategories?.length) return (f.roomCategories as string[]).join(', ');
    if (f.applicableTo === 'specific_rooms' && f.roomIds?.length) {
      const nums = (f.roomIds || []).map((r: any) => r.roomNumber ?? r._id ?? '').filter(Boolean);
      return nums.length ? nums.join(', ') : 'Selected rooms';
    }
    return '—';
  };

  const totalPending = payments.filter((p: any) => p.status === 'pending').reduce((s: number, p: any) => s + (p.amount || 0), 0);
  const totalPaid = payments.filter((p: any) => p.status === 'paid').reduce((s: number, p: any) => s + (p.amount || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto px-4 md:px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/owner/dashboard" className="p-2 rounded-lg hover:bg-gray-100 text-gray-600" aria-label="Back">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">Fee structure & payments</h1>
              <p className="text-sm text-gray-600 mt-0.5">Hostel rent, mess, and other fees · View and record payments</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto px-4 md:px-6 py-6">
        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total collected</p>
                <p className="text-xl font-semibold text-gray-900">₹{totalPaid.toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <CreditCard className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Pending</p>
                <p className="text-xl font-semibold text-gray-900">₹{totalPending.toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Building2 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Plans & fees</p>
                <p className="text-xl font-semibold text-gray-900">{plans.length + fees.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Clarification: charge by plan vs room */}
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50/80 px-4 py-3 text-sm text-blue-900">
          <p className="font-medium">Charge by plan or by room?</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-blue-800">
            <li><strong>By plan:</strong> Use the student&apos;s selected plan (1 / 3 / 6 / 12 month). When you record a payment for hostel rent, the amount is suggested from the student&apos;s plan and the payment is linked to that plan. Best when rent is based on commitment period.</li>
            <li><strong>By room:</strong> Use fee structure by room category (AC, Non-AC, etc.) or specific rooms. The &quot;Record payment&quot; form suggests amount from the fee that applies to the student&apos;s room. Best when rent differs by room type.</li>
            <li>You can use both: assign a plan to the student (create/edit student) and define room-based fees. For hostel rent we prefer the student&apos;s plan amount; for other types we use the fee structure by room.</li>
          </ul>
        </div>

        {/* Fee structure & plans (merged) */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-8">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-semibold text-gray-900">Fee structure & plans</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSeedPlans}
                disabled={!selectedHostelId || seedingPlans || plans.length > 0}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {seedingPlans ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Seed plans
              </button>
              <button
                type="button"
                onClick={() => setFeeModalOpen(true)}
                disabled={!selectedHostelId}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" /> Add fee
              </button>
            </div>
          </div>
          <div className="p-4">
            {(loadingPlans || loadingFees) ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent" />
              </div>
            ) : plans.length === 0 && fees.length === 0 ? (
              <p className="text-gray-500 text-center py-6">No plans or fees yet. Click &quot;Seed plans&quot; for 1/3/6/12 month plans, or &quot;Add fee&quot; for hostel rent by category, mess, etc.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Duration / Frequency</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Amount (₹)</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Applies to</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {plans.map((p) => (
                      <PlanRow
                        key={`plan-${p._id}`}
                        plan={p}
                        updating={updatingPlanId === p._id}
                        onSaveAmount={(amount) => handleUpdatePlanAmount(p._id, amount)}
                      />
                    ))}
                    {fees.map((f) => (
                      <tr key={`fee-${f._id}`}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{f.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{formatType(f.type)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{f.frequency || 'monthly'}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">₹{Number(f.amount).toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{formatAppliesTo(f)}</td>
                        <td className="px-4 py-3 text-right text-sm text-gray-400">—</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Payments */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-gray-900">Payments</h2>
            <div className="flex items-center gap-2">
              <select
                value={paymentStatusFilter}
                onChange={(e) => setPaymentStatusFilter(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">All status</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
              </select>
              <button
                type="button"
                onClick={() => setPaymentModalOpen(true)}
                disabled={!selectedHostelId}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" /> Record payment
              </button>
            </div>
          </div>
          <div className="p-4">
            {loadingPayments ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-500 border-t-transparent" />
              </div>
            ) : payments.length === 0 ? (
              <p className="text-gray-500 text-center py-6">No payments yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Room</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Period (from – to)</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {payments.map((p) => (
                      <tr key={p._id}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {p.studentId?.name ?? (typeof p.studentId === 'string' ? p.studentId : '—')}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {p.studentId?.roomId?.roomNumber ?? '—'}
                          {p.studentId?.roomId?.category ? ` (${p.studentId.roomId.category})` : ''}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{p.planId?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {p.periodStart && p.periodEnd
                            ? `${new Date(p.periodStart).toLocaleDateString()} – ${new Date(p.periodEnd).toLocaleDateString()}`
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{formatType(p.type)}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">₹{Number(p.amount).toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                            p.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {p.paidDate ? new Date(p.paidDate).toLocaleDateString() : p.dueDate ? new Date(p.dueDate).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {p.status === 'pending' && (
                              <button
                                onClick={() => handleMarkPaid(p._id)}
                                disabled={!!markingPaid}
                                className="text-sm font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
                              >
                                {markingPaid === p._id ? 'Updating...' : 'Mark paid'}
                              </button>
                            )}
                            <button
                              onClick={() => handleDeletePayment(p)}
                              disabled={!!deletingPaymentId}
                              className="p-1.5 rounded text-red-600 hover:bg-red-50 disabled:opacity-50"
                              title="Delete payment"
                            >
                              <Trash2 className="w-4 h-4" />
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
        </div>
      </div>

      {/* Add fee modal */}
      {feeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Add fee type</h3>
              <button type="button" onClick={() => setFeeModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddFee} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={feeForm.name}
                  onChange={(e) => setFeeForm({ ...feeForm, name: e.target.value })}
                  placeholder="e.g. Hostel rent"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={feeForm.type}
                  onChange={(e) => setFeeForm({ ...feeForm, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {FEE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={feeForm.amount}
                  onChange={(e) => setFeeForm({ ...feeForm, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                <select
                  value={feeForm.frequency}
                  onChange={(e) => setFeeForm({ ...feeForm, frequency: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {FREQUENCIES.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Applies to</label>
                <select
                  value={feeForm.applicableTo}
                  onChange={(e) => setFeeForm({ ...feeForm, applicableTo: e.target.value as 'all' | 'room_category' | 'specific_rooms' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {APPLICABLE_TO.map((a) => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </select>
              </div>
              {feeForm.applicableTo === 'room_category' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Room categories</label>
                  <div className="flex flex-wrap gap-2">
                    {ROOM_CATEGORIES.map((cat) => (
                      <label key={cat} className="inline-flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={feeForm.roomCategories.includes(cat)}
                          onChange={() => setFeeForm({
                            ...feeForm,
                            roomCategories: feeForm.roomCategories.includes(cat)
                              ? feeForm.roomCategories.filter((c) => c !== cat)
                              : [...feeForm.roomCategories, cat],
                          })}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm">{cat}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {feeForm.applicableTo === 'specific_rooms' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rooms</label>
                  <select
                    multiple
                    value={feeForm.roomIds}
                    onChange={(e) => setFeeForm({
                      ...feeForm,
                      roomIds: Array.from(e.target.selectedOptions, (o) => o.value),
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 min-h-[80px]"
                  >
                    {rooms.map((r) => (
                      <option key={r._id} value={r._id}>{r.roomNumber}{r.category ? ` (${r.category})` : ''}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple rooms</p>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setFeeModalOpen(false)} className="flex-1 py-2 border border-gray-300 rounded-lg">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">{saving ? 'Adding...' : 'Add'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record payment modal */}
      {paymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Record payment (due)</h3>
              <button type="button" onClick={() => setPaymentModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddPayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Student (room · plan)</label>
                <select
                  value={paymentForm.studentId}
                  onChange={(e) => setPaymentForm({ ...paymentForm, studentId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  required
                >
                  <option value="">Select student</option>
                  {students.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name}
                      {s.roomId ? ` — Room ${s.roomId.roomNumber || ''}${s.roomId.category ? ` (${s.roomId.category})` : ''}` : ''}
                      {s.planId?.name ? ` · Plan: ${s.planId.name}` : ''}
                    </option>
                  ))}
                </select>
                {paymentForm.studentId && (() => {
                  const s = students.find((x) => x._id === paymentForm.studentId);
                  return s?.planId?.name ? (
                    <p className="text-sm text-indigo-600 mt-1.5 font-medium">
                      Student&apos;s plan: {s.planId.name} — ₹{Number(s.planId.amount ?? 0).toLocaleString()}
                    </p>
                  ) : null;
                })()}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={paymentForm.type}
                  onChange={(e) => setPaymentForm({ ...paymentForm, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                >
                  {FEE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  required
                />
                {applicableFeeHint && <p className="text-xs text-emerald-600 mt-1">{applicableFeeHint}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due date (optional)</label>
                <input
                  type="date"
                  value={paymentForm.dueDate}
                  onChange={(e) => setPaymentForm({ ...paymentForm, dueDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Period from (optional)</label>
                  <input
                    type="date"
                    value={paymentForm.periodStart}
                    onChange={(e) => setPaymentForm({ ...paymentForm, periodStart: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Period to (optional)</label>
                  <input
                    type="date"
                    value={paymentForm.periodEnd}
                    onChange={(e) => setPaymentForm({ ...paymentForm, periodEnd: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">Set period so you can see which payment is for which date range (e.g. Jan 1 – Mar 31).</p>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setPaymentModalOpen(false)} className="flex-1 py-2 border border-gray-300 rounded-lg">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 bg-emerald-600 text-white rounded-lg disabled:opacity-50">{saving ? 'Adding...' : 'Add'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
  );
}
