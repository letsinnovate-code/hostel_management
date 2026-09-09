'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import StudentLayout from '../../../components/StudentLayout';
import {
  User,
  GraduationCap,
  Users,
  FileCheck2,
  BedDouble,
  CreditCard,
  ScrollText,
  CheckCircle2,
  AlertCircle,
  Clock,
  Upload,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  Check,
  Building,
  ShieldCheck,
  ExternalLink,
  Info,
  Phone,
  Mail,
  MapPin,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface DocumentItem {
  documentType: string;
  name: string;
  url: string;
  fileType: string;
  status: 'not_uploaded' | 'under_review' | 'approved' | 'rejected' | 'resubmission_required';
  rejectionReason?: string;
  correctionInstructions?: string;
  uploadedAt?: string;
}

const REQUIRED_DOC_TYPES = [
  { type: 'gov_id', label: 'Government ID (Aadhaar / Passport / Voter ID)', required: true },
  { type: 'college_id', label: 'College / University ID Card', required: true },
  { type: 'admission_proof', label: 'Admission Letter / Proof of Enrollment', required: true },
  { type: 'photo', label: 'Recent Passport Size Photograph', required: true },
  { type: 'address_proof', label: 'Permanent Address Proof', required: false },
];

export default function StudentOnboardingPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [onboarding, setOnboarding] = useState<any>(null);
  const [activeStep, setActiveStep] = useState(1);

  // Form states
  const [profileForm, setProfileForm] = useState({
    fullName: '',
    dob: '',
    gender: 'male',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    studentIdNumber: '',
    collegeName: '',
    course: '',
    department: '',
    yearOfStudy: '1st Year',
    semester: 'Semester 1',
    admissionYear: new Date().getFullYear(),
  });

  const [contactsForm, setContactsForm] = useState({
    parentName: '',
    parentRelation: 'Father',
    parentPhone: '',
    parentEmail: '',
    parentAddress: '',
    emergencyName: '',
    emergencyRelation: 'Mother',
    emergencyPhone: '',
    emergencyAltPhone: '',
  });

  // Document upload state
  const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedDocTypeForUpload, setSelectedDocTypeForUpload] = useState<string>('');

  // Payment states
  const [paymentMethod, setPaymentMethod] = useState<'razorpay' | 'offline_cash' | 'offline_bank_transfer'>('razorpay');
  const [offlineRefNumber, setOfflineRefNumber] = useState('');
  const [feeBreakdown, setFeeBreakdown] = useState<any>(null);

  // Agreement state
  const [agreementAgreed, setAgreementAgreed] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'student') {
      router.replace('/login');
      return;
    }
    loadOnboardingState();
  }, [user]);

  const loadOnboardingState = async () => {
    try {
      setLoading(true);
      const res = await api.getStudentOnboardingState();
      if (res.success && res.data) {
        const data = res.data;
        setOnboarding(data);

        // Pre-fill profile
        if (data.personalInfo) {
          setProfileForm((prev) => ({
            ...prev,
            fullName: data.personalInfo.fullName || user?.name || '',
            dob: data.personalInfo.dob ? data.personalInfo.dob.split('T')[0] : '',
            gender: data.personalInfo.gender || 'male',
            phone: data.personalInfo.phone || user?.phone || '',
            email: data.personalInfo.email || user?.email || '',
            address: data.personalInfo.address || '',
            city: data.personalInfo.city || '',
            state: data.personalInfo.state || '',
            pincode: data.personalInfo.pincode || '',
            studentIdNumber: data.academicInfo?.studentIdNumber || '',
            collegeName: data.academicInfo?.collegeName || '',
            course: data.academicInfo?.course || '',
            department: data.academicInfo?.department || '',
            yearOfStudy: data.academicInfo?.yearOfStudy || '1st Year',
            semester: data.academicInfo?.semester || 'Semester 1',
            admissionYear: data.academicInfo?.admissionYear || new Date().getFullYear(),
          }));
        } else {
          setProfileForm((prev) => ({
            ...prev,
            fullName: user?.name || '',
            phone: user?.phone || '',
            email: user?.email || '',
          }));
        }

        // Pre-fill contacts
        if (data.guardianInfo || data.emergencyContact) {
          setContactsForm({
            parentName: data.guardianInfo?.name || '',
            parentRelation: data.guardianInfo?.relation || 'Father',
            parentPhone: data.guardianInfo?.phone || '',
            parentEmail: data.guardianInfo?.email || '',
            parentAddress: data.guardianInfo?.address || '',
            emergencyName: data.emergencyContact?.name || '',
            emergencyRelation: data.emergencyContact?.relation || 'Mother',
            emergencyPhone: data.emergencyContact?.phone || '',
            emergencyAltPhone: data.emergencyContact?.altPhone || '',
          });
        }

        if (data.agreementAccepted) {
          setAgreementAgreed(true);
        }

        // Determine appropriate active step based on progress
        const stepNum = mapStatusToStep(data.status, data.progressPercentage);
        setActiveStep(stepNum);

        // Load fee breakdown
        loadFeeBreakdown();
      }
    } catch (err: any) {
      console.error('Failed to load onboarding state:', err);
      toast.error('Could not load onboarding profile. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  const loadFeeBreakdown = async () => {
    try {
      const res = await api.getOnboardingFeeBreakdown();
      if (res.success) {
        setFeeBreakdown(res.data);
      }
    } catch (_) {}
  };

  const mapStatusToStep = (status: string, progress: number): number => {
    switch (status) {
      case 'REGISTERED':
      case 'PROFILE_INCOMPLETE':
        return 1;
      case 'PROFILE_COMPLETED':
        return 2;
      case 'DOCUMENTS_PENDING':
      case 'DOCUMENTS_UNDER_REVIEW':
      case 'CORRECTION_REQUIRED':
        return 3;
      case 'DOCUMENTS_APPROVED':
      case 'ROOM_ALLOCATION_PENDING':
      case 'ROOM_ALLOCATED':
        return 4;
      case 'PAYMENT_PENDING':
        return 5;
      case 'PAYMENT_COMPLETED':
      case 'AGREEMENT_PENDING':
        return 6;
      case 'AGREEMENT_COMPLETED':
      case 'FINAL_REVIEW':
      case 'ONBOARDING_COMPLETED':
        return 7;
      default:
        return 1;
    }
  };

  // Step 1: Save Personal & Academic Info
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileForm.fullName.trim() || !profileForm.phone.trim()) {
      toast.error('Please fill in your full name and phone number');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.saveOnboardingProfile(profileForm);
      if (res.success) {
        toast.success('Personal and academic profile saved!');
        setOnboarding(res.data);
        setActiveStep(2);
      } else {
        toast.error(res.message || 'Failed to save profile');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error saving profile');
    } finally {
      setSubmitting(false);
    }
  };

  // Step 2: Save Parent/Guardian & Emergency Contacts
  const handleSaveContacts = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactsForm.parentName.trim() || !contactsForm.parentPhone.trim()) {
      toast.error('Parent / Guardian name and contact number are required');
      return;
    }
    if (!contactsForm.emergencyName.trim() || !contactsForm.emergencyPhone.trim()) {
      toast.error('Emergency contact name and phone number are required');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.saveOnboardingContacts(contactsForm);
      if (res.success) {
        toast.success('Parent & emergency contacts saved!');
        setOnboarding(res.data);
        setActiveStep(3);
      } else {
        toast.error(res.message || 'Failed to save contacts');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error saving contacts');
    } finally {
      setSubmitting(false);
    }
  };

  // Step 3: Trigger file upload
  const triggerUpload = (docType: string) => {
    setSelectedDocTypeForUpload(docType);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedDocTypeForUpload) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size exceeds 10MB limit. Please upload a smaller file.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentType', selectedDocTypeForUpload);
    formData.append('fileName', file.name);

    try {
      setUploadingDocType(selectedDocTypeForUpload);
      // Check if this document already was rejected
      const existingDoc = onboarding?.documents?.find((d: any) => d.documentType === selectedDocTypeForUpload);
      let res;
      if (existingDoc && (existingDoc.status === 'rejected' || existingDoc.status === 'resubmission_required')) {
        res = await api.resubmitOnboardingDocument(formData);
      } else {
        res = await api.uploadOnboardingDocument(formData);
      }

      if (res.success) {
        toast.success(`Uploaded ${file.name} successfully!`);
        setOnboarding(res.data);
      } else {
        toast.error(res.message || 'Upload failed');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error uploading document');
    } finally {
      setUploadingDocType(null);
      setSelectedDocTypeForUpload('');
    }
  };

  // Step 5: Process Payment
  const handlePayment = async () => {
    try {
      setSubmitting(true);
      if (paymentMethod === 'razorpay') {
        const initRes = await api.initiateOnboardingPayment({
          method: 'razorpay',
          notes: 'Student hostel onboarding fee',
        });

        if (!initRes.success) {
          toast.error(initRes.message || 'Failed to initiate payment');
          return;
        }

        // Check if Razorpay script is loaded
        if (typeof window !== 'undefined' && (window as any).Razorpay && initRes.data?.orderId) {
          const options = {
            key: initRes.data.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
            amount: initRes.data.amount * 100,
            currency: 'INR',
            name: 'Hostelzify Accommodation',
            description: 'Hostel Admission & Security Deposit',
            order_id: initRes.data.orderId,
            handler: async (response: any) => {
              try {
                const verifyRes = await api.verifyOnboardingPayment({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                });
                if (verifyRes.success) {
                  toast.success('Payment verified successfully!');
                  setOnboarding(verifyRes.data);
                  setActiveStep(6);
                } else {
                  toast.error(verifyRes.message || 'Payment verification failed');
                }
              } catch (vErr: any) {
                toast.error(vErr.response?.data?.message || 'Payment verification error');
              }
            },
            prefill: {
              name: profileForm.fullName,
              email: profileForm.email,
              contact: profileForm.phone,
            },
            theme: { color: '#0c2458' },
          };
          const rzp = new (window as any).Razorpay(options);
          rzp.open();
        } else {
          // Dev / fallback simulation
          toast.loading('Simulating payment completion in test mode...');
          const verifyRes = await api.verifyOnboardingPayment({
            offlineReference: `SIMULATED-PAY-${Date.now()}`,
          });
          if (verifyRes.success) {
            toast.dismiss();
            toast.success('Onboarding fee verified!');
            setOnboarding(verifyRes.data);
            setActiveStep(6);
          }
        }
      } else {
        // Offline payment declaration
        if (!offlineRefNumber.trim()) {
          toast.error('Please enter your offline payment reference or receipt number');
          return;
        }
        const verifyRes = await api.verifyOnboardingPayment({
          offlineReference: offlineRefNumber,
        });
        if (verifyRes.success) {
          toast.success('Offline payment submitted for warden verification!');
          setOnboarding(verifyRes.data);
          setActiveStep(6);
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Payment failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Step 6: Accept Agreement
  const handleAcceptAgreement = async () => {
    if (!agreementAgreed) {
      toast.error('You must read and agree to all hostel rules and regulations');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.acceptHostelAgreement({ agreementVersion: 'v2.1-2026' });
      if (res.success) {
        toast.success('Hostel Agreement accepted & digitally recorded!');
        setOnboarding(res.data);
        setActiveStep(7);
      } else {
        toast.error(res.message || 'Failed to accept agreement');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error recording agreement');
    } finally {
      setSubmitting(false);
    }
  };

  // Step 7: Final Submission
  const handleFinalSubmit = async () => {
    try {
      setSubmitting(true);
      const res = await api.submitOnboardingFinalReview();
      if (res.success) {
        toast.success('Congratulations! Your onboarding application has been submitted!');
        setOnboarding(res.data);
      } else {
        toast.error(res.message || 'Submission failed');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error submitting application');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <StudentLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
          <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin" />
          <p className="text-gray-600 font-medium">Loading your onboarding dossier...</p>
        </div>
      </StudentLayout>
    );
  }

  const stepsList = [
    { num: 1, label: 'Profile', icon: User },
    { num: 2, label: 'Contacts', icon: Users },
    { num: 3, label: 'Documents', icon: FileCheck2 },
    { num: 4, label: 'Room & Bed', icon: BedDouble },
    { num: 5, label: 'Hostel Fee', icon: CreditCard },
    { num: 6, label: 'Agreement', icon: ScrollText },
    { num: 7, label: 'Review', icon: CheckCircle2 },
  ];

  const progress = onboarding?.progressPercentage || 0;
  const isCompleted = onboarding?.status === 'ONBOARDING_COMPLETED';

  return (
    <StudentLayout>
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelected}
        accept="image/jpeg,image/png,image/jpg,application/pdf"
        className="hidden"
      />

      <div className="max-w-5xl mx-auto space-y-6 pb-12">
        {/* Onboarding Header & Overall Progress Ribbon */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
          <div className="relative z-10 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-blue-200 text-xs font-semibold backdrop-blur-md mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                  Hostelzify Seamless Onboarding
                </div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                  Welcome to Your New Home, {profileForm.fullName || user?.name}!
                </h1>
                <p className="text-blue-200 text-sm mt-1">
                  Complete these simple steps to activate your hostel accommodation and room access.
                </p>
              </div>

              {/* Status Badge */}
              <div className="flex flex-col items-start md:items-end">
                <span className="text-xs text-blue-200 font-medium">Status</span>
                <span
                  className={`mt-1 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                    isCompleted
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                      : onboarding?.status === 'CORRECTION_REQUIRED'
                      ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                      : 'bg-blue-500/30 text-blue-100 border border-blue-400/40'
                  }`}
                >
                  {onboarding?.status?.replace(/_/g, ' ') || 'REGISTERED'}
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2 pt-2">
              <div className="flex justify-between items-center text-xs font-semibold text-blue-200">
                <span>Overall Onboarding Progress</span>
                <span className="text-base font-bold text-white">{progress}%</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-3 p-0.5 backdrop-blur-sm">
                <div
                  className="bg-gradient-to-r from-teal-400 via-indigo-400 to-emerald-400 h-2 rounded-full transition-all duration-500 shadow-sm"
                  style={{ width: `${Math.max(5, progress)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Responsive Step Navigator */}
        <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 overflow-x-auto scrollbar-none">
          <div className="flex items-center justify-between min-w-[650px]">
            {stepsList.map((step) => {
              const Icon = step.icon;
              const isPast = step.num < activeStep;
              const isCurrent = step.num === activeStep;

              return (
                <button
                  key={step.num}
                  onClick={() => {
                    // Only allow moving to steps that are completed or current
                    if (step.num <= activeStep || isPast) {
                      setActiveStep(step.num);
                    }
                  }}
                  className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-lg transition-all text-xs font-semibold ${
                    isCurrent
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-xs'
                      : isPast
                      ? 'text-emerald-700 hover:bg-emerald-50'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                      isCurrent
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-2 ring-indigo-300'
                        : isPast
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {isPast ? <Check className="w-4 h-4 stroke-[3]" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span>{step.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step Content Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
          {/* STEP 1: PERSONAL & ACADEMIC INFO */}
          {activeStep === 1 && (
            <form onSubmit={handleSaveProfile} className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Personal & Academic Details</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Ensure your information matches your college enrollment records.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Full Legal Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={profileForm.fullName}
                    onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 text-sm"
                    placeholder="e.g. John Doe"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Date of Birth <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={profileForm.dob}
                    onChange={(e) => setProfileForm({ ...profileForm, dob: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Gender <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={profileForm.gender}
                    onChange={(e) => setProfileForm({ ...profileForm, gender: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 text-sm"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 text-sm"
                    placeholder="10-digit mobile number"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 text-sm"
                    placeholder="student@university.edu"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Permanent Address</label>
                  <textarea
                    rows={2}
                    value={profileForm.address}
                    onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 text-sm"
                    placeholder="House/Street/Locality"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    value={profileForm.city}
                    onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">State / Province</label>
                  <input
                    type="text"
                    value={profileForm.state}
                    onChange={(e) => setProfileForm({ ...profileForm, state: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Pincode / Postal Code</label>
                  <input
                    type="text"
                    value={profileForm.pincode}
                    onChange={(e) => setProfileForm({ ...profileForm, pincode: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>
              </div>

              {/* Academic section divider */}
              <div className="pt-4 border-t border-gray-100">
                <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-indigo-600" />
                  Academic Enrollment Information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Student ID / Roll Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={profileForm.studentIdNumber}
                      onChange={(e) => setProfileForm({ ...profileForm, studentIdNumber: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 text-sm"
                      placeholder="e.g. CS-2026-084"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      College / University Name
                    </label>
                    <input
                      type="text"
                      value={profileForm.collegeName}
                      onChange={(e) => setProfileForm({ ...profileForm, collegeName: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 text-sm"
                      placeholder="e.g. National Institute of Engineering"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Course / Degree Program
                    </label>
                    <input
                      type="text"
                      value={profileForm.course}
                      onChange={(e) => setProfileForm({ ...profileForm, course: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 text-sm"
                      placeholder="e.g. B.Tech Computer Science"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Year of Study
                    </label>
                    <select
                      value={profileForm.yearOfStudy}
                      onChange={(e) => setProfileForm({ ...profileForm, yearOfStudy: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 text-sm"
                    >
                      <option value="1st Year">1st Year</option>
                      <option value="2nd Year">2nd Year</option>
                      <option value="3rd Year">3rd Year</option>
                      <option value="4th Year">4th Year</option>
                      <option value="Postgraduate">Postgraduate</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-sm shadow-md shadow-indigo-500/20 transition-all disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save & Continue'}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: PARENT & EMERGENCY CONTACTS */}
          {activeStep === 2 && (
            <form onSubmit={handleSaveContacts} className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Parent / Guardian & Emergency Contacts</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Required for safety, emergency notifications, and verified hostel communication.
                </p>
              </div>

              {/* Parent/Guardian Section */}
              <div className="space-y-4">
                <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600" />
                  Primary Parent / Guardian Details
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Guardian Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={contactsForm.parentName}
                      onChange={(e) => setContactsForm({ ...contactsForm, parentName: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 text-sm"
                      placeholder="e.g. Robert Doe"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Relationship <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={contactsForm.parentRelation}
                      onChange={(e) => setContactsForm({ ...contactsForm, parentRelation: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 text-sm"
                    >
                      <option value="Father">Father</option>
                      <option value="Mother">Mother</option>
                      <option value="Guardian">Guardian</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={contactsForm.parentPhone}
                      onChange={(e) => setContactsForm({ ...contactsForm, parentPhone: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 text-sm"
                      placeholder="Guardian mobile"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      value={contactsForm.parentEmail}
                      onChange={(e) => setContactsForm({ ...contactsForm, parentEmail: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 text-sm"
                      placeholder="guardian@example.com"
                    />
                  </div>
                </div>
              </div>

              {/* Emergency Contact Section */}
              <div className="pt-4 border-t border-gray-100 space-y-4">
                <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-red-600" />
                  Emergency Contact
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Emergency Contact Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={contactsForm.emergencyName}
                      onChange={(e) => setContactsForm({ ...contactsForm, emergencyName: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 text-sm"
                      placeholder="e.g. Mary Doe"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Relationship <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={contactsForm.emergencyRelation}
                      onChange={(e) => setContactsForm({ ...contactsForm, emergencyRelation: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 text-sm"
                      placeholder="e.g. Sister / Uncle / Mother"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Primary Emergency Phone <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={contactsForm.emergencyPhone}
                      onChange={(e) => setContactsForm({ ...contactsForm, emergencyPhone: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 text-sm"
                      placeholder="Emergency contact phone"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Alternate Contact Phone
                    </label>
                    <input
                      type="tel"
                      value={contactsForm.emergencyAltPhone}
                      onChange={(e) => setContactsForm({ ...contactsForm, emergencyAltPhone: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 text-sm"
                      placeholder="Secondary phone (optional)"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center pt-4">
                <button
                  type="button"
                  onClick={() => setActiveStep(1)}
                  className="flex items-center gap-1.5 px-4 py-2 text-gray-600 hover:text-gray-900 font-medium text-sm"
                >
                  <ChevronLeft className="w-4 h-4" /> Back to Profile
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-sm shadow-md shadow-indigo-500/20 transition-all disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save & Continue'}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: DOCUMENT UPLOAD & VERIFICATION */}
          {activeStep === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Document Upload & Verification</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Upload clear copies or photos of your required verification documents. Supported formats: JPG, PNG, PDF (up to 10MB).
                </p>
              </div>

              {/* Rejection Alert if any doc was rejected */}
              {onboarding?.documents?.some(
                (d: any) => d.status === 'rejected' || d.status === 'resubmission_required'
              ) && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-900 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm">Document Resubmission Required</h4>
                    <p className="text-xs text-red-700 mt-0.5">
                      The warden has reviewed your documents and requested corrections on one or more items below. You do not need to restart onboarding — simply re-upload the corrected document.
                    </p>
                  </div>
                </div>
              )}

              {/* Documents List */}
              <div className="space-y-3">
                {REQUIRED_DOC_TYPES.map((item) => {
                  const uploaded = onboarding?.documents?.find((d: any) => d.documentType === item.type);
                  const isUploading = uploadingDocType === item.type;
                  const isApproved = uploaded?.status === 'approved';
                  const isRejected = uploaded?.status === 'rejected' || uploaded?.status === 'resubmission_required';
                  const isUnderReview = uploaded?.status === 'under_review';

                  return (
                    <div
                      key={item.type}
                      className={`p-4 rounded-xl border transition-all ${
                        isApproved
                          ? 'border-emerald-200 bg-emerald-50/40'
                          : isRejected
                          ? 'border-red-200 bg-red-50/40'
                          : isUnderReview
                          ? 'border-amber-200 bg-amber-50/30'
                          : 'border-gray-200 bg-gray-50/50 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-sm text-gray-900">{item.label}</h4>
                            {item.required && (
                              <span className="text-[11px] font-semibold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                                Required
                              </span>
                            )}
                          </div>

                          {uploaded ? (
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <span>File: {uploaded.name}</span>
                              {uploaded.uploadedAt && (
                                <span>• Uploaded {new Date(uploaded.uploadedAt).toLocaleDateString()}</span>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400">No document uploaded yet.</p>
                          )}
                        </div>

                        {/* Status / Action */}
                        <div className="flex items-center gap-3 self-end sm:self-auto">
                          {isApproved && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Approved
                            </span>
                          )}

                          {isUnderReview && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              Under Review
                            </span>
                          )}

                          {/* Rejection / Resubmission Button */}
                          {isRejected && (
                            <button
                              type="button"
                              onClick={() => triggerUpload(item.type)}
                              disabled={isUploading}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-xs transition-all"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${isUploading ? 'animate-spin' : ''}`} />
                              Resubmit Document
                            </button>
                          )}

                          {/* Initial Upload Button */}
                          {!uploaded && (
                            <button
                              type="button"
                              onClick={() => triggerUpload(item.type)}
                              disabled={isUploading}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all disabled:opacity-50"
                            >
                              <Upload className={`w-3.5 h-3.5 ${isUploading ? 'animate-spin' : ''}`} />
                              {isUploading ? 'Uploading...' : 'Upload'}
                            </button>
                          )}

                          {uploaded && !isRejected && (
                            <button
                              type="button"
                              onClick={() => triggerUpload(item.type)}
                              disabled={isUploading}
                              className="text-xs text-gray-500 hover:text-indigo-600 font-medium underline"
                            >
                              Replace
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Rejection reason box if rejected */}
                      {isRejected && (uploaded?.rejectionReason || uploaded?.correctionInstructions) && (
                        <div className="mt-3 p-3 bg-red-100/80 rounded-lg text-xs text-red-800 space-y-1">
                          {uploaded.rejectionReason && (
                            <p>
                              <strong>Rejection Reason:</strong> {uploaded.rejectionReason}
                            </p>
                          )}
                          {uploaded.correctionInstructions && (
                            <p>
                              <strong>Correction Needed:</strong> {uploaded.correctionInstructions}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between items-center pt-4">
                <button
                  type="button"
                  onClick={() => setActiveStep(2)}
                  className="flex items-center gap-1.5 px-4 py-2 text-gray-600 hover:text-gray-900 font-medium text-sm"
                >
                  <ChevronLeft className="w-4 h-4" /> Back to Contacts
                </button>

                <button
                  type="button"
                  onClick={() => setActiveStep(4)}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-sm shadow-md shadow-indigo-500/20 transition-all"
                >
                  Proceed to Room & Bed
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: ROOM & BED ALLOCATION */}
          {activeStep === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Hostel & Room Allocation</h2>
                <p className="text-sm text-gray-500 mt-1">
                  View your allocated room, floor, building, and bed status.
                </p>
              </div>

              {/* Room Allocation Status Card */}
              {onboarding?.roomAllocated && onboarding?.allocationDetails ? (
                <div className="bg-gradient-to-br from-indigo-50 via-white to-blue-50 border border-indigo-200 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/30">
                        <BedDouble className="w-6 h-6" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-indigo-600 tracking-wider uppercase">
                          Room Allocated & Reserved
                        </span>
                        <h3 className="text-xl font-bold text-gray-900">
                          Room {onboarding.allocationDetails.roomNumber || 'Assigned'}
                        </h3>
                      </div>
                    </div>

                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      Confirmed
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-indigo-100 text-sm">
                    <div>
                      <span className="text-xs text-gray-500">Bed Number</span>
                      <p className="font-bold text-gray-900">{onboarding.allocationDetails.bedNumber || 'Bed 1'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Floor</span>
                      <p className="font-bold text-gray-900">Floor {onboarding.allocationDetails.floor || '1'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Room Type</span>
                      <p className="font-bold text-gray-900 capitalize">
                        {onboarding.allocationDetails.roomType || 'Double Sharing'}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Allocated On</span>
                      <p className="font-bold text-gray-900">
                        {onboarding.allocationDetails.allocatedAt
                          ? new Date(onboarding.allocationDetails.allocatedAt).toLocaleDateString()
                          : 'Recently'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                /* Waiting for Room Allocation state */
                <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-8 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-600 mx-auto flex items-center justify-center">
                    <Clock className="w-8 h-8" />
                  </div>
                  <div className="max-w-md mx-auto space-y-1">
                    <h3 className="text-lg font-bold text-gray-900">Waiting for Room Allocation</h3>
                    <p className="text-sm text-gray-600">
                      Room and bed allocations are processed directly by the hostel warden after document verification.
                    </p>
                    <p className="text-xs text-amber-800 font-medium pt-2">
                      You can continue with fee payment and agreement steps while waiting for your room assignment!
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center pt-4">
                <button
                  type="button"
                  onClick={() => setActiveStep(3)}
                  className="flex items-center gap-1.5 px-4 py-2 text-gray-600 hover:text-gray-900 font-medium text-sm"
                >
                  <ChevronLeft className="w-4 h-4" /> Back to Documents
                </button>

                <button
                  type="button"
                  onClick={() => setActiveStep(5)}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-sm shadow-md shadow-indigo-500/20 transition-all"
                >
                  Proceed to Fee Payment
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: FEE & PAYMENT */}
          {activeStep === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Hostel Fee & Payment</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Review your admission fee, refundable security deposit, and complete payment.
                </p>
              </div>

              {/* Fee Breakdown Card */}
              <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200 space-y-4">
                <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-indigo-600" />
                  Detailed Fee Structure
                </h3>

                <div className="space-y-2.5 text-sm divide-y divide-gray-200/60">
                  <div className="flex justify-between pt-1">
                    <span className="text-gray-600">Monthly Hostel Rent (1st Month)</span>
                    <span className="font-semibold text-gray-900">
                      ₹{(feeBreakdown?.hostelRent || onboarding?.feeDetails?.totalFee || 8000).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between pt-2.5">
                    <span className="text-gray-600">Security Deposit (Refundable)</span>
                    <span className="font-semibold text-gray-900">
                      ₹{(feeBreakdown?.securityDeposit || 5000).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between pt-2.5">
                    <span className="text-gray-600">Maintenance & Registration Charges</span>
                    <span className="font-semibold text-gray-900">
                      ₹{(feeBreakdown?.maintenanceFee || 1000).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between pt-3 text-base font-bold text-gray-900">
                    <span>Total Amount Payable</span>
                    <span className="text-indigo-600">
                      ₹
                      {(
                        (feeBreakdown?.hostelRent || 8000) +
                        (feeBreakdown?.securityDeposit || 5000) +
                        (feeBreakdown?.maintenanceFee || 1000)
                      ).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Paid Status */}
                {onboarding?.paymentCompleted ? (
                  <div className="bg-emerald-100/70 border border-emerald-300 rounded-xl p-4 flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                    <div>
                      <h4 className="font-bold text-sm text-emerald-900">Fee Payment Completed</h4>
                      <p className="text-xs text-emerald-800">
                        Amount Paid: ₹{onboarding?.feeDetails?.amountPaid?.toLocaleString() || '14,000'} • Status: Verified
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 pt-4 border-t border-gray-200">
                    <label className="block text-xs font-semibold text-gray-700">Choose Payment Method</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label
                        className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                          paymentMethod === 'razorpay'
                            ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 ring-2 ring-indigo-500/20'
                            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="paymentMethod"
                          checked={paymentMethod === 'razorpay'}
                          onChange={() => setPaymentMethod('razorpay')}
                          className="text-indigo-600"
                        />
                        <div>
                          <p className="text-xs font-bold">Online Payment (UPI, Cards, NetBanking)</p>
                          <p className="text-[11px] text-gray-500">Instant activation via Razorpay</p>
                        </div>
                      </label>

                      <label
                        className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                          paymentMethod === 'offline_cash'
                            ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 ring-2 ring-indigo-500/20'
                            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="paymentMethod"
                          checked={paymentMethod === 'offline_cash'}
                          onChange={() => setPaymentMethod('offline_cash')}
                          className="text-indigo-600"
                        />
                        <div>
                          <p className="text-xs font-bold">Offline / Cash / Bank DD</p>
                          <p className="text-[11px] text-gray-500">Submit receipt for warden confirmation</p>
                        </div>
                      </label>
                    </div>

                    {paymentMethod !== 'razorpay' && (
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Payment Reference / Bank Challan / Receipt Number <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={offlineRefNumber}
                          onChange={(e) => setOfflineRefNumber(e.target.value)}
                          placeholder="e.g. CHAL-849204 or CASH-REC-01"
                          className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 text-sm"
                        />
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handlePayment}
                      disabled={submitting}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
                    >
                      {submitting ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <CreditCard className="w-4 h-4" />
                      )}
                      {paymentMethod === 'razorpay' ? 'Proceed to Secure Pay' : 'Submit Offline Payment Details'}
                    </button>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center pt-4">
                <button
                  type="button"
                  onClick={() => setActiveStep(4)}
                  className="flex items-center gap-1.5 px-4 py-2 text-gray-600 hover:text-gray-900 font-medium text-sm"
                >
                  <ChevronLeft className="w-4 h-4" /> Back to Room
                </button>

                <button
                  type="button"
                  onClick={() => setActiveStep(6)}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-sm shadow-md shadow-indigo-500/20 transition-all"
                >
                  Proceed to Agreement
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 6: HOSTEL RULES & AGREEMENT */}
          {activeStep === 6 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Hostel Rules & Resident Agreement</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Please read the hostel code of conduct and electronically sign to confirm your compliance.
                </p>
              </div>

              {/* Scrollable Rules Box */}
              <div className="h-64 overflow-y-auto p-4 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 space-y-3 leading-relaxed">
                <h4 className="font-bold text-gray-900 text-sm">Hostelzify Resident Code of Conduct (v2.1)</h4>
                <p>
                  <strong>1. Curfew Timings:</strong> All residents must check into the hostel premises before 10:00 PM.
                  Any late entry requires a pre-approved leave or late permission request through the Hostelzify app.
                </p>
                <p>
                  <strong>2. Visitor Policy:</strong> Outside visitors are permitted in designated lounge areas only
                  between 4:00 PM and 7:00 PM. No unauthorized overnight guests are permitted in student rooms.
                </p>
                <p>
                  <strong>3. Room Maintenance & Quiet Hours:</strong> Residents are expected to keep their rooms clean
                  and orderly. Quiet hours are enforced strictly from 11:00 PM to 6:00 AM daily.
                </p>
                <p>
                  <strong>4. Prohibition of Substance Abuse:</strong> Possession or consumption of alcohol, tobacco, or
                  any illegal narcotics is strictly prohibited on hostel grounds and will result in immediate disciplinary
                  action and expulsion.
                </p>
                <p>
                  <strong>5. Security & Damage Liability:</strong> Residents are responsible for the fixtures, furniture,
                  and electrical appliances in their rooms. Any intentional damage will be recovered from the security deposit.
                </p>
                <p>
                  <strong>6. Digital Attendance & Geofencing:</strong> Residents must comply with automated or manual
                  night attendance verification as directed by the warden.
                </p>
              </div>

              {/* Agreement Acceptance Checkbox */}
              <div className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreementAgreed}
                    onChange={(e) => setAgreementAgreed(e.target.checked)}
                    disabled={onboarding?.agreementAccepted}
                    className="mt-1 w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                  />
                  <div className="text-xs text-gray-700 space-y-1">
                    <p className="font-bold text-gray-900">
                      I have read, understood, and agree to abide by all hostel rules, terms, and safety policies.
                    </p>
                    <p className="text-gray-500">
                      This electronic signature is legally binding and will be recorded with your timestamp and IP address.
                    </p>
                  </div>
                </label>

                {onboarding?.agreementAccepted && (
                  <p className="text-xs text-emerald-700 font-semibold mt-2 pl-7">
                    ✓ Accepted on {new Date(onboarding.agreementAcceptedAt || Date.now()).toLocaleString()} (Version: {onboarding.agreementVersion || 'v2.1'})
                  </p>
                )}
              </div>

              <div className="flex justify-between items-center pt-4">
                <button
                  type="button"
                  onClick={() => setActiveStep(5)}
                  className="flex items-center gap-1.5 px-4 py-2 text-gray-600 hover:text-gray-900 font-medium text-sm"
                >
                  <ChevronLeft className="w-4 h-4" /> Back to Payment
                </button>

                <button
                  type="button"
                  onClick={handleAcceptAgreement}
                  disabled={submitting || !agreementAgreed}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-sm shadow-md shadow-indigo-500/20 transition-all disabled:opacity-50"
                >
                  {submitting ? 'Recording...' : 'Accept & Proceed to Review'}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 7: FINAL REVIEW & COMPLETION */}
          {activeStep === 7 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Onboarding Final Review & Status</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Verify your submitted onboarding dossier before final activation.
                </p>
              </div>

              {/* Onboarding Checklist Summary */}
              <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200 space-y-3">
                <h3 className="font-bold text-sm text-gray-900 mb-2">Onboarding Checklist</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="flex items-center gap-2.5 p-2 rounded-lg bg-white border border-gray-100">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Profile Information Completed</span>
                  </div>

                  <div className="flex items-center gap-2.5 p-2 rounded-lg bg-white border border-gray-100">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Parent & Emergency Contacts Saved</span>
                  </div>

                  <div className="flex items-center gap-2.5 p-2 rounded-lg bg-white border border-gray-100">
                    {onboarding?.documentsApproved ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                    )}
                    <span>
                      Documents Verified:{' '}
                      {onboarding?.documentsApproved ? 'Approved by Warden' : 'Under Review / Pending'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 p-2 rounded-lg bg-white border border-gray-100">
                    {onboarding?.roomAllocated ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                    )}
                    <span>Room Allocation: {onboarding?.roomAllocated ? 'Allocated' : 'Pending Warden Allocation'}</span>
                  </div>

                  <div className="flex items-center gap-2.5 p-2 rounded-lg bg-white border border-gray-100">
                    {onboarding?.paymentCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                    )}
                    <span>Hostel Fee: {onboarding?.paymentCompleted ? 'Paid & Verified' : 'Pending'}</span>
                  </div>

                  <div className="flex items-center gap-2.5 p-2 rounded-lg bg-white border border-gray-100">
                    {onboarding?.agreementAccepted ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                    )}
                    <span>Resident Agreement: {onboarding?.agreementAccepted ? 'Digitally Signed' : 'Pending'}</span>
                  </div>
                </div>
              </div>

              {/* Status Action Banner */}
              {isCompleted ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-3">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-emerald-900">You Are Fully Onboarded!</h3>
                  <p className="text-sm text-emerald-800 max-w-md mx-auto">
                    Your hostel resident profile is fully active. You now have full access to daily check-ins, leave requests, cleaning services, and notices.
                  </p>
                  <button
                    onClick={() => router.push('/student/dashboard')}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm shadow-md shadow-emerald-600/20 transition-all"
                  >
                    Go to Student Dashboard
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-indigo-50/70 border border-indigo-200 rounded-2xl">
                  <div>
                    <h4 className="font-bold text-sm text-indigo-950">Ready for Final Warden Approval?</h4>
                    <p className="text-xs text-indigo-700 mt-0.5">
                      Submit your application for final warden review and resident activation.
                    </p>
                  </div>

                  <button
                    onClick={handleFinalSubmit}
                    disabled={submitting}
                    className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50"
                  >
                    {submitting ? 'Submitting...' : 'Submit for Final Review'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </StudentLayout>
  );
}
