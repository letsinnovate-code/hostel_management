'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import StudentLayout from '../../../components/StudentLayout';
import {
  Shield,
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  X,
  AlertCircle,
} from 'lucide-react';

type Permission = {
  _id: string;
  permissionType: string;
  reason: string;
  requestedDate?: string;
  returnDate?: string;
  status: string;
  rejectionReason?: string;
  createdAt?: string;
};

const PERMISSION_TYPES = [
  { value: 'late-entry', label: 'Late Entry' },
  { value: 'leave', label: 'Day Leave' },
  { value: 'overnight', label: 'Overnight Stay' },
  { value: 'multi-day', label: 'Multi-Day Leave' },
];

export default function StudentPermissions() {
  const { user } = useAuth();
  const router = useRouter();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Form state
  const [form, setForm] = useState({
    permissionType: 'late-entry',
    reason: '',
    requestedDate: '',
    returnDate: '',
  });

  useEffect(() => {
    if (!user || user.role !== 'student') {
      router.replace('/login');
      return;
    }
    loadPermissions();
  }, [user, router]);

  const loadPermissions = async () => {
    setLoading(true);
    try {
      const response = await api.getPermissionRequests();
      setPermissions(response.data || []);
    } catch (error: any) {
      console.error('Failed to load permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const openModal = () => {
    const today = new Date().toISOString().split('T')[0];
    setForm({
      permissionType: 'late-entry',
      reason: '',
      requestedDate: today,
      returnDate: '',
    });
    setSubmitError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSubmitError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (!form.reason.trim()) {
      setSubmitError('Please provide a reason for the request.');
      return;
    }
    if (!form.requestedDate) {
      setSubmitError('Please select a date for the request.');
      return;
    }
    const needsReturn = ['leave', 'overnight', 'multi-day'].includes(form.permissionType);
    if (needsReturn && !form.returnDate) {
      setSubmitError('Please provide an expected return date/time for this type of request.');
      return;
    }

    setSubmitting(true);
    try {
      await api.createPermissionRequest({
        permissionType: form.permissionType,
        reason: form.reason.trim(),
        requestedDate: form.requestedDate,
        returnDate: needsReturn ? form.returnDate : undefined,
      });
      closeModal();
      loadPermissions();
    } catch (error: any) {
      setSubmitError(
        error?.response?.data?.message || error?.message || 'Failed to submit request. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (permissionId: string) => {
    if (!confirm('Are you sure you want to cancel this request?')) return;
    try {
      await api.cancelPermissionRequest(permissionId);
      loadPermissions();
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Failed to cancel request.');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-gray-100 text-gray-600';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved': return <CheckCircle className="w-4 h-4" />;
      case 'rejected': return <XCircle className="w-4 h-4" />;
      case 'cancelled': return <X className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getTypeLabel = (type: string) =>
    PERMISSION_TYPES.find((t) => t.value === type)?.label || type;

  const needsReturn = ['leave', 'overnight', 'multi-day'].includes(form.permissionType);

  return (
    <StudentLayout>
      <div className="min-h-screen bg-gray-50">
        <div className="p-6">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Permission Requests</h1>
              <p className="text-sm text-gray-600 mt-1">Request permissions and track their status</p>
            </div>
            <button
              onClick={openModal}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
            >
              <Plus className="w-5 h-5" />
              <span>New Request</span>
            </button>
          </div>

          {/* Permissions List */}
          {loading ? (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-gray-600">Loading permissions...</p>
            </div>
          ) : permissions.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-lg mb-2">No permission requests yet</p>
              <p className="text-gray-500 text-sm mb-6">Submit your first permission request to get started</p>
              <button
                onClick={openModal}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                New Request
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {permissions.map((permission) => (
                <div
                  key={permission._id}
                  className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Shield className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {getTypeLabel(permission.permissionType)}
                          </h3>
                          <p className="text-xs text-gray-400">ID: {permission._id}</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 ml-[52px]">{permission.reason}</p>
                    </div>
                    <span
                      className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(permission.status)}`}
                    >
                      {getStatusIcon(permission.status)}
                      {permission.status
                        ? permission.status.charAt(0).toUpperCase() + permission.status.slice(1)
                        : 'Pending'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-100 text-sm">
                    {permission.requestedDate && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span>
                          Date: {new Date(permission.requestedDate).toLocaleDateString('en-IN', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                        </span>
                      </div>
                    )}
                    {permission.returnDate && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span>
                          Return by:{' '}
                          {new Date(permission.returnDate).toLocaleString('en-IN', {
                            day: 'numeric', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit', hour12: true,
                          })}
                        </span>
                      </div>
                    )}
                    {permission.createdAt && (
                      <div className="flex items-center gap-2 text-gray-500">
                        <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span>
                          Submitted:{' '}
                          {new Date(permission.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                        </span>
                      </div>
                    )}
                    {permission.rejectionReason && (
                      <div className="col-span-full flex items-start gap-2 text-red-600 bg-red-50 rounded-md p-2">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>
                          <span className="font-medium">Rejection Reason: </span>
                          {permission.rejectionReason}
                        </span>
                      </div>
                    )}
                  </div>

                  {permission.status?.toLowerCase() === 'pending' && (
                    <div className="mt-4 pt-3 border-t border-gray-100">
                      <button
                        onClick={() => handleCancel(permission._id)}
                        className="text-sm text-red-600 hover:text-red-700 font-medium"
                      >
                        Cancel Request
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New Request Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">New Permission Request</h2>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {/* Permission Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Request Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.permissionType}
                  onChange={(e) => setForm((f) => ({ ...f, permissionType: e.target.value, returnDate: '' }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {PERMISSION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                  placeholder="Explain the reason for your request..."
                  rows={3}
                  maxLength={500}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  required
                />
                <p className="text-xs text-gray-400 mt-1 text-right">{form.reason.length}/500</p>
              </div>

              {/* Request Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {form.permissionType === 'late-entry' ? 'Date' : 'Start Date'}{' '}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type={form.permissionType === 'late-entry' ? 'date' : 'date'}
                  value={form.requestedDate}
                  onChange={(e) => setForm((f) => ({ ...f, requestedDate: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Return Date (only for leave/overnight/multi-day) */}
              {needsReturn && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expected Return Date & Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={form.returnDate}
                    onChange={(e) => setForm((f) => ({ ...f, returnDate: e.target.value }))}
                    min={form.requestedDate ? `${form.requestedDate}T00:00` : undefined}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              )}

              {/* Error Message */}
              {submitError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Submit Request
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </StudentLayout>
  );
}
