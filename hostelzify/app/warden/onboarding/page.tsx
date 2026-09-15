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
  Key,
  Eye,
  EyeOff,
  Home,
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

  // Direct Student Registration Modal
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [registerSubmitting, setRegisterSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: 'Student@123',
    gender: 'Male',
    dateOfBirth: '',
    course: '',
    year: '1',
    roomId: '',
    bedNumber: 'Bed 1',
    parentName: '',
    parentPhone: '',
    parentEmail: '',
    parentRelation: 'Parent',
    emergencyName: '',
    emergencyPhone: '',
    emergencyRelation: 'Guardian',
    street: '',
    city: '',
    state: '',
    pincode: '',
  });

  useEffect(() => {
    if (registerModalOpen && availableRooms.length === 0) {
      api.getWardenRooms().then((res: any) => {
        const rList = res?.data?.rooms || res?.rooms || (Array.isArray(res?.data) ? res.data : []);
        if (rList.length > 0) {
          setAvailableRooms(rList);
        } else {
          api.getAvailableRoomsForOnboarding().then((fallbackRes: any) => {
            if (fallbackRes?.data) setAvailableRooms(fallbackRes.data);
          }).catch(() => {});
        }
      }).catch(() => {
        api.getAvailableRoomsForOnboarding().then((fallbackRes: any) => {
          if (fallbackRes?.data) setAvailableRooms(fallbackRes.data);
        }).catch(() => {});
      });
    }
  }, [registerModalOpen, availableRooms.length]);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerForm.name.trim() || !registerForm.email.trim() || !registerForm.phone.trim()) {
      toast.error('Name, email, and phone are required');
      return;
    }
    if (!registerForm.password.trim()) {
      toast.error('Password is required');
      return;
    }
    const targetHostelId = user?.hostelId || (selectedApp?.hostelId?._id || selectedApp?.hostelId);
    if (!targetHostelId) {
      toast.error('Hostel ID not identified');
      return;
    }
    setRegisterSubmitting(true);
    try {
      await api.createWardenStudent({
        name: registerForm.name,
        email: registerForm.email,
        phone: registerForm.phone,
        password: registerForm.password,
        hostelId: targetHostelId,
        roomId: registerForm.roomId || undefined,
        bedNumber: registerForm.bedNumber,
        gender: registerForm.gender,
        dateOfBirth: registerForm.dateOfBirth || undefined,
        course: registerForm.course || undefined,
        year: registerForm.year || undefined,
        parentContact: {
          name: registerForm.parentName,
          phone: registerForm.parentPhone,
          email: registerForm.parentEmail,
          relation: registerForm.parentRelation,
        },
        emergencyContact: {
          name: registerForm.emergencyName,
          phone: registerForm.emergencyPhone,
          relation: registerForm.emergencyRelation,
        },
        address: {
          street: registerForm.street,
          city: registerForm.city,
          state: registerForm.state,
          pincode: registerForm.pincode,
        },
      });
      toast.success('Student registered successfully with room and bed allocation!');
      setRegisterModalOpen(false);
      setRegisterForm({
        name: '',
        email: '',
        phone: '',
        password: 'Student@123',
        gender: 'Male',
        dateOfBirth: '',
        course: '',
        year: '1',
        roomId: '',
        bedNumber: 'Bed 1',
        parentName: '',
        parentPhone: '',
        parentEmail: '',
        parentRelation: 'Parent',
        emergencyName: '',
        emergencyPhone: '',
        emergencyRelation: 'Guardian',
        street: '',
        city: '',
        state: '',
        pincode: '',
      });
      loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Failed to register student');
    } finally {
      setRegisterSubmitting(false);
    }
  };

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

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setRefreshing(true);
              loadData().finally(() => setRefreshing(false));
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl text-xs font-semibold shadow-xs transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Pipeline
          </button>

          <button
            onClick={() => setRegisterModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all"
          >
            <UserCheck className="w-4 h-4" />
            Register Student
          </button>
        </div>
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

      {/* ── DIRECT STUDENT REGISTRATION MODAL ── */}
      {registerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-gray-200 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Direct Student Registration</h3>
                  <p className="text-xs text-gray-500">In-person resident onboarding and credential creation</p>
                </div>
              </div>
              <button
                onClick={() => setRegisterModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterSubmit} className="space-y-4 mt-4 text-xs">
              {/* 1. Personal Information */}
              <div>
                <p className="font-bold text-gray-900 uppercase text-[10px] tracking-wider text-indigo-600 mb-2">
                  1. Personal Information
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rahul Sharma"
                      value={registerForm.name}
                      onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. rahul@example.com"
                      value={registerForm.email}
                      onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Phone Number *</label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. +91 9876543210"
                      value={registerForm.phone}
                      onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Gender</label>
                    <select
                      value={registerForm.gender}
                      onChange={(e) => setRegisterForm({ ...registerForm, gender: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Date of Birth</label>
                    <input
                      type="date"
                      value={registerForm.dateOfBirth}
                      onChange={(e) => setRegisterForm({ ...registerForm, dateOfBirth: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Course & Year</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Course (B.Tech)"
                        value={registerForm.course}
                        onChange={(e) => setRegisterForm({ ...registerForm, course: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <select
                        value={registerForm.year}
                        onChange={(e) => setRegisterForm({ ...registerForm, year: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="1">1st Year</option>
                        <option value="2">2nd Year</option>
                        <option value="3">3rd Year</option>
                        <option value="4">4th Year</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Room & Bed Allocation */}
              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100">
                <p className="font-bold text-indigo-900 uppercase text-[10px] tracking-wider mb-2 flex items-center gap-1.5">
                  <BedDouble className="w-3.5 h-3.5 text-indigo-600" />
                  2. Room & Bed Allocation
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Select Room (Optional)</label>
                    <select
                      value={registerForm.roomId}
                      onChange={(e) => setRegisterForm({ ...registerForm, roomId: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                    >
                      <option value="">-- Assign Later / Unallocated --</option>
                      {availableRooms.map((r: any) => (
                        <option key={r._id || r.id} value={r._id || r.id}>
                          Room {r.roomNumber} ({r.roomType || 'Standard'}) - {r.currentOccupancy || 0}/{r.capacity || 2} Occupied
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Assigned Bed</label>
                    <select
                      value={registerForm.bedNumber}
                      onChange={(e) => setRegisterForm({ ...registerForm, bedNumber: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                    >
                      <option value="Bed 1">Bed 1</option>
                      <option value="Bed 2">Bed 2</option>
                      <option value="Bed 3">Bed 3</option>
                      <option value="Bed 4">Bed 4</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 3. Account Password & Access */}
              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-bold text-emerald-900 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-emerald-600" />
                    3. Portal Password & Access *
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const randomPass = 'Hostel@' + Math.floor(1000 + Math.random() * 9000);
                      setRegisterForm({ ...registerForm, password: randomPass });
                    }}
                    className="text-[10px] font-semibold text-emerald-700 hover:text-emerald-800 underline"
                  >
                    Generate Random
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Set resident password"
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                    className="w-full px-3 py-2 pr-10 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                  The student will use their registered email and this password to access the resident portal.
                </p>
              </div>

              {/* 4. Guardian Details */}
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                <p className="font-bold text-gray-800 mb-2">4. Guardian / Parent Information</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Parent/Guardian Name"
                    value={registerForm.parentName}
                    onChange={(e) => setRegisterForm({ ...registerForm, parentName: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    type="tel"
                    placeholder="Parent Phone Number"
                    value={registerForm.parentPhone}
                    onChange={(e) => setRegisterForm({ ...registerForm, parentPhone: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* 5. Emergency Contact */}
              <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-100">
                <p className="font-bold text-rose-900 mb-2">5. Emergency Contact</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Emergency Contact Name"
                    value={registerForm.emergencyName}
                    onChange={(e) => setRegisterForm({ ...registerForm, emergencyName: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    type="tel"
                    placeholder="Emergency Phone"
                    value={registerForm.emergencyPhone}
                    onChange={(e) => setRegisterForm({ ...registerForm, emergencyPhone: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    type="text"
                    placeholder="Relationship"
                    value={registerForm.emergencyRelation}
                    onChange={(e) => setRegisterForm({ ...registerForm, emergencyRelation: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* 6. Address */}
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Permanent Street Address"
                  value={registerForm.street}
                  onChange={(e) => setRegisterForm({ ...registerForm, street: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  type="text"
                  placeholder="City"
                  value={registerForm.city}
                  onChange={(e) => setRegisterForm({ ...registerForm, city: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setRegisterModalOpen(false)}
                  className="px-4 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={registerSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  <UserCheck className="w-4 h-4" />
                  {registerSubmitting ? 'Registering...' : 'Register & Admit Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
