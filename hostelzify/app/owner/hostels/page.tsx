'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import Link from 'next/link';
import { MapPin, Users, Bed, Building2, Edit, Eye, Plus, Loader2, Trash2 } from 'lucide-react';
import ConfirmModal, { useConfirmModal } from '../../../components/ConfirmModal';
import { useToast } from '../../../components/Toast';

import { useOwnerHostel } from '../../../contexts/OwnerHostelContext';
import { CheckCircle2 } from 'lucide-react';

export default function OwnerHostels() {
  const { user } = useAuth();
  const router = useRouter();
  const { confirm } = useConfirmModal();
  const { showToast } = useToast();
  const { selectedHostel, setSelectedHostel, refetchHostels } = useOwnerHostel();
  const [hostels, setHostels] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    if (!user || user.role !== 'owner') {
      router.replace('/login');
      return;
    }
    loadHostels();
  }, [user, router]);

  const loadHostels = async () => {
    setLoading(true);
    try {
      const data = await api.getHostels();
      setHostels(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error('Failed to load hostels:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteHostel = async (hostelId: string, hostelName: string) => {
    const result = await confirm({
      title: 'Delete Hostel',
      message: `Are you sure you want to delete "${hostelName || 'this hostel'}"? This will permanently delete the hostel, all associated rooms, blocks, amenities, rules, and geofences. This action cannot be undone.`,
      confirmText: 'Delete Permanently',
      cancelText: 'Cancel',
      confirmButtonClass: 'bg-red-600 hover:bg-red-700',
    });

    if (result) {
      setDeletingId(hostelId);
      try {
        await api.deleteHostel(hostelId);
        showToast('Hostel deleted successfully', 'success');
        setHostels((prev) => prev.filter((h) => (h._id || h.id) !== hostelId));
        await refetchHostels();
      } catch (error: any) {
        showToast(error.message || 'Failed to delete hostel', 'error');
      } finally {
        setDeletingId(null);
      }
    }
  };

  const formatAddress = (address: any) => {
    if (!address) return 'Address not available';
    if (typeof address === 'string') return address;
    if (address.formattedAddress) return address.formattedAddress;
    
    const parts = [];
    if (address.street) parts.push(address.street);
    if (address.city) parts.push(address.city);
    if (address.state) parts.push(address.state);
    if (address.pincode) parts.push(address.pincode);
    if (address.country && address.country !== 'India') parts.push(address.country);
    
    return parts.length > 0 ? parts.join(', ') : 'Address not available';
  };

  const getCoverImage = (hostel: any) => {
    if (hostel.coverImage) return hostel.coverImage;
    if (hostel.images && Array.isArray(hostel.images) && hostel.images.length > 0) {
      return hostel.images[0];
    }
    return null;
  };

  const getTypeColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'boys':
        return 'bg-blue-100 text-blue-800';
      case 'girls':
        return 'bg-pink-100 text-pink-800';
      case 'co-ed':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      case 'maintenance':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredHostels = hostels.filter((h) => {
    if (typeFilter !== 'all' && h.type?.toLowerCase() !== typeFilter.toLowerCase()) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = h.name?.toLowerCase().includes(q);
      const matchCity = h.address?.city?.toLowerCase().includes(q);
      if (!matchName && !matchCity) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="px-4 md:px-6 py-4 md:py-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Manage Hostels</h1>
                <p className="text-sm text-gray-600 mt-1">
                  {hostels.length} {hostels.length === 1 ? 'hostel' : 'hostels'} total &bull; Active: <b>{hostels.find(h => (h._id || h.id) === selectedHostel)?.name || 'None'}</b>
                </p>
              </div>
              <Link
                href="/owner/hostels/create"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Create Hostel
              </Link>
            </div>

            {/* Filter Toolbar */}
            <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative max-w-sm w-full">
                <input
                  type="text"
                  placeholder="Search hostels by name or city..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-3 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50/50"
                />
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {['all', 'boys', 'girls', 'co-ed'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTypeFilter(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                      typeFilter === t
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 md:px-6 py-6">
        {loading ? (
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
                <p className="text-gray-600">Loading hostels...</p>
              </div>
          </div>
        ) : filteredHostels.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No hostels matched</h3>
              <p className="text-gray-600 mb-6">
                {hostels.length === 0 ? 'Get started by creating your first hostel' : 'Try adjusting your search query or filter'}
              </p>
              {hostels.length === 0 && (
                <Link
                  href="/owner/hostels/create"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create Your First Hostel
                </Link>
              )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredHostels.map((hostel, index) => {
              const hostelKey = hostel._id || hostel.id || `hostel-${index}`;
              const isActive = hostelKey === selectedHostel;
              const coverImage = getCoverImage(hostel);
              const occupancyRate = hostel.capacity 
                ? Math.round((hostel.currentOccupancy || 0) / hostel.capacity * 100) 
                : 0;

              return (
                  <div
                    key={hostelKey}
                    className={`bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group border ${
                      isActive ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-gray-200'
                    }`}
                  >
                    {/* Cover Image */}
                    <div className="relative h-48 bg-gradient-to-br from-blue-400 to-indigo-600 overflow-hidden">
                      {coverImage ? (
                        <img
                          src={coverImage}
                          alt={hostel.name || 'Hostel'}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Building2 className="w-16 h-16 text-white opacity-50" />
                        </div>
                      )}
                      {/* Badges */}
                      <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                        {isActive && (
                          <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-600 text-white shadow-md flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Active Hostel
                          </span>
                        )}
                        {hostel.type && (
                          <span className={`px-2 py-0.5 rounded-md text-xs font-medium shadow-sm ${getTypeColor(hostel.type)}`}>
                            {hostel.type.charAt(0).toUpperCase() + hostel.type.slice(1)}
                          </span>
                        )}
                        {hostel.status && (
                          <span className={`px-2 py-0.5 rounded-md text-xs font-medium shadow-sm ${getStatusColor(hostel.status)}`}>
                            {hostel.status.charAt(0).toUpperCase() + hostel.status.slice(1)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="text-lg font-bold text-gray-900 line-clamp-1">
                          {hostel.name || 'Unnamed Hostel'}
                        </h3>
                        {!isActive && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedHostel(hostelKey);
                              showToast(`Switched active hostel to ${hostel.name}`, 'success');
                            }}
                            className="text-xs px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded font-medium transition-colors flex-shrink-0"
                          >
                            Set Active
                          </button>
                        )}
                      </div>
                      
                      {/* Address */}
                      <div className="flex items-start gap-2 mb-4">
                        <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-gray-600 line-clamp-2 flex-1">
                          {formatAddress(hostel.address)}
                        </p>
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-500">Capacity</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {hostel.capacity || 'N/A'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Bed className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-500">Occupied</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {hostel.currentOccupancy || 0}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Occupancy Progress */}
                      {hostel.capacity && (
                        <div className="mb-4">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs text-gray-600">Occupancy</span>
                            <span className="text-xs font-medium text-gray-900">{occupancyRate}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                occupancyRate >= 90
                                  ? 'bg-red-500'
                                  : occupancyRate >= 70
                                  ? 'bg-yellow-500'
                                  : 'bg-green-500'
                              }`}
                              style={{ width: `${Math.min(occupancyRate, 100)}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Link
                          href={`/owner/hostels/${hostelKey}`}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </Link>
                        <Link
                          href={`/owner/hostels/${hostelKey}/edit`}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                        >
                          <Edit className="w-4 h-4" />
                          Edit
                        </Link>
                        <button
                          onClick={() => handleDeleteHostel(hostelKey, hostel.name)}
                          disabled={deletingId === hostelKey}
                          title="Delete Hostel"
                          className="px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center"
                        >
                          {deletingId === hostelKey ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </div>
        <ConfirmModal />
      </div>
  );
}
