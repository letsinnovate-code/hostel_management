'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import { useToast } from '../../../components/Toast';
import { useConfirmModal } from '../../../components/ConfirmModal';
import { Plus, Search, Filter, Eye, Edit, Trash2, Wifi, CheckCircle, XCircle, Loader2, Package } from 'lucide-react';

export default function AmenitiesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const { confirm } = useConfirmModal();
  const [loading, setLoading] = useState(true);
  const [amenities, setAmenities] = useState<any[]>([]);
  const [hostels, setHostels] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    hostelId: '',
    category: '',
    isAvailable: '',
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
      const [hostelsRes, amenitiesRes] = await Promise.all([
        api.getHostels(),
        api.getAmenities({ hostelId: filters.hostelId || undefined }),
      ]);
      
      setHostels(hostelsRes.data || []);
      setAmenities(amenitiesRes.data || []);
    } catch (error: any) {
      showToast(error.message || 'Failed to load amenities', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters.hostelId, filters.category, filters.isAvailable]);

  const handleDelete = async (amenity: any) => {
    const result = await confirm({
      title: 'Delete Amenity',
      message: `Are you sure you want to delete ${amenity.name}? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      confirmButtonClass: 'bg-red-600 hover:bg-red-700',
    });

    if (result) {
      try {
        await api.deleteAmenity(amenity._id || amenity.id);
        showToast('Amenity deleted successfully', 'success');
        loadData();
      } catch (error: any) {
        showToast(error.message || 'Failed to delete amenity', 'error');
      }
    }
  };

  const filteredAmenities = amenities.filter((amenity) => {
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      if (
        !amenity.name?.toLowerCase().includes(searchLower) &&
        !amenity.category?.toLowerCase().includes(searchLower) &&
        !amenity.description?.toLowerCase().includes(searchLower)
      ) {
        return false;
      }
    }
    if (filters.category && amenity.category !== filters.category) return false;
    if (filters.isAvailable !== '' && amenity.isAvailable !== (filters.isAvailable === 'true')) return false;
    return true;
  });

  const getCategoryIcon = (category: string) => {
    return <Wifi className="w-5 h-5" />;
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      wifi: 'bg-blue-100 text-blue-800',
      laundry: 'bg-purple-100 text-purple-800',
      mess: 'bg-orange-100 text-orange-800',
      parking: 'bg-gray-100 text-gray-800',
      gym: 'bg-red-100 text-red-800',
      library: 'bg-green-100 text-green-800',
      'common-room': 'bg-indigo-100 text-indigo-800',
      'tv-room': 'bg-pink-100 text-pink-800',
      'study-room': 'bg-yellow-100 text-yellow-800',
      security: 'bg-teal-100 text-teal-800',
      medical: 'bg-red-100 text-red-800',
      sports: 'bg-green-100 text-green-800',
      other: 'bg-gray-100 text-gray-800',
    };
    return colors[category] || colors.other;
  };

  if (loading) {
    return (
      
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
            <p className="text-gray-600">Loading amenities...</p>
          </div>
        </div>
      
    );
  }

  return (
    
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="mx-auto px-4 md:px-6 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Amenities Management</h1>
                <p className="text-sm md:text-base text-gray-600 mt-1">Manage hostel amenities and inventory</p>
              </div>
              <Link
                href="/owner/amenities/create"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 justify-center sm:justify-start"
              >
                <Plus className="w-5 h-5" />
                Add Amenity
              </Link>
            </div>
          </div>
        </div>

        <div className="mx-auto px-4 md:px-6 py-6">
          {/* Filters */}
          <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Hostel</label>
                <select
                  value={filters.hostelId}
                  onChange={(e) => setFilters({ ...filters, hostelId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select
                  value={filters.category}
                  onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                >
                  <option value="">All Categories</option>
                  <option value="wifi">WiFi</option>
                  <option value="laundry">Laundry</option>
                  <option value="mess">Mess</option>
                  <option value="parking">Parking</option>
                  <option value="gym">Gym</option>
                  <option value="library">Library</option>
                  <option value="common-room">Common Room</option>
                  <option value="tv-room">TV Room</option>
                  <option value="study-room">Study Room</option>
                  <option value="security">Security</option>
                  <option value="medical">Medical</option>
                  <option value="sports">Sports</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={filters.isAvailable}
                  onChange={(e) => setFilters({ ...filters, isAvailable: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                >
                  <option value="">All Status</option>
                  <option value="true">Available</option>
                  <option value="false">Unavailable</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    placeholder="Search amenities..."
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Amenities List */}
          {filteredAmenities.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No amenities found</h3>
              <p className="text-gray-600 mb-6">
                {amenities.length === 0
                  ? 'Get started by creating your first amenity.'
                  : 'Try adjusting your filters to see more results.'}
              </p>
              {amenities.length === 0 && (
                <Link
                  href="/owner/amenities/create"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Add Amenity
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAmenities.map((amenity) => (
                <div
                  key={amenity._id || amenity.id}
                  className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200 overflow-hidden"
                >
                  {/* Cover Image or Icon */}
                  {amenity.images && amenity.images.length > 0 ? (
                    <div className="h-48 bg-gray-200 overflow-hidden">
                      <img
                        src={amenity.images[0]}
                        alt={amenity.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="h-48 bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                      {getCategoryIcon(amenity.category)}
                    </div>
                  )}

                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">{amenity.name}</h3>
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(amenity.category)}`}>
                          {amenity.category.replace('-', ' ')}
                        </span>
                      </div>
                      {amenity.isAvailable ? (
                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                      )}
                    </div>

                    {amenity.description && (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{amenity.description}</p>
                    )}

                    {/* Inventory Info */}
                    {amenity.quantity !== undefined && (
                      <div className="mb-3 p-2 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Available:</span>
                          <span className={`font-medium ${amenity.availableQuantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {amenity.availableQuantity || 0} / {amenity.quantity} {amenity.unit}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Pricing Info */}
                    {amenity.cost > 0 && (
                      <div className="mb-3 text-sm">
                        <span className="text-gray-600">Cost: </span>
                        <span className="font-medium text-gray-900">
                          ₹{amenity.cost.toLocaleString()}
                          {amenity.costType === 'monthly' && '/month'}
                          {amenity.costType === 'per-use' && '/use'}
                        </span>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-3 border-t border-gray-200">
                      <Link
                        href={`/owner/amenities/${amenity._id || amenity.id}`}
                        className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </Link>
                      <Link
                        href={`/owner/amenities/${amenity._id || amenity.id}/edit`}
                        className="flex-1 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
                      >
                        <Edit className="w-4 h-4" />
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(amenity)}
                        className="px-3 py-2 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    
  );
}
