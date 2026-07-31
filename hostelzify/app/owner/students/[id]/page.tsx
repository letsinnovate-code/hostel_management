'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../../contexts/AuthContext';
import api from '../../../../services/api';
import { useToast } from '../../../../components/Toast';
import { useConfirmModal } from '../../../../components/ConfirmModal';
import { User, MapPin, Users, AlertCircle, FileText, Info, CreditCard, LogIn, LogOut, ChevronLeft, ChevronRight, Calendar, ExternalLink, QrCode, Download, Loader2, X } from 'lucide-react';

const GATE_CLUB_MINUTES = 2;
function toDateString(d: Date) {
  return d.toISOString().slice(0, 10);
}
function addDays(dateStr: string, delta: number) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + delta);
  return toDateString(d);
}
function formatTimeOnly(date: string | Date) {
  if (!date) return '—';
  return new Date(date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
}
type GateEvent = { time: string; type: 'in' | 'out'; studentId: string; studentName: string; studentEmail: string; studentNumber: string };
type GateRow =
  | { kind: 'single'; time: string; type: 'in' | 'out'; studentId: string; studentName: string; studentEmail: string; studentNumber: string }
  | { kind: 'inout'; inTime: string; outTime: string; studentId: string; studentName: string; studentEmail: string; studentNumber: string };
function buildGateRows(events: GateEvent[]): GateRow[] {
  const rows: GateRow[] = [];
  const ms = GATE_CLUB_MINUTES * 60 * 1000;
  let i = 0;
  while (i < events.length) {
    const cur = events[i];
    const next = events[i + 1];
    if (cur.type === 'in' && next?.type === 'out' && next.studentId === cur.studentId && new Date(next.time).getTime() - new Date(cur.time).getTime() <= ms) {
      rows.push({ kind: 'inout', inTime: cur.time, outTime: next.time, studentId: cur.studentId, studentName: cur.studentName, studentEmail: cur.studentEmail, studentNumber: cur.studentNumber });
      i += 2;
    } else {
      rows.push({ kind: 'single', time: cur.time, type: cur.type, studentId: cur.studentId, studentName: cur.studentName, studentEmail: cur.studentEmail, studentNumber: cur.studentNumber });
      i += 1;
    }
  }
  return rows;
}

export default function StudentDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const studentId = params?.id as string;
  const { showToast } = useToast();
  const { confirm } = useConfirmModal();

  const [student, setStudent] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const today = toDateString(new Date());
  const [gateDateFrom, setGateDateFrom] = useState<string>(() => today);
  const [gateDateTo, setGateDateTo] = useState<string>(() => today);
  const [gateEvents, setGateEvents] = useState<GateEvent[]>([]);
  const [gateLoading, setGateLoading] = useState(false);

  // QR state
  const [qrData, setQrData] = useState<{ qrDataUrl: string; student: any } | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'owner') {
      router.replace('/login');
      return;
    }
    if (studentId) {
      loadStudent();
    }
  }, [user, router, studentId]);

  const loadStudent = async () => {
    setLoading(true);
    try {
      const response = await api.getUser(studentId);
      if (response.success && response.data) {
        setStudent(response.data);
      }
    } catch (error: any) {
      showToast(error.message || 'Failed to load student details', 'error');
      router.push('/owner/students/presence');
    } finally {
      setLoading(false);
    }
  };

  const loadPayments = async () => {
    if (!studentId) return;
    try {
      const res = await api.getPayments({ studentId });
      const data = (res as any)?.data ?? res ?? [];
      setPayments(Array.isArray(data) ? data : []);
    } catch {
      setPayments([]);
    }
  };

  useEffect(() => {
    if (studentId) loadPayments();
  }, [studentId]);

  const loadGateLogs = async () => {
    if (!studentId || !student?.hostelId) return;
    const hostelId = typeof student.hostelId === 'object' ? (student.hostelId as any)?._id : student.hostelId;
    if (!hostelId) return;
    setGateLoading(true);
    try {
      const res = await api.getGateLogs({ hostelId, from: gateDateFrom, to: gateDateTo, studentId });
      setGateEvents(Array.isArray(res?.data?.events) ? res.data.events : []);
    } catch {
      setGateEvents([]);
    } finally {
      setGateLoading(false);
    }
  };

  useEffect(() => {
    if (student?.hostelId && studentId) loadGateLogs();
  }, [student?.hostelId, studentId, gateDateFrom, gateDateTo]);

  const gateGoPrev = () => {
    setGateDateFrom((f) => addDays(f, -1));
    setGateDateTo((t) => addDays(t, -1));
  };
  const gateGoNext = () => {
    setGateDateFrom((f) => addDays(f, 1));
    setGateDateTo((t) => addDays(t, 1));
  };
  const gateSetToday = () => {
    setGateDateFrom(today);
    setGateDateTo(today);
  };
  const gateCanGoNext = gateDateTo < today;
  const gateIsTodayRange = gateDateFrom === today && gateDateTo === today;

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: 'Delete Student',
      message: `Are you sure you want to delete ${student?.name}? This action cannot be undone and will delete all associated data including documents and images.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      confirmButtonClass: 'bg-red-600 hover:bg-red-700',
    });

    if (!confirmed) return;

    try {
      await api.deleteUser(studentId);
      showToast('Student deleted successfully', 'success');
      router.push('/owner/students/presence');
    } catch (error: any) {
      showToast(error.message || 'Failed to delete student', 'error');
    }
  };

  const handleApprove = async () => {
    const confirmed = await confirm({
      title: 'Approve Student',
      message: 'Approve this student? An approval email will be sent.',
      confirmText: 'Approve',
      cancelText: 'Cancel',
      confirmButtonClass: 'bg-green-600 hover:bg-green-700',
    });

    if (!confirmed) return;

    try {
      await api.approveStudentOnboarding(studentId);
      showToast('Student approved successfully! Approval email has been sent.', 'success');
      loadStudent();
    } catch (error: any) {
      showToast(error.message || 'Failed to approve student', 'error');
    }
  };

  const handleResendWelcomeEmail = async () => {
    const confirmed = await confirm({
      title: 'Resend Welcome Email',
      message: `Resend welcome email with new password to ${student?.name}?`,
      confirmText: 'Send Email',
      cancelText: 'Cancel',
      confirmButtonClass: 'bg-blue-600 hover:bg-blue-700',
    });

    if (!confirmed) return;

    try {
      await api.resendWelcomeEmail(studentId);
      showToast('Welcome email with new password has been sent successfully!', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to resend welcome email', 'error');
    }
  };

  const formatAddress = (address: any) => {
    if (!address) return 'Not provided';
    if (typeof address === 'string') return address;
    const parts = [];
    if (address.street) parts.push(address.street);
    if (address.city) parts.push(address.city);
    if (address.state) parts.push(address.state);
    if (address.pincode) parts.push(address.pincode);
    if (address.country && address.country !== 'India') parts.push(address.country);
    return parts.length > 0 ? parts.join(', ') : 'Not provided';
  };

  const formatDate = (date: string | Date) => {
    if (!date) return 'Not provided';
    try {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return date.toString();
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'on-leave':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'exited':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'suspended':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  if (loading) {
    return (
      
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading student details...</p>
          </div>
        </div>
      
    );
  }

  if (!student) {
    return (
      
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-sm p-8 text-center max-w-md">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <h3 className="mt-2 text-lg font-medium text-gray-900">Student not found</h3>
            <p className="mt-1 text-sm text-gray-500">The student you're looking for doesn't exist or has been removed.</p>
            <Link
              href="/owner/students/presence"
              className="mt-6 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Back to Students
            </Link>
          </div>
        </div>
      
    );
  }

  return (
    
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="px-6 py-4">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-4">
                <Link
                  href="/owner/students/presence"
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </Link>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    {student.profileImage ? (
                      <img
                        src={student.profileImage}
                        alt={student.name}
                        className="w-20 h-20 rounded-full object-cover border-4 border-gray-200 shadow-lg"
                        onError={(e) => {
                          e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name || 'Student')}&background=0a7ea4&color=fff&size=128`;
                        }}
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-3xl font-semibold border-4 border-gray-200 shadow-lg">
                        {student.name?.charAt(0).toUpperCase() || 'S'}
                      </div>
                    )}
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900">{student.name}</h1>
                    <p className="text-gray-600 mt-1">{student.email}</p>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadgeColor(
                          student.status || 'active'
                        )}`}
                      >
                        {student.status || 'active'}
                      </span>
                      {typeof student.planId === 'object' && student.planId?.name ? (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 border border-indigo-200">
                          Plan: {student.planId.name} — ₹{Number(student.planId.amount || 0).toLocaleString()}
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-xs text-gray-500 bg-gray-100 border border-gray-200">
                          Plan: Not selected
                        </span>
                      )}
                      {student.studentId && (
                        <span className="text-sm text-gray-600 font-medium">ID: {student.studentId}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                {student.status !== 'active' && (
                  <button
                    onClick={handleApprove}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 transition-colors font-medium"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Approve
                  </button>
                )}
                <button
                  onClick={handleResendWelcomeEmail}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors font-medium"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Resend Email
                </button>
                <Link
                  href={`/owner/students/${studentId}/edit`}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2 transition-colors font-medium"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </Link>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 transition-colors font-medium"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Basic Information Card */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Basic Information</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Phone</label>
                  <p className="text-gray-900 mt-1 font-medium">{student.phone || 'Not provided'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Date of Birth</label>
                  <p className="text-gray-900 mt-1 font-medium">{formatDate(student.dateOfBirth)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Hostel</label>
                  <p className="text-gray-900 mt-1 font-medium">
                    {typeof student.hostelId === 'object' ? student.hostelId?.name : 'Not assigned'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Block</label>
                  <p className="text-gray-900 mt-1 font-medium">
                    {typeof student.blockId === 'object' ? student.blockId?.name || student.blockId?.blockNumber : 'Not assigned'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Room</label>
                  <p className="text-gray-900 mt-1 font-medium">
                    {typeof student.roomId === 'object' ? student.roomId?.roomNumber : 'Not assigned'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Rent plan</label>
                  <p className="text-gray-900 mt-1 font-medium">
                    {typeof student.planId === 'object' && student.planId?.name
                      ? `${student.planId.name} — ₹${Number(student.planId.amount || 0).toLocaleString()}`
                      : 'Not selected'}
                  </p>
                </div>
              </div>
            </div>

            {/* Address Card */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-green-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Address</h2>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Full Address</label>
                <p className="text-gray-900 mt-1 font-medium">{formatAddress(student.address)}</p>
              </div>
            </div>

            {/* Parent Contact Card */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-purple-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Parent Contact</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Name</label>
                  <p className="text-gray-900 mt-1 font-medium">{student.parentContact?.name || 'Not provided'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Phone</label>
                  <p className="text-gray-900 mt-1 font-medium">{student.parentContact?.phone || 'Not provided'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Email</label>
                  <p className="text-gray-900 mt-1 font-medium">{student.parentContact?.email || 'Not provided'}</p>
                </div>
              </div>
            </div>

            {/* Emergency Contact Card */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Emergency Contact</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Name</label>
                  <p className="text-gray-900 mt-1 font-medium">{student.emergencyContact?.name || 'Not provided'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Phone</label>
                  <p className="text-gray-900 mt-1 font-medium">{student.emergencyContact?.phone || 'Not provided'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Relation</label>
                  <p className="text-gray-900 mt-1 font-medium">{student.emergencyContact?.relation || 'Not provided'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Documents Card */}
          {student.documents && student.documents.length > 0 && (
            <div className="mt-6 bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-orange-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Documents</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {student.documents.map((doc: any, index: number) => (
                  <div
                    key={doc._id || index}
                    className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{doc.name || 'Document'}</p>
                          <p className="text-sm text-gray-500 capitalize">{doc.type?.replace('-', ' ') || 'other'}</p>
                        </div>
                      </div>
                      {doc.url && (
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 p-2 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View document"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment history */}
          <div className="mt-6 bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-emerald-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Payment history</h2>
            </div>
            {payments.length === 0 ? (
              <p className="text-gray-500 text-sm">No payments recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Period (from – to)</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {payments.map((p: any) => (
                      <tr key={p._id}>
                        <td className="px-4 py-3 text-sm text-gray-900">{p.type || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{p.planId?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {p.periodStart && p.periodEnd
                            ? `${formatDate(p.periodStart)} – ${formatDate(p.periodEnd)}`
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">₹{Number(p.amount || 0).toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                            p.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {p.paidDate ? formatDate(p.paidDate) : p.dueDate ? formatDate(p.dueDate) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Gate logs (student-wise, same clubbing as main gate-logs page) */}
          <div className="mt-6 bg-white rounded-lg shadow-sm p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <LogIn className="w-5 h-5 text-slate-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Gate logs</h2>
              </div>
              <Link
                href="/owner/gate-logs"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                <ExternalLink className="w-4 h-4" />
                View all gate logs
              </Link>
            </div>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <button
                type="button"
                onClick={gateGoPrev}
                disabled={gateLoading}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50"
                aria-label="Previous day"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <span className="min-w-[180px] text-center text-sm font-medium text-gray-700 flex items-center justify-center gap-1">
                <Calendar className="w-4 h-4 text-gray-500" />
                {gateDateFrom === gateDateTo
                  ? new Date(gateDateFrom + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                  : `${new Date(gateDateFrom + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${new Date(gateDateTo + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`}
              </span>
              <button
                type="button"
                onClick={gateGoNext}
                disabled={gateLoading || !gateCanGoNext}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Next day"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
              <button
                type="button"
                onClick={gateSetToday}
                disabled={gateLoading || gateIsTodayRange}
                className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 text-sm font-medium text-gray-700"
              >
                Today
              </button>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <span>From</span>
                <input
                  type="date"
                  value={gateDateFrom}
                  onChange={(e) => setGateDateFrom(e.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <span>To</span>
                <input
                  type="date"
                  value={gateDateTo}
                  onChange={(e) => setGateDateTo(e.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                />
              </label>
            </div>
            {gateLoading ? (
              <p className="text-gray-500 text-sm py-4">Loading...</p>
            ) : gateEvents.length === 0 ? (
              <p className="text-gray-500 text-sm py-4">No check-ins or check-outs in this range.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Time</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Type</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {buildGateRows(gateEvents).map((row, i) => (
                      <tr key={row.kind === 'inout' ? `inout-${row.inTime}-${i}` : `single-${row.time}-${row.type}-${i}`} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                          {row.kind === 'inout' ? `${formatTimeOnly(row.inTime)} – ${formatTimeOnly(row.outTime)}` : formatTimeOnly(row.time)}
                        </td>
                        <td className="px-4 py-3">
                          {row.kind === 'inout' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
                              <LogIn className="w-3.5 h-3.5" /> IN <span className="opacity-70">→</span> <LogOut className="w-3.5 h-3.5" /> OUT
                            </span>
                          ) : row.type === 'in' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <LogIn className="w-3.5 h-3.5" /> IN
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                              <LogOut className="w-3.5 h-3.5" /> OUT
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Student ID QR Code Card */}
          <div className="mt-6 bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <QrCode className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Student ID QR Code</h2>
                  <p className="text-sm text-gray-500">For gate check-in / identity verification</p>
                </div>
              </div>
              {!showQR && (
                <button
                  onClick={async () => {
                    setShowQR(true);
                    if (!qrData) {
                      setQrLoading(true);
                      try {
                        const res = await api.getStudentQR(studentId);
                        if (res.success) setQrData(res.data);
                        else showToast(res.message || 'Failed to generate QR', 'error');
                      } catch (e: any) {
                        showToast(e?.response?.data?.message || 'Failed to generate QR', 'error');
                      } finally {
                        setQrLoading(false);
                      }
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                >
                  <QrCode className="w-4 h-4" />
                  Show QR
                </button>
              )}
              {showQR && (
                <button onClick={() => setShowQR(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {showQR && (
              <div className="flex flex-col items-center py-4 gap-4">
                {qrLoading ? (
                  <div className="flex flex-col items-center gap-3 py-6">
                    <Loader2 className="animate-spin w-8 h-8 text-indigo-500" />
                    <p className="text-sm text-gray-500">Generating QR code...</p>
                  </div>
                ) : qrData ? (
                  <>
                    <div className="border-2 border-indigo-100 rounded-xl p-3 bg-white shadow-inner">
                      <img src={qrData.qrDataUrl} alt="Student ID QR" className="w-52 h-52 object-contain" />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-gray-800">{qrData.student?.name}</p>
                      {qrData.student?.studentId && <p className="text-sm text-gray-500">ID: {qrData.student.studentId}</p>}
                    </div>
                    <button
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = qrData.qrDataUrl;
                        link.download = `student-qr-${qrData.student?.name?.replace(/\s+/g, '-') || studentId}.png`;
                        link.click();
                      }}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 border border-indigo-300 hover:bg-indigo-50 rounded-lg transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Download QR
                    </button>
                  </>
                ) : null}
              </div>
            )}
          </div>

          {/* Additional Info Card */}
          <div className="mt-6 bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <Info className="w-5 h-5 text-gray-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Additional Information</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium text-gray-500">Created At</label>
                <p className="text-gray-900 mt-1 font-medium">{formatDate(student.createdAt)}</p>
              </div>
              {student.lastLogin && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Last Login</label>
                  <p className="text-gray-900 mt-1 font-medium">{formatDate(student.lastLogin)}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    
  );
}
