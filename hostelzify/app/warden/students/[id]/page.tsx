'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../../contexts/AuthContext';
import api from '../../../../services/api';
import toast from 'react-hot-toast';
import {
  User,
  Building,
  BedDouble,
  FileCheck2,
  AlertTriangle,
  MessageSquare,
  Clock,
  Calendar,
  Phone,
  Mail,
  MapPin,
  ChevronLeft,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Shield,
  ShieldAlert,
  ArrowRightLeft,
  LogIn,
  LogOut,
  Users,
  GraduationCap,
  Sparkles,
  ExternalLink,
  Info,
} from 'lucide-react';

interface StudentDetailsData {
  student: {
    _id: string;
    name: string;
    studentId?: string;
    email: string;
    phone: string;
    gender?: string;
    course?: string;
    year?: string | number;
    status: 'active' | 'on-leave' | 'suspended' | 'exited';
    dateOfBirth?: string;
    profileImage?: string;
    createdAt: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      pincode?: string;
      country?: string;
    };
    parentContact?: {
      name?: string;
      phone?: string;
      email?: string;
    };
    emergencyContact?: {
      name?: string;
      phone?: string;
      relation?: string;
    };
    hostelId?: {
      _id: string;
      name: string;
      address?: any;
      contactNumber?: string;
      rules?: any;
    };
    blockId?: {
      _id: string;
      name: string;
    };
    roomId?: {
      _id: string;
      roomNumber: string;
      floorNumber: number;
      capacity: number;
      currentOccupancy: number;
      category?: string;
      pricing?: { monthly?: number };
      amenities?: string[];
      description?: string;
    };
  };
  roommates: Array<{
    _id: string;
    name: string;
    studentId?: string;
    phone?: string;
    status: string;
    profileImage?: string;
  }>;
  livePresence: {
    status: 'inside' | 'outside' | 'on-leave' | 'unknown';
    lastCheckIn?: string | null;
    lastCheckOut?: string | null;
    lastBusinessDate?: string | null;
  };
  attendanceSummary: {
    totalDaysTracked: number;
    daysInside: number;
    daysOutside: number;
    daysOnLeave: number;
    attendancePercentage: number;
    totalHoursInside: number;
    recentRecords: Array<{
      _id: string;
      date: string;
      businessDate?: string;
      status: string;
      checkInTime?: string;
      checkOutTime?: string;
      totalMinutesInside?: number;
      verificationMethod?: string;
    }>;
  };
  leaveSummary: {
    total: number;
    approved: number;
    pending: number;
    rejected: number;
    history: Array<{
      _id: string;
      permissionType: string;
      reason: string;
      requestedDate: string;
      returnDate?: string;
      status: string;
      approvedBy?: { name: string; role: string };
      approvedAt?: string;
      rejectionReason?: string;
      createdAt: string;
    }>;
  };
  complaintSummary: {
    total: number;
    resolved: number;
    pending: number;
    history: Array<{
      _id: string;
      title: string;
      description: string;
      complaintType: string;
      priority: string;
      status: string;
      resolvedAt?: string;
      resolutionNotes?: string;
      createdAt: string;
      assignedTo?: { name: string; role: string };
    }>;
  };
  disciplinarySummary: {
    total: number;
    totalFines: number;
    history: Array<{
      _id: string;
      violationType: string;
      description: string;
      warningLevel?: string;
      fineAmount?: number;
      status: string;
      createdAt: string;
      reportedBy?: { name: string; role: string };
      recordType?: string;
    }>;
  };
  visitorHistory: Array<{
    _id: string;
    visitorName: string;
    visitorPhone: string;
    purpose: string;
    visitDate?: string;
    entryTime?: string;
    exitTime?: string;
    status: string;
    approvedBy?: { name: string; role: string };
    createdAt: string;
  }>;
  gateEvents: Array<{
    _id: string;
    type: 'in' | 'out';
    time: string;
    verificationMethod?: string;
    source?: string;
    accuracy?: number;
    distanceFromHostel?: number;
  }>;
}

