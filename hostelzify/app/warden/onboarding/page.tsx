'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import {
  Users,
  Search,
  Filter,
  RefreshCw,
  Building,
  GraduationCap,
  Calendar,
  ChevronRight,
  Phone,
  Mail,
  UserCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  BedDouble,
  CreditCard,
  FileCheck2,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  AlertTriangle,
  FileText,
} from 'lucide-react';

export default function WardenOnboardingPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [applications, setApplications] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [selectedStatusTab, setSelectedStatusTab] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected application for deep inspection
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [dossierLoading, setDossierLoading] = useState(false);

  // Action modals
  const [rejectDocModal, setRejectDocModal] = useState<{ open: boolean; docType: string; docName: string }>({
    open: false,
    docType: '',
    docName: '',
  });
  const [docRejectionReason, setDocRejectionReason] = useState('');
  const [docCorrectionNotes, setDocCorrectionNotes] = useState('');

  // Room allocation state
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [selectedBedNumber, setSelectedBedNumber] = useState('Bed 1');

  // Offline payment confirmation state
  const [offlineFeeAmount, setOfflineFeeAmount] = useState<number>(14000);
  const [offlineRefNumber, setOfflineRefNumber] = useState('');

  // General correction modal
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [correctionInstructions, setCorrectionInstructions] = useState('');

  // Check role authorization
  useEffect(() => {
    const role = Array.isArray(user?.role) ? user?.role[0] : user?.role;
    if (!user || !['warden', 'owner', 'superadmin'].includes(role as string)) {
      router.replace('/login');
      return;
    }
    loadData();
  }, [user]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [appsRes, metricsRes] = await Promise.all([
        api.getWardenOnboardingApplications({
          status: selectedStatusTab === 'ALL' ? undefined : selectedStatusTab,
          search: searchQuery || undefined,
        }),
        api.getOnboardingMetrics().catch(() => ({ data: null })),
      ]);

      if (appsRes.success) {
        setApplications(appsRes.data || []);
      }
      if (metricsRes?.data) {
        setMetrics(metricsRes.data);
      }
    } catch (err: any) {
      console.error('Failed to load onboarding applications:', err);
      toast.error('Failed to fetch onboarding applications');
    } finally {
      setLoading(false);
    }
  }, [selectedStatusTab, searchQuery]);

  // Refetch on tab or search change
  useEffect(() => {
    loadData();
  }, [selectedStatusTab, loadData]);

  // Open Application Dossier Drawer
  const openDossier = async (appId: string) => {
    try {
      setDossierLoading(true);
      const res = await api.getWardenOnboardingApplicationDetails(appId);
      if (res.success) {
        setSelectedApp(res.data);
        // Pre-fill offline payment amount if needed
        if (res.data.feeDetails?.totalFee) {
          setOfflineFeeAmount(res.data.feeDetails.totalFee);
        }
        // Load available rooms for this application's hostel
        loadAvailableRooms(res.data.hostelId?._id || res.data.hostelId);
      } else {
        toast.error(res.message || 'Failed to open dossier');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error opening application dossier');
    } finally {
      setDossierLoading(false);
    }
  };

  const loadAvailableRooms = async (hostelId?: string) => {
    try {
      const res = await api.getAvailableRoomsForOnboarding({ hostelId });
      if (res.success) {
        setAvailableRooms(res.data || []);
      }
    } catch (_) {}
  };

  // Document Verification
  const handleApproveDocument = async (docType: string) => {
    if (!selectedApp) return;
    try {
      const res = await api.verifyWardenDocument(selectedApp._id, {
        documentType: docType,
        status: 'approved',
      });
      if (res.success) {
        toast.success(`Document marked as Approved!`);
        openDossier(selectedApp._id);
        loadData();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error approving document');
    }
  };

  const handleRejectDocumentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp || !rejectDocModal.docType) return;
    if (!docRejectionReason.trim()) {
      toast.error('Please specify a rejection reason for the student');
      return;
    }

    try {
      const res = await api.verifyWardenDocument(selectedApp._id, {
        documentType: rejectDocModal.docType,
        status: 'resubmission_required',
        rejectionReason: docRejectionReason,
        correctionInstructions: docCorrectionNotes,
      });
      if (res.success) {
        toast.success('Document marked for resubmission & student notified!');
        setRejectDocModal({ open: false, docType: '', docName: '' });
        setDocRejectionReason('');
        setDocCorrectionNotes('');
        openDossier(selectedApp._id);
        loadData();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error rejecting document');
    }
  };

  // Room Allocation
  const handleAllocateRoom = async () => {
    if (!selectedApp || !selectedRoomId) {
      toast.error('Please select a room to allocate');
      return;
    }

    try {
      const res = await api.allocateWardenOnboardingRoom(selectedApp._id, {
        roomId: selectedRoomId,
        bedNumber: selectedBedNumber,
      });
      if (res.success) {
        toast.success('Room and bed allocated successfully!');
        openDossier(selectedApp._id);
        loadData();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Room allocation failed');
    }
  };

  // Offline Payment Confirmation
  const handleConfirmOfflinePayment = async () => {
    if (!selectedApp) return;
    try {
      const res = await api.confirmWardenOfflineFee(selectedApp._id, {
        amountPaid: offlineFeeAmount,
        paymentMode: 'cash',
        referenceNumber: offlineRefNumber || `OFFLINE-REC-${Date.now()}`,
        notes: 'Confirmed in person by Warden',
      });
      if (res.success) {
        toast.success('Offline payment confirmed & receipt recorded!');
        openDossier(selectedApp._id);
        loadData();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error confirming payment');
    }
  };

  // Request General Correction
  const handleRequestCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp || !correctionInstructions.trim()) return;

    try {
      const res = await api.requestWardenCorrection(selectedApp._id, {
        instructions: correctionInstructions,
      });
      if (res.success) {
        toast.success('Correction request sent to student!');
        setCorrectionModalOpen(false);
        setCorrectionInstructions('');
        openDossier(selectedApp._id);
        loadData();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to request correction');
    }
  };

  // Final Approval
  const handleFinalApproval = async () => {
    if (!selectedApp) return;
    try {
      const res = await api.approveWardenOnboardingFinal(selectedApp._id, {
        notes: 'Approved and confirmed by Hostel Warden.',
      });
      if (res.success) {
        toast.success('Student onboarding completed! Resident is now fully ACTIVE.');
        setSelectedApp(null);
        loadData();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to grant final approval');
    }
  };

  const statusTabs = [
    { key: 'ALL', label: 'All Applications' },
    { key: 'DOCUMENTS_UNDER_REVIEW', label: 'Docs Review' },
    { key: 'ROOM_ALLOCATION_PENDING', label: 'Room Pending' },
    { key: 'PAYMENT_PENDING', label: 'Payment Pending' },
    { key: 'FINAL_REVIEW', label: 'Final Approval' },
    { key: 'ONBOARDING_COMPLETED', label: 'Completed' },
    { key: 'CORRECTION_REQUIRED', label: 'Corrections' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 font-semibold text-xs uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4" />
            Resident Admissions Console
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Student Hostel Onboarding</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Audit newcomer registrations, inspect verification documents, assign beds, and activate residents.
          </p>
        </div>

        <button
          onClick={() => {
            setRefreshing(true);
            loadData().finally(() => setRefreshing(false));
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl text-xs font-semibold shadow-xs transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh Pipeline
        </button>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs space-y-1">
          <span className="text-xs font-semibold text-gray-500">Total Applicants</span>
          <p className="text-2xl font-bold text-gray-900">{metrics?.totalApplications || applications.length}</p>
          <div className="text-[11px] text-gray-400">All registered joiners</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs space-y-1">
          <span className="text-xs font-semibold text-amber-600">Pending Verification</span>
          <p className="text-2xl font-bold text-amber-600">
            {metrics?.dropOffByStep?.documents ||
              applications.filter((a) =>
                ['DOCUMENTS_UNDER_REVIEW', 'DOCUMENTS_PENDING'].includes(a.status)
              ).length}
          </p>
          <div className="text-[11px] text-gray-400">Awaiting doc review</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs space-y-1">
          <span className="text-xs font-semibold text-indigo-600">Room Assignment</span>
          <p className="text-2xl font-bold text-indigo-600">
            {metrics?.dropOffByStep?.room ||
              applications.filter((a) =>
                ['DOCUMENTS_APPROVED', 'ROOM_ALLOCATION_PENDING'].includes(a.status)
              ).length}
          </p>
          <div className="text-[11px] text-gray-400">Ready for bed allocation</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs space-y-1">
          <span className="text-xs font-semibold text-emerald-600">Completed & Active</span>
          <p className="text-2xl font-bold text-emerald-600">
            {metrics?.completedApplications ||
              applications.filter((a) => a.status === 'ONBOARDING_COMPLETED').length}
          </p>
          <div className="text-[11px] text-gray-400">
            {metrics?.completionRate ? `${metrics.completionRate}% completion rate` : 'Fully onboarded'}
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 md:pb-0">
            {statusTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setSelectedStatusTab(tab.key)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedStatusTab === tab.key
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by student name or roll..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Applications Grid / Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-gray-100">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-gray-500 text-xs mt-2">Loading applications...</p>
        </div>
      ) : applications.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 space-y-2">
          <Users className="w-12 h-12 text-gray-300 mx-auto" />
          <h3 className="text-base font-bold text-gray-800">No Applications Found</h3>
          <p className="text-xs text-gray-500">
            {selectedStatusTab !== 'ALL'
              ? `No student applications currently in "${selectedStatusTab.replace(/_/g, ' ')}" status.`
              : 'No new student onboarding applications have been registered yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {applications.map((app) => {
            const student = app.studentId || {};
            const pInfo = app.personalInfo || {};
            const aInfo = app.academicInfo || {};
            const progress = app.progressPercentage || 0;

            const isApproved = app.status === 'ONBOARDING_COMPLETED';
            const isReview = ['DOCUMENTS_UNDER_REVIEW', 'FINAL_REVIEW'].includes(app.status);

            return (
              <div
                key={app._id}
                className="bg-white rounded-2xl p-5 border border-gray-100 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-gray-900 text-base">
                        {pInfo.fullName || student.name || 'New Applicant'}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {aInfo.studentIdNumber || student.studentId || 'ID: Pending'} •{' '}
                        {aInfo.course || 'Degree Program'}
                      </p>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        isApproved
                          ? 'bg-emerald-100 text-emerald-800'
                          : isReview
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {app.status?.replace(/_/g, ' ')}
                    </span>
                  </div>

                  {/* Contact Snippet */}
                  <div className="space-y-1 text-xs text-gray-600">
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-gray-400" />
                      <span>{pInfo.phone || student.phone || 'No phone'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-gray-400" />
                      <span className="truncate">{pInfo.email || student.email || 'No email'}</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-semibold text-gray-500">
                      <span>Onboarding Progress</span>
                      <span className="text-indigo-600 font-bold">{progress}%</span>
                    </div>
                    <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-600 h-full rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Status Pills */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                        app.documentsApproved
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      Docs: {app.documentsApproved ? 'Approved' : 'Pending'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                        app.roomAllocated ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      Room: {app.roomAllocated ? 'Allocated' : 'Unallocated'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                        app.paymentCompleted ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      Fee: {app.paymentCompleted ? 'Paid' : 'Pending'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => openDossier(app._id)}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-semibold text-xs transition-all"
                >
                  Inspect Dossier & Verify
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* DETAILED APPLICATION DOSSIER DRAWER / MODAL */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-2xl bg-white min-h-screen p-6 shadow-2xl flex flex-col justify-between space-y-6 overflow-y-auto">
            <div className="space-y-6">
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                    Student Dossier #{selectedApp._id.slice(-6)}
                  </span>
                  <h2 className="text-xl font-bold text-gray-900">
                    {selectedApp.personalInfo?.fullName || 'Applicant Details'}
                  </h2>
                </div>

                <button
                  onClick={() => setSelectedApp(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status Ribbon */}
              <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 flex items-center justify-between">
                <div>
                  <span className="text-xs text-indigo-700 font-medium">Application Status</span>
                  <p className="font-bold text-sm text-indigo-950">
                    {selectedApp.status?.replace(/_/g, ' ')}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-indigo-700 font-medium">Progress</span>
                  <p className="font-bold text-sm text-indigo-950">
                    {selectedApp.progressPercentage}%
                  </p>
                </div>
              </div>

              {/* SECTION 1: DOCUMENTS VERIFICATION STATION */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <FileCheck2 className="w-4 h-4 text-indigo-600" />
                  Uploaded Verification Documents
                </h3>

                <div className="space-y-2">
                  {selectedApp.documents?.length === 0 ? (
                    <p className="text-xs text-gray-500 italic p-3 bg-gray-50 rounded-lg">
                      No documents uploaded yet by the student.
                    </p>
                  ) : (
                    selectedApp.documents?.map((doc: any) => {
                      const isApproved = doc.status === 'approved';
                      const isRejected = doc.status === 'rejected' || doc.status === 'resubmission_required';

                      return (
                        <div
                          key={doc.documentType}
                          className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-gray-800 uppercase">
                                {doc.documentType?.replace(/_/g, ' ')}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  isApproved
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : isRejected
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {doc.status?.replace(/_/g, ' ')}
                              </span>
                            </div>
                            <p className="text-gray-500 text-[11px] truncate max-w-xs">{doc.name}</p>
                          </div>

                          <div className="flex items-center gap-2">
                            {doc.url && (
                              <a
                                href={doc.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-indigo-600 hover:bg-indigo-50 font-semibold rounded"
                              >
                                View Doc <ExternalLink className="w-3 h-3" />
                              </a>
                            )}

                            {!isApproved && (
                              <button
                                onClick={() => handleApproveDocument(doc.documentType)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold"
                              >
                                Approve
                              </button>
                            )}

                            {!isApproved && (
                              <button
                                onClick={() =>
                                  setRejectDocModal({
                                    open: true,
                                    docType: doc.documentType,
                                    docName: doc.name || doc.documentType,
                                  })
                                }
                                className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded font-semibold"
                              >
                                Request Correction
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* SECTION 2: ROOM & BED ALLOCATION */}
              <div className="space-y-3 pt-4 border-t">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <BedDouble className="w-4 h-4 text-indigo-600" />
                  Room & Bed Allocation
                </h3>

                {selectedApp.roomAllocated ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-1">
                    <p className="font-bold text-emerald-900">
                      Allocated Room: {selectedApp.allocationDetails?.roomNumber || 'Assigned'} (Bed:{' '}
                      {selectedApp.allocationDetails?.bedNumber || 'Bed 1'})
                    </p>
                    <p className="text-emerald-700">
                      Floor: {selectedApp.allocationDetails?.floor} • Type:{' '}
                      {selectedApp.allocationDetails?.roomType}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <p className="text-xs text-gray-600">
                      Select an available room with capacity to allocate this applicant:
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                          Available Rooms
                        </label>
                        <select
                          value={selectedRoomId}
                          onChange={(e) => setSelectedRoomId(e.target.value)}
                          className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300"
                        >
                          <option value="">-- Choose Room --</option>
                          {availableRooms.map((r) => (
                            <option key={r._id} value={r._id}>
                              Room {r.roomNumber} (Floor {r.floorNumber} - {r.availableBeds} beds free)
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                          Bed Identifier
                        </label>
                        <input
                          type="text"
                          value={selectedBedNumber}
                          onChange={(e) => setSelectedBedNumber(e.target.value)}
                          className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300"
                          placeholder="e.g. Bed 1 or Bed B"
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleAllocateRoom}
                      disabled={!selectedRoomId}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                    >
                      Assign Room & Reserve Bed
                    </button>
                  </div>
                )}
              </div>

              {/* SECTION 3: FEE PAYMENT STATUS & OFFLINE VERIFICATION */}
              <div className="space-y-3 pt-4 border-t">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-indigo-600" />
                  Hostel Fee & Payment Status
                </h3>

                {selectedApp.paymentCompleted ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-1">
                    <p className="font-bold text-emerald-900">Payment Completed & Verified</p>
                    <p className="text-emerald-700">
                      Amount: ₹{selectedApp.feeDetails?.amountPaid?.toLocaleString()} (Method:{' '}
                      {selectedApp.feeDetails?.paymentMethod})
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <p className="text-xs text-gray-600">
                      Applicant has not paid online yet. If student paid via cash or bank counter, confirm receipt:
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                          Amount Received (₹)
                        </label>
                        <input
                          type="number"
                          value={offlineFeeAmount}
                          onChange={(e) => setOfflineFeeAmount(Number(e.target.value))}
                          className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                          Challan / Receipt #
                        </label>
                        <input
                          type="text"
                          value={offlineRefNumber}
                          onChange={(e) => setOfflineRefNumber(e.target.value)}
                          placeholder="e.g. CASH-102"
                          className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300"
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleConfirmOfflinePayment}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold"
                    >
                      Confirm Offline Cash / DD Receipt
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions Drawer */}
            <div className="border-t pt-4 space-y-2">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCorrectionModalOpen(true)}
                  className="flex-1 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl font-bold text-xs transition-all"
                >
                  Request Application Correction
                </button>

                <button
                  onClick={handleFinalApproval}
                  disabled={selectedApp.status === 'ONBOARDING_COMPLETED'}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
                >
                  {selectedApp.status === 'ONBOARDING_COMPLETED'
                    ? 'Already Fully Onboarded'
                    : 'Grant Final Approval & Activate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DOCUMENT REJECTION MODAL */}
      {rejectDocModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-gray-900">
                Reject / Request Resubmission
              </h3>
              <button
                onClick={() => setRejectDocModal({ open: false, docType: '', docName: '' })}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-600">
              Document: <strong>{rejectDocModal.docName}</strong>
            </p>

            <form onSubmit={handleRejectDocumentSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Blur image, name mismatch, expired ID"
                  value={docRejectionReason}
                  onChange={(e) => setDocRejectionReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Correction Instructions
                </label>
                <textarea
                  rows={2}
                  placeholder="Tell the student how to fix the issue..."
                  value={docCorrectionNotes}
                  onChange={(e) => setDocCorrectionNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectDocModal({ open: false, docType: '', docName: '' })}
                  className="px-4 py-2 text-xs text-gray-600 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg"
                >
                  Send Rejection & Notify
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GENERAL CORRECTION MODAL */}
      {correctionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-gray-900">Request Application Correction</h3>
              <button
                onClick={() => setCorrectionModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRequestCorrectionSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Correction Instructions <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Specify what details or documents the student must update..."
                  value={correctionInstructions}
                  onChange={(e) => setCorrectionInstructions(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCorrectionModalOpen(false)}
                  className="px-4 py-2 text-xs text-gray-600 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg"
                >
                  Submit Correction Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
