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
  X,
  FileText,
  Users,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Paperclip,
  Eye,
  MessageSquare,
  Send,
  History,
  AlertOctagon,
  Shield,
  PhoneCall,
  Flame,
  Check,
  Building,
  UserCheck,
  UserX,
} from 'lucide-react';

interface InvolvedStudent {
  studentId?: string;
  name: string;
  rollNumber?: string;
  roomNumber?: string;
  roleInIncident?: 'primary_offender' | 'accomplice' | 'instigator' | 'involved_party' | 'bystander';
}

interface Witness {
  name: string;
  contact?: string;
  role?: 'student' | 'guard' | 'cleaning_staff' | 'warden' | 'faculty' | 'other';
  statement?: string;
  recordedAt?: string;
}

interface Evidence {
  name: string;
  url?: string;
  fileType?: string;
  description?: string;
  uploadedAt?: string;
}

interface TimelineItem {
  action: string;
  performedBy?: any;
  performedByName?: string;
  performedByRole?: string;
  notes?: string;
  fromStatus?: string;
  toStatus?: string;
  timestamp: string;
}

interface RemarkItem {
  author?: any;
  authorName?: string;
  authorRole?: string;
  comment: string;
  createdAt: string;
}

interface ViolationRecord {
  _id: string;
  studentId?: any;
  title?: string;
  violationType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  incidentDate?: string;
  location?: string;
  involvedStudents?: InvolvedStudent[];
  witnesses?: Witness[];
  evidence?: Evidence[];
  reportedBy?: any;
  fineAmount?: number;
  warningLevel?: 'warning' | 'first' | 'second' | 'final';
  actionTaken?: string;
  actionDetails?: string;
  actionDate?: string;
  actionBy?: any;
  parentNotified?: boolean;
  parentNotifiedAt?: string;
  parentNotificationMethod?: string;
  parentNotificationNotes?: string;
  parentContactInfo?: string;
  status: 'pending' | 'investigating' | 'action_taken' | 'resolved' | 'escalated' | 'closed';
  isEscalated?: boolean;
  escalatedTo?: string;
  escalationReason?: string;
  escalatedAt?: string;
  escalatedBy?: any;
  resolutionNotes?: string;
  resolvedBy?: any;
  resolvedAt?: string;
  remarks?: RemarkItem[];
  timeline?: TimelineItem[];
  createdAt: string;
  updatedAt?: string;
}