export default function WardenStudentDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const studentId = params?.id as string;

  const [data, setData] = useState<StudentDetailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Active Tab View
  const [activeTab, setActiveTab] = useState<
    'overview' | 'attendance' | 'leaves' | 'complaints' | 'discipline' | 'visitors' | 'gate'
  >('overview');

  const fetchDetails = useCallback(
    async (isRefresh = false) => {
      if (!studentId) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const res = await api.getWardenStudentDetails(studentId);
        if (res?.success && res.data) {
          setData(res.data);
        } else {
          toast.error(res?.message || 'Could not load student profile');
        }
      } catch (err: any) {
        console.error('Error fetching student details:', err);
        toast.error(err.message || 'Failed to load student details');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [studentId]
  );

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto text-center py-24">
        <div className="inline-block animate-spin text-indigo-600 mb-4">
          <RefreshCw className="w-10 h-10" />
        </div>
        <h2 className="text-lg font-bold text-gray-800">Loading Student Dossier...</h2>
        <p className="text-sm text-gray-500">Retrieving profile, attendance, leaves, and records.</p>
      </div>
    );
  }

  if (!data || !data.student) {
    return (
      <div className="p-8 max-w-7xl mx-auto text-center py-20 bg-white rounded-2xl border border-gray-200 mt-6">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Student Not Found</h2>
        <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">
          This student does not exist or does not belong to your assigned hostel.
        </p>
        <Link
          href="/warden/students"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Students List</span>
        </Link>
      </div>
    );
  }

  const {
    student,
    roommates,
    livePresence,
    attendanceSummary,
    leaveSummary,
    complaintSummary,
    disciplinarySummary,
    visitorHistory,
    gateEvents,
  } = data;

  const initials = student.name
    ? student.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'ST';

  // Presence badge formatting
  const presenceConfig = {
    inside: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', label: 'Currently Inside' },
    outside: { bg: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500', label: 'Currently Outside' },
    'on-leave': { bg: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-500', label: 'On Approved Leave' },
    unknown: { bg: 'bg-gray-50 text-gray-600 border-gray-200', dot: 'bg-gray-400', label: 'Status Unknown' },
  }[livePresence.status || 'unknown'];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link
            href="/warden/students"
            className="flex items-center gap-1 font-semibold text-gray-600 hover:text-indigo-600 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Students Directory</span>
          </Link>
          <span>/</span>
          <span className="text-gray-900 font-bold truncate max-w-[200px] sm:max-w-xs">{student.name}</span>
        </div>

        <button
          onClick={() => fetchDetails(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-semibold border border-gray-200 shadow-xs transition-all self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
          <span>Refresh Details</span>
        </button>
      </div>

      {/* Header Profile Card */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="h-28 bg-gradient-to-r from-indigo-700 via-indigo-600 to-purple-700 relative p-6 flex justify-end items-start">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md bg-white/90 shadow-xs border ${presenceConfig.bg}`}
            >
              <span className={`w-2 h-2 rounded-full ${presenceConfig.dot} animate-pulse`} />
              <span>{presenceConfig.label}</span>
            </span>

            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white/90 text-gray-800 shadow-xs backdrop-blur-md">
              {student.status}
            </span>
          </div>
        </div>

        <div className="px-6 pb-6 pt-0 relative">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 -mt-12">
            {/* Avatar & Core Identity */}
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 text-center sm:text-left">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-800 text-white font-bold text-2xl flex items-center justify-center border-4 border-white shadow-md shrink-0">
                {student.profileImage ? (
                  <img
                    src={student.profileImage}
                    alt={student.name}
                    className="w-full h-full object-cover rounded-xl"
                  />
                ) : (
                  initials
                )}
              </div>

              <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{student.name}</h1>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-1">
                  <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                    {student.studentId || 'ID Pending'}
                  </span>
                  {student.gender && (
                    <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md uppercase">
                      {student.gender}
                    </span>
                  )}
                  {student.course && (
                    <span className="text-xs text-gray-600 flex items-center gap-1">
                      <GraduationCap className="w-3.5 h-3.5 text-indigo-500" />
                      <span>
                        {student.course} {student.year ? `(Yr ${student.year})` : ''}
                      </span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Room Allocation Quick Pill */}
            <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-200/80 flex items-center gap-4 self-center sm:self-auto">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <BedDouble className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Assigned Room</p>
                <p className="text-base font-bold text-gray-900">
                  {student.roomId ? `Room ${student.roomId.roomNumber}` : 'Unassigned'}
                </p>
                <p className="text-xs text-gray-500">
                  Floor {student.roomId?.floorNumber ?? '—'}
                  {student.blockId?.name ? ` • Block ${student.blockId.name}` : ''}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="border-t border-gray-100 bg-gray-50/50 px-4 sm:px-6 overflow-x-auto">
          <div className="flex items-center gap-2 py-2">
            {[
              { id: 'overview', label: 'Overview & Profile', icon: User, count: null },
              { id: 'attendance', label: 'Attendance', icon: Clock, count: `${attendanceSummary.attendancePercentage}%` },
              { id: 'leaves', label: 'Leaves & Passes', icon: FileCheck2, count: leaveSummary.total },
              { id: 'complaints', label: 'Complaints', icon: MessageSquare, count: complaintSummary.total },
              { id: 'discipline', label: 'Disciplinary', icon: AlertTriangle, count: disciplinarySummary.total },
              { id: 'visitors', label: 'Visitors', icon: Users, count: visitorHistory.length },
              { id: 'gate', label: 'Gate In/Out', icon: ArrowRightLeft, count: gateEvents.length },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  {tab.count != null && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                        isActive ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ==================== TAB 1: OVERVIEW & PROFILE ==================== */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Attendance Rate</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-indigo-600">
                  {attendanceSummary.attendancePercentage}%
                </span>
                <span className="text-xs text-gray-500">{attendanceSummary.daysInside} of {attendanceSummary.totalDaysTracked} days</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Leave Requests</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-gray-900">{leaveSummary.total}</span>
                <span className="text-xs text-emerald-600 font-semibold">{leaveSummary.approved} approved</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Complaints Filed</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-gray-900">{complaintSummary.total}</span>
                <span className="text-xs text-indigo-600 font-semibold">{complaintSummary.resolved} resolved</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Disciplinary Records</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-rose-600">{disciplinarySummary.total}</span>
                <span className="text-xs text-rose-500 font-semibold">₹{disciplinarySummary.totalFines} fines</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Personal & Contact Info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Profile Details Card */}
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                  <User className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-bold text-gray-900 text-base">Personal & Academic Profile</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-xs text-gray-400 font-semibold block">Full Legal Name</span>
                    <span className="font-semibold text-gray-800">{student.name}</span>
                  </div>

                  <div>
                    <span className="text-xs text-gray-400 font-semibold block">Student ID / Roll Number</span>
                    <span className="font-mono font-bold text-gray-800">{student.studentId || 'Pending'}</span>
                  </div>

                  <div>
                    <span className="text-xs text-gray-400 font-semibold block">Email Address</span>
                    <span className="text-gray-700 font-mono text-xs">{student.email}</span>
                  </div>

                  <div>
                    <span className="text-xs text-gray-400 font-semibold block">Primary Phone</span>
                    <a
                      href={`tel:${student.phone}`}
                      className="font-mono text-indigo-600 font-semibold hover:underline"
                    >
                      {student.phone}
                    </a>
                  </div>

                  <div>
                    <span className="text-xs text-gray-400 font-semibold block">Course & Branch</span>
                    <span className="text-gray-800">{student.course || 'Not Specified'}</span>
                  </div>

                  <div>
                    <span className="text-xs text-gray-400 font-semibold block">Academic Year</span>
                    <span className="text-gray-800">{student.year ? `Year ${student.year}` : 'Not Specified'}</span>
                  </div>

                  <div>
                    <span className="text-xs text-gray-400 font-semibold block">Date of Birth</span>
                    <span className="text-gray-800">
                      {student.dateOfBirth
                        ? new Date(student.dateOfBirth).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : 'Not Specified'}
                    </span>
                  </div>

                  <div>
                    <span className="text-xs text-gray-400 font-semibold block">Enrollment / Registration Date</span>
                    <span className="text-gray-800">
                      {new Date(student.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>

                {/* Permanent / Home Address */}
                {student.address && (
                  <div className="pt-3 border-t border-gray-100">
                    <span className="text-xs text-gray-400 font-semibold block mb-1">Permanent Home Address</span>
                    <p className="text-xs text-gray-700 leading-relaxed">
                      {[
                        student.address.street,
                        student.address.city,
                        student.address.state,
                        student.address.pincode,
                        student.address.country,
                      ]
                        .filter(Boolean)
                        .join(', ') || 'No address recorded.'}
                    </p>
                  </div>
                )}
              </div>

              {/* Authorized Parent & Emergency Contacts Card */}
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <Phone className="w-5 h-5 text-indigo-600" />
                    <h3 className="font-bold text-gray-900 text-base">Authorized Parent & Guardian Contact</h3>
                  </div>
                  <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                    Warden Authorized
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Parent Contact Card */}
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200/70 space-y-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                      Primary Parent / Guardian
                    </span>
                    <p className="font-bold text-gray-900 text-sm">
                      {student.parentContact?.name || 'Guardian name not provided'}
                    </p>
                    {student.parentContact?.phone ? (
                      <a
                        href={`tel:${student.parentContact.phone}`}
                        className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-indigo-600 hover:text-indigo-800"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>{student.parentContact.phone}</span>
                      </a>
                    ) : (
                      <p className="text-xs text-gray-400 italic">No phone number recorded</p>
                    )}
                    {student.parentContact?.email && (
                      <p className="text-xs text-gray-500 font-mono">{student.parentContact.email}</p>
                    )}
                  </div>

                  {/* Emergency Contact Card */}
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200/70 space-y-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                      Emergency Alternate Contact
                    </span>
                    <p className="font-bold text-gray-900 text-sm">
                      {student.emergencyContact?.name || 'Emergency contact not provided'}
                    </p>
                    {student.emergencyContact?.relation && (
                      <p className="text-xs text-gray-500">Relation: {student.emergencyContact.relation}</p>
                    )}
                    {student.emergencyContact?.phone ? (
                      <a
                        href={`tel:${student.emergencyContact.phone}`}
                        className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-rose-600 hover:text-rose-800"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>{student.emergencyContact.phone}</span>
                      </a>
                    ) : (
                      <p className="text-xs text-gray-400 italic">No emergency phone recorded</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Col: Hostel & Room Allocation */}
            <div className="space-y-6">
              {/* Room & Bed Allocation */}
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                  <Building className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-bold text-gray-900 text-base">Hostel & Room Allocation</h3>
                </div>

                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-xs text-gray-400 font-semibold block">Hostel Facility</span>
                    <span className="font-bold text-gray-900">{student.hostelId?.name || 'Campus Hostel'}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-xl border border-gray-200/70">
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase font-bold block">Room No.</span>
                      <span className="font-bold text-gray-900 text-base">
                        {student.roomId?.roomNumber || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase font-bold block">Floor</span>
                      <span className="font-bold text-gray-900 text-base">
                        {student.roomId?.floorNumber ?? '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase font-bold block">Category</span>
                      <span className="text-xs font-semibold text-indigo-600">
                        {student.roomId?.category || 'Standard'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase font-bold block">Occupancy</span>
                      <span className="text-xs font-semibold text-gray-800">
                        {student.roomId?.currentOccupancy || 0} / {student.roomId?.capacity || 2} Beds
                      </span>
                    </div>
                  </div>

                  {student.roomId?.amenities && student.roomId.amenities.length > 0 && (
                    <div>
                      <span className="text-xs text-gray-400 font-semibold block mb-1.5">Room Amenities</span>
                      <div className="flex flex-wrap gap-1.5">
                        {student.roomId.amenities.map((amenity, i) => (
                          <span
                            key={i}
                            className="text-[11px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-medium"
                          >
                            {amenity}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Roommates / Bed-Mates */}
                  <div className="pt-3 border-t border-gray-100">
                    <span className="text-xs font-bold text-gray-800 block mb-2">
                      Bed Mates ({roommates.length})
                    </span>

                    {roommates.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">No other roommates assigned to this room.</p>
                    ) : (
                      <div className="space-y-2">
                        {roommates.map((mate) => (
                          <div
                            key={mate._id}
                            className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-100 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center">
                                {mate.name ? mate.name[0].toUpperCase() : 'R'}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">{mate.name}</p>
                                <p className="text-[10px] text-gray-400 font-mono">{mate.studentId || 'ID: —'}</p>
                              </div>
                            </div>

                            <Link
                              href={`/warden/students/${mate._id}`}
                              className="text-indigo-600 hover:text-indigo-800 font-semibold text-[11px]"
                            >
                              View
                            </Link>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Live Gate Status */}
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                  <ArrowRightLeft className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-bold text-gray-900 text-base">Current Activity State</h3>
                </div>

                <div className="text-xs space-y-2">
                  <div className="flex justify-between py-1 border-b border-gray-50">
                    <span className="text-gray-500">Live Presence</span>
                    <span className="font-bold capitalize text-gray-800">{livePresence.status}</span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-gray-50">
                    <span className="text-gray-500">Last Check-In</span>
                    <span className="font-mono text-gray-700">
                      {livePresence.lastCheckIn
                        ? new Date(livePresence.lastCheckIn).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true,
                          })
                        : '—'}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-gray-50">
                    <span className="text-gray-500">Last Check-Out</span>
                    <span className="font-mono text-gray-700">
                      {livePresence.lastCheckOut
                        ? new Date(livePresence.lastCheckOut).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true,
                          })
                        : '—'}
                    </span>
                  </div>

                  <div className="flex justify-between py-1">
                    <span className="text-gray-500">Cumulative Time Inside</span>
                    <span className="font-bold text-indigo-600">
                      {attendanceSummary.totalHoursInside} Hours
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 2: ATTENDANCE HISTORY ==================== */}
      {activeTab === 'attendance' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
            <div>
              <h3 className="text-base font-bold text-gray-900">Attendance Log & Summary</h3>
              <p className="text-xs text-gray-500">
                Calculated over {attendanceSummary.totalDaysTracked} recorded business days.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-gray-500">Overall Rate:</span>
              <span className="text-lg font-bold text-indigo-600">
                {attendanceSummary.attendancePercentage}%
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase">Days Inside</span>
              <p className="text-xl font-bold text-emerald-600 mt-0.5">{attendanceSummary.daysInside}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase">Days Outside</span>
              <p className="text-xl font-bold text-amber-600 mt-0.5">{attendanceSummary.daysOutside}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase">Days On Leave</span>
              <p className="text-xl font-bold text-purple-600 mt-0.5">{attendanceSummary.daysOnLeave}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase">Total Hours Inside</span>
              <p className="text-xl font-bold text-indigo-600 mt-0.5">{attendanceSummary.totalHoursInside} hrs</p>
            </div>
          </div>

          {attendanceSummary.recentRecords.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No attendance records logged yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-bold text-gray-500 uppercase">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Check-In</th>
                    <th className="py-2.5 px-3">Check-Out</th>
                    <th className="py-2.5 px-3">Minutes Inside</th>
                    <th className="py-2.5 px-3">Method</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {attendanceSummary.recentRecords.map((rec) => (
                    <tr key={rec._id} className="hover:bg-gray-50">
                      <td className="py-2.5 px-3 font-semibold text-gray-800">
                        {rec.businessDate || new Date(rec.date).toLocaleDateString('en-IN')}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full font-semibold uppercase text-[10px] ${
                            rec.status === 'inside'
                              ? 'bg-emerald-50 text-emerald-700'
                              : rec.status === 'outside'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-purple-50 text-purple-700'
                          }`}
                        >
                          {rec.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-gray-600">
                        {rec.checkInTime ? new Date(rec.checkInTime).toLocaleTimeString('en-IN') : '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-gray-600">
                        {rec.checkOutTime ? new Date(rec.checkOutTime).toLocaleTimeString('en-IN') : '—'}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-gray-800">
                        {rec.totalMinutesInside != null ? `${rec.totalMinutesInside} min` : '—'}
                      </td>
                      <td className="py-2.5 px-3 capitalize text-gray-500">{rec.verificationMethod || 'auto'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 3: LEAVES & PASSES ==================== */}
      {activeTab === 'leaves' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden p-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-gray-100">
            <div>
              <h3 className="text-base font-bold text-gray-900">Permission & Outpass History</h3>
              <p className="text-xs text-gray-500">
                All leave applications and night-out requests submitted by {student.name}.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold">
                {leaveSummary.approved} Approved
              </span>
              <span className="text-xs px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 font-bold">
                {leaveSummary.pending} Pending
              </span>
            </div>
          </div>

          {leaveSummary.history.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No leave requests recorded for this student.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {leaveSummary.history.map((perm) => (
                <div key={perm._id} className="py-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md">
                      {perm.permissionType}
                    </span>
                    <span
                      className={`text-xs font-bold uppercase px-2 py-0.5 rounded-md ${
                        perm.status === 'approved'
                          ? 'bg-emerald-50 text-emerald-700'
                          : perm.status === 'rejected'
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {perm.status}
                    </span>
                  </div>

                  <p className="text-sm font-semibold text-gray-800">{perm.reason}</p>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                    <span>
                      Requested: <strong className="text-gray-700">{new Date(perm.requestedDate).toLocaleDateString('en-IN')}</strong>
                    </span>
                    {perm.returnDate && (
                      <span>
                        Return Date: <strong className="text-gray-700">{new Date(perm.returnDate).toLocaleDateString('en-IN')}</strong>
                      </span>
                    )}
                    {perm.approvedBy && (
                      <span className="text-gray-400">
                        Processed by: {perm.approvedBy.name}
                      </span>
                    )}
                    {perm.rejectionReason && (
                      <span className="text-rose-600 font-semibold">
                        Rejection Note: {perm.rejectionReason}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 4: COMPLAINTS ==================== */}
      {activeTab === 'complaints' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden p-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-gray-100">
            <div>
              <h3 className="text-base font-bold text-gray-900">Complaints & Tickets Raised</h3>
              <p className="text-xs text-gray-500">
                Issues raised by this student regarding hostel maintenance, food, or cleanliness.
              </p>
            </div>
            <span className="text-xs font-bold px-3 py-1 bg-gray-100 rounded-lg text-gray-700">
              Total: {complaintSummary.total}
            </span>
          </div>

          {complaintSummary.history.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No complaints logged by this student.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {complaintSummary.history.map((comp) => (
                <div key={comp._id} className="py-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                        {comp.complaintType}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                          comp.priority === 'urgent'
                            ? 'bg-rose-100 text-rose-700'
                            : comp.priority === 'high'
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {comp.priority}
                      </span>
                    </div>

                    <span
                      className={`text-xs font-bold uppercase px-2.5 py-0.5 rounded-md ${
                        comp.status === 'resolved' || comp.status === 'closed'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {comp.status}
                    </span>
                  </div>

                  <h4 className="font-bold text-gray-900 text-sm">{comp.title}</h4>
                  <p className="text-xs text-gray-600 leading-relaxed">{comp.description}</p>

                  <div className="flex flex-wrap items-center justify-between text-xs text-gray-400 pt-1">
                    <span>Filed on: {new Date(comp.createdAt).toLocaleDateString('en-IN')}</span>
                    {comp.resolutionNotes && (
                      <span className="text-emerald-700 font-medium">
                        Resolution: {comp.resolutionNotes}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 5: DISCIPLINARY ==================== */}
      {activeTab === 'discipline' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden p-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-gray-100">
            <div>
              <h3 className="text-base font-bold text-gray-900">Disciplinary & Curfew Infractions</h3>
              <p className="text-xs text-gray-500">
                Rule breaches, late entries, and automated curfew logs.
              </p>
            </div>
            <span className="text-xs font-bold px-3 py-1 bg-rose-50 text-rose-700 rounded-lg">
              Total Fines: ₹{disciplinarySummary.totalFines}
            </span>
          </div>

          {disciplinarySummary.history.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-bold text-gray-800">Clean Disciplinary Record</p>
              <p className="text-xs text-gray-400">No violations or curfew infractions reported.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {disciplinarySummary.history.map((violation) => (
                <div key={violation._id} className="py-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-md">
                      {violation.violationType}
                    </span>

                    <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md uppercase">
                      Level: {violation.warningLevel || 'warning'}
                    </span>
                  </div>

                  <p className="text-sm text-gray-800 font-medium">{violation.description}</p>

                  <div className="flex flex-wrap items-center justify-between text-xs text-gray-500 pt-1">
                    <span>
                      Date: <strong className="text-gray-700">{new Date(violation.createdAt).toLocaleString('en-IN')}</strong>
                    </span>
                    {violation.fineAmount ? (
                      <span className="font-bold text-rose-600">Fine: ₹{violation.fineAmount}</span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 6: VISITORS ==================== */}
      {activeTab === 'visitors' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden p-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-gray-100">
            <div>
              <h3 className="text-base font-bold text-gray-900">Visitor History</h3>
              <p className="text-xs text-gray-500">
                Guests and parents registered to visit {student.name}.
              </p>
            </div>
            <span className="text-xs font-bold px-3 py-1 bg-gray-100 rounded-lg text-gray-700">
              Total Visits: {visitorHistory.length}
            </span>
          </div>

          {visitorHistory.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No visitor records found for this student.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {visitorHistory.map((vis) => (
                <div key={vis._id} className="py-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm">{vis.visitorName}</h4>
                      <p className="text-xs font-mono text-gray-500">{vis.visitorPhone}</p>
                    </div>

                    <span
                      className={`text-xs font-bold uppercase px-2.5 py-0.5 rounded-md ${
                        vis.status === 'approved' || vis.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-700'
                          : vis.status === 'rejected'
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {vis.status}
                    </span>
                  </div>

                  <p className="text-xs text-gray-700">
                    Purpose: <strong className="text-gray-900">{vis.purpose}</strong>
                  </p>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400">
                    <span>
                      Date: {vis.visitDate ? new Date(vis.visitDate).toLocaleDateString('en-IN') : '—'}
                    </span>
                    {vis.entryTime && (
                      <span>
                        In: {new Date(vis.entryTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    {vis.exitTime && (
                      <span>
                        Out: {new Date(vis.exitTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 7: GATE IN/OUT HISTORY ==================== */}
      {activeTab === 'gate' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden p-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-gray-100">
            <div>
              <h3 className="text-base font-bold text-gray-900">Check-in / Check-out History</h3>
              <p className="text-xs text-gray-500">
                Live gate transition logs recorded via student mobile app, biometric, or warden check.
              </p>
            </div>
            <span className="text-xs font-bold px-3 py-1 bg-gray-100 rounded-lg text-gray-700">
              Recent Logs: {gateEvents.length}
            </span>
          </div>

          {gateEvents.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No gate events logged for this student.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-bold text-gray-500 uppercase">
                    <th className="py-2.5 px-3">Event Type</th>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Trigger Source</th>
                    <th className="py-2.5 px-3">Verification Method</th>
                    <th className="py-2.5 px-3">Telemetry</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {gateEvents.map((evt) => {
                    const isIn = evt.type === 'in';
                    return (
                      <tr key={evt._id} className="hover:bg-gray-50">
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                              isIn ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {isIn ? <LogIn className="w-3 h-3" /> : <LogOut className="w-3 h-3" />}
                            <span>{isIn ? 'Check In' : 'Check Out'}</span>
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-medium text-gray-800">
                          {new Date(evt.time).toLocaleString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </td>
                        <td className="py-2.5 px-3 capitalize text-gray-600">{evt.source || 'student'}</td>
                        <td className="py-2.5 px-3 uppercase text-gray-500 font-mono text-[11px]">
                          {evt.verificationMethod || 'auto'}
                        </td>
                        <td className="py-2.5 px-3 text-gray-400">
                          {evt.accuracy != null ? `±${Math.round(evt.accuracy)}m` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
