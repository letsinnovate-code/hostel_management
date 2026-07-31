'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE_URL } from '../../constants/config';
import { Search, Building2, Filter } from 'lucide-react';
import HostelCard from '../../components/marketplace/HostelCard';
import PublicNavbar from '../../components/layout/PublicNavbar';
import PublicFooter from '../../components/layout/PublicFooter';

export default function MarketplacePage() {
  const router = useRouter();
  const [hostels, setHostels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    type: '',
    city: '',
    minRent: '',
    maxRent: '',
    amenities: [] as string[],
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadHostels();
  }, []);

  const loadHostels = async () => {
    setLoading(true);
    try {
      const apiUrl = API_BASE_URL.replace('/api', '') || 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/api/public/hostels`);
      if (response.ok) {
        const data = await response.json();
        setHostels(data.data || []);
      } else {
        console.error('Failed to load hostels:', response.statusText);
      }
    } catch (error) {
      console.error('Failed to load hostels:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredHostels = hostels.filter((hostel) => {
    if (searchQuery && !hostel.name?.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !hostel.address?.city?.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !hostel.address?.state?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (filters.type && hostel.type !== filters.type) return false;
    if (filters.city && hostel.address?.city?.toLowerCase() !== filters.city.toLowerCase()) return false;
    if (filters.minRent && hostel.pricing?.minRent && hostel.pricing.minRent < parseFloat(filters.minRent)) return false;
    if (filters.maxRent && hostel.pricing?.maxRent && hostel.pricing.maxRent > parseFloat(filters.maxRent)) return false;
    return true;
  });

  const cities = Array.from(new Set(hostels.map(h => h.address?.city).filter(Boolean)));

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <PublicNavbar />

      {/* Marketplace Hero */}
      <div className="pt-32 pb-12 px-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl md:text-5xl font-bold mb-6 text-black">Find Your Perfect Hostel</h1>

          {/* Search Bar - Large */}
          <div className="max-w-2xl relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-6 h-6 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, city, or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 text-lg border-0 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/30 shadow-2xl"
            />
          </div>
        </div>
      </div>

      {/* Sticky Filters Bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-2">

          {/* Controls */}
          <div className="flex flex-wrap gap-2 items-center">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-gray-700 font-medium transition-colors"
            >
              <Filter className="w-4 h-4" />
              {showFilters ? 'Hide Filters' : 'Filters'}
            </button>

            {filters.type && (
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-1">
                {filters.type}
                <button onClick={() => setFilters({ ...filters, type: '' })} className="hover:text-blue-600">×</button>
              </span>
            )}
            {filters.city && (
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-1">
                {filters.city}
                <button onClick={() => setFilters({ ...filters, city: '' })} className="hover:text-blue-600">×</button>
              </span>
            )}

            <span className="ml-auto text-sm text-gray-500">
              {filteredHostels.length} {filteredHostels.length === 1 ? 'hostel' : 'hostels'} found
            </span>
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={filters.type}
                  onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Types</option>
                  <option value="boys">Boys</option>
                  <option value="girls">Girls</option>
                  <option value="co-ed">Co-ed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <select
                  value={filters.city}
                  onChange={(e) => setFilters({ ...filters, city: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Cities</option>
                  {cities.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min Rent (₹)</label>
                <input
                  type="number"
                  value={filters.minRent}
                  onChange={(e) => setFilters({ ...filters, minRent: e.target.value })}
                  placeholder="Min"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Rent (₹)</label>
                <input
                  type="number"
                  value={filters.maxRent}
                  onChange={(e) => setFilters({ ...filters, maxRent: e.target.value })}
                  placeholder="Max"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 px-4 md:px-6 py-8">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Loading hostels...</p>
            </div>
          ) : filteredHostels.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100">
              <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No hostels found</h3>
              <p className="text-gray-600">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredHostels.map((hostel) => (
                <HostelCard key={hostel._id || hostel.id} hostel={hostel} />
              ))}
            </div>
          )}
        </div>
      </div>

      <PublicFooter />
    </div>
  );
}