export default function WardenDisciplineManagement() {
  const { user } = useAuth();
  const router = useRouter();

  const [violations, setViolations] = useState<ViolationRecord[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'ACTION_TAKEN' | 'CRITICAL' | 'RESOLVED'>('ALL');
  const [filterSeverity, setFilterSeverity] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    investigating: 0,
    actionTaken: 0,
    critical: 0,
    escalated: 0,
    resolved: 0,
  });

  // Modal States
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [parentModalOpen, setParentModalOpen] = useState(false);
  const [escalateModalOpen, setEscalateModalOpen] = useState(false);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [dossierModalOpen, setDossierModalOpen] = useState(false);

  const [selectedIncident, setSelectedIncident] = useState<ViolationRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // New Incident Form State
  const [createForm, setCreateForm] = useState({
    studentId: '',
    title: '',
    violationType: 'late-entry',
    severity: 'low' as 'low' | 'medium' | 'high' | 'critical',
    description: '',
    incidentDate: new Date().toISOString().slice(0, 16),
    location: '',
    warningLevel: 'warning' as 'warning' | 'first' | 'second' | 'final',
    fineAmount: 0,
    actionTaken: 'none',
    actionDetails: '',
    parentNotified: false,
    parentNotificationMethod: 'call',
    parentNotificationNotes: '',
    parentContactInfo: '',
    initialRemarks: '',
  });

  // Multi-fields for Create Modal
  const [involvedList, setInvolvedList] = useState<InvolvedStudent[]>([]);
  const [witnessList, setWitnessList] = useState<Witness[]>([]);
  const [evidenceList, setEvidenceList] = useState<Evidence[]>([]);

  // Disciplinary Action Form
  const [actionForm, setActionForm] = useState({
    actionTaken: 'written_warning',
    actionDetails: '',
    warningLevel: 'first',
    fineAmount: 0,
  });

  // Parent Notification Form
  const [parentForm, setParentForm] = useState({
    method: 'call',
    parentContactInfo: '',
    notes: '',
  });

  // Escalate Form
  const [escalateForm, setEscalateForm] = useState({
    escalateTo: 'owner',
    reason: '',
  });

  // Resolve Form
  const [resolveForm, setResolveForm] = useState({
    resolutionNotes: '',
  });

  // Remarks Form inside Dossier
  const [newRemark, setNewRemark] = useState('');
  const [addingRemark, setAddingRemark] = useState(false);

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
      const response = await api.getViolations({ limit: 'all' });
      const records = response.data || [];
      setViolations(records);
      if (response.stats) {
        setStats(response.stats);
      } else {
        calculateStats(records);
      }
    } catch (error: any) {
      console.error('Failed to load violations:', error);
      toast.error(error.message || 'Failed to load disciplinary records');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (records: ViolationRecord[]) => {
    setStats({
      total: records.length,
      pending: records.filter((v) => v.status === 'pending').length,
      investigating: records.filter((v) => v.status === 'investigating').length,
      actionTaken: records.filter((v) => v.status === 'action_taken').length,
      critical: records.filter((v) => v.severity === 'critical' && v.status !== 'resolved' && v.status !== 'closed').length,
      escalated: records.filter((v) => v.isEscalated || v.status === 'escalated').length,
      resolved: records.filter((v) => v.status === 'resolved' || v.status === 'closed').length,
    });
  };

  const loadStudents = async () => {
    try {
      const list = await api.getStudentsWithAttendance(user?.hostelId as string);
      setStudents(Array.isArray(list) ? list : []);
    } catch (e) {
      // Non-blocking
    }
  };

  // Open Dossier Drawer & Fetch Fresh Incident Record
  const openDossier = async (incident: ViolationRecord) => {
    setSelectedIncident(incident);
    setDossierModalOpen(true);
    try {
      const res = await api.getViolationDetails(incident._id);
      if (res?.data) {
        setSelectedIncident(res.data);
      }
    } catch (err) {
      console.error('Error fetching deep incident details:', err);
    }
  };

  // Record Incident Submit
  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.studentId) {
      toast.error('Please select the primary student involved');
      return;
    }
    if (!createForm.description.trim()) {
      toast.error('Incident description is required');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...createForm,
        fineAmount: Number(createForm.fineAmount) || 0,
        involvedStudents: involvedList.filter((s) => s.name.trim()),
        witnesses: witnessList.filter((w) => w.name.trim()),
        evidence: evidenceList.filter((ev) => ev.name.trim()),
        remarks: createForm.initialRemarks.trim() || undefined,
      };

      await api.createViolation(payload);
      toast.success('Disciplinary incident recorded successfully');
      setCreateModalOpen(false);
      resetCreateForm();
      loadViolations();
    } catch (error: any) {
      toast.error(error.message || 'Failed to record incident');
    } finally {
      setSubmitting(false);
    }
  };

  const resetCreateForm = () => {
    setCreateForm({
      studentId: '',
      title: '',
      violationType: 'late-entry',
      severity: 'low',
      description: '',
      incidentDate: new Date().toISOString().slice(0, 16),
      location: '',
      warningLevel: 'warning',
      fineAmount: 0,
      actionTaken: 'none',
      actionDetails: '',
      parentNotified: false,
      parentNotificationMethod: 'call',
      parentNotificationNotes: '',
      parentContactInfo: '',
      initialRemarks: '',
    });
    setInvolvedList([]);
    setWitnessList([]);
    setEvidenceList([]);
  };

  // Record Disciplinary Action Submit
  const handleRecordAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident) return;

    setSubmitting(true);
    try {
      await api.recordDisciplinaryAction(selectedIncident._id, {
        actionTaken: actionForm.actionTaken,
        actionDetails: actionForm.actionDetails,
        warningLevel: actionForm.warningLevel,
        fineAmount: Number(actionForm.fineAmount) || 0,
      });
      toast.success('Disciplinary action logged in student file');
      setActionModalOpen(false);
      loadViolations();
      if (dossierModalOpen) {
        const res = await api.getViolationDetails(selectedIncident._id);
        if (res?.data) setSelectedIncident(res.data);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to log disciplinary action');
    } finally {
      setSubmitting(false);
    }
  };

  // Record Parent Notification Submit
  const handleRecordParentNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident) return;

    setSubmitting(true);
    try {
      await api.recordParentNotification(selectedIncident._id, {
        method: parentForm.method,
        parentContactInfo: parentForm.parentContactInfo,
        notes: parentForm.notes,
      });
      toast.success('Parent communication recorded');
      setParentModalOpen(false);
      loadViolations();
      if (dossierModalOpen) {
        const res = await api.getViolationDetails(selectedIncident._id);
        if (res?.data) setSelectedIncident(res.data);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to log parent notification');
    } finally {
      setSubmitting(false);
    }
  };

  // Escalate Submit
  const handleEscalateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident) return;

    setSubmitting(true);
    try {
      await api.escalateViolation(selectedIncident._id, {
        escalateTo: escalateForm.escalateTo,
        reason: escalateForm.reason,
      });
      toast.success(`Incident escalated to ${escalateForm.escalateTo}`);
      setEscalateModalOpen(false);
      loadViolations();
      if (dossierModalOpen) {
        const res = await api.getViolationDetails(selectedIncident._id);
        if (res?.data) setSelectedIncident(res.data);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to escalate incident');
    } finally {
      setSubmitting(false);
    }
  };

  // Resolve Submit
  const handleResolveIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident) return;
    if (!resolveForm.resolutionNotes.trim()) {
      toast.error('Resolution notes are required to close case');
      return;
    }

    setSubmitting(true);
    try {
      await api.resolveViolation(selectedIncident._id, {
        resolutionNotes: resolveForm.resolutionNotes.trim(),
      });
      toast.success('Disciplinary case resolved and closed');
      setResolveModalOpen(false);
      setResolveForm({ resolutionNotes: '' });
      loadViolations();
      if (dossierModalOpen) {
        const res = await api.getViolationDetails(selectedIncident._id);
        if (res?.data) setSelectedIncident(res.data);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to resolve incident');
    } finally {
      setSubmitting(false);
    }
  };

  // Add Internal Remark inside Dossier
  const handleAddRemark = async () => {
    if (!selectedIncident || !newRemark.trim()) return;
    setAddingRemark(true);
    try {
      await api.addViolationRemark(selectedIncident._id, { comment: newRemark.trim() });
      toast.success('Inquiry remark appended');
      setNewRemark('');
      const res = await api.getViolationDetails(selectedIncident._id);
      if (res?.data) setSelectedIncident(res.data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to add remark');
    } finally {
      setAddingRemark(false);
    }
  };

  // Filtered List
  const filteredViolations = violations.filter((v) => {
    // Tab Filter
    if (activeTab === 'PENDING' && v.status !== 'pending' && v.status !== 'investigating') return false;
    if (activeTab === 'ACTION_TAKEN' && v.status !== 'action_taken') return false;
    if (activeTab === 'CRITICAL' && v.severity !== 'critical' && !v.isEscalated && v.status !== 'escalated') return false;
    if (activeTab === 'RESOLVED' && v.status !== 'resolved' && v.status !== 'closed') return false;

    // Severity Filter
    if (filterSeverity !== 'ALL' && (v.severity || 'low').toLowerCase() !== filterSeverity.toLowerCase()) {
      return false;
    }

    // Category Filter
    if (filterType !== 'ALL' && (v.violationType || '').toLowerCase() !== filterType.toLowerCase()) {
      return false;
    }

    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const sName = v.studentId?.name || '';
      const roll = v.studentId?.rollNumber || v.studentId?.studentId || '';
      const room = v.studentId?.roomId?.roomNumber || String(v.studentId?.roomId || '');
      const title = v.title || '';
      const desc = v.description || '';
      const loc = v.location || '';
      const vType = v.violationType || '';
      const match =
        sName.toLowerCase().includes(q) ||
        roll.toLowerCase().includes(q) ||
        room.toLowerCase().includes(q) ||
        title.toLowerCase().includes(q) ||
        desc.toLowerCase().includes(q) ||
        loc.toLowerCase().includes(q) ||
        vType.toLowerCase().includes(q);
      if (!match) return false;
    }

    return true;
  });

  // Severity UI helper
  const getSeverityBadge = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300 animate-pulse">
            <Flame className="w-3.5 h-3.5 text-red-600" />
            CRITICAL
          </span>
        );
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-800 border border-orange-300">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-600" />
            HIGH
          </span>
        );
      case 'medium':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
            MEDIUM
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            <Shield className="w-3.5 h-3.5 text-blue-500" />
            LOW
          </span>
        );
    }
  };

  // Status UI helper
  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'resolved':
      case 'closed':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            Resolved
          </span>
        );
      case 'escalated':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-300">
            Escalated
          </span>
        );
      case 'action_taken':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
            Action Taken
          </span>
        );
      case 'investigating':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-300">
            Investigating
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            Pending Action
          </span>
        );
    }
  };

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Discipline & Incident Registry</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Record infractions, conduct inquiries, enforce actions, notify parents, and log audit timelines.
              </p>
            </div>
          </div>
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
            onClick={() => {
              resetCreateForm();
              setCreateModalOpen(true);
            }}
            className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-sm transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Record Incident
          </button>
        </div>
      </div>

      {/* KPI Stats Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500">Total Records</p>
            <p className="text-xl font-bold text-gray-900">{stats.total}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500">Pending Action</p>
            <p className="text-xl font-bold text-amber-700">{stats.pending}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500">Action Taken</p>
            <p className="text-xl font-bold text-blue-700">{stats.actionTaken}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-700 flex items-center justify-center relative">
            <Flame className="w-5 h-5" />
            {stats.critical > 0 && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-600 rounded-full border-2 border-white animate-ping" />
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500">Critical / Escalated</p>
            <p className="text-xl font-bold text-red-600">{stats.critical + stats.escalated}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3 col-span-2 sm:col-span-1">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500">Resolved Archive</p>
            <p className="text-xl font-bold text-emerald-700">{stats.resolved}</p>
          </div>
        </div>
      </div>

      {/* Workflow Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { id: 'ALL', label: 'All Incidents', count: stats.total },
          { id: 'PENDING', label: 'Pending Inquiry', count: stats.pending },
          { id: 'ACTION_TAKEN', label: 'Action Taken', count: stats.actionTaken },
          { id: 'CRITICAL', label: 'Critical & Escalated', count: stats.critical + stats.escalated },
          { id: 'RESOLVED', label: 'Resolved Archive', count: stats.resolved },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-gray-900 text-white shadow-sm'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search student, room, roll ID, title, location, description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20"
          >
            <option value="ALL">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20"
          >
            <option value="ALL">All Categories</option>
            <option value="curfew">Curfew Breach</option>
            <option value="late-entry">Late Entry</option>
            <option value="unauthorized-visitor">Unauthorized Visitor</option>
            <option value="noise">Noise Disturbance</option>
            <option value="damage">Hostel Property Damage</option>
            <option value="substance">Substance Abuse</option>
            <option value="fighting">Physical Altercation</option>
            <option value="ragging">Ragging / Harassment</option>
            <option value="theft">Theft</option>
            <option value="misconduct">Misconduct</option>
            <option value="other">Other Infraction</option>
          </select>

          {(searchQuery || filterSeverity !== 'ALL' || filterType !== 'ALL') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterSeverity('ALL');
                setFilterType('ALL');
              }}
              className="text-xs text-gray-500 hover:text-gray-900 underline px-2 py-1"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Main Incident Card Listing */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-sm text-gray-500">Loading disciplinary registry...</p>
        </div>
      ) : filteredViolations.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">No Disciplinary Incidents Found</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
            {searchQuery || filterSeverity !== 'ALL' || filterType !== 'ALL'
              ? 'No incidents match your current filter parameters.'
              : 'The disciplinary registry for this hostel is clean.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredViolations.map((incident) => {
            const student = incident.studentId || {};
            const studentName = student.name || 'Student';
            const roomNumber = student.roomId?.roomNumber || student.roomNumber || student.roomId || 'Unassigned';
            const rollNumber = student.rollNumber || student.studentId || '';
            const isResolved = incident.status === 'resolved' || incident.status === 'closed';
            const isEscalated = incident.isEscalated || incident.status === 'escalated';

            return (
              <div
                key={incident._id}
                className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:border-gray-200 transition-all space-y-4"
              >
                {/* Top Row: Badges, Title, Timestamps */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getSeverityBadge(incident.severity)}
                    {getStatusBadge(incident.status)}
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide bg-gray-100 text-gray-700">
                      {incident.violationType?.replace(/-/g, ' ')}
                    </span>
                    {incident.warningLevel && incident.warningLevel !== 'warning' && (
                      <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        {incident.warningLevel.toUpperCase()} NOTICE
                      </span>
                    )}
                    {incident.fineAmount && incident.fineAmount > 0 && (
                      <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        <DollarSign className="w-3 h-3" /> ₹{incident.fineAmount} Fine
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      {incident.incidentDate
                        ? new Date(incident.incidentDate).toLocaleString('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })
                        : new Date(incident.createdAt).toLocaleDateString()}
                    </span>
                    {incident.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                        {incident.location}
                      </span>
                    )}
                  </div>
                </div>

                {/* Middle Row: Student Dossier & Incident Content */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-red-50 text-red-700 font-bold flex items-center justify-center text-sm border border-red-100">
                        {studentName.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                          {studentName}
                          <span className="text-xs font-medium text-gray-500">
                            (Room {roomNumber} {rollNumber ? `• ${rollNumber}` : ''})
                          </span>
                        </h3>
                        <p className="text-xs text-gray-400">
                          Primary Offender • Logged by: {incident.reportedBy?.name || 'Warden'}
                        </p>
                      </div>
                    </div>

                    {incident.title && (
                      <h4 className="text-sm font-bold text-gray-800 pt-1">{incident.title}</h4>
                    )}

                    <p className="text-sm text-gray-700 font-normal bg-gray-50 p-3 rounded-xl border border-gray-100 leading-relaxed">
                      {incident.description}
                    </p>

                    {/* Metadata tags */}
                    <div className="flex items-center gap-3 flex-wrap pt-1 text-xs text-gray-600">
                      {incident.involvedStudents && incident.involvedStudents.length > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-medium">
                          <Users className="w-3 h-3" />
                          {incident.involvedStudents.length} Other Involved Student(s)
                        </span>
                      )}
                      {incident.witnesses && incident.witnesses.length > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-teal-50 text-teal-700 font-medium">
                          <Eye className="w-3 h-3" />
                          {incident.witnesses.length} Witness(es)
                        </span>
                      )}
                      {incident.evidence && incident.evidence.length > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-50 text-purple-700 font-medium">
                          <Paperclip className="w-3 h-3" />
                          {incident.evidence.length} Evidence Attachment(s)
                        </span>
                      )}
                      {incident.parentNotified ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-medium">
                          <PhoneCall className="w-3 h-3" />
                          Parent Contacted ({incident.parentNotificationMethod || 'Call'})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 text-gray-600">
                          <Phone className="w-3 h-3 text-gray-400" />
                          Parent Not Contacted
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Disciplinary Action Banner if Action was Recorded */}
                {incident.actionTaken && incident.actionTaken !== 'none' && (
                  <div className="bg-blue-50/60 border border-blue-200/80 rounded-xl p-3 text-xs text-blue-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="font-bold uppercase tracking-wide text-blue-700 mr-2">
                        Formal Action Taken:
                      </span>
                      <span className="font-semibold">{incident.actionTaken.replace(/_/g, ' ').toUpperCase()}</span>
                      {incident.actionDetails && <span className="text-blue-800 ml-1.5">• {incident.actionDetails}</span>}
                    </div>
                    {incident.actionDate && (
                      <span className="text-blue-600 text-[11px] whitespace-nowrap">
                        Recorded on {new Date(incident.actionDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                )}

                {/* Escalation Banner if Escalated */}
                {isEscalated && (
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-xs text-purple-900 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ArrowUpRight className="w-4 h-4 text-purple-600 flex-shrink-0" />
                      <span>
                        <span className="font-bold">Escalated to {incident.escalatedTo?.toUpperCase() || 'MANAGEMENT'}:</span>{' '}
                        {incident.escalationReason || 'Case escalated for administrative decision'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Resolution Banner if Resolved */}
                {isResolved && incident.resolutionNotes && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>
                      <span className="font-bold">Case Closed:</span> {incident.resolutionNotes}
                    </span>
                  </div>
                )}

                {/* Bottom Row: Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100 flex-wrap gap-2">
                  <button
                    onClick={() => openDossier(incident)}
                    className="px-3.5 py-1.5 text-xs font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    <History className="w-3.5 h-3.5 text-gray-500" />
                    View Dossier & Timeline
                  </button>

                  <div className="flex items-center gap-2 flex-wrap">
                    {!incident.parentNotified && (
                      <button
                        onClick={() => {
                          setSelectedIncident(incident);
                          setParentForm({
                            method: 'call',
                            parentContactInfo: student.parentContact || '',
                            notes: '',
                          });
                          setParentModalOpen(true);
                        }}
                        className="px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-colors flex items-center gap-1"
                      >
                        <PhoneCall className="w-3.5 h-3.5" />
                        Notify Parent
                      </button>
                    )}

                    {!isResolved && (
                      <>
                        <button
                          onClick={() => {
                            setSelectedIncident(incident);
                            setActionForm({
                              actionTaken: incident.actionTaken || 'written_warning',
                              actionDetails: incident.actionDetails || '',
                              warningLevel: incident.warningLevel || 'first',
                              fineAmount: incident.fineAmount || 0,
                            });
                            setActionModalOpen(true);
                          }}
                          className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors flex items-center gap-1"
                        >
                          <Shield className="w-3.5 h-3.5" />
                          Record Action
                        </button>

                        {!isEscalated && (
                          <button
                            onClick={() => {
                              setSelectedIncident(incident);
                              setEscalateForm({ escalateTo: 'owner', reason: '' });
                              setEscalateModalOpen(true);
                            }}
                            className="px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition-colors flex items-center gap-1"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                            Escalate
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setSelectedIncident(incident);
                            setResolveForm({ resolutionNotes: '' });
                            setResolveModalOpen(true);
                          }}
                          className="px-3.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Resolve Case
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================= MODAL: RECORD DISCIPLINARY INCIDENT ================= */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-3 text-red-600">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Record Disciplinary Incident</h3>
                  <p className="text-xs text-gray-500">Log an infraction with witnesses, severity, and timeline</p>
                </div>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateIncident} className="space-y-4">
              {/* Primary Student Selection */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Primary Resident Involved *
                </label>
                <select
                  required
                  value={createForm.studentId}
                  onChange={(e) => {
                    const sid = e.target.value;
                    const found = students.find((s) => s._id === sid);
                    setCreateForm({
                      ...createForm,
                      studentId: sid,
                      parentContactInfo: found?.parentContact || '',
                    });
                  }}
                  className="w-full text-sm border border-gray-200 rounded-xl p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                >
                  <option value="">Select a student...</option>
                  {students.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} ({s.roomId ? `Room ${s.roomId}` : 'No room'}) • {s.rollNumber || s.email}
                    </option>
                  ))}
                </select>
              </div>

              {/* Title, Category & Severity */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Incident Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Corridor noise at 2 AM"
                    value={createForm.title}
                    onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                    className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Violation Category *
                  </label>
                  <select
                    value={createForm.violationType}
                    onChange={(e) => setCreateForm({ ...createForm, violationType: e.target.value })}
                    className="w-full text-sm border border-gray-200 rounded-xl p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  >
                    <option value="curfew">Curfew Breach</option>
                    <option value="late-entry">Late Entry</option>
                    <option value="unauthorized-visitor">Unauthorized Visitor</option>
                    <option value="noise">Noise Disturbance</option>
                    <option value="damage">Hostel Property Damage</option>
                    <option value="substance">Substance Abuse</option>
                    <option value="fighting">Physical Altercation</option>
                    <option value="ragging">Ragging / Harassment</option>
                    <option value="theft">Theft</option>
                    <option value="misconduct">Misconduct</option>
                    <option value="other">Other Infraction</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Severity Level *
                  </label>
                  <select
                    value={createForm.severity}
                    onChange={(e) => setCreateForm({ ...createForm, severity: e.target.value as any })}
                    className="w-full text-sm border border-gray-200 rounded-xl p-2.5 bg-white font-semibold focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  >
                    <option value="low">Low Severity</option>
                    <option value="medium">Medium Severity</option>
                    <option value="high">High Severity</option>
                    <option value="critical">Critical Severity</option>
                  </select>
                </div>
              </div>

              {/* Date/Time and Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Incident Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    value={createForm.incidentDate}
                    onChange={(e) => setCreateForm({ ...createForm, incidentDate: e.target.value })}
                    className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Location / Occurrence Spot
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Wing B 2nd Floor corridor, Room 204, Mess Hall"
                    value={createForm.location}
                    onChange={(e) => setCreateForm({ ...createForm, location: e.target.value })}
                    className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Incident Narrative & Description *
                </label>
                <textarea
                  required
                  rows={3}
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  placeholder="Detail the sequence of events, behavior observed, damages incurred..."
                  className="w-full text-sm border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 resize-none"
                />
              </div>

              {/* Other Involved Students Section */}
              <div className="border border-gray-200 rounded-xl p-3.5 space-y-2 bg-gray-50/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-indigo-600" />
                    Other Involved Students ({involvedList.length})
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setInvolvedList([
                        ...involvedList,
                        { name: '', rollNumber: '', roleInIncident: 'involved_party' },
                      ])
                    }
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    + Add Student
                  </button>
                </div>

                {involvedList.map((inv, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Student name"
                      value={inv.name}
                      onChange={(e) => {
                        const next = [...involvedList];
                        next[idx].name = e.target.value;
                        setInvolvedList(next);
                      }}
                      className="flex-1 text-xs border border-gray-200 rounded-lg p-2 bg-white"
                    />
                    <input
                      type="text"
                      placeholder="Roll/Room"
                      value={inv.rollNumber}
                      onChange={(e) => {
                        const next = [...involvedList];
                        next[idx].rollNumber = e.target.value;
                        setInvolvedList(next);
                      }}
                      className="w-24 text-xs border border-gray-200 rounded-lg p-2 bg-white"
                    />
                    <select
                      value={inv.roleInIncident}
                      onChange={(e) => {
                        const next = [...involvedList];
                        next[idx].roleInIncident = e.target.value as any;
                        setInvolvedList(next);
                      }}
                      className="text-xs border border-gray-200 rounded-lg p-2 bg-white"
                    >
                      <option value="involved_party">Involved</option>
                      <option value="accomplice">Accomplice</option>
                      <option value="instigator">Instigator</option>
                      <option value="bystander">Bystander</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => setInvolvedList(involvedList.filter((_, i) => i !== idx))}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Witnesses Section */}
              <div className="border border-gray-200 rounded-xl p-3.5 space-y-2 bg-gray-50/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-teal-600" />
                    Witnesses & Testimony ({witnessList.length})
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setWitnessList([
                        ...witnessList,
                        { name: '', contact: '', role: 'student', statement: '' },
                      ])
                    }
                    className="text-xs font-semibold text-teal-600 hover:text-teal-800"
                  >
                    + Add Witness
                  </button>
                </div>

                {witnessList.map((wit, idx) => (
                  <div key={idx} className="space-y-1.5 p-2 bg-white rounded-lg border border-gray-200">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Witness full name *"
                        value={wit.name}
                        onChange={(e) => {
                          const next = [...witnessList];
                          next[idx].name = e.target.value;
                          setWitnessList(next);
                        }}
                        className="flex-1 text-xs border border-gray-200 rounded-lg p-1.5"
                      />
                      <input
                        type="text"
                        placeholder="Contact phone"
                        value={wit.contact}
                        onChange={(e) => {
                          const next = [...witnessList];
                          next[idx].contact = e.target.value;
                          setWitnessList(next);
                        }}
                        className="w-32 text-xs border border-gray-200 rounded-lg p-1.5"
                      />
                      <select
                        value={wit.role}
                        onChange={(e) => {
                          const next = [...witnessList];
                          next[idx].role = e.target.value as any;
                          setWitnessList(next);
                        }}
                        className="text-xs border border-gray-200 rounded-lg p-1.5"
                      >
                        <option value="student">Student</option>
                        <option value="guard">Security Guard</option>
                        <option value="cleaning_staff">Cleaning Staff</option>
                        <option value="warden">Warden</option>
                        <option value="faculty">Faculty</option>
                        <option value="other">Other</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => setWitnessList(witnessList.filter((_, i) => i !== idx))}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Brief statement / testimony observed..."
                      value={wit.statement}
                      onChange={(e) => {
                        const next = [...witnessList];
                        next[idx].statement = e.target.value;
                        setWitnessList(next);
                      }}
                      className="w-full text-xs border border-gray-200 rounded-lg p-1.5"
                    />
                  </div>
                ))}
              </div>

              {/* Evidence Section */}
              <div className="border border-gray-200 rounded-xl p-3.5 space-y-2 bg-gray-50/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                    <Paperclip className="w-4 h-4 text-purple-600" />
                    Evidence / Attachments ({evidenceList.length})
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setEvidenceList([...evidenceList, { name: '', url: '', description: '' }])
                    }
                    className="text-xs font-semibold text-purple-600 hover:text-purple-800"
                  >
                    + Add Evidence Link
                  </button>
                </div>

                {evidenceList.map((ev, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Label (e.g. CCTV recording, Damage photo)"
                      value={ev.name}
                      onChange={(e) => {
                        const next = [...evidenceList];
                        next[idx].name = e.target.value;
                        setEvidenceList(next);
                      }}
                      className="flex-1 text-xs border border-gray-200 rounded-lg p-2 bg-white"
                    />
                    <input
                      type="text"
                      placeholder="Link / URL / Storage path"
                      value={ev.url}
                      onChange={(e) => {
                        const next = [...evidenceList];
                        next[idx].url = e.target.value;
                        setEvidenceList(next);
                      }}
                      className="flex-1 text-xs border border-gray-200 rounded-lg p-2 bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setEvidenceList(evidenceList.filter((_, i) => i !== idx))}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Action, Warning Level & Fine */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Warning Notice
                  </label>
                  <select
                    value={createForm.warningLevel}
                    onChange={(e) => setCreateForm({ ...createForm, warningLevel: e.target.value as any })}
                    className="w-full text-sm border border-gray-200 rounded-xl p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  >
                    <option value="warning">Verbal / First Warning</option>
                    <option value="first">Official First Notice</option>
                    <option value="second">Second Notice</option>
                    <option value="final">Final Notice</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Fine Assessment (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={createForm.fineAmount}
                    onChange={(e) => setCreateForm({ ...createForm, fineAmount: Number(e.target.value) || 0 })}
                    placeholder="0"
                    className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Initial Action Taken
                  </label>
                  <select
                    value={createForm.actionTaken}
                    onChange={(e) => setCreateForm({ ...createForm, actionTaken: e.target.value })}
                    className="w-full text-sm border border-gray-200 rounded-xl p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  >
                    <option value="none">None (Under Investigation)</option>
                    <option value="verbal_warning">Verbal Warning</option>
                    <option value="written_warning">Written Warning</option>
                    <option value="fine">Monetary Fine</option>
                    <option value="room_transfer">Room Transfer</option>
                    <option value="suspension">Hostel Suspension</option>
                    <option value="parent_summons">Parent Summons</option>
                    <option value="community_service">Community Service</option>
                    <option value="referred_to_committee">Referred to Committee</option>
                  </select>
                </div>
              </div>

              {/* Initial Remarks */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Confidential Warden Remarks (Internal Only)
                </label>
                <input
                  type="text"
                  placeholder="Confidential observations, background context..."
                  value={createForm.initialRemarks}
                  onChange={(e) => setCreateForm({ ...createForm, initialRemarks: e.target.value })}
                  className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                />
              </div>

              {/* Submit / Cancel Buttons */}
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
                  {submitting ? 'Recording Incident...' : 'Record Incident'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: RECORD DISCIPLINARY ACTION ================= */}
      {actionModalOpen && selectedIncident && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-blue-600 border-b border-gray-100 pb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Enforce Disciplinary Action</h3>
                <p className="text-xs text-gray-500">Student: {selectedIncident.studentId?.name || 'Resident'}</p>
              </div>
            </div>

            <form onSubmit={handleRecordAction} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Action Type *
                </label>
                <select
                  required
                  value={actionForm.actionTaken}
                  onChange={(e) => setActionForm({ ...actionForm, actionTaken: e.target.value })}
                  className="w-full text-sm border border-gray-200 rounded-xl p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="verbal_warning">Verbal Warning</option>
                  <option value="written_warning">Written Formal Warning</option>
                  <option value="fine">Monetary Fine</option>
                  <option value="room_transfer">Forced Room Transfer</option>
                  <option value="suspension">Hostel Suspension</option>
                  <option value="parent_summons">Parent / Guardian Summons</option>
                  <option value="community_service">Hostel Community Service</option>
                  <option value="referred_to_committee">Disciplinary Committee Referral</option>
                  <option value="other">Other Directive</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Warning Level
                  </label>
                  <select
                    value={actionForm.warningLevel}
                    onChange={(e) => setActionForm({ ...actionForm, warningLevel: e.target.value })}
                    className="w-full text-sm border border-gray-200 rounded-xl p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="warning">First Warning</option>
                    <option value="first">Official Notice 1</option>
                    <option value="second">Official Notice 2</option>
                    <option value="final">Final Notice</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Fine Amount (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={actionForm.fineAmount}
                    onChange={(e) => setActionForm({ ...actionForm, fineAmount: Number(e.target.value) || 0 })}
                    placeholder="0"
                    className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Action Directive & Conditions
                </label>
                <textarea
                  rows={3}
                  value={actionForm.actionDetails}
                  onChange={(e) => setActionForm({ ...actionForm, actionDetails: e.target.value })}
                  placeholder="Terms of action, payment deadline, community tasks assigned..."
                  className="w-full text-sm border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActionModalOpen(false)}
                  className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
                >
                  {submitting ? 'Recording...' : 'Record Action'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: PARENT NOTIFICATION ================= */}
      {parentModalOpen && selectedIncident && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-amber-600 border-b border-gray-100 pb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                <PhoneCall className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Notify Parent / Guardian</h3>
                <p className="text-xs text-gray-500">Student: {selectedIncident.studentId?.name || 'Resident'}</p>
              </div>
            </div>

            <form onSubmit={handleRecordParentNotification} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Communication Method *
                </label>
                <select
                  value={parentForm.method}
                  onChange={(e) => setParentForm({ ...parentForm, method: e.target.value })}
                  className="w-full text-sm border border-gray-200 rounded-xl p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                >
                  <option value="call">Phone Call (Direct)</option>
                  <option value="sms">SMS Text Message</option>
                  <option value="whatsapp">WhatsApp Message</option>
                  <option value="email">Official Email Notice</option>
                  <option value="in_person">In-Person Meeting in Warden Office</option>
                  <option value="official_letter">Postal Registered Letter</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Parent / Guardian Contact Number
                </label>
                <input
                  type="text"
                  value={parentForm.parentContactInfo}
                  onChange={(e) => setParentForm({ ...parentForm, parentContactInfo: e.target.value })}
                  placeholder="e.g. +91 9876543210"
                  className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Communication Details & Parent Response
                </label>
                <textarea
                  rows={3}
                  value={parentForm.notes}
                  onChange={(e) => setParentForm({ ...parentForm, notes: e.target.value })}
                  placeholder="Spoke with student's mother, explained curfew violation, mother committed to speaking with student..."
                  className="w-full text-sm border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-amber-500/20 resize-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setParentModalOpen(false)}
                  className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
                >
                  {submitting ? 'Logging...' : 'Log Parent Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: ESCALATE ================= */}
      {escalateModalOpen && selectedIncident && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-purple-600 border-b border-gray-100 pb-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                <ArrowUpRight className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Escalate Disciplinary Matter</h3>
                <p className="text-xs text-gray-500">Route to higher management or disciplinary council</p>
              </div>
            </div>

            <form onSubmit={handleEscalateIncident} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Escalate To *
                </label>
                <select
                  value={escalateForm.escalateTo}
                  onChange={(e) => setEscalateForm({ ...escalateForm, escalateTo: e.target.value })}
                  className="w-full text-sm border border-gray-200 rounded-xl p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                >
                  <option value="owner">Hostel Owner / Managing Director</option>
                  <option value="management">Hostel Management Board</option>
                  <option value="committee">Disciplinary Committee</option>
                  <option value="parent">Parental Direct Escalation</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Reason for Escalation
                </label>
                <textarea
                  rows={3}
                  value={escalateForm.reason}
                  onChange={(e) => setEscalateForm({ ...escalateForm, reason: e.target.value })}
                  placeholder="Explain severity, uncooperative behavior, repeated offenses requiring formal intervention..."
                  className="w-full text-sm border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-purple-500/20 resize-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-purple-50/70 text-purple-900 text-xs flex items-start gap-2">
                <AlertOctagon className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                <span>
                  Escalating this incident automatically elevates its severity to <strong>CRITICAL</strong> and
                  dispatches an alert to administrators.
                </span>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEscalateModalOpen(false)}
                  className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
                >
                  {submitting ? 'Escalating...' : 'Confirm Escalation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: RESOLVE INCIDENT ================= */}
      {resolveModalOpen && selectedIncident && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-emerald-600 border-b border-gray-100 pb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Resolve & Close Incident</h3>
                <p className="text-xs text-gray-500">Record final closure terms and resolution notes</p>
              </div>
            </div>

            <form onSubmit={handleResolveIncident} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Resolution Notes (Mandatory) *
                </label>
                <textarea
                  required
                  rows={4}
                  value={resolveForm.resolutionNotes}
                  onChange={(e) => setResolveForm({ ...resolveForm, resolutionNotes: e.target.value })}
                  placeholder="Student paid fine, submitted formal apology, completed required community tasks, matter closed..."
                  className="w-full text-sm border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResolveModalOpen(false)}
                  className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
                >
                  {submitting ? 'Closing Case...' : 'Mark as Resolved'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= FULL DOSSIER & ACTION TIMELINE DRAWER ================= */}
      {dossierModalOpen && selectedIncident && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {getSeverityBadge(selectedIncident.severity)}
                  {getStatusBadge(selectedIncident.status)}
                  <span className="text-xs text-gray-500 font-mono">ID: {selectedIncident._id.slice(-6)}</span>
                </div>
                <h2 className="text-lg font-bold text-gray-900">
                  {selectedIncident.title || `${selectedIncident.violationType?.toUpperCase()} Incident`}
                </h2>
              </div>
              <button
                onClick={() => setDossierModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Resident Dossier Card */}
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200/70 space-y-3">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-4 h-4 text-gray-600" />
                  Primary Offender Profile
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-gray-400">Full Name:</span>
                    <p className="font-bold text-gray-900">{selectedIncident.studentId?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Assigned Room:</span>
                    <p className="font-semibold text-gray-900">
                      Room {selectedIncident.studentId?.roomId?.roomNumber || selectedIncident.studentId?.roomId || 'Unassigned'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-400">Roll / Student ID:</span>
                    <p className="font-semibold text-gray-900">
                      {selectedIncident.studentId?.rollNumber || selectedIncident.studentId?.studentId || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-400">Phone:</span>
                    <p className="font-semibold text-gray-900">{selectedIncident.studentId?.phone || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Parent / Guardian:</span>
                    <p className="font-semibold text-gray-900">
                      {selectedIncident.studentId?.parentName || selectedIncident.studentId?.guardianName || 'Guardian'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-400">Parent Contact:</span>
                    <p className="font-semibold text-gray-900">
                      {selectedIncident.parentContactInfo || selectedIncident.studentId?.parentContact || selectedIncident.studentId?.guardianPhone || 'Not on file'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Incident Details & Narrative */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-gray-600" />
                  Incident Narrative
                </h4>
                <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200/70 text-xs text-gray-800 space-y-2 leading-relaxed">
                  <p className="font-medium text-gray-900">{selectedIncident.description}</p>
                  <div className="flex items-center gap-4 text-gray-500 pt-2 border-t border-gray-200/50">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {selectedIncident.incidentDate
                        ? new Date(selectedIncident.incidentDate).toLocaleString('en-IN')
                        : 'N/A'}
                    </span>
                    {selectedIncident.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {selectedIncident.location}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Involved Students */}
              {selectedIncident.involvedStudents && selectedIncident.involvedStudents.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-indigo-600" />
                    Other Involved Residents ({selectedIncident.involvedStudents.length})
                  </h4>
                  <div className="space-y-1.5">
                    {selectedIncident.involvedStudents.map((inv, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-indigo-50/50 border border-indigo-100 flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-bold text-gray-900">{inv.name}</span>
                          {inv.rollNumber && <span className="text-gray-500 ml-1.5">• {inv.rollNumber}</span>}
                        </div>
                        <span className="px-2 py-0.5 rounded-md font-semibold text-[11px] uppercase bg-indigo-100 text-indigo-800">
                          {inv.roleInIncident?.replace(/_/g, ' ') || 'Involved'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Witnesses & Testimony */}
              {selectedIncident.witnesses && selectedIncident.witnesses.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-teal-600" />
                    Witness Accounts & Statements ({selectedIncident.witnesses.length})
                  </h4>
                  <div className="space-y-2">
                    {selectedIncident.witnesses.map((wit, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-teal-50/50 border border-teal-100 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-gray-900">{wit.name}</span>
                          <span className="text-[11px] font-medium text-teal-800 uppercase px-2 py-0.5 rounded bg-teal-100">
                            {wit.role || 'Witness'}
                          </span>
                        </div>
                        {wit.contact && <p className="text-[11px] text-gray-500">Contact: {wit.contact}</p>}
                        {wit.statement && (
                          <p className="text-gray-700 italic pt-1 border-t border-teal-100/60 font-serif">
                            "{wit.statement}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Evidence & Attachments */}
              {selectedIncident.evidence && selectedIncident.evidence.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Paperclip className="w-4 h-4 text-purple-600" />
                    Evidence Files & Links ({selectedIncident.evidence.length})
                  </h4>
                  <div className="space-y-1.5">
                    {selectedIncident.evidence.map((ev, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-purple-50/50 border border-purple-100 flex items-center justify-between text-xs"
                      >
                        <span className="font-bold text-gray-900">{ev.name}</span>
                        {ev.url && (
                          <a
                            href={ev.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-purple-600 hover:text-purple-800 font-semibold underline text-[11px]"
                          >
                            Open Link
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Disciplinary Action Section */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-blue-600" />
                  Disciplinary Action Record
                </h4>
                <div className="p-3.5 rounded-xl bg-blue-50/50 border border-blue-100 text-xs space-y-2">
                  {selectedIncident.actionTaken && selectedIncident.actionTaken !== 'none' ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-blue-900 uppercase">
                          {selectedIncident.actionTaken.replace(/_/g, ' ')}
                        </span>
                        {selectedIncident.fineAmount ? (
                          <span className="font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                            Fine: ₹{selectedIncident.fineAmount}
                          </span>
                        ) : null}
                      </div>
                      {selectedIncident.actionDetails && (
                        <p className="text-gray-700">{selectedIncident.actionDetails}</p>
                      )}
                      {selectedIncident.actionDate && (
                        <p className="text-[11px] text-gray-400">
                          Recorded on {new Date(selectedIncident.actionDate).toLocaleString('en-IN')}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-gray-500 italic">No formal disciplinary action registered yet.</p>
                  )}
                </div>
              </div>

              {/* Parent Notification Status */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <PhoneCall className="w-4 h-4 text-amber-600" />
                  Parent / Guardian Communication
                </h4>
                <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-100 text-xs space-y-1.5">
                  {selectedIncident.parentNotified ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-900">
                          Contacted via {selectedIncident.parentNotificationMethod?.toUpperCase() || 'CALL'}
                        </span>
                        {selectedIncident.parentNotifiedAt && (
                          <span className="text-amber-700 text-[11px]">
                            {new Date(selectedIncident.parentNotifiedAt).toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                      {selectedIncident.parentNotificationNotes && (
                        <p className="text-gray-700">{selectedIncident.parentNotificationNotes}</p>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 italic">Parents have not been formally contacted yet.</span>
                      <button
                        onClick={() => {
                          setParentForm({
                            method: 'call',
                            parentContactInfo:
                              selectedIncident.parentContactInfo ||
                              selectedIncident.studentId?.parentContact ||
                              '',
                            notes: '',
                          });
                          setParentModalOpen(true);
                        }}
                        className="text-xs font-bold text-amber-700 hover:text-amber-900 underline"
                      >
                        Contact Parent Now
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Internal Remarks Thread */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-gray-600" />
                  Internal Inquiry Remarks ({selectedIncident.remarks?.length || 0})
                </h4>

                <div className="space-y-2">
                  {selectedIncident.remarks && selectedIncident.remarks.length > 0 ? (
                    selectedIncident.remarks.map((r, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-gray-50 border border-gray-200/70 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-gray-900">{r.authorName || 'Warden'}</span>
                          <span className="text-[10px] text-gray-400">
                            {new Date(r.createdAt).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <p className="text-gray-700">{r.comment}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-400 italic">No confidential remarks recorded yet.</p>
                  )}

                  {/* Add Remark Input */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Add inquiry note or observation..."
                      value={newRemark}
                      onChange={(e) => setNewRemark(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddRemark();
                        }
                      }}
                      className="flex-1 text-xs border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-gray-400"
                    />
                    <button
                      onClick={handleAddRemark}
                      disabled={addingRemark || !newRemark.trim()}
                      className="px-4 py-2.5 bg-gray-900 hover:bg-black text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Post
                    </button>
                  </div>
                </div>
              </div>

              {/* Complete Chronological Timeline */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-4 h-4 text-gray-600" />
                  Chronological Action & Audit Timeline
                </h4>

                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                  {selectedIncident.timeline && selectedIncident.timeline.length > 0 ? (
                    selectedIncident.timeline.map((item, idx) => (
                      <div key={idx} className="relative text-xs">
                        <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-white border-2 border-red-500 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-gray-900 capitalize">
                              {item.action.replace(/_/g, ' ')}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {new Date(item.timestamp).toLocaleString('en-IN')}
                            </span>
                          </div>
                          {item.performedByName && (
                            <p className="text-[11px] text-gray-500">By: {item.performedByName}</p>
                          )}
                          {item.notes && <p className="text-gray-700 font-medium pt-0.5">{item.notes}</p>}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-400 italic">Timeline will populate as actions are taken.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between gap-3">
              <button
                onClick={() => setDossierModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-gray-600 hover:text-gray-800"
              >
                Close Dossier
              </button>

              <div className="flex items-center gap-2">
                {selectedIncident.status !== 'resolved' && (
                  <>
                    <button
                      onClick={() => {
                        setActionForm({
                          actionTaken: selectedIncident.actionTaken || 'written_warning',
                          actionDetails: selectedIncident.actionDetails || '',
                          warningLevel: selectedIncident.warningLevel || 'first',
                          fineAmount: selectedIncident.fineAmount || 0,
                        });
                        setActionModalOpen(true);
                      }}
                      className="px-3.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition-colors"
                    >
                      Enforce Action
                    </button>
                    <button
                      onClick={() => {
                        setResolveForm({ resolutionNotes: '' });
                        setResolveModalOpen(true);
                      }}
                      className="px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition-colors"
                    >
                      Resolve Case
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
