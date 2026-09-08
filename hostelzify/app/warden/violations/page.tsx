'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  ShieldAlert,
  Search,
  Filter,
  Plus,
  RefreshCw,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  User,
  DollarSign,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';

export default function WardenViolations() {
  const { user } = useAuth();
  const router = useRouter();
  const [violations, setViolations] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');

  // Create Violation Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    studentId: '',
    violationType: 'late-entry',
    description: '',
    warningLevel: 'warning',
    fineAmount: '0',
  });
  const [submitting, setSubmitting] = useState(false);

  // Escalate Modal
  const [escalateModalOpen, setEscalateModalOpen] = useState(false);
  const [selectedViolationId, setSelectedViolationId] = useState<string | null>(null);
  const [escalateTo, setEscalateTo] = useState('owner');

  useEffect(() => {
    if (!user || user.role !== 'warden') {
      router.replace('/login');
      return;
    }
    loadViolations();
    loadStudents();
  }, [user, router]);

  const loadViolations = async () => {
    setLoading(true);
    try {
      const response = await api.getViolations();
      setViolations(response.data || []);
    } catch (error: any) {
      console.error('Failed to load violations:', error);
      toast.error(error.message || 'Failed to load violations');
    } finally {
      setLoading(false);
    }
  };

  const loadStudents = async () => {
    try {
      const list = await api.getStudentsWithAttendance(user?.hostelId as string);
      setStudents(Array.isArray(list) ? list : []);
    } catch (e) {
      // Non-blocking
    }
  };

  const handleResolve = async (violationId: string) => {
    setActionLoading(violationId);
    try {
      await api.updateViolation(violationId, {
        status: 'resolved',
        resolvedAt: new Date(),
      });
      toast.success('Violation marked as resolved');
      loadViolations();
    } catch (error: any) {
      toast.error(error.message || 'Failed to resolve violation');
    } finally {
      setActionLoading(null);
    }
  };

  const openEscalateModal = (violationId: string) => {
    setSelectedViolationId(violationId);
    setEscalateTo('owner');
    setEscalateModalOpen(true);
  };

  const handleEscalate = async () => {
    if (!selectedViolationId) return;
    setActionLoading(selectedViolationId);
    try {
      await api.escalateViolation(selectedViolationId, { escalateTo });
      toast.success(`Violation escalated to ${escalateTo}`);
      setEscalateModalOpen(false);
      setSelectedViolationId(null);
      loadViolations();
    } catch (error: any) {
      toast.error(error.message || 'Failed to escalate violation');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.studentId) {
      toast.error('Please select a student');
      return;
    }
    if (!formData.description.trim()) {
      toast.error('Please describe the violation incident');
      return;
    }

    setSubmitting(true);
    try {
      await api.createViolation({
        ...formData,
        fineAmount: Number(formData.fineAmount) || 0,
      });
      toast.success('Disciplinary incident recorded and logged');
      setCreateModalOpen(false);
      setFormData({
        studentId: '',
        violationType: 'late-entry',
        description: '',
        warningLevel: 'warning',
        fineAmount: '0',
      });
      loadViolations();
    } catch (error: any) {
      toast.error(error.message || 'Failed to log violation');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredViolations = violations.filter((v) => {
    const studentName = v.studentId?.name || v.studentName || '';
    const room = v.studentId?.roomId || '';
    const desc = v.description || '';
    const matchesSearch =
      studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.toLowerCase().includes(searchQuery.toLowerCase()) ||
      desc.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'ALL' || (v.status || 'pending').toUpperCase() === filterStatus;
    const matchesType = filterType === 'ALL' || (v.violationType || '').toUpperCase() === filterType;
    return matchesSearch && matchesStatus && matchesType;
  });

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Disciplinary Violations Registry</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
              {violations.filter((v) => v.status !== 'resolved').length} Active
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Track curfew breaches, hostel rule infractions, fine levies, and escalation records.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadViolations}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-sm transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Report Violation
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search student, room, incident description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending Action</option>
            <option value="RESOLVED">Resolved</option>
            <option value="ESCALATED">Escalated</option>
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
          >
            <option value="ALL">All Violation Types</option>
            <option value="CURFEW">Curfew</option>
            <option value="LATE-ENTRY">Late Entry</option>
            <option value="UNAUTHORIZED-VISITOR">Unauthorized Visitor</option>
            <option value="NOISE">Noise Disturbance</option>
            <option value="DAMAGE">Hostel Property Damage</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
      </div>

      {/* Main List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-sm text-gray-500">Loading disciplinary registry...</p>
        </div>
      ) : filteredViolations.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <div className="w-16 h-16 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">Clean Discipline Record</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
            No disciplinary violations match your filter criteria.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredViolations.map((violation) => {
            const vId = violation._id || violation.id;
            const student = violation.studentId || {};
            const studentName = student.name || violation.studentName || 'Student';
            const room = student.roomId ? `Room ${student.roomId}` : 'Room unassigned';
            const reportedByName = violation.reportedBy?.name || 'Staff';
            const isResolved = violation.status === 'resolved';
            const isEscalated = violation.status === 'escalated';
            const isProcessing = actionLoading === vId;

            return (
              <div
                key={vId}
                className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:border-red-200 transition-all flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide bg-red-50 text-red-700 border border-red-200">
                      {violation.violationType || 'infraction'}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        isResolved
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : isEscalated
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {violation.status || 'pending'}
                    </span>
                    {violation.warningLevel && (
                      <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-600">
                        {violation.warningLevel} warning
                      </span>
                    )}
                    {violation.fineAmount > 0 && (
                      <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        <DollarSign className="w-3 h-3" /> ₹{violation.fineAmount} Fine
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      {studentName}
                      <span className="text-xs font-normal text-gray-500">({room})</span>
                    </h3>
                    <p className="text-sm text-gray-700 mt-1 font-medium bg-gray-50 p-3 rounded-xl border border-gray-100">
                      {violation.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span>Reported by: {reportedByName}</span>
                    <span>•</span>
                    <span>
                      {violation.createdAt ? new Date(violation.createdAt).toLocaleString('en-IN') : 'Recently'}
                    </span>
                    {violation.escalatedTo && (
                      <>
                        <span>•</span>
                        <span className="text-purple-600 font-medium">Escalated to: {violation.escalatedTo}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center">
                  {!isResolved && (
                    <>
                      <button
                        onClick={() => handleResolve(vId)}
                        disabled={isProcessing}
                        className="px-3.5 py-2 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Mark Resolved
                      </button>
                      {!isEscalated && (
                        <button
                          onClick={() => openEscalateModal(vId)}
                          disabled={isProcessing}
                          className="px-3.5 py-2 text-xs font-semibold bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <ArrowUpRight className="w-4 h-4" />
                          Escalate
                        </button>
                      )}
                    </>
                  )}
                  {isResolved && (
                    <span className="px-3 py-1 text-xs text-green-700 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-green-600" /> Case Closed
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Record Violation Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Record Disciplinary Incident</h3>
                <p className="text-xs text-gray-500">Log an infraction against hostel rules</p>
              </div>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Select Student *
                </label>
                <select
                  required
                  value={formData.studentId}
                  onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                  className="w-full text-sm border border-gray-200 rounded-xl p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                >
                  <option value="">Select a student...</option>
                  {students.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} ({s.roomId ? `Room ${s.roomId}` : 'No room'}) - {s.email}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Violation Type *
                  </label>
                  <select
                    value={formData.violationType}
                    onChange={(e) => setFormData({ ...formData, violationType: e.target.value })}
                    className="w-full text-sm border border-gray-200 rounded-xl p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  >
                    <option value="late-entry">Late Entry</option>
                    <option value="curfew">Curfew Breach</option>
                    <option value="unauthorized-visitor">Unauthorized Visitor</option>
                    <option value="noise">Noise Disturbance</option>
                    <option value="damage">Property Damage</option>
                    <option value="improper-checkout">Improper Checkout</option>
                    <option value="other">Other Infraction</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Warning Level
                  </label>
                  <select
                    value={formData.warningLevel}
                    onChange={(e) => setFormData({ ...formData, warningLevel: e.target.value })}
                    className="w-full text-sm border border-gray-200 rounded-xl p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  >
                    <option value="warning">Verbal / First Warning</option>
                    <option value="first">Official First Notice</option>
                    <option value="second">Second Notice</option>
                    <option value="final">Final Notice</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Fine Assessment (₹, optional)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.fineAmount}
                  onChange={(e) => setFormData({ ...formData, fineAmount: e.target.value })}
                  placeholder="0"
                  className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Incident Description & Notes *
                </label>
                <textarea
                  required
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe what occurred, witness accounts, damage caused..."
                  className="w-full text-sm border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 resize-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Recording...' : 'File Violation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Escalate Modal */}
      {escalateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-purple-600">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                <ArrowUpRight className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Escalate Violation</h3>
                <p className="text-xs text-gray-500">Route this disciplinary issue to higher authority</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Escalate To
              </label>
              <select
                value={escalateTo}
                onChange={(e) => setEscalateTo(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              >
                <option value="owner">Hostel Owner / Management</option>
                <option value="parent">Student Parents / Guardian</option>
                <option value="warden">Chief Warden</option>
              </select>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEscalateModalOpen(false)}
                className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEscalate}
                disabled={actionLoading !== null}
                className="flex-1 py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
              >
                Escalate Case
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
