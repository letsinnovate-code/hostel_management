'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import {
  UserCheck,
  Search,
  Filter,
  RefreshCw,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldAlert,
  Users,
  Building,
  Layers,
  ArrowUpDown,
  History,
  Info,
  Phone,
  MessageSquare,
  Sparkles,
  Save,
  Check,
  X,
  FileText,
  AlertCircle,
  ArrowRight,
  UserX,
} from 'lucide-react';

interface StudentData {
  _id: string;
  name: string;
  studentId: string;
  email?: string;
  phone?: string;
  profileImage?: string;
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
  room?: {
    _id: string;
    roomNumber: string;
    floorNumber: number;
  } | null;
  course?: string;
  year?: string;
}

interface AttendanceItem {
  student: StudentData;
  attendanceId: string | null;
  attendanceStatus: 'present' | 'absent' | 'late' | 'on-leave' | 'unmarked';
  isLate: boolean;
  remarks: string;
  markedBy?: { _id: string; name: string; role?: string } | null;
  lastEditedBy?: { _id: string; name: string; role?: string } | null;
  lastEditedAt?: string | null;
  editReason?: string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  isOnLeave: boolean;
  leaveDetails?: {
    reason?: string;
    returnDate?: string;
    permissionType?: string;
  } | null;
  thirtyDayStats: {
    totalMarkedDays: number;
    presentCount: number;
    absentCount: number;
    lateCount: number;
    percentage: number;
  };
}

interface SheetStats {
  totalStudents: number;
  markedCount: number;
  unmarkedCount: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  onLeaveCount: number;
  presentPercentage: number;
}

interface Facets {
  floors: number[];
  rooms: string[];
  courses: string[];
}

