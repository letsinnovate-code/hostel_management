'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import { useToast } from '../../../components/Toast';
import { useConfirmModal } from '../../../components/ConfirmModal';
import { Plus, Search, Filter, Eye, Edit, Trash2, Users, Home, Wrench, CheckCircle, XCircle, Loader2 } from 'lucide-react';

export default function RoomsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const { confirm } = useConfirmModal();
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState<any[]>([]);
  const [hostels, setHostels] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    hostelId: '',
    status: '',
    category: '',
    search: '',
  });

  useEffect(() => {
    if (!user || user.role !== 'owner') {
      router.replace('/login');
      return;
    }
    loadData();
  }, [user, router]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [hostelsRes, roomsRes] = await Promise.all([
        api.getHostels(),
        api.getRooms({ hostelId: filters.hostelId || undefined }),
      ]);
      const hostelsPayload = hostelsRes?.data ?? hostelsRes;
      const roomsPayload = roomsRes?.data ?? roomsRes;
      setHostels(Array.isArray(hostelsPayload) ? hostelsPayload : []);
      setRooms(Array.isArray(roomsPayload) ? roomsPayload : []);
    } catch (error: any) {
      showToast(error.message || 'Failed to load rooms', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters.hostelId, filters.status, filters.category]);

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
        await api.deleteRoom(room._id || room.id);
        showToast('Room deleted successfully', 'success');
        loadData();
      } catch (error: any) {
        showToast(error.message || 'Failed to delete room', 'error');
      }
    }
  };

  const filteredRooms = rooms.filter((room) => {
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-800';
      case 'occupied':
        return 'bg-blue-100 text-blue-800';
      case 'maintenance':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available':
        return <CheckCircle className="w-4 h-4" />;
      case 'occupied':
        return <Users className="w-4 h-4" />;
      case 'maintenance':
        return <Wrench className="w-4 h-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Room Management</h1>
                <p className="text-sm text-gray-600 mt-1">Manage all rooms across your hostels</p>
              </div>
              <Link
                href="/owner/rooms/create"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Create Room
              </Link>
            </div>
          </div>
        </div>

        <div className="px-6 py-6">
          {/* Filters */}
          <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hostel</label>
                <select
                  value={filters.hostelId}
                  onChange={(e) => setFilters({ ...filters, hostelId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Hostels</option>
                  {hostels.map((hostel) => (
                    <option key={hostel._id || hostel.id} value={hostel._id || hostel.id}>
                      {hostel.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Status</option>
                  <option value="available">Available</option>
                  <option value="occupied">Occupied</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={filters.category}
                  onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Categories</option>
                  <option value="AC">AC</option>
                  <option value="Non-AC">Non-AC</option>
                  <option value="Deluxe">Deluxe</option>
                  <option value="Standard">Standard</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    placeholder="Search rooms..."
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Rooms Table */}
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <Home className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No rooms found</h3>
              <p className="text-gray-600 mb-4">Get started by creating your first room</p>
              <Link
                href="/owner/rooms/create"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Create Room
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-semibold">Room Number</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold">Hostel</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold">Floor</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold">Category</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold">Capacity</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold">Occupancy</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold">Status</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold">Pricing</th>
                      <th className="px-6 py-4 text-center text-sm font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredRooms.map((room) => (
                      <tr
                        key={room._id || room.id}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => router.push(`/owner/rooms/${room._id || room.id}`)}
                      >
                        <td className="px-6 py-4">
                          <div className="font-semibold text-gray-900">{room.roomNumber}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">
                            {room.hostelId
                              ? typeof room.hostelId === 'object' && room.hostelId?.name
                                ? room.hostelId.name
                                : String(room.hostelId)
                              : '—'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">Floor {room.floorNumber}</div>
                          {room.blockId && (
                            <div className="text-xs text-gray-500">
                              {typeof room.blockId === 'object' && room.blockId?.name
                                ? room.blockId.name
                                : typeof room.blockId === 'string'
                                  ? room.blockId
                                  : ''}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                            {room.category}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1 text-sm text-gray-700">
                            <Users className="w-4 h-4" />
                            {room.capacity}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {(() => {
                            // Calculate occupancy from students array if available, otherwise use currentOccupancy
                            const studentsCount = Array.isArray(room.students) ? room.students.length : 0;
                            const occupancy = studentsCount > 0 ? studentsCount : (room.currentOccupancy || 0);
                            const capacity = room.capacity || 0;
                            const occupancyPercent = capacity > 0 ? Math.round((occupancy / capacity) * 100) : 0;
                            
                            return (
                              <>
                                <div className="flex items-center gap-2">
                                  <div className="text-sm font-semibold text-gray-900">
                                    <span className="text-blue-600">{occupancy}</span>
                                    <span className="text-gray-400 mx-1">/</span>
                                    <span>{capacity}</span>
                                  </div>
                                  {occupancy > 0 && (
                                    <div className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">
                                      {occupancyPercent}%
                                    </div>
                                  )}
                                </div>
                                {studentsCount > 0 && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    {studentsCount} student{studentsCount !== 1 ? 's' : ''} assigned
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded ${getStatusColor(
                              room.status
                            )}`}
                          >
                            {getStatusIcon(room.status)}
                            {room.status || 'available'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-700">
                            ₹{room.pricing?.monthly || 0}/mo
                          </div>
                          {room.pricing?.yearly && (
                            <div className="text-xs text-gray-500">₹{room.pricing.yearly}/yr</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <Link
                              href={`/owner/rooms/${room._id || room.id}`}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="View"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>
                            <Link
                              href={`/owner/rooms/${room._id || room.id}/edit`}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </Link>
                            <button
                              onClick={() => handleDelete(room)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
  );
}
