'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, ChangeEvent, MouseEvent } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { useOwnerHostel } from '../../../../contexts/OwnerHostelContext';
import { useConfirmModal } from '../../../../components/ConfirmModal';
import { useToast } from '../../../../components/Toast';
import api from '../../../../services/api';

const STATUS_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'On Leave', value: 'on-leave' },
  { label: 'Exited', value: 'exited' },
  { label: 'Suspended', value: 'suspended' },
];

const presenceBadgeClass = (presence: string) => {
  switch (presence) {
    case 'inside':
      return 'bg-green-100 text-green-800';
    case 'outside':
      return 'bg-amber-100 text-amber-800';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

const statusBadgeClass = (status: string) => {
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

const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
};

export default function OwnerStudentsPresencePage() {
  const { user } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const { confirm } = useConfirmModal();

  const { selectedHostel } = useOwnerHostel();
  const [students, setStudents] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (user.role !== 'owner') {
      router.replace('/login');
      return;
    }
  }, [user, router]);

  useEffect(() => {
    if (!user || user.role !== 'owner') return;
    loadStudents();
  }, [selectedHostel, filter, user]);

  const loadStudents = async () => {
    setLoading(true);
    try {
      const list = await api.getStudentsWithAttendance(selectedHostel || undefined);
      const normalized = Array.isArray(list) ? list : [];
      const filtered = filter === 'all' ? normalized : normalized.filter((student) => (student.status || 'active') === filter);
      setStudents(filtered);
    } catch (error: any) {
      console.error('Failed to load students with attendance:', error);
      showToast(error?.message || 'Failed to load students', 'error');
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (studentId: string) => {
    router.push(`/owner/students/${studentId}`);
  };

  const handleApprove = async (event: MouseEvent<HTMLButtonElement>, studentId: string) => {
    event.stopPropagation();
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
      loadStudents();
    } catch (error: any) {
      showToast(error?.message || 'Failed to approve student', 'error');
    }
  };

  const handleStatusChange = async (event: ChangeEvent<HTMLSelectElement>, studentId: string) => {
    event.stopPropagation();
    const newStatus = event.target.value;
    try {
      await api.updateStudentStatus(studentId, newStatus);
      showToast('Student status updated successfully', 'success');
      loadStudents();
    } catch (error: any) {
      showToast(error?.message || 'Failed to update status', 'error');
    }
  };

  const handleResendWelcomeEmail = async (event: MouseEvent<HTMLButtonElement>, studentId: string, studentName: string) => {
    event.stopPropagation();
    const confirmed = await confirm({
      title: 'Resend Welcome Email',
      message: `Resend welcome email with new password to ${studentName}?`,
      confirmText: 'Send Email',
      cancelText: 'Cancel',
      confirmButtonClass: 'bg-blue-600 hover:bg-blue-700',
    });
    if (!confirmed) return;
    try {
      await api.resendWelcomeEmail(studentId);
      showToast('Welcome email with new password has been sent successfully!', 'success');
    } catch (error: any) {
      showToast(error?.message || 'Failed to resend welcome email', 'error');
    }
  };

  const handleDelete = async (event: MouseEvent<HTMLButtonElement>, studentId: string, studentName: string) => {
    event.stopPropagation();
    const confirmed = await confirm({
      title: 'Delete Student',
      message: `Are you sure you want to delete ${studentName}? This action cannot be undone and will delete all associated data including documents and images.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      confirmButtonClass: 'bg-red-600 hover:bg-red-700',
    });
    if (!confirmed) return;
    try {
      await api.deleteUser(studentId);
      showToast('Student deleted successfully', 'success');
      loadStudents();
    } catch (error: any) {
      showToast(error?.message || 'Failed to delete student', 'error');
    }
  };

  const filteredCount = useMemo(() => students.length, [students]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Student Presence &amp; Management</h1>
            <p className="text-sm text-gray-600 mt-1">
              Monitor check-in/check-out status and manage student lifecycle from a single view.
            </p>
          </div>
          <Link
            href="/owner/students/create"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Student
          </Link>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex flex-wrap gap-6">
            <div className="flex-1 min-w-[240px]">
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Status</label>
              <div className="flex flex-wrap gap-2">
                {STATUS_FILTERS.map(({ label, value }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFilter(value)}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                      filter === value ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="flex flex-col gap-1 border-b border-gray-200 bg-gray-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Students</h2>
              <p className="text-sm text-gray-500">Latest attendance status with management controls</p>
            </div>
            <span className="text-sm font-medium text-gray-600">
              Showing <span className="text-gray-900">{filteredCount}</span> student{filteredCount === 1 ? '' : 's'}
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
              <p className="mt-4 text-gray-600">Loading students...</p>
            </div>
          ) : students.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center text-gray-500">
              <svg className="h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <h3 className="text-sm font-semibold text-gray-900">No students match the current filters</h3>
              <p className="text-sm text-gray-500">Adjust the filters or add a new student to see data here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">Student</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">Contact</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">Hostel / Room</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">Plan</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">Presence</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">Notifications</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">Last Activity</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {students.map((student) => (
                    <tr
                      key={student._id || student.id}
                      onClick={() => handleRowClick(student._id || student.id)}
                      className="cursor-pointer transition hover:bg-blue-50"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-sm font-semibold text-white">
                            {student.name?.charAt(0)?.toUpperCase() ?? 'S'}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-900">{student.name}</div>
                            <div className="text-xs text-gray-500">{student.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div>{student.phone || '—'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div>{typeof student.hostelId === 'object' ? student.hostelId?.name : '—'}</div>
                        <div className="text-xs text-gray-500">
                          Room {typeof student.roomId === 'object' ? student.roomId?.roomNumber || '—' : '—'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {typeof student.planId === 'object' && student.planId?.name
                          ? `${student.planId.name} — ₹${Number(student.planId?.amount ?? 0).toLocaleString()}`
                          : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${presenceBadgeClass(
                            student.presenceStatus,
                          )}`}
                        >
                          {student.presenceStatus === 'inside'
                            ? 'Checked in'
                            : student.presenceStatus === 'outside'
                              ? 'Checked out'
                              : 'Unknown'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                          title={student.hasPushToken ? 'Push notifications enabled (FCM)' : 'Push notifications off'}
                        >
                          {student.hasPushToken ? (
                            <>
                              <Bell className="h-4 w-4 text-green-600" aria-hidden />
                              <span className="text-green-700">On</span>
                            </>
                          ) : (
                            <>
                              <BellOff className="h-4 w-4 text-gray-400" aria-hidden />
                              <span className="text-gray-500">Off</span>
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                        <div>
                          <span className="font-medium text-gray-700">Check-in:</span> {formatDateTime(student.lastCheckIn)}
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Check-out:</span> {formatDateTime(student.lastCheckOut)}
                        </div>
                      </td>
                      <td
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-700"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
                          <select
                            value={student.status || 'active'}
                            onChange={(event) => handleStatusChange(event, student._id || student.id)}
                            className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs font-medium text-gray-900 shadow-sm transition hover:border-blue-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="active">Active</option>
                            <option value="on-leave">On Leave</option>
                            <option value="exited">Exited</option>
                            <option value="suspended">Suspended</option>
                          </select>
                          <div className="flex items-center gap-1">
                            {student.status !== 'active' && (
                              <button
                                onClick={(event) => handleApprove(event, student._id || student.id)}
                                className="rounded-lg p-2 text-green-600 transition hover:bg-green-50"
                                title="Approve student"
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                            )}
                            <button
                              onClick={(event) => handleResendWelcomeEmail(event, student._id || student.id, student.name)}
                              className="rounded-lg p-2 text-blue-600 transition hover:bg-blue-50"
                              title="Resend welcome email"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                />
                              </svg>
                            </button>
                            <button
                              onClick={(event) => handleDelete(event, student._id || student.id, student.name)}
                              className="rounded-lg p-2 text-red-600 transition hover:bg-red-50"
                              title="Delete student"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </div>
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
  );
}