export default function WardenAttendancePage() {
  const { user } = useAuth();

  // Primary state
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [todayStr, setTodayStr] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [isHistorical, setIsHistorical] = useState(false);

  // Data states
  const [attendanceList, setAttendanceList] = useState<AttendanceItem[]>([]);
  const [stats, setStats] = useState<SheetStats>({
    totalStudents: 0,
    markedCount: 0,
    unmarkedCount: 0,
    presentCount: 0,
    lateCount: 0,
    absentCount: 0,
    onLeaveCount: 0,
    presentPercentage: 0,
  });
  const [facets, setFacets] = useState<Facets>({ floors: [], rooms: [], courses: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedFloor, setSelectedFloor] = useState<string>('all');
  const [selectedRoom, setSelectedRoom] = useState<string>('all');
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Staged inline changes: Map of studentId -> { attendanceStatus, isLate, remarks }
  const [stagedChanges, setStagedChanges] = useState<
    Record<string, { attendanceStatus: 'present' | 'absent' | 'late' | 'on-leave' | 'unmarked'; isLate: boolean; remarks: string }>
  >({});
  const [savingBatch, setSavingBatch] = useState(false);

  // Edit History / Single Modal
  const [editModal, setEditModal] = useState<{
    open: boolean;
    item: AttendanceItem | null;
    targetStatus: 'present' | 'absent' | 'late' | 'on-leave';
    remarks: string;
    editReason: string;
    loading: boolean;
  }>({
    open: false,
    item: null,
    targetStatus: 'present',
    remarks: '',
    editReason: '',
    loading: false,
  });

  // Bulk Edit Rationale Modal (for historical or overwrite bulk submissions)
  const [bulkRationaleModal, setBulkRationaleModal] = useState<{
    open: boolean;
    records: Array<{ studentId: string; attendanceStatus: 'present' | 'absent' | 'late' | 'on-leave'; isLate: boolean; remarks: string }>;
    editReason: string;
    loading: boolean;
  }>({
    open: false,
    records: [],
    editReason: '',
    loading: false,
  });

  // Frequent Absences / Analytics Modal
  const [analyticsModal, setAnalyticsModal] = useState<{
    open: boolean;
    loading: boolean;
    data: any | null;
  }>({
    open: false,
    loading: false,
    data: null,
  });

  // Student Attendance History Drawer
  const [historyDrawer, setHistoryDrawer] = useState<{
    open: boolean;
    student: StudentData | null;
    stats: any;
    records: any[];
    loading: boolean;
  }>({
    open: false,
    student: null,
    stats: null,
    records: [],
    loading: false,
  });

  // Load attendance sheet from server
  const loadAttendanceSheet = useCallback(
    async (targetDate = selectedDate, isSilent = false) => {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      try {
        const res = await api.getWardenAttendanceSheet({
          date: targetDate,
        });

        if (res?.success) {
          setAttendanceList(res.data || []);
          if (res.stats) setStats(res.stats);
          if (res.facets) setFacets(res.facets);
          if (res.today) setTodayStr(res.today);
          setIsHistorical(!!res.isHistorical);
          // Clear staged changes when reloading clean sheet
          setStagedChanges({});
        } else {
          toast.error(res?.message || 'Failed to load attendance');
        }
      } catch (error: any) {
        console.error('Failed to load attendance sheet:', error);
        toast.error(error?.response?.data?.message || error.message || 'Error loading attendance sheet');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedDate]
  );

  useEffect(() => {
    loadAttendanceSheet(selectedDate);
  }, [selectedDate, loadAttendanceSheet]);

  // Handle Date Stepping
  const handleDateChange = (newDate: string) => {
    if (newDate > todayStr) {
      toast.error('Cannot mark or view attendance for future dates');
      return;
    }
    setSelectedDate(newDate);
  };

  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    handleDateChange(d.toISOString().slice(0, 10));
  };

  const handleNextDay = () => {
    if (selectedDate >= todayStr) return;
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    const nextStr = d.toISOString().slice(0, 10);
    if (nextStr <= todayStr) {
      handleDateChange(nextStr);
    }
  };

  const handleToday = () => {
    handleDateChange(todayStr);
  };

  // Filter and Search
  const filteredList = useMemo(() => {
    return attendanceList.filter((item) => {
      // Search
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchesName = item.student.name.toLowerCase().includes(q);
        const matchesId = (item.student.studentId || '').toLowerCase().includes(q);
        const matchesRoom = (item.student.room?.roomNumber || '').toLowerCase().includes(q);
        const matchesPhone = (item.student.phone || '').includes(q);
        if (!matchesName && !matchesId && !matchesRoom && !matchesPhone) return false;
      }

      // Floor
      if (selectedFloor !== 'all') {
        const fNum = parseInt(selectedFloor, 10);
        if (item.student.room?.floorNumber !== fNum) return false;
      }

      // Room
      if (selectedRoom !== 'all') {
        if (item.student.room?.roomNumber !== selectedRoom) return false;
      }

      // Course
      if (selectedCourse !== 'all') {
        if ((item.student.course || '').toLowerCase() !== selectedCourse.toLowerCase()) return false;
      }

      // Status
      if (selectedStatus !== 'all') {
        const currentEffectiveStatus = stagedChanges[item.student._id]?.attendanceStatus || item.attendanceStatus;
        if (currentEffectiveStatus !== selectedStatus) return false;
      }

      return true;
    });
  }, [attendanceList, search, selectedFloor, selectedRoom, selectedCourse, selectedStatus, stagedChanges]);

  // Stage inline status toggle for a student
  const handleStageStatus = (
    item: AttendanceItem,
    targetStatus: 'present' | 'absent' | 'late' | 'on-leave'
  ) => {
    // If viewing historical attendance, or changing an already saved record, open the audit rationale modal
    if (isHistorical || (item.attendanceId && item.attendanceStatus !== 'unmarked')) {
      setEditModal({
        open: true,
        item,
        targetStatus,
        remarks: item.remarks || '',
        editReason: '',
        loading: false,
      });
      return;
    }

    // Direct stage for current day unmarked student
    const isLate = targetStatus === 'late';
    setStagedChanges((prev) => ({
      ...prev,
      [item.student._id]: {
        attendanceStatus: targetStatus,
        isLate,
        remarks: prev[item.student._id]?.remarks || item.remarks || '',
      },
    }));
  };

  // Inline remarks update for staged record
  const handleStageRemarks = (studentId: string, remarks: string, currentItem: AttendanceItem) => {
    const existingStaged = stagedChanges[studentId];
    const currentStatus = existingStaged?.attendanceStatus || (currentItem.attendanceStatus === 'unmarked' ? 'present' : currentItem.attendanceStatus);
    const isLate = existingStaged?.isLate ?? (currentStatus === 'late');

    setStagedChanges((prev) => ({
      ...prev,
      [studentId]: {
        attendanceStatus: currentStatus as any,
        isLate,
        remarks,
      },
    }));
  };

  // Quick Action: Stage all unmarked as Present
  const handleMarkAllUnmarkedPresent = () => {
    const newStaged = { ...stagedChanges };
    let count = 0;

    filteredList.forEach((item) => {
      const currentStatus = stagedChanges[item.student._id]?.attendanceStatus || item.attendanceStatus;
      if (currentStatus === 'unmarked') {
        newStaged[item.student._id] = {
          attendanceStatus: 'present',
          isLate: false,
          remarks: item.remarks || '',
        };
        count++;
      }
    });

    if (count === 0) {
      toast('No unmarked students in current view', { icon: 'ℹ️' });
      return;
    }

    setStagedChanges(newStaged);
    toast.success(`Staged ${count} unmarked students as Present. Click "Save Attendance" to apply.`);
  };

  // Quick Action: Stage all in view as Present
  const handleMarkAllFilteredPresent = () => {
    const newStaged = { ...stagedChanges };
    let count = 0;

    filteredList.forEach((item) => {
      // Don't overwrite students explicitly on leave unless warden chooses
      if (item.isOnLeave) return;

      newStaged[item.student._id] = {
        attendanceStatus: 'present',
        isLate: false,
        remarks: item.remarks || '',
      };
      count++;
    });

    setStagedChanges(newStaged);
    toast.success(`Staged ${count} students as Present. Click "Save Attendance" to apply.`);
  };

  // Commit Staged Batch
  const handleSaveStagedBatch = async () => {
    const entries = Object.entries(stagedChanges);
    if (entries.length === 0) {
      toast.error('No changes staged');
      return;
    }

    const records = entries
      .filter(([, data]) => data.attendanceStatus !== 'unmarked')
      .map(([studentId, data]) => ({
        studentId,
        attendanceStatus: data.attendanceStatus as 'present' | 'absent' | 'late' | 'on-leave',
        isLate: data.isLate,
        remarks: data.remarks,
      }));

    // If historical date, or if any record was already existing, we require an edit reason
    const anyExistingOrHistorical =
      isHistorical ||
      records.some((r) => {
        const item = attendanceList.find((a) => a.student._id === r.studentId);
        return item && item.attendanceId && item.attendanceStatus !== 'unmarked';
      });

    if (anyExistingOrHistorical) {
      setBulkRationaleModal({
        open: true,
        records,
        editReason: '',
        loading: false,
      });
      return;
    }

    // Direct submit
    setSavingBatch(true);
    try {
      const res = await api.bulkMarkWardenAttendance({
        records,
        date: selectedDate,
      });

      if (res?.success) {
        toast.success(res.message || 'Attendance saved successfully!');
        setStagedChanges({});
        await loadAttendanceSheet(selectedDate, true);
      } else {
        toast.error(res?.message || 'Failed to save attendance');
      }
    } catch (error: any) {
      console.error('Error in saving batch attendance:', error);
      toast.error(error?.response?.data?.message || error.message || 'Failed to save attendance');
    } finally {
      setSavingBatch(false);
    }
  };

  // Submit Bulk with Rationale (for historical / overwrites)
  const handleSubmitBulkWithRationale = async () => {
    if (!bulkRationaleModal.editReason || bulkRationaleModal.editReason.trim().length < 3) {
      toast.error('Please enter a valid rationale (minimum 3 characters)');
      return;
    }

    setBulkRationaleModal((prev) => ({ ...prev, loading: true }));
    try {
      const res = await api.bulkMarkWardenAttendance({
        records: bulkRationaleModal.records,
        date: selectedDate,
        editReason: bulkRationaleModal.editReason.trim(),
      });

      if (res?.success) {
        toast.success(res.message || 'Attendance records updated with audit trail');
        setBulkRationaleModal({ open: false, records: [], editReason: '', loading: false });
        setStagedChanges({});
        await loadAttendanceSheet(selectedDate, true);
      } else {
        toast.error(res?.message || 'Failed to update attendance');
      }
    } catch (error: any) {
      console.error('Error submitting bulk with rationale:', error);
      toast.error(error?.response?.data?.message || error.message || 'Failed to update attendance');
    } finally {
      setBulkRationaleModal((prev) => ({ ...prev, loading: false }));
    }
  };

  // Submit Single Edit Modal
  const handleSubmitSingleEdit = async () => {
    if (!editModal.item) return;

    if (!editModal.editReason || editModal.editReason.trim().length < 3) {
      toast.error('Audit rationale is required (minimum 3 characters)');
      return;
    }

    setEditModal((prev) => ({ ...prev, loading: true }));
    try {
      const res = await api.markWardenSingleAttendance({
        studentId: editModal.item.student._id,
        attendanceStatus: editModal.targetStatus,
        isLate: editModal.targetStatus === 'late',
        remarks: editModal.remarks,
        date: selectedDate,
        editReason: editModal.editReason.trim(),
      });

      if (res?.success) {
        toast.success('Attendance updated successfully with audit trail');
        setEditModal({ open: false, item: null, targetStatus: 'present', remarks: '', editReason: '', loading: false });
        await loadAttendanceSheet(selectedDate, true);
      } else {
        toast.error(res?.message || 'Failed to update attendance');
      }
    } catch (error: any) {
      console.error('Failed to submit single attendance edit:', error);
      toast.error(error?.response?.data?.message || error.message || 'Failed to update attendance');
    } finally {
      setEditModal((prev) => ({ ...prev, loading: false }));
    }
  };

  // Open Frequent Absences & Defaulters Analytics
  const handleOpenAnalytics = async () => {
    setAnalyticsModal({ open: true, loading: true, data: null });
    try {
      const res = await api.getWardenAttendanceAnalytics({
        days: 30,
        threshold: 3,
        lowPercentageThreshold: 75,
      });

      if (res?.success) {
        setAnalyticsModal({ open: true, loading: false, data: res });
      } else {
        toast.error(res?.message || 'Failed to load analytics');
        setAnalyticsModal((prev) => ({ ...prev, loading: false }));
      }
    } catch (error: any) {
      console.error('Failed to load attendance analytics:', error);
      toast.error('Error fetching analytics');
      setAnalyticsModal((prev) => ({ ...prev, loading: false }));
    }
  };

  // Open Student History Drawer
  const handleOpenStudentHistory = async (student: StudentData) => {
    setHistoryDrawer({ open: true, student, stats: null, records: [], loading: true });
    try {
      const res = await api.getWardenStudentAttendanceHistory(student._id);
      if (res?.success) {
        setHistoryDrawer({
          open: true,
          student,
          stats: res.stats,
          records: res.records || [],
          loading: false,
        });
      } else {
        toast.error(res?.message || 'Failed to load student history');
        setHistoryDrawer((prev) => ({ ...prev, loading: false }));
      }
    } catch (error: any) {
      console.error('Error loading student attendance history:', error);
      toast.error('Error loading history');
      setHistoryDrawer((prev) => ({ ...prev, loading: false }));
    }
  };

  // Export Attendance to CSV
  const handleExportCSV = async () => {
    try {
      toast.loading('Generating attendance CSV...', { id: 'csv-export' });
      const blob = await api.exportWardenAttendanceCSV({
        date: selectedDate,
        roomId: selectedRoom !== 'all' ? selectedRoom : undefined,
        floor: selectedFloor !== 'all' ? selectedFloor : undefined,
        course: selectedCourse !== 'all' ? selectedCourse : undefined,
        status: selectedStatus !== 'all' ? selectedStatus : undefined,
      });

      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `hostel_attendance_${selectedDate}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      toast.success('Attendance CSV downloaded successfully', { id: 'csv-export' });
    } catch (error: any) {
      console.error('Export CSV failed:', error);
      toast.error('Failed to export CSV report', { id: 'csv-export' });
    }
  };

  const stagedCount = Object.keys(stagedChanges).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
      {/* Header & Date Bar */}
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20">
                <div className="h-full w-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                  <UserCheck className="h-6 w-6 text-emerald-400" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
                  Warden Attendance Management
                </h1>
                <p className="text-sm text-slate-400">
                  Daily roll call, multi-filter staging, instant audit logging, and defaulter tracking
                </p>
              </div>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              onClick={() => loadAttendanceSheet(selectedDate, true)}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition"
              title="Refresh Sheet"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-emerald-400' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              onClick={handleOpenAnalytics}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-950/60 border border-indigo-700/50 text-sm font-medium text-indigo-300 hover:text-white hover:bg-indigo-900/60 transition shadow-sm"
            >
              <ShieldAlert className="h-4 w-4 text-indigo-400" />
              <span>Frequent Absences</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-sm font-medium text-slate-200 hover:text-white hover:bg-slate-800 transition shadow-sm"
            >
              <Download className="h-4 w-4 text-emerald-400" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Date Selector Navigation Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl backdrop-blur-md">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Previous / Today / Next Controls */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={handlePrevDay}
                className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 text-slate-200 hover:text-white transition"
                title="Previous Day"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <button
                onClick={handleToday}
                className={`px-3.5 py-2 rounded-xl text-sm font-medium transition border ${
                  selectedDate === todayStr
                    ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                    : 'bg-slate-800/80 text-slate-300 border-slate-700/60 hover:bg-slate-700 hover:text-white'
                }`}
              >
                Today
              </button>

              <button
                onClick={handleNextDay}
                disabled={selectedDate >= todayStr}
                className={`p-2.5 rounded-xl border transition ${
                  selectedDate >= todayStr
                    ? 'bg-slate-900 text-slate-600 border-slate-800/50 cursor-not-allowed'
                    : 'bg-slate-800/80 hover:bg-slate-700 border-slate-700/60 text-slate-200 hover:text-white'
                }`}
                title={selectedDate >= todayStr ? 'Future dates are prohibited' : 'Next Day'}
              >
                <ChevronRight className="h-5 w-5" />
              </button>

              {/* Native Datepicker */}
              <div className="relative flex-1 sm:flex-initial">
                <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 focus-within:border-emerald-500 transition">
                  <Calendar className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                  <input
                    type="date"
                    max={todayStr}
                    value={selectedDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className="bg-transparent text-sm font-semibold text-white focus:outline-none cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Historical Warning Banner */}
            {isHistorical && (
              <div className="flex items-center gap-2.5 px-4 py-2 bg-amber-950/40 border border-amber-700/50 rounded-xl text-amber-300 text-xs sm:text-sm font-medium">
                <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 animate-pulse" />
                <span>Historical Mode: Editing past dates requires an audit rationale and will be logged.</span>
              </div>
            )}
          </div>
        </div>

        {/* Real-time KPI Stats Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {/* Total Students */}
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-xs font-medium uppercase tracking-wider">Total Roster</span>
              <Users className="h-4 w-4 text-slate-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-white">{stats.totalStudents}</span>
              <span className="text-xs text-slate-500">students</span>
            </div>
          </div>

          {/* Present */}
          <div className="bg-gradient-to-br from-emerald-950/40 to-slate-900/80 border border-emerald-800/40 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-emerald-400 mb-1">
              <span className="text-xs font-medium uppercase tracking-wider">Present</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-300">{stats.presentCount}</span>
              <span className="text-xs text-emerald-400/80 font-semibold">
                {stats.totalStudents > 0 ? Math.round((stats.presentCount / stats.totalStudents) * 100) : 0}%
              </span>
            </div>
          </div>

          {/* Late */}
          <div className="bg-gradient-to-br from-amber-950/40 to-slate-900/80 border border-amber-800/40 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-amber-400 mb-1">
              <span className="text-xs font-medium uppercase tracking-wider">Late Arrivals</span>
              <Clock className="h-4 w-4 text-amber-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-amber-300">{stats.lateCount}</span>
              <span className="text-xs text-amber-400/80 font-semibold">
                {stats.totalStudents > 0 ? Math.round((stats.lateCount / stats.totalStudents) * 100) : 0}%
              </span>
            </div>
          </div>

          {/* Absent */}
          <div className="bg-gradient-to-br from-rose-950/40 to-slate-900/80 border border-rose-800/40 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-rose-400 mb-1">
              <span className="text-xs font-medium uppercase tracking-wider">Absent</span>
              <XCircle className="h-4 w-4 text-rose-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-rose-300">{stats.absentCount}</span>
              <span className="text-xs text-rose-400/80 font-semibold">
                {stats.totalStudents > 0 ? Math.round((stats.absentCount / stats.totalStudents) * 100) : 0}%
              </span>
            </div>
          </div>

          {/* On Leave */}
          <div className="bg-gradient-to-br from-purple-950/40 to-slate-900/80 border border-purple-800/40 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-purple-400 mb-1">
              <span className="text-xs font-medium uppercase tracking-wider">On Leave</span>
              <FileText className="h-4 w-4 text-purple-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-purple-300">{stats.onLeaveCount}</span>
              <span className="text-xs text-purple-400/80 font-semibold">approved</span>
            </div>
          </div>

          {/* Unmarked Records */}
          <div
            className={`border rounded-xl p-4 flex flex-col justify-between transition ${
              stats.unmarkedCount > 0
                ? 'bg-gradient-to-br from-amber-950/60 to-red-950/40 border-amber-500/50 shadow-lg shadow-amber-950/20'
                : 'bg-slate-900/70 border-slate-800/80'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Unmarked</span>
              {stats.unmarkedCount > 0 ? (
                <AlertCircle className="h-4 w-4 text-amber-400 animate-bounce" />
              ) : (
                <Check className="h-4 w-4 text-emerald-400" />
              )}
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl sm:text-3xl font-extrabold ${stats.unmarkedCount > 0 ? 'text-amber-300' : 'text-slate-300'}`}>
                {stats.unmarkedCount}
              </span>
              <span className="text-xs text-slate-500">{stats.unmarkedCount > 0 ? 'pending roll-call' : 'all recorded'}</span>
            </div>
          </div>
        </div>

        {/* Filter & Batch Actions Bar */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search by student name, roll number, room or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Quick Bulk Marking Actions */}
            <div className="flex flex-wrap items-center gap-2">
              {stats.unmarkedCount > 0 && (
                <button
                  onClick={handleMarkAllUnmarkedPresent}
                  className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-950/70 border border-emerald-600/50 text-emerald-300 text-xs sm:text-sm font-semibold hover:bg-emerald-900/70 hover:text-white transition shadow-sm"
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Mark Unmarked as Present</span>
                </button>
              )}

              <button
                onClick={handleMarkAllFilteredPresent}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700/60 text-slate-200 text-xs sm:text-sm font-semibold transition shadow-sm"
              >
                <Users className="h-4 w-4 text-slate-400" />
                <span>Mark All Filtered as Present</span>
              </button>
            </div>
          </div>

          {/* Filter Dropdowns Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800/80">
            {/* Floor Filter */}
            <div>
              <label className="block text-[11px] font-medium uppercase text-slate-400 mb-1">Floor</label>
              <select
                value={selectedFloor}
                onChange={(e) => setSelectedFloor(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="all">All Floors</option>
                {facets.floors.map((fl) => (
                  <option key={fl} value={fl}>
                    Floor {fl}
                  </option>
                ))}
              </select>
            </div>

            {/* Room Filter */}
            <div>
              <label className="block text-[11px] font-medium uppercase text-slate-400 mb-1">Room</label>
              <select
                value={selectedRoom}
                onChange={(e) => setSelectedRoom(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="all">All Rooms</option>
                {facets.rooms.map((rm) => (
                  <option key={rm} value={rm}>
                    Room {rm}
                  </option>
                ))}
              </select>
            </div>

            {/* Course Filter */}
            <div>
              <label className="block text-[11px] font-medium uppercase text-slate-400 mb-1">Course</label>
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="all">All Courses</option>
                {facets.courses.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-[11px] font-medium uppercase text-slate-400 mb-1">Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="unmarked">Unmarked Only</option>
                <option value="present">Present</option>
                <option value="late">Late</option>
                <option value="absent">Absent</option>
                <option value="on-leave">On Leave</option>
              </select>
            </div>
          </div>
        </div>

        {/* Floating / Docked Save Banner (when changes are staged) */}
        {stagedCount > 0 && (
          <div className="sticky top-4 z-30 bg-gradient-to-r from-emerald-950/95 via-slate-900/95 to-emerald-950/95 border-2 border-emerald-500/60 rounded-2xl p-4 shadow-2xl backdrop-blur-lg flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
                <Save className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm sm:text-base font-bold text-white">
                  You have <span className="text-emerald-400">{stagedCount}</span> staged attendance modification{stagedCount > 1 ? 's' : ''}
                </p>
                <p className="text-xs text-slate-400">
                  {isHistorical
                    ? 'Audit rationale will be prompted upon clicking Save.'
                    : 'Changes will be saved into the database immediately.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                onClick={() => setStagedChanges({})}
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs sm:text-sm font-semibold transition"
              >
                Discard
              </button>
              <button
                onClick={handleSaveStagedBatch}
                disabled={savingBatch}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-emerald-500/25 transition disabled:opacity-50"
              >
                {savingBatch ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Saving Database...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 stroke-[3]" />
                    <span>Save Attendance ({stagedCount})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Roll-Call Sheet Table */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
          {loading ? (
            <div className="py-20 text-center flex flex-col items-center justify-center space-y-4">
              <RefreshCw className="h-10 w-10 text-emerald-400 animate-spin" />
              <p className="text-base text-slate-400 font-medium">Loading attendance records...</p>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <Users className="h-12 w-12 text-slate-600 mx-auto" />
              <p className="text-lg font-semibold text-slate-300">No students found matching current filters</p>
              <p className="text-sm text-slate-500">Try resetting search or adjusting floor/room filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                    <th className="py-3.5 px-4 sm:px-6">Student Information</th>
                    <th className="py-3.5 px-3">Room / Floor</th>
                    <th className="py-3.5 px-3">30-Day Rate</th>
                    <th className="py-3.5 px-4 text-center">Fast Roll-Call</th>
                    <th className="py-3.5 px-4">Remarks / Audit Note</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {filteredList.map((item) => {
                    const staged = stagedChanges[item.student._id];
                    const currentStatus = staged ? staged.attendanceStatus : item.attendanceStatus;
                    const isRowStaged = !!staged;
                    const stats30 = item.thirtyDayStats || { totalMarkedDays: 0, percentage: 100, absentCount: 0 };
                    const hasFrequentAbsences = stats30.absentCount >= 3;
                    const isLowAttendance = stats30.percentage < 75 && stats30.totalMarkedDays >= 5;

                    return (
                      <tr
                        key={item.student._id}
                        className={`transition hover:bg-slate-800/40 ${
                          isRowStaged ? 'bg-emerald-950/20 border-l-4 border-l-emerald-500' : ''
                        }`}
                      >
                        {/* Student Info */}
                        <td className="py-3.5 px-4 sm:px-6">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              {item.student.profileImage ? (
                                <img
                                  src={item.student.profileImage}
                                  alt={item.student.name}
                                  className="h-10 w-10 rounded-full object-cover border border-slate-700"
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-300 text-sm">
                                  {item.student.name.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              {currentStatus === 'present' && (
                                <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-slate-900" />
                              )}
                              {currentStatus === 'late' && (
                                <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-amber-500 border-2 border-slate-900" />
                              )}
                              {currentStatus === 'absent' && (
                                <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-rose-500 border-2 border-slate-900" />
                              )}
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-white">{item.student.name}</span>
                                {item.isOnLeave && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-900/60 border border-purple-600/50 text-purple-300">
                                    On Leave
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-slate-400">
                                <span>{item.student.studentId || 'ID Pending'}</span>
                                {item.student.course && (
                                  <>
                                    <span>•</span>
                                    <span>{item.student.course}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Room / Floor */}
                        <td className="py-3.5 px-3">
                          {item.student.room ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/60 text-xs font-semibold text-slate-200">
                                Room {item.student.room.roomNumber}
                              </span>
                              <div className="text-[11px] text-slate-400">Floor {item.student.room.floorNumber}</div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500 italic">No Room Assigned</span>
                          )}
                        </td>

                        {/* 30-Day Attendance Rate */}
                        <td className="py-3.5 px-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                                  isLowAttendance
                                    ? 'bg-rose-950/80 text-rose-300 border border-rose-700/50'
                                    : stats30.percentage >= 85
                                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/50'
                                    : 'bg-amber-950/80 text-amber-300 border border-amber-700/50'
                                }`}
                              >
                                {stats30.percentage}%
                              </span>
                            </div>
                            {hasFrequentAbsences && (
                              <div className="flex items-center gap-1 text-[11px] text-rose-400 font-medium">
                                <AlertTriangle className="h-3 w-3" />
                                <span>{stats30.absentCount} abs. this mo.</span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Fast Roll-Call Toggles */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Present Button [P] */}
                            <button
                              type="button"
                              onClick={() => handleStageStatus(item, 'present')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                                currentStatus === 'present'
                                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-400/50'
                                  : 'bg-slate-800/90 text-slate-400 hover:text-emerald-300 hover:bg-emerald-950/40 border border-slate-700/60'
                              }`}
                              title="Mark Present"
                            >
                              <Check className="h-3.5 w-3.5" />
                              <span>P</span>
                            </button>

                            {/* Late Button [L] */}
                            <button
                              type="button"
                              onClick={() => handleStageStatus(item, 'late')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                                currentStatus === 'late'
                                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30 ring-2 ring-amber-400/50'
                                  : 'bg-slate-800/90 text-slate-400 hover:text-amber-300 hover:bg-amber-950/40 border border-slate-700/60'
                              }`}
                              title="Mark Late Arrival"
                            >
                              <Clock className="h-3.5 w-3.5" />
                              <span>L</span>
                            </button>

                            {/* Absent Button [A] */}
                            <button
                              type="button"
                              onClick={() => handleStageStatus(item, 'absent')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                                currentStatus === 'absent'
                                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30 ring-2 ring-rose-400/50'
                                  : 'bg-slate-800/90 text-slate-400 hover:text-rose-300 hover:bg-rose-950/40 border border-slate-700/60'
                              }`}
                              title="Mark Absent"
                            >
                              <X className="h-3.5 w-3.5" />
                              <span>A</span>
                            </button>

                            {/* On-Leave Button */}
                            <button
                              type="button"
                              onClick={() => handleStageStatus(item, 'on-leave')}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                                currentStatus === 'on-leave'
                                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 ring-2 ring-purple-400/50'
                                  : 'bg-slate-800/90 text-slate-400 hover:text-purple-300 hover:bg-purple-950/40 border border-slate-700/60'
                              }`}
                              title="Mark On-Leave"
                            >
                              Leave
                            </button>
                          </div>
                        </td>

                        {/* Remarks & Audit Notes */}
                        <td className="py-3.5 px-4 min-w-[200px]">
                          <div className="space-y-1">
                            <input
                              type="text"
                              placeholder="Add optional remarks..."
                              value={staged?.remarks ?? item.remarks ?? ''}
                              onChange={(e) => handleStageRemarks(item.student._id, e.target.value, item)}
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
                            />
                            {item.editReason && (
                              <div className="text-[10px] text-amber-400/90 italic truncate max-w-[240px]">
                                Edit rationale: {item.editReason}
                              </div>
                            )}
                            {item.leaveDetails && (
                              <div className="text-[10px] text-purple-400 truncate max-w-[240px]">
                                Leave: {item.leaveDetails.reason || 'Authorized'}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Actions Column */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenStudentHistory(item.student)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                              title="View Student Attendance Log"
                            >
                              <History className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: Single Attendance Edit Rationale (Mandatory for editing past or recorded entries) */}
      {editModal.open && editModal.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Audit Rationale Required</h3>
                  <p className="text-xs text-slate-400">Modifying saved or historical attendance</p>
                </div>
              </div>
              <button
                onClick={() => setEditModal({ ...editModal, open: false })}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                <p className="text-xs text-slate-400 font-medium">Student</p>
                <p className="text-sm font-semibold text-white">
                  {editModal.item.student.name} ({editModal.item.student.studentId || 'No ID'})
                </p>
                <div className="flex items-center gap-3 pt-1 text-xs">
                  <span className="text-slate-400">
                    Current: <strong className="text-slate-200 uppercase">{editModal.item.attendanceStatus}</strong>
                  </span>
                  <ArrowRight className="h-3 w-3 text-slate-500" />
                  <span className="text-emerald-400">
                    New: <strong className="uppercase">{editModal.targetStatus}</strong>
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Reason for modification <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Student returned from lab with HOD letter; Misclick correction..."
                  value={editModal.editReason}
                  onChange={(e) => setEditModal({ ...editModal, editReason: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition"
                />
                <p className="text-[11px] text-slate-500 mt-1">This explanation is stored in the immutable Audit Log.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Remarks (Optional)</label>
                <input
                  type="text"
                  placeholder="Additional remarks..."
                  value={editModal.remarks}
                  onChange={(e) => setEditModal({ ...editModal, remarks: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-slate-700"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditModal({ ...editModal, open: false })}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-medium text-slate-300 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={editModal.loading || !editModal.editReason || editModal.editReason.trim().length < 3}
                onClick={handleSubmitSingleEdit}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-sm transition disabled:opacity-50 flex items-center gap-2"
              >
                {editModal.loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Confirm & Log Audit</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Bulk Rationale Modal */}
      {bulkRationaleModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Audit Rationale for Batch</h3>
                  <p className="text-xs text-slate-400">Saving {bulkRationaleModal.records.length} records</p>
                </div>
              </div>
              <button
                onClick={() => setBulkRationaleModal({ ...bulkRationaleModal, open: false })}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-slate-300">
                You are updating attendance for <strong className="text-white">{bulkRationaleModal.records.length}</strong> students
                {isHistorical ? ' on a historical date.' : '.'} A mandatory rationale is required for the audit record.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Batch Edit Rationale <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Regular night roll call completion; Bulk synchronization..."
                  value={bulkRationaleModal.editReason}
                  onChange={(e) => setBulkRationaleModal({ ...bulkRationaleModal, editReason: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setBulkRationaleModal({ ...bulkRationaleModal, open: false })}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-medium text-slate-300 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  bulkRationaleModal.loading ||
                  !bulkRationaleModal.editReason ||
                  bulkRationaleModal.editReason.trim().length < 3
                }
                onClick={handleSubmitBulkWithRationale}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition disabled:opacity-50 flex items-center gap-2"
              >
                {bulkRationaleModal.loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Processing Batch...</span>
                  </>
                ) : (
                  <span>Save Batch & Audit</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Frequent Absences & Defaulters Intelligence */}
      {analyticsModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Frequent Absences & Defaulter Watch</h3>
                  <p className="text-xs text-slate-400">30-day attendance patterns and emergency guardian contacts</p>
                </div>
              </div>
              <button
                onClick={() => setAnalyticsModal({ ...analyticsModal, open: false })}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 py-4 space-y-6 pr-1">
              {analyticsModal.loading ? (
                <div className="py-20 text-center flex flex-col items-center justify-center space-y-3">
                  <RefreshCw className="h-8 w-8 text-rose-400 animate-spin" />
                  <p className="text-sm text-slate-400">Aggregating attendance telemetry...</p>
                </div>
              ) : analyticsModal.data ? (
                <>
                  {/* Summary Bar */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-center">
                      <div className="text-xs text-slate-400">Hostel Average Rate</div>
                      <div className="text-xl font-bold text-emerald-400 mt-0.5">
                        {analyticsModal.data.overallRate}%
                      </div>
                    </div>
                    <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-center">
                      <div className="text-xs text-slate-400">Frequent Absentees (≥3)</div>
                      <div className="text-xl font-bold text-rose-400 mt-0.5">
                        {analyticsModal.data.frequentAbsentees?.length || 0}
                      </div>
                    </div>
                    <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-center">
                      <div className="text-xs text-slate-400">Defaulters (&lt;75%)</div>
                      <div className="text-xl font-bold text-amber-400 mt-0.5">
                        {analyticsModal.data.defaulters?.length || 0}
                      </div>
                    </div>
                  </div>

                  {/* Section 1: Frequent Absentees List */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-rose-300 uppercase tracking-wider flex items-center gap-2">
                      <XCircle className="h-4 w-4" />
                      Frequent Absentees (≥ 3 absences in last 30 days)
                    </h4>

                    {analyticsModal.data.frequentAbsentees?.length === 0 ? (
                      <div className="bg-slate-950/60 p-4 rounded-xl text-center text-sm text-slate-400 border border-slate-800">
                        🎉 Excellent discipline! No students with 3 or more absences in the last 30 days.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {analyticsModal.data.frequentAbsentees.map((rep: any) => (
                          <div
                            key={rep.student._id}
                            className="bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-slate-700 transition"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-white">{rep.student.name}</span>
                                <span className="text-xs text-slate-400">({rep.student.studentId || 'No ID'})</span>
                                {rep.student.room && (
                                  <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                                    Room {rep.student.room.roomNumber}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                                <span className="text-rose-400 font-bold">{rep.absentCount} Total Absences</span>
                                <span>•</span>
                                <span>Attendance: {rep.attendancePercentage}%</span>
                                {rep.lastAbsentDate && (
                                  <>
                                    <span>•</span>
                                    <span>Last absent: {rep.lastAbsentDate}</span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Contact Parent CTA */}
                            {rep.student.parentContact?.phone ? (
                              <a
                                href={`tel:${rep.student.parentContact.phone}`}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 text-xs font-semibold hover:bg-emerald-900 transition flex-shrink-0"
                              >
                                <Phone className="h-3.5 w-3.5" />
                                <span>Call Parent ({rep.student.parentContact.phone})</span>
                              </a>
                            ) : (
                              <span className="text-xs text-slate-500 italic">No parent phone recorded</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Section 2: Low Attendance Defaulters */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Attendance Defaulters (&lt; 75% overall rate)
                    </h4>

                    {analyticsModal.data.defaulters?.length === 0 ? (
                      <div className="bg-slate-950/60 p-4 rounded-xl text-center text-sm text-slate-400 border border-slate-800">
                        No students below the 75% attendance threshold.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {analyticsModal.data.defaulters.map((rep: any) => (
                          <div
                            key={rep.student._id}
                            className="bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between gap-3"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-white">{rep.student.name}</span>
                                <span className="text-xs text-slate-400">({rep.student.studentId || 'No ID'})</span>
                                {rep.student.room && (
                                  <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                                    Room {rep.student.room.roomNumber}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-400 mt-0.5">
                                Completed {rep.presentCount} of {rep.totalDays} business days
                              </div>
                            </div>

                            <span className="text-sm font-extrabold text-amber-400 px-3 py-1 rounded-lg bg-amber-950/60 border border-amber-800/60">
                              {rep.attendancePercentage}%
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end flex-shrink-0">
              <button
                onClick={() => setAnalyticsModal({ ...analyticsModal, open: false })}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-medium text-slate-200 transition"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DRAWER / MODAL 4: Individual Student Attendance History */}
      {historyDrawer.open && historyDrawer.student && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <History className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{historyDrawer.student.name}</h3>
                  <p className="text-xs text-slate-400">
                    ID: {historyDrawer.student.studentId || 'N/A'} • Room {historyDrawer.student.room?.roomNumber || 'Unassigned'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setHistoryDrawer({ ...historyDrawer, open: false })}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 py-4 space-y-4">
              {historyDrawer.loading ? (
                <div className="py-16 text-center flex flex-col items-center justify-center space-y-3">
                  <RefreshCw className="h-8 w-8 text-emerald-400 animate-spin" />
                  <p className="text-sm text-slate-400">Loading student attendance history...</p>
                </div>
              ) : (
                <>
                  {historyDrawer.stats && (
                    <div className="grid grid-cols-4 gap-2 bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-center">
                      <div>
                        <div className="text-[11px] text-slate-400">Rate</div>
                        <div className="text-lg font-bold text-emerald-400">{historyDrawer.stats.percentage}%</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-400">Present</div>
                        <div className="text-lg font-bold text-emerald-300">{historyDrawer.stats.presentCount}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-400">Late</div>
                        <div className="text-lg font-bold text-amber-300">{historyDrawer.stats.lateCount}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-400">Absent</div>
                        <div className="text-lg font-bold text-rose-300">{historyDrawer.stats.absentCount}</div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    {historyDrawer.records.length === 0 ? (
                      <p className="text-sm text-slate-500 text-center py-6">No historical records found for this student.</p>
                    ) : (
                      historyDrawer.records.map((rec) => (
                        <div
                          key={rec._id}
                          className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs"
                        >
                          <div className="space-y-0.5">
                            <div className="font-semibold text-white flex items-center gap-2">
                              <span>{rec.businessDate || new Date(rec.date).toISOString().slice(0, 10)}</span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  rec.attendanceStatus === 'present'
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                    : rec.attendanceStatus === 'late'
                                    ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                    : rec.attendanceStatus === 'absent'
                                    ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                    : 'bg-purple-950 text-purple-300 border border-purple-800'
                                }`}
                              >
                                {rec.attendanceStatus || rec.status}
                              </span>
                            </div>
                            {rec.remarks && <div className="text-slate-400 italic">{rec.remarks}</div>}
                            {rec.editReason && (
                              <div className="text-amber-400 text-[11px]">Audit rationale: {rec.editReason}</div>
                            )}
                          </div>

                          <div className="text-right text-[11px] text-slate-500">
                            <div>Marked by: {rec.markedBy?.name || 'System'}</div>
                            {rec.lastEditedBy && <div>Edited by: {rec.lastEditedBy.name}</div>}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end flex-shrink-0">
              <button
                onClick={() => setHistoryDrawer({ ...historyDrawer, open: false })}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-medium text-slate-200 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
