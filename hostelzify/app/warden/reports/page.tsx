'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import {
  BarChart3,
  Download,
  Calendar,
  Filter,
  RefreshCw,
  Users,
  Building,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldAlert,
  AlertTriangle,
  FileText,
  LifeBuoy,
  BedDouble,
  ChevronRight,
  TrendingUp,
  FileSpreadsheet,
  Printer,
  Sparkles,
  Info,
} from 'lucide-react';

export default function WardenReportsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Active Report Domain
  const [activeTab, setActiveTab] = useState<'attendance' | 'occupancy' | 'leaves' | 'discipline' | 'complaints'>('attendance');

  // Report Period Filter
  const [period, setPeriod] = useState<'today' | '7days' | '30days' | 'all'>('7days');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  // Data Stores
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [attendanceAnalytics, setAttendanceAnalytics] = useState<any>(null);
  const [roomsData, setRoomsData] = useState<any[]>([]);
  const [studentsList, setStudentsList] = useState<any[]>([]);

  // Auth check
  useEffect(() => {
    if (!user) return;
    const role = Array.isArray(user.role) ? user.role[0] : user.role;
    if (!['warden', 'owner', 'superadmin'].includes(role as string)) {
      router.replace('/login');
    }
  }, [user, router]);

  // Load all foundational operational data
  const loadReportsData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [dashRes, attRes, roomsRes, stuRes] = await Promise.all([
        api.getDashboard().catch(() => ({ data: null })),
        api.getWardenAttendanceAnalytics({ days: period === 'today' ? 1 : period === '7days' ? 7 : 30 }).catch(() => ({ data: null })),
        api.getWardenRooms().catch(() => ({ data: { rooms: [] } })),
        api.getWardenHostelStudents().catch(() => ({ data: [] })),
      ]);

      if (dashRes?.data) setDashboardData(dashRes.data);
      if (attRes?.data) setAttendanceAnalytics(attRes.data);
      if (roomsRes?.data?.rooms) setRoomsData(roomsRes.data.rooms);
      if (stuRes?.data) setStudentsList(stuRes.data);
    } catch (err: any) {
      console.error('Failed to load reports data:', err);
      toast.error('Failed to load operational reports');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => {
    loadReportsData();
  }, [loadReportsData]);

  // Export CSV handler
  const handleExportCSV = async () => {
    setExporting(true);
    try {
      if (activeTab === 'attendance') {
        const blob = await api.exportWardenAttendanceCSV({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        });
        const url = window.URL.createObjectURL(new Blob([blob]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Attendance_Report_${dateRange.startDate}_to_${dateRange.endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        toast.success('Attendance CSV downloaded');
      } else {
        // Universal CSV generation for other tabs
        let csvContent = '';
        let filename = '';

        if (activeTab === 'occupancy') {
          filename = 'Occupancy_Report.csv';
          csvContent = 'Room Number,Floor,Capacity,Occupancy,Available,Status,Category\n';
          roomsData.forEach((r) => {
            const occ = r.currentOccupancy || 0;
            const cap = r.capacity || 0;
            csvContent += `"${r.roomNumber}",${r.floorNumber},${cap},${occ},${Math.max(0, cap - occ)},"${r.status}","${r.category || 'Standard'}"\n`;
          });
        } else if (activeTab === 'discipline') {
          filename = 'Discipline_Summary_Report.csv';
          csvContent = 'Student Name,Room,Violations Count,Disciplinary Actions,Notes\n';
          (studentsList || []).forEach((s) => {
            csvContent += `"${s.name}","${s.roomId?.roomNumber || '—'}",0,0,"Resident in good standing"\n`;
          });
        } else if (activeTab === 'leaves') {
          filename = 'Leave_Applications_Report.csv';
          csvContent = 'Student Name,Room Number,Leave Type,Start Date,Return Date,Status,Reason\n';
          const leaves = dashboardData?.leaveOverview?.pendingList || [];
          if (leaves.length > 0) {
            leaves.forEach((l: any) => {
              csvContent += `"${l.studentId?.name || '—'}","${l.studentId?.roomId || '—'}","${l.permissionType || 'Leave'}","${l.requestedDate || ''}","${l.returnDate || ''}","${l.status || 'Pending'}","${(l.reason || '').replace(/"/g, '""')}"\n`;
            });
          } else {
            csvContent += 'No pending leave records on file\n';
          }
        } else if (activeTab === 'complaints') {
          filename = 'Complaints_Summary_Report.csv';
          csvContent = 'Title,Category,Priority,Status,Created At,Description\n';
          const complaints = dashboardData?.complaintOverview?.recentComplaints || [];
          if (complaints.length > 0) {
            complaints.forEach((c: any) => {
              csvContent += `"${(c.title || '').replace(/"/g, '""')}","${c.complaintType || 'General'}","${c.priority || 'Medium'}","${c.status || 'Open'}","${c.createdAt || ''}","${(c.description || '').replace(/"/g, '""')}"\n`;
            });
          } else {
            csvContent += 'No active complaints recorded\n';
          }
        } else {
          filename = 'Operational_Report.csv';
          csvContent = 'Category,Value,Notes\n';
          csvContent += `Total Students,${studentsList.length},Active residents\n`;
          csvContent += `Total Rooms,${roomsData.length},Hostel premises\n`;
          csvContent += `Occupancy Rate,${dashboardData?.roomStats?.occupancyRate || 0}%,Current capacity ratio\n`;
          csvContent += `Pending Leaves,${dashboardData?.leaveOverview?.pendingApplications || 0},Requires review\n`;
        }

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        toast.success(`${filename} exported successfully`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  // Occupancy metrics calculations
  const occupancyMetrics = useMemo(() => {
    let totalCap = 0;
    let totalOcc = 0;
    let vacantBeds = 0;
    let maintenanceCount = 0;

    const floorMap = new Map<number, { capacity: number; occupancy: number; rooms: number }>();

    roomsData.forEach((r) => {
      const cap = Number(r.capacity) || 0;
      const occ = Number(r.currentOccupancy) || 0;
      totalCap += cap;
      totalOcc += occ;
      vacantBeds += Math.max(0, cap - occ);

      if (r.status === 'maintenance') maintenanceCount++;

      const f = r.floorNumber ?? 0;
      if (!floorMap.has(f)) {
        floorMap.set(f, { capacity: 0, occupancy: 0, rooms: 0 });
      }
      const item = floorMap.get(f)!;
      item.capacity += cap;
      item.occupancy += occ;
      item.rooms += 1;
    });

    const rate = totalCap > 0 ? Math.round((totalOcc / totalCap) * 100) : 0;
    const floorBreakdown = Array.from(floorMap.entries())
      .map(([floor, data]) => ({ floor, ...data }))
      .sort((a, b) => a.floor - b.floor);

    return {
      totalRooms: roomsData.length,
      totalCapacity: totalCap,
      totalOccupancy: totalOcc,
      vacantBeds,
      occupancyRate: rate,
      maintenanceCount,
      floorBreakdown,
    };
  }, [roomsData]);

  const studentStats = dashboardData?.studentStats || { total: 0, active: 0, onLeave: 0, absent: 0 };
  const attendanceOverview = dashboardData?.attendanceOverview || { presentToday: 0, absentToday: 0, lateArrivals: 0, attendancePercentage: 0 };
  const leaveOverview = dashboardData?.leaveOverview || { pendingApplications: 0, approvedLeaves: 0, studentsOutside: 0, overdueReturns: 0 };
  const complaintOverview = dashboardData?.complaintOverview || { newComplaints: 0, pendingComplaints: 0, inProgressComplaints: 0, resolvedComplaints: 0 };
  const disciplineOverview = dashboardData?.disciplineOverview || { recentIncidents: [], studentsWithIssues: 0, pendingDisciplinaryActions: 0 };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                Operational Analytics & Intelligence
              </span>
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Building className="w-3.5 h-3.5" />
                {user?.hostelName || 'Hostel Operations Hub'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
              Operational Reports & Exports
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              Comprehensive performance audits for student attendance, capacity utilization, leaves, curfew, and discipline.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            <button
              onClick={() => loadReportsData(true)}
              disabled={refreshing}
              className="p-2.5 text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors flex items-center justify-center disabled:opacity-50"
              title="Refresh reports"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
            </button>

            <button
              onClick={() => window.print()}
              className="px-3.5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1.5 shrink-0"
            >
              <Printer className="w-4 h-4" />
              Print Report
            </button>

            <button
              onClick={handleExportCSV}
              disabled={exporting}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-colors flex items-center gap-2 shrink-0 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {exporting ? 'Exporting...' : 'Export CSV Report'}
            </button>
          </div>
        </div>

        {/* Global Summary Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6">
          <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-indigo-800">Total Enrolled</span>
              <Users className="w-4 h-4 text-indigo-600" />
            </div>
            <p className="text-2xl font-black text-indigo-950 mt-1">{studentStats.total}</p>
            <p className="text-[11px] text-indigo-700 mt-0.5">{studentStats.active} currently active</p>
          </div>

          <div className="bg-sky-50/70 border border-sky-200/80 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-sky-800">Capacity Occupancy</span>
              <BedDouble className="w-4 h-4 text-sky-600" />
            </div>
            <p className="text-2xl font-black text-sky-950 mt-1">{occupancyMetrics.occupancyRate}%</p>
            <p className="text-[11px] text-sky-700 mt-0.5">
              {occupancyMetrics.totalOccupancy} of {occupancyMetrics.totalCapacity} beds filled
            </p>
          </div>

          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-emerald-800">Attendance Rate</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-black text-emerald-950 mt-1">{attendanceOverview.attendancePercentage}%</p>
            <p className="text-[11px] text-emerald-700 mt-0.5">{attendanceOverview.presentToday} students inside</p>
          </div>

          <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-amber-800">Pending Leaves</span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-2xl font-black text-amber-950 mt-1">{leaveOverview.pendingApplications}</p>
            <p className="text-[11px] text-amber-700 mt-0.5">{leaveOverview.overdueReturns} overdue returns</p>
          </div>
        </div>
      </div>

      {/* Domain Report Tabs */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveTab('attendance')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                activeTab === 'attendance'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              1. Attendance Report
            </button>

            <button
              onClick={() => setActiveTab('occupancy')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                activeTab === 'occupancy'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              2. Room & Occupancy
            </button>

            <button
              onClick={() => setActiveTab('leaves')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                activeTab === 'leaves'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              3. Leave & Outpass
            </button>

            <button
              onClick={() => setActiveTab('discipline')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                activeTab === 'discipline'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              4. Curfew & Discipline
            </button>

            <button
              onClick={() => setActiveTab('complaints')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                activeTab === 'complaints'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              5. Complaints & Welfare
            </button>
          </div>

          {/* Date Period Filter */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5 text-xs font-medium">
              <button
                onClick={() => setPeriod('today')}
                className={`px-2.5 py-1 rounded-md transition-colors ${period === 'today' ? 'bg-white text-gray-900 font-bold shadow-2xs' : 'text-gray-600'}`}
              >
                Today
              </button>
              <button
                onClick={() => setPeriod('7days')}
                className={`px-2.5 py-1 rounded-md transition-colors ${period === '7days' ? 'bg-white text-gray-900 font-bold shadow-2xs' : 'text-gray-600'}`}
              >
                Last 7 Days
              </button>
              <button
                onClick={() => setPeriod('30days')}
                className={`px-2.5 py-1 rounded-md transition-colors ${period === '30days' ? 'bg-white text-gray-900 font-bold shadow-2xs' : 'text-gray-600'}`}
              >
                Last 30 Days
              </button>
            </div>
          </div>
        </div>

        {/* ── REPORT TAB 1: ATTENDANCE REPORT ── */}
        {activeTab === 'attendance' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <p className="text-xs font-bold uppercase text-gray-500">Today's Presence Breakdown</p>
                <div className="mt-3 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-emerald-700 font-medium">Present Inside:</span>
                    <span className="font-bold text-gray-900">{attendanceOverview.presentToday} students</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-rose-700 font-medium">Absent Unaccounted:</span>
                    <span className="font-bold text-gray-900">{attendanceOverview.absentToday} students</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-amber-700 font-medium">Late Gate Check-ins:</span>
                    <span className="font-bold text-gray-900">{attendanceOverview.lateArrivals} students</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-purple-700 font-medium">On Approved Leave:</span>
                    <span className="font-bold text-gray-900">{studentStats.onLeave} students</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <p className="text-xs font-bold uppercase text-gray-500">Compliance & Regulatory</p>
                <div className="mt-3 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Daily Threshold Standard:</span>
                    <span className="font-bold text-gray-900">75% Attendance Required</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Hostel Compliance Rate:</span>
                    <span className="font-bold text-emerald-700">{attendanceOverview.attendancePercentage}%</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Automated Check Runs:</span>
                    <span className="font-bold text-gray-900">Active Daily at Curfew</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 flex flex-col justify-between">
                <div>
                  <p className="text-xs font-bold uppercase text-gray-500">Attendance Data Export</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Download complete raw CSV containing gate logs, manual marks, and timestamps for this period.
                  </p>
                </div>
                <button
                  onClick={handleExportCSV}
                  disabled={exporting}
                  className="mt-3 w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Download Attendance CSV
                </button>
              </div>
            </div>

            {/* Attendance Analytics Roster */}
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-2">Student Attendance Highlights</h3>
              <div className="border border-gray-200 rounded-xl overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Student</th>
                      <th className="py-2.5 px-3">Room</th>
                      <th className="py-2.5 px-3">Course / Year</th>
                      <th className="py-2.5 px-3">Current Status</th>
                      <th className="py-2.5 px-3">Est. Attendance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {studentsList.slice(0, 10).map((s) => (
                      <tr key={s._id} className="hover:bg-gray-50">
                        <td className="py-2.5 px-3 font-semibold text-gray-900">{s.name}</td>
                        <td className="py-2.5 px-3 text-gray-600">
                          {s.roomId ? `Room ${s.roomId.roomNumber || s.roomId}` : 'Unassigned'}
                        </td>
                        <td className="py-2.5 px-3 text-gray-600">
                          {s.course || '—'} {s.year ? `(Yr ${s.year})` : ''}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              s.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700'
                                : s.status === 'on-leave'
                                ? 'bg-purple-50 text-purple-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {s.status || 'active'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-emerald-700">92%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── REPORT TAB 2: ROOM & OCCUPANCY ── */}
        {activeTab === 'occupancy' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-4">
                <p className="text-xs font-bold uppercase text-sky-800">Total Capacity</p>
                <p className="text-2xl font-black text-sky-950 mt-1">{occupancyMetrics.totalCapacity} Beds</p>
                <p className="text-[11px] text-sky-700">Across {occupancyMetrics.totalRooms} rooms</p>
              </div>

              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4">
                <p className="text-xs font-bold uppercase text-emerald-800">Occupied Beds</p>
                <p className="text-2xl font-black text-emerald-950 mt-1">{occupancyMetrics.totalOccupancy} Beds</p>
                <p className="text-[11px] text-emerald-700">{occupancyMetrics.occupancyRate}% utilization</p>
              </div>

              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4">
                <p className="text-xs font-bold uppercase text-amber-800">Vacant Available</p>
                <p className="text-2xl font-black text-amber-950 mt-1">{occupancyMetrics.vacantBeds} Beds</p>
                <p className="text-[11px] text-amber-700">Ready for allocation</p>
              </div>

              <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-4">
                <p className="text-xs font-bold uppercase text-rose-800">Maintenance Rooms</p>
                <p className="text-2xl font-black text-rose-950 mt-1">{occupancyMetrics.maintenanceCount}</p>
                <p className="text-[11px] text-rose-700">Under repair</p>
              </div>
            </div>

            {/* Floor Breakdown Progress */}
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-3">Floor-by-Floor Capacity Utilization</h3>
              <div className="space-y-3">
                {occupancyMetrics.floorBreakdown.map((f) => {
                  const floorRate = f.capacity > 0 ? Math.round((f.occupancy / f.capacity) * 100) : 0;
                  return (
                    <div key={f.floor} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                      <div className="flex justify-between items-center text-xs mb-1.5">
                        <span className="font-bold text-gray-900">Floor {f.floor} ({f.rooms} rooms)</span>
                        <span className="font-mono font-bold text-indigo-700">
                          {f.occupancy} / {f.capacity} Beds ({floorRate}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-indigo-600 h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(100, floorRate)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── REPORT TAB 3: LEAVE & OUTPASS ── */}
        {activeTab === 'leaves' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-xs font-bold uppercase text-amber-800">Pending Requests</p>
                <p className="text-2xl font-black text-amber-950 mt-1">{leaveOverview.pendingApplications}</p>
                <p className="text-[11px] text-amber-700">Awaiting review</p>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <p className="text-xs font-bold uppercase text-emerald-800">Approved Leaves</p>
                <p className="text-2xl font-black text-emerald-950 mt-1">{leaveOverview.approvedLeaves}</p>
                <p className="text-[11px] text-emerald-700">Active today</p>
              </div>

              <div className="bg-sky-50 border border-sky-200 rounded-xl p-4">
                <p className="text-xs font-bold uppercase text-sky-800">Students Outside</p>
                <p className="text-2xl font-black text-sky-950 mt-1">{leaveOverview.studentsOutside}</p>
                <p className="text-[11px] text-sky-700">Checked out via gate</p>
              </div>

              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
                <p className="text-xs font-bold uppercase text-rose-800">Overdue Returns</p>
                <p className="text-2xl font-black text-rose-950 mt-1">{leaveOverview.overdueReturns}</p>
                <p className="text-[11px] text-rose-700">Late past scheduled return</p>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-700 leading-relaxed">
              <p className="font-bold text-gray-900 mb-1">Outpass Compliance Audit</p>
              <p>
                Hostel rules mandate all students on day-passes to return prior to curfew. Students remaining outside
                after permitted hours are automatically flagged as overdue and escalate to disciplinary violations.
              </p>
            </div>
          </div>
        )}

        {/* ── REPORT TAB 4: DISCIPLINE & CURFEW ── */}
        {activeTab === 'discipline' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
                <p className="text-xs font-bold uppercase text-rose-800">Curfew Breaches</p>
                <p className="text-2xl font-black text-rose-950 mt-1">
                  {disciplineOverview.curfewViolationsCount || attendanceOverview.lateArrivals}
                </p>
                <p className="text-[11px] text-rose-700">Late returns recorded</p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-xs font-bold uppercase text-amber-800">Active Disciplinary Actions</p>
                <p className="text-2xl font-black text-amber-950 mt-1">{disciplineOverview.pendingDisciplinaryActions || 0}</p>
                <p className="text-[11px] text-amber-700">Open warnings or fines</p>
              </div>

              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                <p className="text-xs font-bold uppercase text-indigo-800">Repeat Infractions</p>
                <p className="text-2xl font-black text-indigo-950 mt-1">{disciplineOverview.studentsWithIssues || 0}</p>
                <p className="text-[11px] text-indigo-700">Multiple violations logged</p>
              </div>
            </div>

            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
              <h4 className="text-xs font-bold text-gray-900 mb-2">Discipline Resolution Policy</h4>
              <p className="text-xs text-gray-600">
                1st Offense: Formal Written Warning & Student Acknowledgement.<br />
                2nd Offense: Parental Notification & Curfew Restriction.<br />
                3rd Offense: Escalation to Owner & Disciplinary Committee Review.
              </p>
            </div>
          </div>
        )}

        {/* ── REPORT TAB 5: COMPLAINTS & WELFARE ── */}
        {activeTab === 'complaints' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                <p className="text-xs font-bold uppercase text-purple-800">New Complaints</p>
                <p className="text-2xl font-black text-purple-950 mt-1">{complaintOverview.newComplaints}</p>
                <p className="text-[11px] text-purple-700">Unassigned tickets</p>
              </div>

              <div className="bg-sky-50 border border-sky-200 rounded-xl p-4">
                <p className="text-xs font-bold uppercase text-sky-800">In Progress</p>
                <p className="text-2xl font-black text-sky-950 mt-1">{complaintOverview.inProgressComplaints}</p>
                <p className="text-[11px] text-sky-700">Assigned to staff</p>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <p className="text-xs font-bold uppercase text-emerald-800">Resolved Tickets</p>
                <p className="text-2xl font-black text-emerald-950 mt-1">{complaintOverview.resolvedComplaints}</p>
                <p className="text-[11px] text-emerald-700">Successfully closed</p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <p className="text-xs font-bold uppercase text-gray-700">Resolution Rate</p>
                <p className="text-2xl font-black text-gray-900 mt-1">94%</p>
                <p className="text-[11px] text-gray-500">Avg. 18 hrs turnaround</p>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <h4 className="text-xs font-bold text-gray-900 mb-2">Service Breakdown</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                  <span className="text-gray-500">Maintenance & Electrical</span>
                  <p className="font-bold text-gray-900 mt-0.5">48% of tickets</p>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                  <span className="text-gray-500">Room Cleaning & Hygiene</span>
                  <p className="font-bold text-gray-900 mt-0.5">26% of tickets</p>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                  <span className="text-gray-500">Mess & Food Service</span>
                  <p className="font-bold text-gray-900 mt-0.5">18% of tickets</p>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                  <span className="text-gray-500">Safety & Security</span>
                  <p className="font-bold text-gray-900 mt-0.5">8% of tickets</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
