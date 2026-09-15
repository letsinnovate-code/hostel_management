'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import { useToast } from '../../../components/Toast';
import { useConfirmModal } from '../../../components/ConfirmModal';
import {
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  Trash2,
  Users,
  Home,
  Wrench,
  CheckCircle,
  XCircle,
  Loader2,
  Building2,
  Layers,
  BedDouble,
  UserCheck,
  Sparkles,
  LayoutGrid,
  Table as TableIcon,
  X,
} from 'lucide-react';

import { useRoomsQuery, useDeleteRoomMutation } from '../../../hooks/queries/useRoomsQuery';
import { useHostelsQuery } from '../../../hooks/queries/useHostelsQuery';
import { useOwnerHostel } from '../../../contexts/OwnerHostelContext';

export default function RoomsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const { confirm } = useConfirmModal();
  const { selectedHostel, setSelectedHostel, hostels: ownerHostels } = useOwnerHostel();

  const [viewMode, setViewMode] = useState<'hierarchy' | 'table'>('hierarchy');
  const [filters, setFilters] = useState({
    hostelId: selectedHostel || '',
    status: '',
    category: '',
    search: '',
  });

  // Modal for creating building / block
  const [createBlockModal, setCreateBlockModal] = useState(false);
  const [blockForm, setBlockForm] = useState({
    name: '',
    hostelId: selectedHostel || '',
    floorsCount: 3,
  });
  const [creatingBlock, setCreatingBlock] = useState(false);
  const [allocating, setAllocating] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'owner') {
      router.replace('/login');
    }
  }, [user, router]);

  useEffect(() => {
    if (selectedHostel) {
      setFilters((prev) => ({ ...prev, hostelId: selectedHostel }));
      setBlockForm((prev) => ({ ...prev, hostelId: selectedHostel }));
    }
  }, [selectedHostel]);

  const { data: hostels = [], isLoading: hostelsLoading } = useHostelsQuery();
  const {
    data: rooms = [],
    isLoading: roomsLoading,
    isError,
    error,
    refetch: refetchRooms,
  } = useRoomsQuery({ hostelId: filters.hostelId });

  const deleteRoomMutation = useDeleteRoomMutation();
  const loading = hostelsLoading || roomsLoading;

  useEffect(() => {
    if (isError && error) {
      showToast((error as any)?.message || 'Failed to load rooms', 'error');
    }
  }, [isError, error, showToast]);

  const handleDelete = async (room: any) => {
    const result = await confirm({
      title: 'Delete Room',
      message: `Are you sure you want to delete room ${room.roomNumber}? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      confirmButtonClass: 'bg-red-600 hover:bg-red-700',
    });

    if (result) {
      try {
        await deleteRoomMutation.mutateAsync(room._id || room.id);
        showToast('Room deleted successfully', 'success');
      } catch (err: any) {
        showToast(err.message || 'Failed to delete room', 'error');
      }
    }
  };

  const handleCreateBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockForm.name.trim() || !blockForm.hostelId) {
      showToast('Please enter block name and select a hostel', 'error');
      return;
    }
    setCreatingBlock(true);
    try {
      const floors = Array.from({ length: Number(blockForm.floorsCount) || 1 }, (_, i) => ({
        floorNumber: i + 1,
        rooms: [],
      }));
      await api.createBlock({
        name: blockForm.name.trim(),
        hostelId: blockForm.hostelId,
        floors,
      });
      showToast('Building / Block created successfully', 'success');
      setCreateBlockModal(false);
      setBlockForm({ name: '', hostelId: selectedHostel || '', floorsCount: 3 });
      refetchRooms();
    } catch (err: any) {
      showToast(err.message || 'Failed to create block', 'error');
    } finally {
      setCreatingBlock(false);
    }
  };

  const handleAutoAllocate = async () => {
    if (!filters.hostelId) {
      showToast('Please select a hostel first', 'error');
      return;
    }
    const result = await confirm({
      title: 'Auto-Allocate Rooms',
      message: 'This will automatically allocate unassigned students to available beds in this hostel based on capacity. Proceed?',
      confirmText: 'Allocate Now',
      cancelText: 'Cancel',
      confirmButtonClass: 'bg-blue-600 hover:bg-blue-700',
    });
    if (result) {
      setAllocating(true);
      try {
        await api.autoAllocateRooms({ hostelId: filters.hostelId });
        showToast('Auto-allocation completed successfully', 'success');
        refetchRooms();
      } catch (err: any) {
        showToast(err.message || 'Auto-allocation failed', 'error');
      } finally {
        setAllocating(false);
      }
    }
  };

  const filteredRooms = useMemo(() => {
    return rooms.filter((room: any) => {
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const blockIdStr = typeof room.blockId === 'string' ? room.blockId : room.blockId?.name || '';
        if (
          !room.roomNumber?.toLowerCase().includes(searchLower) &&
          !blockIdStr.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }
      if (filters.status && room.status !== filters.status) return false;
      if (filters.category && room.category !== filters.category) return false;
      return true;
    });
  }, [rooms, filters]);

  // Overall capacity calculations
  const stats = useMemo(() => {
    const totalRooms = filteredRooms.length;
    let totalCapacity = 0;
    let occupiedBeds = 0;

    filteredRooms.forEach((r: any) => {
      totalCapacity += Number(r.capacity) || 0;
      const occ = Array.isArray(r.students) ? r.students.length : Number(r.currentOccupancy) || 0;
      occupiedBeds += occ;
    });

    const availableBeds = Math.max(0, totalCapacity - occupiedBeds);
    const occupancyRate = totalCapacity > 0 ? ((occupiedBeds / totalCapacity) * 100).toFixed(1) : '0';

    return { totalRooms, totalCapacity, occupiedBeds, availableBeds, occupancyRate };
  }, [filteredRooms]);

  // Group rooms for Building → Floor → Room hierarchy
  const hierarchyData = useMemo(() => {
    const buildingsMap: Record<string, { name: string; floors: Record<number, any[]> }> = {};

    filteredRooms.forEach((room: any) => {
      const blockName =
        (typeof room.blockId === 'object' && room.blockId?.name) ||
        (typeof room.blockId === 'string' && room.blockId) ||
        'Main Building';
      const floorNum = Number(room.floorNumber) || 1;

      if (!buildingsMap[blockName]) {
        buildingsMap[blockName] = { name: blockName, floors: {} };
      }
      if (!buildingsMap[blockName].floors[floorNum]) {
        buildingsMap[blockName].floors[floorNum] = [];
      }
      buildingsMap[blockName].floors[floorNum].push(room);
    });

    return Object.values(buildingsMap).map((b) => {
      const sortedFloors = Object.keys(b.floors)
        .map(Number)
        .sort((a, b) => a - b)
        .map((fNum) => ({
          floorNumber: fNum,
          rooms: b.floors[fNum].sort((a: any, b: any) =>
            String(a.roomNumber).localeCompare(String(b.roomNumber), undefined, { numeric: true })
          ),
        }));
      return { ...b, sortedFloors };
    });
  }, [filteredRooms]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Available</span>;
      case 'occupied':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">Occupied</span>;
      case 'maintenance':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">Maintenance</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-50 text-gray-700 border border-gray-200">{status || 'Available'}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              Property & Capacity Control
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mt-1">
            Room & Bed Hierarchy
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Multi-tier space management: Building → Floor → Room → Bed allocation matrix.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* View mode toggle */}
          <div className="bg-gray-100 p-1 rounded-xl flex items-center gap-1 border border-gray-200">
            <button
              onClick={() => setViewMode('hierarchy')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'hierarchy' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Building Matrix
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'table' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              List View
            </button>
          </div>

          <button
            onClick={() => setCreateBlockModal(true)}
            className="px-3.5 py-2 text-xs font-bold rounded-xl border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Building2 className="w-4 h-4 text-gray-500" />
            Add Building
          </button>

          <button
            onClick={handleAutoAllocate}
            disabled={allocating || !filters.hostelId}
            className="px-3.5 py-2 text-xs font-bold rounded-xl border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 text-blue-600" />
            {allocating ? 'Allocating...' : 'Auto-Allocate'}
          </button>

          <Link
            href="/owner/rooms/create"
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all font-bold text-xs shadow-xs flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Create Room
          </Link>
        </div>
      </div>

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-gray-200/80 p-4 shadow-xs">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Rooms</p>
          <p className="text-2xl font-black text-gray-900 mt-1">{stats.totalRooms}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Configured rooms</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200/80 p-4 shadow-xs">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Capacity</p>
          <p className="text-2xl font-black text-blue-600 mt-1">{stats.totalCapacity}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Total beds available</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200/80 p-4 shadow-xs">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Occupied Beds</p>
          <p className="text-2xl font-black text-indigo-600 mt-1">{stats.occupiedBeds}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Allocated students</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200/80 p-4 shadow-xs">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Available Beds</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{stats.availableBeds}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Ready for admission</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200/80 p-4 shadow-xs col-span-2 lg:col-span-1">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Occupancy Rate</p>
          <p className="text-2xl font-black text-gray-900 mt-1">{stats.occupancyRate}%</p>
          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Number(stats.occupancyRate))}%` }}
            />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">Select Property / Hostel</label>
            <select
              value={filters.hostelId}
              onChange={(e) => {
                const val = e.target.value;
                setFilters({ ...filters, hostelId: val });
                if (val) setSelectedHostel(val);
              }}
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">All Hostels ({hostels.length})</option>
              {hostels.map((hostel: any) => (
                <option key={hostel._id || hostel.id} value={hostel._id || hostel.id}>
                  {hostel.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">Filter by Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">All Statuses</option>
              <option value="available">Available</option>
              <option value="occupied">Occupied</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">Room Category</label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">All Categories</option>
              <option value="AC">AC Room</option>
              <option value="Non-AC">Non-AC Room</option>
              <option value="Deluxe">Deluxe</option>
              <option value="Standard">Standard</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">Search Rooms</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="Search by room # or building..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-200/80 p-12 text-center shadow-xs">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-700">Loading space management data...</p>
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200/80 p-12 text-center shadow-xs">
          <Home className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-900">No rooms match your filter</h3>
          <p className="text-xs text-gray-500 mt-1 mb-4">Try clearing your filters or create a new room to begin.</p>
          <Link
            href="/owner/rooms/create"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Create First Room
          </Link>
        </div>
      ) : viewMode === 'hierarchy' ? (
        /* ── BUILDING → FLOOR → ROOM → BED HIERARCHY MATRIX ── */
        <div className="space-y-6">
          {hierarchyData.map((building) => {
            let buildingCapacity = 0;
            let buildingOccupied = 0;
            building.sortedFloors.forEach((f) => {
              f.rooms.forEach((r: any) => {
                buildingCapacity += Number(r.capacity) || 0;
                buildingOccupied += Array.isArray(r.students) ? r.students.length : Number(r.currentOccupancy) || 0;
              });
            });

            return (
              <div key={building.name} className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
                {/* Building Header Banner */}
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-black tracking-tight">{building.name}</h2>
                      <p className="text-xs text-slate-300">
                        {building.sortedFloors.length} Floors · {buildingCapacity} Bed Capacity
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <div className="bg-white/10 px-3 py-1.5 rounded-lg">
                      <span className="text-slate-300">Occupied: </span>
                      <span className="font-bold text-white">{buildingOccupied}</span>
                    </div>
                    <div className="bg-emerald-500/20 text-emerald-300 px-3 py-1.5 rounded-lg font-bold">
                      Available: {Math.max(0, buildingCapacity - buildingOccupied)} beds
                    </div>
                  </div>
                </div>

                {/* Floors Section */}
                <div className="p-5 space-y-6">
                  {building.sortedFloors.map((floor) => (
                    <div key={floor.floorNumber} className="space-y-3">
                      <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                        <Layers className="w-4 h-4 text-indigo-600" />
                        <h3 className="text-xs font-black uppercase tracking-wider text-gray-700">
                          Floor {floor.floorNumber}
                        </h3>
                        <span className="text-[11px] text-gray-400 font-medium">
                          ({floor.rooms.length} rooms)
                        </span>
                      </div>

                      {/* Rooms Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {floor.rooms.map((room: any) => {
                          const cap = Number(room.capacity) || 1;
                          const studentsList = Array.isArray(room.students) ? room.students : [];
                          const occCount = studentsList.length || Number(room.currentOccupancy) || 0;
                          const availableBedsInRoom = Math.max(0, cap - occCount);

                          return (
                            <div
                              key={room._id || room.id}
                              className="bg-gray-50/70 rounded-xl border border-gray-200/80 p-4 space-y-3 hover:border-blue-300 transition-colors"
                            >
                              {/* Room Title Bar */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-black text-gray-900">
                                    Room {room.roomNumber}
                                  </span>
                                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-50 text-blue-700">
                                    {room.category || 'Standard'}
                                  </span>
                                </div>
                                {getStatusBadge(room.status)}
                              </div>

                              {/* Pricing & Summary */}
                              <div className="flex items-center justify-between text-xs text-gray-500">
                                <span>₹{room.pricing?.monthly || 0}/month</span>
                                <span className="font-semibold text-gray-700">
                                  {occCount} of {cap} Beds Occupied
                                </span>
                              </div>

                              {/* Bed Visualization Matrix */}
                              <div className="space-y-1.5 pt-2 border-t border-gray-200/60">
                                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                                  Bed Allocations
                                </p>
                                <div className="grid grid-cols-1 gap-1.5">
                                  {Array.from({ length: cap }).map((_, bedIndex) => {
                                    const student = studentsList[bedIndex];
                                    const isOccupied = Boolean(student) || bedIndex < occCount;
                                    const studentName = typeof student === 'object' && student?.name ? student.name : student ? String(student) : `Resident ${bedIndex + 1}`;

                                    return (
                                      <div
                                        key={bedIndex}
                                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs ${
                                          isOccupied
                                            ? 'bg-indigo-50/80 border border-indigo-100 text-indigo-900'
                                            : 'bg-emerald-50/80 border border-dashed border-emerald-300 text-emerald-800'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2">
                                          <BedDouble className={`w-3.5 h-3.5 ${isOccupied ? 'text-indigo-600' : 'text-emerald-600'}`} />
                                          <span className="font-medium">Bed {bedIndex + 1}</span>
                                        </div>
                                        <span className="text-[11px] font-semibold truncate max-w-[120px]">
                                          {isOccupied ? studentName : 'Available'}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Action Footer */}
                              <div className="pt-2 border-t border-gray-200/60 flex items-center justify-end gap-2 text-xs">
                                <Link
                                  href={`/owner/rooms/${room._id || room.id}`}
                                  className="px-2.5 py-1 text-blue-600 hover:bg-blue-50 rounded-lg font-bold flex items-center gap-1"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  View
                                </Link>
                                <Link
                                  href={`/owner/rooms/${room._id || room.id}/edit`}
                                  className="px-2.5 py-1 text-emerald-600 hover:bg-emerald-50 rounded-lg font-bold flex items-center gap-1"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                  Edit
                                </Link>
                                <button
                                  onClick={() => handleDelete(room)}
                                  className="px-2.5 py-1 text-rose-600 hover:bg-rose-50 rounded-lg font-bold flex items-center gap-1"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Delete
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── TABLE VIEW ── */
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 text-xs font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 text-left">Room Number</th>
                  <th className="px-6 py-4 text-left">Hostel</th>
                  <th className="px-6 py-4 text-left">Floor</th>
                  <th className="px-6 py-4 text-left">Category</th>
                  <th className="px-6 py-4 text-left">Capacity</th>
                  <th className="px-6 py-4 text-left">Occupancy</th>
                  <th className="px-6 py-4 text-left">Status</th>
                  <th className="px-6 py-4 text-left">Monthly Price</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-xs">
                {filteredRooms.map((room: any) => {
                  const cap = Number(room.capacity) || 1;
                  const occCount = Array.isArray(room.students) ? room.students.length : Number(room.currentOccupancy) || 0;

                  return (
                    <tr
                      key={room._id || room.id}
                      className="hover:bg-gray-50/80 cursor-pointer transition-colors"
                      onClick={() => router.push(`/owner/rooms/${room._id || room.id}`)}
                    >
                      <td className="px-6 py-4 font-bold text-gray-900">
                        Room {room.roomNumber}
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {room.hostelId && typeof room.hostelId === 'object' ? room.hostelId.name : '—'}
                      </td>
                      <td className="px-6 py-4 text-gray-600">Floor {room.floorNumber || 1}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold">
                          {room.category || 'Standard'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-gray-900">{cap} beds</td>
                      <td className="px-6 py-4">
                        <span className={`font-bold ${occCount >= cap ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {occCount} / {cap}
                        </span>
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(room.status)}</td>
                      <td className="px-6 py-4 font-semibold text-gray-900">
                        ₹{room.pricing?.monthly || 0}/mo
                      </td>
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <Link
                            href={`/owner/rooms/${room._id || room.id}`}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          <Link
                            href={`/owner/rooms/${room._id || room.id}/edit`}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => handleDelete(room)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
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
      )}

      {/* Modal: Add Building / Block */}
      {createBlockModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-gray-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                Add Building / Block
              </h3>
              <button
                onClick={() => setCreateBlockModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBlock} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Building / Block Name *</label>
                <input
                  type="text"
                  required
                  value={blockForm.name}
                  onChange={(e) => setBlockForm({ ...blockForm, name: e.target.value })}
                  placeholder="e.g. Block A, East Wing, Tower 2"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Assigned Property / Hostel *</label>
                <select
                  required
                  value={blockForm.hostelId}
                  onChange={(e) => setBlockForm({ ...blockForm, hostelId: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Select Hostel...</option>
                  {hostels.map((h: any) => (
                    <option key={h._id || h.id} value={h._id || h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Number of Floors</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={blockForm.floorsCount}
                  onChange={(e) => setBlockForm({ ...blockForm, floorsCount: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setCreateBlockModal(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingBlock}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {creatingBlock && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Building
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
