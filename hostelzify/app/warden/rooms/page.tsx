'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import {
  BedDouble,
  Users,
  Search,
  Filter,
  RefreshCw,
  Building,
  ArrowRightLeft,
  UserPlus,
  LogOut,
  Wrench,
  History,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  Layers,
  ChevronRight,
  AlertCircle,
  X,
  LayoutGrid,
  List,
  Info,
  Check,
} from 'lucide-react';

interface StudentResident {
  _id: string;
  name: string;
  studentId?: string;
  phone?: string;
  email?: string;
  gender?: string;
  course?: string;
  year?: string | number;
  status: string;
  profileImage?: string;
}

interface RoomItem {
  _id: string;
  roomNumber: string;
  floorNumber: number;
  capacity: number;
  currentOccupancy: number;
  availableBeds: number;
  status: 'available' | 'occupied' | 'maintenance' | 'unavailable';
  category: 'AC' | 'Non-AC' | 'Deluxe' | 'Standard';
  amenities?: string[];
  blockId?: {
    _id: string;
    name: string;
  };
  hostelId?: {
    _id: string;
    name: string;
  };
  students: StudentResident[];
}

export default function WardenRoomsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // View Mode: 'pipeline' (Occupancy Table: Room -> Capacity -> Occupied -> Available -> Students) or 'grid' (Visual Bed Cards)
  const [viewMode, setViewMode] = useState<'pipeline' | 'grid'>('pipeline');

  // Filters
  const [search, setSearch] = useState('');
  const [selectedFloor, setSelectedFloor] = useState('all');
  const [selectedBlock, setSelectedBlock] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Facets & Metrics
  const [floors, setFloors] = useState<number[]>([]);
  const [blocks, setBlocks] = useState<Array<{ _id: string; name: string }>>([]);
  const [metrics, setMetrics] = useState({
    totalRooms: 0,
    totalBeds: 0,
    occupiedBeds: 0,
    vacantBeds: 0,
    occupancyRate: 0,
    maintenanceRooms: 0,
  });

  // Modals State
  // 1. Assign Modal
  const [assignModal, setAssignModal] = useState<{
    open: boolean;
    room: RoomItem | null;
    selectedStudentId: string;
    reason: string;
    loading: boolean;
  }>({ open: false, room: null, selectedStudentId: '', reason: '', loading: false });
  const [unassignedStudents, setUnassignedStudents] = useState<StudentResident[]>([]);
  const [unassignedSearch, setUnassignedSearch] = useState('');

  // 2. Transfer Modal
  const [transferModal, setTransferModal] = useState<{
    open: boolean;
    student: StudentResident | null;
    fromRoom: RoomItem | null;
    toRoomId: string;
    reason: string;
    loading: boolean;
  }>({ open: false, student: null, fromRoom: null, toRoomId: '', reason: '', loading: false });

  // 3. Vacate Modal (Destructive Confirmation)
  const [vacateModal, setVacateModal] = useState<{
    open: boolean;
    student: StudentResident | null;
    room: RoomItem | null;
    reason: string;
    loading: boolean;
  }>({ open: false, student: null, room: null, reason: '', loading: false });

  // 4. Status / Maintenance Modal
  const [statusModal, setStatusModal] = useState<{
    open: boolean;
    room: RoomItem | null;
    targetStatus: 'available' | 'maintenance' | 'unavailable';
    reason: string;
    loading: boolean;
  }>({ open: false, room: null, targetStatus: 'maintenance', reason: '', loading: false });

  // 5. Report Problem Modal
  const [problemModal, setProblemModal] = useState<{
    open: boolean;
    room: RoomItem | null;
    title: string;
    description: string;
    priority: string;
    complaintType: string;
    loading: boolean;
  }>({
    open: false,
    room: null,
    title: '',
    description: '',
    priority: 'medium',
    complaintType: 'maintenance',
    loading: false,
  });

  // 6. Allocation History Drawer / Modal
  const [historyModal, setHistoryModal] = useState<{
    open: boolean;
    roomId?: string;
    roomNumber?: string;
    logs: any[];
    loading: boolean;
    total: number;
    page: number;
  }>({ open: false, logs: [], loading: false, total: 0, page: 1 });

  // Fetch Rooms Data
  const loadRooms = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const res = await api.getWardenRooms({
          floor: selectedFloor !== 'all' ? selectedFloor : undefined,
          block: selectedBlock !== 'all' ? selectedBlock : undefined,
          status: selectedStatus !== 'all' ? selectedStatus : undefined,
          category: selectedCategory !== 'all' ? selectedCategory : undefined,
          search: search.trim() || undefined,
        });

        if (res?.success && res.data) {
          setRooms(res.data.rooms || []);
          if (res.data.floors) setFloors(res.data.floors);
          if (res.data.blocks) setBlocks(res.data.blocks);
          if (res.data.metrics) setMetrics(res.data.metrics);
        }
      } catch (error: any) {
        console.error('Failed to load rooms:', error);
        toast.error(error.message || 'Failed to load rooms');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedFloor, selectedBlock, selectedStatus, selectedCategory, search]
  );

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  // Load Unassigned Students for Assign Modal
  const openAssignModal = async (room: RoomItem) => {
    if (room.status === 'maintenance' || room.status === 'unavailable') {
      toast.error(`Room ${room.roomNumber} is currently under ${room.status}. Cannot assign students.`);
      return;
    }
    if (room.availableBeds <= 0) {
      toast.error(`Room ${room.roomNumber} is already at full capacity (${room.capacity}/${room.capacity} beds).`);
      return;
    }

    setAssignModal({
      open: true,
      room,
      selectedStudentId: '',
      reason: '',
      loading: false,
    });
    setUnassignedSearch('');

    try {
      const res = await api.getWardenUnassignedStudents();
      if (res?.success && res.data) {
        setUnassignedStudents(res.data);
      }
    } catch (err) {
      console.warn('Could not load unassigned students:', err);
    }
  };

  // Submit Assignment
  const handleAssignSubmit = async () => {
    if (!assignModal.room || !assignModal.selectedStudentId) {
      toast.error('Please select a student to assign');
      return;
    }

    setAssignModal((prev) => ({ ...prev, loading: true }));
    try {
      const res = await api.assignWardenBed(assignModal.room._id, {
        studentId: assignModal.selectedStudentId,
        reason: assignModal.reason,
      });

      if (res?.success) {
        toast.success(res.message || 'Student assigned to bed successfully');
        setAssignModal((prev) => ({ ...prev, open: false }));
        loadRooms(true);
      } else {
        toast.error(res?.message || 'Failed to assign bed');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to assign bed');
    } finally {
      setAssignModal((prev) => ({ ...prev, loading: false }));
    }
  };

  // Open Transfer Modal
  const openTransferModal = (student: StudentResident, fromRoom: RoomItem) => {
    setTransferModal({
      open: true,
      student,
      fromRoom,
      toRoomId: '',
      reason: '',
      loading: false,
    });
  };

  // Submit Transfer
  const handleTransferSubmit = async () => {
    if (!transferModal.student || !transferModal.fromRoom || !transferModal.toRoomId) {
      toast.error('Please select a destination room');
      return;
    }

    setTransferModal((prev) => ({ ...prev, loading: true }));
    try {
      const res = await api.transferWardenBed({
        studentId: transferModal.student._id,
        fromRoomId: transferModal.fromRoom._id,
        toRoomId: transferModal.toRoomId,
        reason: transferModal.reason,
      });

      if (res?.success) {
        toast.success(res.message || 'Student transferred successfully');
        setTransferModal((prev) => ({ ...prev, open: false }));
        loadRooms(true);
      } else {
        toast.error(res?.message || 'Failed to transfer student');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to transfer student');
    } finally {
      setTransferModal((prev) => ({ ...prev, loading: false }));
    }
  };

  // Open Vacate Confirmation Modal
  const openVacateModal = (student: StudentResident, room: RoomItem) => {
    setVacateModal({
      open: true,
      student,
      room,
      reason: '',
      loading: false,
    });
  };

  // Submit Vacate
  const handleVacateSubmit = async () => {
    if (!vacateModal.student || !vacateModal.room) return;

    setVacateModal((prev) => ({ ...prev, loading: true }));
    try {
      const res = await api.vacateWardenBed(vacateModal.room._id, {
        studentId: vacateModal.student._id,
        reason: vacateModal.reason,
      });

      if (res?.success) {
        toast.success(res.message || 'Student vacated successfully');
        setVacateModal((prev) => ({ ...prev, open: false }));
        loadRooms(true);
      } else {
        toast.error(res?.message || 'Failed to vacate student');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to vacate student');
    } finally {
      setVacateModal((prev) => ({ ...prev, loading: false }));
    }
  };

  // Open Status Modal
  const openStatusModal = (room: RoomItem) => {
    setStatusModal({
      open: true,
      room,
      targetStatus: room.status === 'maintenance' || room.status === 'unavailable' ? 'available' : 'maintenance',
      reason: '',
      loading: false,
    });
  };

  // Submit Status Change
  const handleStatusSubmit = async () => {
    if (!statusModal.room) return;

    setStatusModal((prev) => ({ ...prev, loading: true }));
    try {
      const res = await api.updateWardenRoomStatus(statusModal.room._id, {
        status: statusModal.targetStatus,
        reason: statusModal.reason,
      });

      if (res?.success) {
        toast.success(res.message || 'Room status updated successfully');
        setStatusModal((prev) => ({ ...prev, open: false }));
        loadRooms(true);
      } else {
        toast.error(res?.message || 'Failed to update status');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update status');
    } finally {
      setStatusModal((prev) => ({ ...prev, loading: false }));
    }
  };

  // Open Problem Report Modal
  const openProblemModal = (room: RoomItem) => {
    setProblemModal({
      open: true,
      room,
      title: '',
      description: '',
      priority: 'medium',
      complaintType: 'maintenance',
      loading: false,
    });
  };

  // Submit Problem Report
  const handleProblemSubmit = async () => {
    if (!problemModal.room || !problemModal.title.trim() || !problemModal.description.trim()) {
      toast.error('Title and description are required');
      return;
    }

    setProblemModal((prev) => ({ ...prev, loading: true }));
    try {
      const res = await api.reportWardenRoomProblem(problemModal.room._id, {
        title: problemModal.title,
        description: problemModal.description,
        priority: problemModal.priority,
        complaintType: problemModal.complaintType,
      });

      if (res?.success) {
        toast.success(`Problem ticket logged for Room ${problemModal.room.roomNumber}`);
        setProblemModal((prev) => ({ ...prev, open: false }));
      } else {
        toast.error(res?.message || 'Failed to report problem');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to report problem');
    } finally {
      setProblemModal((prev) => ({ ...prev, loading: false }));
    }
  };

  // Open Allocation History
  const openHistory = async (roomId?: string, roomNumber?: string) => {
    setHistoryModal({
      open: true,
      roomId,
      roomNumber,
      logs: [],
      loading: true,
      total: 0,
      page: 1,
    });

    try {
      const res = await api.getWardenRoomAllocationHistory({ roomId, page: 1, limit: 30 });
      if (res?.success) {
        setHistoryModal((prev) => ({
          ...prev,
          logs: res.data || [],
          total: res.pagination?.total || 0,
          loading: false,
        }));
      }
    } catch (err: any) {
      toast.error('Failed to load allocation history');
      setHistoryModal((prev) => ({ ...prev, loading: false }));
    }
  };

  // Rooms eligible for transfer (has available bed & not maintenance & not same room)
  const availableTargetRooms = rooms.filter((r) => {
    if (!transferModal.fromRoom) return false;
    if (r._id === transferModal.fromRoom._id) return false;
    if (r.status === 'maintenance' || r.status === 'unavailable') return false;
    return r.availableBeds > 0;
  });

  const hasActiveFilters =
    search.trim() !== '' ||
    selectedFloor !== 'all' ||
    selectedBlock !== 'all' ||
    selectedStatus !== 'all' ||
    selectedCategory !== 'all';

  const handleResetFilters = () => {
    setSearch('');
    setSelectedFloor('all');
    setSelectedBlock('all');
    setSelectedStatus('all');
    setSelectedCategory('all');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
            <BedDouble className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Room & Bed Management</h1>
            <p className="text-sm text-gray-500">
              Live room occupancy, bed allocation pipeline, transfers, and maintenance oversight.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* View mode switcher */}
          <div className="bg-gray-100 p-1 rounded-xl flex items-center gap-1 border border-gray-200/80">
            <button
              onClick={() => setViewMode('pipeline')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'pipeline'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Occupancy Pipeline Table View"
            >
              <List className="w-3.5 h-3.5" />
              <span>Pipeline</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'grid'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Visual Bed Slots Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Bed Slots</span>
            </button>
          </div>

          <button
            onClick={() => openHistory()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-semibold border border-gray-200 shadow-xs transition-colors"
          >
            <History className="w-3.5 h-3.5 text-indigo-600" />
            <span>Audit History</span>
          </button>

          <button
            onClick={() => loadRooms(true)}
            disabled={refreshing || loading}
            className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl border border-gray-200 transition-colors disabled:opacity-50"
            title="Refresh Rooms"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase">Total Rooms</p>
            <p className="text-xl font-bold text-gray-900">{metrics.totalRooms}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
            <BedDouble className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase">Total Bed Capacity</p>
            <p className="text-xl font-bold text-purple-900">{metrics.totalBeds}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-blue-100 bg-blue-50/20 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-blue-600 uppercase">Occupied Beds</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-blue-900">{metrics.occupiedBeds}</span>
              <span className="text-xs font-semibold text-blue-600">({metrics.occupancyRate}%)</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-100 bg-emerald-50/20 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-emerald-600 uppercase">Available Beds</p>
            <p className="text-xl font-bold text-emerald-900">{metrics.vacantBeds}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-100 bg-amber-50/20 shadow-xs flex items-center gap-3 col-span-2 sm:col-span-1">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-amber-600 uppercase">Maintenance</p>
            <p className="text-xl font-bold text-amber-900">{metrics.maintenanceRooms} rooms</p>
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Room number (e.g. 101, 204)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* Floor */}
            <div>
              <select
                value={selectedFloor}
                onChange={(e) => setSelectedFloor(e.target.value)}
                aria-label="Filter by Floor"
                className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              >
                <option value="all">All Floors</option>
                {floors.map((f) => (
                  <option key={f} value={f}>
                    Floor {f}
                  </option>
                ))}
              </select>
            </div>

            {/* Block */}
            <div>
              <select
                value={selectedBlock}
                onChange={(e) => setSelectedBlock(e.target.value)}
                aria-label="Filter by Block"
                className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              >
                <option value="all">All Blocks</option>
                {blocks.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                aria-label="Filter by Status"
                className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              >
                <option value="all">All Status</option>
                <option value="available">Available Beds</option>
                <option value="occupied">Fully Occupied</option>
                <option value="maintenance">Maintenance</option>
                <option value="unavailable">Unavailable</option>
              </select>
            </div>

            {/* Category */}
            <div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                aria-label="Filter by Category"
                className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              >
                <option value="all">All Categories</option>
                <option value="Standard">Standard</option>
                <option value="Deluxe">Deluxe</option>
                <option value="AC">AC</option>
                <option value="Non-AC">Non-AC</option>
              </select>
            </div>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs">
            <span className="text-gray-500">Filtered rooms</span>
            <button
              onClick={handleResetFilters}
              className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Content View */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center shadow-sm">
          <div className="inline-block animate-spin text-indigo-600 mb-3">
            <RefreshCw className="w-8 h-8" />
          </div>
          <p className="text-sm font-semibold text-gray-700">Loading rooms and bed occupancy...</p>
        </div>
      ) : rooms.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center shadow-sm">
          <BedDouble className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-900 mb-1">No rooms match your filter</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto mb-4">
            Try adjusting your search query, floor filter, or room status.
          </p>
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl text-xs font-semibold transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : viewMode === 'pipeline' ? (
        /* ==================== VIEW 1: OCCUPANCY PIPELINE TABLE ==================== */
        /* Exact layout: Room → Capacity → Occupied Beds → Available Beds → Students */
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/80 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-3.5 px-5">Room</th>
                  <th className="py-3.5 px-4 text-center">Capacity</th>
                  <th className="py-3.5 px-4 text-center">Occupied Beds</th>
                  <th className="py-3.5 px-4 text-center">Available Beds</th>
                  <th className="py-3.5 px-5">Assigned Students</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {rooms.map((room) => {
                  const isMaintenance = room.status === 'maintenance' || room.status === 'unavailable';
                  const isFull = room.availableBeds <= 0;

                  return (
                    <tr key={room._id} className="hover:bg-indigo-50/20 transition-colors">
                      {/* 1. ROOM */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border ${
                              isMaintenance
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : isFull
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}
                          >
                            {room.roomNumber}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-gray-900">Room {room.roomNumber}</span>
                              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                                {room.category}
                              </span>
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">
                              Floor {room.floorNumber}
                              {room.blockId?.name ? ` • Block ${room.blockId.name}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* 2. CAPACITY */}
                      <td className="py-4 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-800 font-bold text-xs">
                          <BedDouble className="w-3.5 h-3.5 text-gray-500" />
                          <span>{room.capacity} Beds</span>
                        </span>
                      </td>

                      {/* 3. OCCUPIED BEDS */}
                      <td className="py-4 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                            room.currentOccupancy > 0
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-gray-50 text-gray-500 border-gray-200'
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              room.currentOccupancy > 0 ? 'bg-blue-600' : 'bg-gray-400'
                            }`}
                          />
                          <span>{room.currentOccupancy} Occupied</span>
                        </span>
                      </td>

                      {/* 4. AVAILABLE BEDS */}
                      <td className="py-4 px-4 text-center">
                        {isMaintenance ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 uppercase text-[10px]">
                            <Wrench className="w-3 h-3" />
                            <span>{room.status}</span>
                          </span>
                        ) : room.availableBeds > 0 ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span>{room.availableBeds} Vacant</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-gray-100 text-gray-500">
                            0 Vacant (Full)
                          </span>
                        )}
                      </td>

                      {/* 5. STUDENTS */}
                      <td className="py-4 px-5">
                        {room.students.length === 0 ? (
                          <span className="text-xs text-gray-400 italic">No students allocated</span>
                        ) : (
                          <div className="flex flex-col gap-1.5 max-w-sm">
                            {room.students.map((student) => (
                              <div
                                key={student._id}
                                className="flex items-center justify-between gap-2 p-1.5 pr-2 rounded-lg bg-gray-50 border border-gray-200/80 text-xs group"
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                                    {student.name ? student.name[0].toUpperCase() : 'S'}
                                  </div>
                                  <Link
                                    href={`/warden/students/${student._id}`}
                                    className="font-semibold text-gray-800 hover:text-indigo-600 truncate"
                                  >
                                    {student.name}
                                  </Link>
                                  {student.studentId && (
                                    <span className="text-[10px] text-gray-400 font-mono hidden sm:inline">
                                      ({student.studentId})
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={() => openTransferModal(student, room)}
                                    title="Transfer Student"
                                    className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                  >
                                    <ArrowRightLeft className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => openVacateModal(student, room)}
                                    title="Vacate Bed"
                                    className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                  >
                                    <LogOut className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* 6. ACTIONS */}
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Assign Bed Button */}
                          <button
                            onClick={() => openAssignModal(room)}
                            disabled={isMaintenance || isFull}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-30 disabled:pointer-events-none transition-colors border border-indigo-100"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>Assign</span>
                          </button>

                          {/* Toggle Status / Maintenance */}
                          <button
                            onClick={() => openStatusModal(room)}
                            title={isMaintenance ? 'Restore Room Status' : 'Mark Maintenance / Unavailable'}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 border border-gray-200 transition-colors"
                          >
                            <Wrench className="w-3.5 h-3.5" />
                          </button>

                          {/* Report Problem */}
                          <button
                            onClick={() => openProblemModal(room)}
                            title="Report Room Problem Ticket"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 border border-gray-200 transition-colors"
                          >
                            <AlertCircle className="w-3.5 h-3.5" />
                          </button>

                          {/* View Room History */}
                          <button
                            onClick={() => openHistory(room._id, room.roomNumber)}
                            title="Room Allocation History"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 border border-gray-200 transition-colors"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ==================== VIEW 2: VISUAL BED SLOTS GRID ==================== */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms.map((room) => {
            const isMaintenance = room.status === 'maintenance' || room.status === 'unavailable';
            const isFull = room.availableBeds <= 0;

            // Generate slots for each bed in the room
            const bedSlots = Array.from({ length: room.capacity }).map((_, index) => {
              const student = room.students[index] || null;
              return { slotIndex: index + 1, student };
            });

            return (
              <div
                key={room._id}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4 hover:border-indigo-200 transition-all flex flex-col justify-between"
              >
                {/* Room Card Header */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border ${
                          isMaintenance
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : isFull
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {room.roomNumber}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-gray-900 text-base">Room {room.roomNumber}</h3>
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                            {room.category}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400">
                          Floor {room.floorNumber}
                          {room.blockId?.name ? ` • Block ${room.blockId.name}` : ''}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${
                        isMaintenance
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : isFull
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {isMaintenance ? room.status : `${room.currentOccupancy}/${room.capacity} Beds`}
                    </span>
                  </div>

                  {/* Bed Slots Visual Pipeline */}
                  <div className="mt-4 pt-3 border-t border-gray-100 space-y-2">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Bed Allocations</p>
                    <div className="grid grid-cols-1 gap-2">
                      {bedSlots.map((slot) => (
                        <div
                          key={slot.slotIndex}
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                            slot.student
                              ? 'bg-indigo-50/40 border-indigo-100'
                              : isMaintenance
                              ? 'bg-amber-50/30 border-amber-100'
                              : 'bg-gray-50 border-gray-200 border-dashed'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                              {slot.slotIndex}
                            </span>
                            {slot.student ? (
                              <div className="truncate">
                                <Link
                                  href={`/warden/students/${slot.student._id}`}
                                  className="font-bold text-gray-900 hover:text-indigo-600 truncate block"
                                >
                                  {slot.student.name}
                                </Link>
                                <span className="text-[10px] text-gray-500 font-mono">
                                  {slot.student.studentId || 'ID: —'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-400 italic">
                                {isMaintenance ? 'Unavailable (Maintenance)' : 'Vacant Bed Slot'}
                              </span>
                            )}
                          </div>

                          {slot.student ? (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => openTransferModal(slot.student!, room)}
                                className="px-2 py-1 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] font-semibold transition-colors"
                              >
                                Transfer
                              </button>
                              <button
                                onClick={() => openVacateModal(slot.student!, room)}
                                className="px-2 py-1 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-[11px] font-semibold transition-colors"
                              >
                                Vacate
                              </button>
                            </div>
                          ) : (
                            !isMaintenance && (
                              <button
                                onClick={() => openAssignModal(room)}
                                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-semibold transition-colors shrink-0"
                              >
                                + Assign
                              </button>
                            )
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openProblemModal(room)}
                      className="text-gray-600 hover:text-rose-600 font-semibold flex items-center gap-1"
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Report Issue</span>
                    </button>
                    <span>•</span>
                    <button
                      onClick={() => openStatusModal(room)}
                      className="text-gray-600 hover:text-amber-600 font-semibold flex items-center gap-1"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span>{isMaintenance ? 'Restore' : 'Status'}</span>
                    </button>
                  </div>

                  <button
                    onClick={() => openHistory(room._id, room.roomNumber)}
                    className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Audit Log</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ==================== MODAL 1: ASSIGN BED MODAL ==================== */}
      {assignModal.open && assignModal.room && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 border border-gray-200 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Assign Bed to Resident</h3>
                  <p className="text-xs text-gray-500">
                    Room {assignModal.room.roomNumber} ({assignModal.room.availableBeds} beds available)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAssignModal((prev) => ({ ...prev, open: false }))}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Unassigned Students Search & List */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-700">Select Unassigned Student</label>
                <input
                  type="text"
                  placeholder="Filter student by name or ID..."
                  value={unassignedSearch}
                  onChange={(e) => setUnassignedSearch(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />

                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
                  {unassignedStudents.filter((s) =>
                    unassignedSearch
                      ? s.name.toLowerCase().includes(unassignedSearch.toLowerCase()) ||
                        s.studentId?.toLowerCase().includes(unassignedSearch.toLowerCase())
                      : true
                  ).length === 0 ? (
                    <div className="p-4 text-center text-xs text-gray-500">
                      No unassigned active students found in this hostel.
                    </div>
                  ) : (
                    unassignedStudents
                      .filter((s) =>
                        unassignedSearch
                          ? s.name.toLowerCase().includes(unassignedSearch.toLowerCase()) ||
                            s.studentId?.toLowerCase().includes(unassignedSearch.toLowerCase())
                          : true
                      )
                      .map((student) => {
                        const isSelected = assignModal.selectedStudentId === student._id;
                        return (
                          <div
                            key={student._id}
                            onClick={() =>
                              setAssignModal((prev) => ({ ...prev, selectedStudentId: student._id }))
                            }
                            className={`p-3 flex items-center justify-between text-xs cursor-pointer transition-colors ${
                              isSelected ? 'bg-indigo-50/80 font-bold' : 'hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center">
                                {student.name ? student.name[0].toUpperCase() : 'S'}
                              </div>
                              <div>
                                <p className="text-gray-900 font-semibold">{student.name}</p>
                                <p className="text-[10px] text-gray-400 font-mono">{student.studentId || 'ID Pending'}</p>
                              </div>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-indigo-600" />}
                          </div>
                        );
                      })
                  )}
                </div>
              </div>

              {/* Allocation Notes */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Allocation Note / Reason (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Regular semester check-in, special request"
                  value={assignModal.reason}
                  onChange={(e) => setAssignModal((prev) => ({ ...prev, reason: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* Safeguard Notice */}
              <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-100 flex items-start gap-2 text-xs text-indigo-800">
                <Shield className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <p>
                  System safeguards ensure this student cannot be assigned to another room concurrently and room
                  capacity ({assignModal.room.capacity} beds) will never be exceeded.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                onClick={() => setAssignModal((prev) => ({ ...prev, open: false }))}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignSubmit}
                disabled={assignModal.loading || !assignModal.selectedStudentId}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50"
              >
                {assignModal.loading ? 'Assigning...' : 'Confirm Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL 2: TRANSFER BED MODAL ==================== */}
      {transferModal.open && transferModal.student && transferModal.fromRoom && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 border border-gray-200 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Transfer Student</h3>
                  <p className="text-xs text-gray-500">
                    Moving {transferModal.student.name} from Room {transferModal.fromRoom.roomNumber}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setTransferModal((prev) => ({ ...prev, open: false }))}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Target Room Selector */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Select Destination Room (Vacant beds only)
                </label>
                <select
                  value={transferModal.toRoomId}
                  onChange={(e) => setTransferModal((prev) => ({ ...prev, toRoomId: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="">-- Choose Target Room --</option>
                  {availableTargetRooms.map((r) => (
                    <option key={r._id} value={r._id}>
                      Room {r.roomNumber} (Floor {r.floorNumber}, {r.category}) — {r.availableBeds} beds available
                    </option>
                  ))}
                </select>
              </div>

              {/* Transfer Reason */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Reason for Transfer</label>
                <input
                  type="text"
                  placeholder="e.g. Mutual swap, AC upgrade, noise concerns"
                  value={transferModal.reason}
                  onChange={(e) => setTransferModal((prev) => ({ ...prev, reason: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* Safeguard Notice */}
              <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-100 flex items-start gap-2 text-blue-900">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p>
                  System safeguards ensure the source bed will be freed immediately and destination bed occupancy
                  updated in real time.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                onClick={() => setTransferModal((prev) => ({ ...prev, open: false }))}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleTransferSubmit}
                disabled={transferModal.loading || !transferModal.toRoomId}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
              >
                {transferModal.loading ? 'Transferring...' : 'Execute Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL 3: VACATE BED CONFIRMATION ==================== */}
      {vacateModal.open && vacateModal.student && vacateModal.room && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 border border-gray-200 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-2">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-gray-900 text-lg">Vacate Resident Bed?</h3>
              <p className="text-xs text-gray-500">
                You are about to remove <strong className="text-gray-800">{vacateModal.student.name}</strong> from{' '}
                <strong className="text-gray-800">Room {vacateModal.room.roomNumber}</strong>. The bed will become vacant
                immediately.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Reason for Vacating (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. End of semester, hostel exit, withdrawal"
                  value={vacateModal.reason}
                  onChange={(e) => setVacateModal((prev) => ({ ...prev, reason: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                onClick={() => setVacateModal((prev) => ({ ...prev, open: false }))}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleVacateSubmit}
                disabled={vacateModal.loading}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors disabled:opacity-50"
              >
                {vacateModal.loading ? 'Vacating...' : 'Confirm Vacate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL 4: ROOM STATUS / MAINTENANCE ==================== */}
      {statusModal.open && statusModal.room && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 border border-gray-200 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-gray-900 text-base">
                  Update Room {statusModal.room.roomNumber} Status
                </h3>
              </div>
              <button
                onClick={() => setStatusModal((prev) => ({ ...prev, open: false }))}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Select New Status</label>
                <select
                  value={statusModal.targetStatus}
                  onChange={(e) => setStatusModal((prev) => ({ ...prev, targetStatus: e.target.value as any }))}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800"
                >
                  <option value="available">Available (Operational)</option>
                  <option value="maintenance">Maintenance (Locked)</option>
                  <option value="unavailable">Unavailable (Admin Hold)</option>
                </select>
              </div>

              {statusModal.room.currentOccupancy > 0 && statusModal.targetStatus !== 'available' && (
                <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-amber-800 space-y-1">
                  <p className="font-bold flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Warning: Room has {statusModal.room.currentOccupancy} active resident(s)</span>
                  </p>
                  <p className="text-[11px]">
                    Marking this room as {statusModal.targetStatus} will prevent new allocations, but existing
                    residents will remain recorded unless transferred or vacated.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Reason / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Electrical rewiring, deep cleaning, paintwork"
                  value={statusModal.reason}
                  onChange={(e) => setStatusModal((prev) => ({ ...prev, reason: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                onClick={() => setStatusModal((prev) => ({ ...prev, open: false }))}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStatusSubmit}
                disabled={statusModal.loading}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50"
              >
                {statusModal.loading ? 'Updating...' : 'Save Status'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL 5: REPORT ROOM PROBLEM ==================== */}
      {problemModal.open && problemModal.room && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 border border-gray-200 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-600" />
                <h3 className="font-bold text-gray-900 text-base">
                  Report Problem: Room {problemModal.room.roomNumber}
                </h3>
              </div>
              <button
                onClick={() => setProblemModal((prev) => ({ ...prev, open: false }))}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Issue Title</label>
                <input
                  type="text"
                  placeholder="e.g. Broken window latch, dripping tap"
                  value={problemModal.title}
                  onChange={(e) => setProblemModal((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Category</label>
                  <select
                    value={problemModal.complaintType}
                    onChange={(e) => setProblemModal((prev) => ({ ...prev, complaintType: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs"
                  >
                    <option value="maintenance">Maintenance</option>
                    <option value="cleaning">Cleaning</option>
                    <option value="safety">Safety</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Priority</label>
                  <select
                    value={problemModal.priority}
                    onChange={(e) => setProblemModal((prev) => ({ ...prev, priority: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Detailed Description</label>
                <textarea
                  rows={3}
                  placeholder="Provide details about the issue to assist the repair staff..."
                  value={problemModal.description}
                  onChange={(e) => setProblemModal((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                onClick={() => setProblemModal((prev) => ({ ...prev, open: false }))}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleProblemSubmit}
                disabled={problemModal.loading}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors disabled:opacity-50"
              >
                {problemModal.loading ? 'Submitting...' : 'Log Ticket'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL 6: ALLOCATION AUDIT TRAIL ==================== */}
      {historyModal.open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-4 border border-gray-200 shadow-2xl animate-in fade-in zoom-in-95 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="font-bold text-gray-900 text-base">
                    {historyModal.roomNumber
                      ? `Allocation History: Room ${historyModal.roomNumber}`
                      : 'Hostel Room & Bed Allocation Audit Trail'}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {historyModal.total} recorded events in the audit ledger
                  </p>
                </div>
              </div>
              <button
                onClick={() => setHistoryModal((prev) => ({ ...prev, open: false }))}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              {historyModal.loading ? (
                <div className="p-12 text-center">
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-600 mx-auto mb-2" />
                  <p className="text-gray-500">Loading audit history...</p>
                </div>
              ) : historyModal.logs.length === 0 ? (
                <p className="p-8 text-center text-gray-400">No allocation events logged yet.</p>
              ) : (
                historyModal.logs.map((log) => {
                  const actionColorMap: Record<string, string> = {
                    assign: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    transfer: 'bg-blue-50 text-blue-700 border-blue-200',
                    vacate: 'bg-rose-50 text-rose-700 border-rose-200',
                    status_change: 'bg-purple-50 text-purple-700 border-purple-200',
                    maintenance: 'bg-amber-50 text-amber-700 border-amber-200',
                  };
                  const actionColor = actionColorMap[log.action] || 'bg-gray-100 text-gray-700 border-gray-200';

                  return (
                    <div
                      key={log._id}
                      className="p-3.5 rounded-xl border border-gray-200 bg-gray-50/60 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${actionColor}`}
                        >
                          {log.action.replace('_', ' ')}
                        </span>
                        <span className="text-[11px] text-gray-400 font-mono">
                          {new Date(log.createdAt).toLocaleString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <div>
                          {log.studentId ? (
                            <p className="font-bold text-gray-900">
                              {log.studentId.name}{' '}
                              <span className="font-mono text-gray-400 font-normal">
                                ({log.studentId.studentId || 'ID: —'})
                              </span>
                            </p>
                          ) : (
                            <p className="font-semibold text-gray-800">Room Status Modification</p>
                          )}
                        </div>

                        <div className="text-right text-[11px] font-semibold text-gray-700">
                          {log.action === 'transfer' ? (
                            <span>
                              Room {log.fromRoomId?.roomNumber || '—'} → Room {log.toRoomId?.roomNumber || '—'}
                            </span>
                          ) : log.action === 'assign' ? (
                            <span>→ Room {log.toRoomId?.roomNumber || log.details?.roomNumber || '—'}</span>
                          ) : log.action === 'vacate' ? (
                            <span>Left Room {log.fromRoomId?.roomNumber || log.details?.roomNumber || '—'}</span>
                          ) : (
                            <span>{log.details?.previousStatus} → {log.details?.newStatus}</span>
                          )}
                        </div>
                      </div>

                      {log.reason && (
                        <p className="text-[11px] text-gray-500 italic">Note: &quot;{log.reason}&quot;</p>
                      )}

                      {log.performedBy && (
                        <p className="text-[10px] text-gray-400 pt-0.5 border-t border-gray-200/50">
                          Recorded by: {log.performedBy.name} ({log.performedBy.role})
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-3 border-t border-gray-100 flex justify-end shrink-0">
              <button
                onClick={() => setHistoryModal((prev) => ({ ...prev, open: false }))}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-800 transition-colors"
              >
                Close Audit History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
