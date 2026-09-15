'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, isOwnerUser } from '../../../contexts/AuthContext';
import { useOwnerHostel } from '../../../contexts/OwnerHostelContext';
import api from '../../../services/api';
import {
  FileText,
  Download,
  Printer,
  Calendar,
  Building2,
  Users,
  ShieldCheck,
  DollarSign,
  CreditCard,
  MessageSquare,
  Wrench,
  Clock,
  ChevronLeft,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

type ReportDomain = 
  | 'occupancy' 
  | 'students' 
  | 'staff' 
  | 'revenue' 
  | 'payments' 
  | 'complaints' 
  | 'maintenance' 
  | 'attendance';

export default function OwnerReportsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { hostels, selectedHostel, setSelectedHostel } = useOwnerHostel();

  const [domain, setDomain] = useState<ReportDomain>('occupancy');
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'quarter' | 'year'>('month');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Domain data stores
  const [occupancyData, setOccupancyData] = useState<any>(null);
  const [studentsData, setStudentsData] = useState<any[]>([]);
  const [staffData, setStaffData] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState<any>(null);
  const [paymentsData, setPaymentsData] = useState<any[]>([]);
  const [complaintsData, setComplaintsData] = useState<any[]>([]);
  const [maintenanceData, setMaintenanceData] = useState<any[]>([]);
  const [attendanceData, setAttendanceData] = useState<any>(null);

  useEffect(() => {
    if (!user || !isOwnerUser(user)) {
      router.replace('/login');
      return;
    }
  }, [user, router]);

  useEffect(() => {
    if (!user) return;
    loadDomainData(domain);
  }, [user, selectedHostel, domain, dateRange]);

  const loadDomainData = async (activeDomain: ReportDomain) => {
    setLoading(true);
    try {
      if (activeDomain === 'occupancy') {
        const res: any = await api.getOccupancyReport({ hostelId: selectedHostel || undefined });
        setOccupancyData(res?.data ?? res ?? null);
      } else if (activeDomain === 'students') {
        const res: any = await api.getOwnerStudents({ hostelId: selectedHostel || undefined, limit: 100 });
        const list = res?.data?.students || res?.data || (Array.isArray(res) ? res : []);
        setStudentsData(Array.isArray(list) ? list : []);
      } else if (activeDomain === 'staff') {
        const res: any = await api.getOwnerStaff({ hostelId: selectedHostel || undefined });
        const list = res?.data?.staff || res?.data || (Array.isArray(res) ? res : []);
        setStaffData(Array.isArray(list) ? list : []);
      } else if (activeDomain === 'revenue') {
        const res: any = await api.getFinancialReport({ hostelId: selectedHostel || undefined, period: dateRange });
        setRevenueData(res?.data ?? res ?? null);
      } else if (activeDomain === 'payments') {
        const res: any = await api.getOwnerPayments({ hostelId: selectedHostel || undefined, limit: 100 });
        const list = res?.data?.payments || res?.data || (Array.isArray(res) ? res : []);
        setPaymentsData(Array.isArray(list) ? list : []);
      } else if (activeDomain === 'complaints') {
        const res: any = await api.getOwnerComplaints({ hostelId: selectedHostel || undefined, limit: 100 });
        const list = res?.data?.complaints || res?.data || (Array.isArray(res) ? res : []);
        setComplaintsData(Array.isArray(list) ? list : []);
      } else if (activeDomain === 'maintenance') {
        const res: any = await api.getMaintenanceComplaints(selectedHostel || undefined);
        setMaintenanceData(Array.isArray(res) ? res : res?.data ?? []);
      } else if (activeDomain === 'attendance') {
        const res: any = await api.getAttendanceTrends({ hostelId: selectedHostel || undefined });
        setAttendanceData(res?.data ?? res ?? null);
      }
    } catch (err: any) {
      console.error('Failed to load domain data:', err);
    } finally {
      setLoading(false);
    }
  };

  const domainTabs: { id: ReportDomain; label: string; icon: any; desc: string }[] = [
    { id: 'occupancy', label: 'Occupancy', icon: Building2, desc: 'Beds, capacity & occupancy rates' },
    { id: 'students', label: 'Students', icon: Users, desc: 'Resident roster & status breakdown' },
    { id: 'staff', label: 'Staff', icon: ShieldCheck, desc: 'Warden, supervisor, security & cleaners' },
    { id: 'revenue', label: 'Revenue', icon: DollarSign, desc: 'Financial collections & forecasts' },
    { id: 'payments', label: 'Payments', icon: CreditCard, desc: 'Ledgers, receipts & transactions' },
    { id: 'complaints', label: 'Complaints', icon: MessageSquare, desc: 'Grievance logs & resolution status' },
    { id: 'maintenance', label: 'Maintenance', icon: Wrench, desc: 'Facility repairs & upkeep orders' },
    { id: 'attendance', label: 'Attendance', icon: Clock, desc: 'Presence summaries & curfew adherence' },
  ];

  const exportCSV = () => {
    let rows: any[] = [];
    let filename = `${domain}_report_${new Date().toISOString().slice(0, 10)}.csv`;

    if (domain === 'occupancy') {
      rows = [
        ['Metric', 'Value'],
        ['Total Rooms', occupancyData?.totalRooms ?? 0],
        ['Occupied Rooms', occupancyData?.occupiedRooms ?? 0],
        ['Available Rooms', occupancyData?.availableRooms ?? 0],
        ['Total Beds Capacity', occupancyData?.totalCapacity ?? 0],
        ['Occupied Beds', occupancyData?.occupiedBeds ?? 0],
        ['Occupancy Rate', `${occupancyData?.occupancyRate ?? 0}%`],
      ];
    } else if (domain === 'students') {
      rows = [
        ['Name', 'Email', 'Phone', 'Room', 'Status', 'Admission Date'],
        ...studentsData.map(s => [
          s.name || 'N/A',
          s.email || 'N/A',
          s.phone || 'N/A',
          s.roomNumber || s.roomId?.roomNumber || 'Unassigned',
          s.status || 'active',
          s.createdAt ? new Date(s.createdAt).toLocaleDateString() : 'N/A'
        ])
      ];
    } else if (domain === 'staff') {
      rows = [
        ['Name', 'Role', 'Email', 'Phone', 'Assigned Hostels', 'Status'],
        ...staffData.map(st => [
          st.name || 'N/A',
          st.role || 'N/A',
          st.email || 'N/A',
          st.phone || 'N/A',
          (st.hostels || []).map((h: any) => h.name || h).join('; ') || 'All',
          st.isActive !== false ? 'Active' : 'Deactivated'
        ])
      ];
    } else if (domain === 'revenue') {
      rows = [
        ['Metric', 'Amount (INR)'],
        ['Total Collected Revenue', revenueData?.totalRevenue || 0],
        ['Pending Collections', revenueData?.pendingAmount || 0],
        ['Collection Efficiency', `${revenueData?.collectionRate || 100}%`],
      ];
    } else if (domain === 'payments') {
      rows = [
        ['Receipt / Ref', 'Student Name', 'Amount (INR)', 'Payment Mode', 'Status', 'Date'],
        ...paymentsData.map(p => [
          p.receiptNumber || p.transactionId || p._id,
          p.studentName || p.studentId?.name || 'Student',
          p.amount || 0,
          p.paymentMethod || 'Online',
          p.status || 'completed',
          p.createdAt ? new Date(p.createdAt).toLocaleDateString() : 'N/A'
        ])
      ];
    } else if (domain === 'complaints') {
      rows = [
        ['Title', 'Category', 'Priority', 'Status', 'Raised By', 'Created At'],
        ...complaintsData.map(c => [
          c.title || 'Untitled',
          c.category || 'general',
          c.priority || 'medium',
          c.status || 'open',
          c.raisedBy?.name || 'Student',
          c.createdAt ? new Date(c.createdAt).toLocaleDateString() : 'N/A'
        ])
      ];
    } else if (domain === 'maintenance') {
      rows = [
        ['Title', 'Room', 'Status', 'Description', 'Resolution Notes', 'Date'],
        ...maintenanceData.map(m => [
          m.title || 'Maintenance Issue',
          m.roomId?.roomNumber || 'General Facility',
          m.status || 'open',
          m.description || '',
          m.resolutionNotes || 'None',
          m.createdAt ? new Date(m.createdAt).toLocaleDateString() : 'N/A'
        ])
      ];
    } else if (domain === 'attendance') {
      rows = [
        ['Metric', 'Count / Value'],
        ['Present Inside Hostel', attendanceData?.inside ?? attendanceData?.present ?? 0],
        ['Outside Hostel', attendanceData?.outside ?? attendanceData?.absent ?? 0],
        ['Attendance Rate', `${attendanceData?.rate ?? 95}%`],
      ];
    }

    if (rows.length === 0) {
      toast.error('No data available to export');
      return;
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.map((val: any) => `"${String(val).replace(/"/g, '""')}"`).join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`${domain.toUpperCase()} report exported successfully`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link
                href="/owner/dashboard"
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
                title="Back to Dashboard"
              >
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <FileText className="w-6 h-6 text-blue-600" />
                  Owner Operations & Audit Reports
                </h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  Comprehensive audit logs, cross-hostel telemetry, and financial accounting reports
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => loadDomainData(domain)}
                className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium shadow-sm transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium shadow-sm transition-colors print:hidden"
              >
                <Printer className="w-4 h-4 text-gray-500" />
                <span>Print</span>
              </button>
              <button
                onClick={exportCSV}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors print:hidden"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Controls: Hostel selector and Period filter */}
          <div className="mt-5 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-gray-700 font-medium">
                <Building2 className="w-4 h-4 text-blue-600" />
                <span>Property:</span>
                <select
                  value={selectedHostel || ''}
                  onChange={(e) => setSelectedHostel(e.target.value || '')}
                  className="px-3 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Managed Hostels</option>
                  {hostels.map((h: any) => (
                    <option key={h._id} value={h._id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-700 font-medium">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span>Period:</span>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value as any)}
                  className="px-3 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="quarter">This Quarter</option>
                  <option value="year">Year to Date</option>
                </select>
              </div>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search report entries..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Domain Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {domainTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = domain === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setDomain(tab.id);
                  setSearchTerm('');
                }}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                  isActive
                    ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm ring-1 ring-blue-500'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
                }`}
              >
                <Icon className={`w-5 h-5 mb-1.5 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                <span className="text-xs font-semibold">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 mt-6">
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mb-3" />
            <p className="text-sm font-medium text-gray-600">Compiling report telemetry...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 1. OCCUPANCY REPORT */}
            {domain === 'occupancy' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Rooms</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{occupancyData?.totalRooms ?? 0}</p>
                    <p className="text-xs text-gray-500 mt-1">Configured inventory</p>
                  </div>
                  <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Bed Capacity</p>
                    <p className="text-2xl font-bold text-blue-600 mt-1">{occupancyData?.totalCapacity ?? 0}</p>
                    <p className="text-xs text-gray-500 mt-1">Maximum resident ceiling</p>
                  </div>
                  <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Occupied Beds</p>
                    <p className="text-2xl font-bold text-green-600 mt-1">{occupancyData?.occupiedBeds ?? occupancyData?.totalOccupied ?? 0}</p>
                    <p className="text-xs text-gray-500 mt-1">Currently assigned</p>
                  </div>
                  <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Occupancy Rate</p>
                    <p className="text-2xl font-bold text-purple-600 mt-1">{occupancyData?.occupancyRate ?? 0}%</p>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                      <div
                        className="bg-purple-600 h-1.5 rounded-full"
                        style={{ width: `${Math.min(occupancyData?.occupancyRate ?? 0, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                  <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                    <h3 className="text-sm font-semibold text-gray-900">Inventory Distribution & Availability</h3>
                  </div>
                  <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="border border-green-200 bg-green-50/50 rounded-lg p-4 text-center">
                      <p className="text-sm font-medium text-green-800">Fully Occupied Rooms</p>
                      <p className="text-3xl font-bold text-green-700 mt-2">{occupancyData?.fullyOccupiedRooms ?? 0}</p>
                      <p className="text-xs text-green-600 mt-1">100% capacity utilized</p>
                    </div>
                    <div className="border border-amber-200 bg-amber-50/50 rounded-lg p-4 text-center">
                      <p className="text-sm font-medium text-amber-800">Partially Occupied Rooms</p>
                      <p className="text-3xl font-bold text-amber-700 mt-2">{occupancyData?.partiallyOccupiedRooms ?? 0}</p>
                      <p className="text-xs text-amber-600 mt-1">Has available vacant slots</p>
                    </div>
                    <div className="border border-blue-200 bg-blue-50/50 rounded-lg p-4 text-center">
                      <p className="text-sm font-medium text-blue-800">Available / Vacant Rooms</p>
                      <p className="text-3xl font-bold text-blue-700 mt-2">{occupancyData?.emptyRooms ?? occupancyData?.availableRooms ?? 0}</p>
                      <p className="text-xs text-blue-600 mt-1">Ready for allocation</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. STUDENTS REPORT */}
            {domain === 'students' && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">Registered Students Roster ({studentsData.length})</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="px-6 py-3 text-left font-medium">Student Name</th>
                        <th className="px-6 py-3 text-left font-medium">Contact</th>
                        <th className="px-6 py-3 text-left font-medium">Room Allocation</th>
                        <th className="px-6 py-3 text-left font-medium">Admission Date</th>
                        <th className="px-6 py-3 text-left font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {studentsData
                        .filter(s => 
                          (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (s.email || '').toLowerCase().includes(searchTerm.toLowerCase())
                        )
                        .map((s) => (
                          <tr key={s._id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                              <div>{s.name}</div>
                              <div className="text-xs text-gray-400">{s.studentId || s._id}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                              <div>{s.email}</div>
                              <div className="text-xs text-gray-400">{s.phone || '—'}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                              {s.roomNumber || s.roomId?.roomNumber ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                  Room {s.roomNumber || s.roomId?.roomNumber}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">Unallocated</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                              {s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '—'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                s.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                              }`}>
                                {s.status || 'active'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      {studentsData.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                            No student records found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 3. STAFF REPORT */}
            {domain === 'staff' && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">Staff Personnel & Roles ({staffData.length})</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="px-6 py-3 text-left font-medium">Staff Member</th>
                        <th className="px-6 py-3 text-left font-medium">Role</th>
                        <th className="px-6 py-3 text-left font-medium">Contact</th>
                        <th className="px-6 py-3 text-left font-medium">Assigned Property</th>
                        <th className="px-6 py-3 text-left font-medium">Account Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {staffData
                        .filter(st => (st.name || '').toLowerCase().includes(searchTerm.toLowerCase()))
                        .map((st) => (
                          <tr key={st._id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                              {st.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="capitalize px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 border">
                                {st.role}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                              <div>{st.email}</div>
                              <div className="text-xs text-gray-400">{st.phone || '—'}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                              {(st.hostels || []).map((h: any) => h.name || h).join(', ') || 'All Properties'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                st.isActive !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {st.isActive !== false ? 'Active' : 'Suspended'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      {staffData.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                            No staff members registered.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 4. REVENUE REPORT */}
            {domain === 'revenue' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Revenue</p>
                    <p className="text-3xl font-bold text-green-600 mt-2">
                      ₹{(revenueData?.totalRevenue ?? 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Recognized collections in period</p>
                  </div>
                  <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Pending Receivables</p>
                    <p className="text-3xl font-bold text-amber-600 mt-2">
                      ₹{(revenueData?.pendingAmount ?? 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Outstanding student dues</p>
                  </div>
                  <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Collection Efficiency</p>
                    <p className="text-3xl font-bold text-blue-600 mt-2">
                      {revenueData?.collectionRate ?? 100}%
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Realized vs. Invoiced</p>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Financial Health & Inflow Summary</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Operating income for selected period ({dateRange}) is tracked across room rent, mess charges, and security deposits.
                    Revenue realization is monitored against billing cycles to minimize delinquent arrears.
                  </p>
                </div>
              </div>
            )}

            {/* 5. PAYMENT REPORT */}
            {domain === 'payments' && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">Payment Transactions ({paymentsData.length})</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="px-6 py-3 text-left font-medium">Receipt / Transaction ID</th>
                        <th className="px-6 py-3 text-left font-medium">Student</th>
                        <th className="px-6 py-3 text-left font-medium">Amount</th>
                        <th className="px-6 py-3 text-left font-medium">Mode</th>
                        <th className="px-6 py-3 text-left font-medium">Date</th>
                        <th className="px-6 py-3 text-left font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {paymentsData
                        .filter(p => 
                          (p.receiptNumber || p.transactionId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (p.studentName || p.studentId?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
                        )
                        .map((p) => (
                          <tr key={p._id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-gray-900">
                              {p.receiptNumber || p.transactionId || p._id.slice(-8).toUpperCase()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-900 font-medium">
                              {p.studentName || p.studentId?.name || 'Resident'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-900 font-bold">
                              ₹{(p.amount || 0).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-600 capitalize">
                              {p.paymentMethod || 'Online'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                              {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '—'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                {p.status || 'completed'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      {paymentsData.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                            No payment transactions recorded.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 6. COMPLAINTS REPORT */}
            {domain === 'complaints' && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">Complaints & Grievance Logs ({complaintsData.length})</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="px-6 py-3 text-left font-medium">Title & Details</th>
                        <th className="px-6 py-3 text-left font-medium">Category</th>
                        <th className="px-6 py-3 text-left font-medium">Priority</th>
                        <th className="px-6 py-3 text-left font-medium">Reported By</th>
                        <th className="px-6 py-3 text-left font-medium">Date</th>
                        <th className="px-6 py-3 text-left font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {complaintsData
                        .filter(c => (c.title || '').toLowerCase().includes(searchTerm.toLowerCase()))
                        .map((c) => (
                          <tr key={c._id} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <div className="font-medium text-gray-900">{c.title}</div>
                              <div className="text-xs text-gray-500 line-clamp-1">{c.description}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="capitalize text-xs font-semibold px-2 py-0.5 bg-gray-100 rounded text-gray-700">
                                {c.category || 'General'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${
                                c.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                                c.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {c.priority || 'medium'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-700 text-xs">
                              {c.raisedBy?.name || 'Resident'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-500 text-xs">
                              {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${
                                c.status === 'resolved' ? 'bg-green-100 text-green-800' :
                                c.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                                'bg-amber-100 text-amber-800'
                              }`}>
                                {c.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      {complaintsData.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                            No complaints reported.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 7. MAINTENANCE REPORT */}
            {domain === 'maintenance' && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">Maintenance & Repair Work Orders ({maintenanceData.length})</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="px-6 py-3 text-left font-medium">Issue</th>
                        <th className="px-6 py-3 text-left font-medium">Target Location / Room</th>
                        <th className="px-6 py-3 text-left font-medium">Assigned To</th>
                        <th className="px-6 py-3 text-left font-medium">Date</th>
                        <th className="px-6 py-3 text-left font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {maintenanceData
                        .filter(m => (m.title || '').toLowerCase().includes(searchTerm.toLowerCase()))
                        .map((m) => (
                          <tr key={m._id} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <div className="font-medium text-gray-900">{m.title}</div>
                              <div className="text-xs text-gray-500">{m.description}</div>
                              {m.resolutionNotes && (
                                <div className="text-xs text-green-700 mt-1 font-medium">
                                  Notes: {m.resolutionNotes}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                              {m.roomId?.roomNumber ? `Room ${m.roomId.roomNumber}` : 'General Premises'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-600 text-xs">
                              {m.assignedTo?.name || 'Unassigned'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-500 text-xs">
                              {m.createdAt ? new Date(m.createdAt).toLocaleDateString() : '—'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${
                                m.status === 'resolved' ? 'bg-green-100 text-green-800' :
                                m.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                                'bg-amber-100 text-amber-800'
                              }`}>
                                {m.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      {maintenanceData.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                            No maintenance requests logged.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 8. ATTENDANCE SUMMARY REPORT */}
            {domain === 'attendance' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm text-center">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Inside Hostel</p>
                    <p className="text-3xl font-bold text-green-600 mt-2">
                      {attendanceData?.inside ?? attendanceData?.present ?? 0}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Verified safe on-premises</p>
                  </div>
                  <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm text-center">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Outside Hostel / On Leave</p>
                    <p className="text-3xl font-bold text-amber-600 mt-2">
                      {attendanceData?.outside ?? attendanceData?.absent ?? 0}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Authorized leaves & off-campus</p>
                  </div>
                  <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm text-center">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Attendance Compliance</p>
                    <p className="text-3xl font-bold text-blue-600 mt-2">
                      {attendanceData?.rate ?? 95}%
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Daily curfew adherence metric</p>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Gate Logs & Curfew Policy Overview</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Student location and gate telemetry is maintained by the Warden and Security personnel at entrance checkpoints.
                    Owners maintain strategic auditing visibility to guarantee perimeter safety without interfering in minute-to-minute operations.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
