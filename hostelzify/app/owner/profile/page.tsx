'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import { useToast } from '../../../components/Toast';
import { ArrowLeft, User, Mail, Phone, MapPin, Building2, Edit, Key } from 'lucide-react';

export default function OwnerProfilePage() {
  const { user } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const [owner, setOwner] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== 'owner') {
      router.replace('/login');
      return;
    }
    loadOwnerProfile();
  }, [user, router]);

  const loadOwnerProfile = async () => {
    setLoading(true);
    try {
      const response = await api.getCurrentUser();
      if (response.success && response.data) {
        setOwner(response.data);
      }
    } catch (error: any) {
      showToast(error.message || 'Failed to load profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatAddress = (address: any) => {
    if (!address) return 'Not provided';
    if (typeof address === 'string') return address;
    const parts = [];
    if (address.street) parts.push(address.street);
    if (address.city) parts.push(address.city);
    if (address.state) parts.push(address.state);
    if (address.pincode) parts.push(address.pincode);
    if (address.country && address.country !== 'India') parts.push(address.country);
    return parts.length > 0 ? parts.join(', ') : 'Not provided';
  };

  if (loading) {
    return (
      
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading profile...</p>
          </div>
        </div>
      
    );
  }

  return (
    
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="px-6 py-4">
            <div className="flex items-center gap-4">
              <Link
                href="/owner/dashboard"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
                <p className="text-sm text-gray-600 mt-1">View and manage your profile information</p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-6">
          <div className="w-full">
            {/* Profile Header Card */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <div className="flex items-center gap-6">
                <div className="relative">
                  {owner?.profileImage ? (
                    <img
                      src={owner.profileImage}
                      alt={owner.name}
                      className="w-24 h-24 rounded-full object-cover border-4 border-gray-200 shadow-lg"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-3xl font-semibold border-4 border-gray-200 shadow-lg">
                      {owner?.name?.charAt(0).toUpperCase() || 'O'}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900">{owner?.name || 'Owner'}</h2>
                  <p className="text-gray-600 mt-1">{owner?.email}</p>
                  <div className="flex gap-3 mt-4">
                    <Link
                      href="/owner/profile/edit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors font-medium"
                    >
                      <Edit className="w-4 h-4" />
                      Edit Profile
                    </Link>
                    <Link
                      href="/owner/profile/change-password"
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2 transition-colors font-medium"
                    >
                      <Key className="w-4 h-4" />
                      Change Password
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Profile Details */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Basic Information */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <User className="w-5 h-5 text-blue-600" />
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">Basic Information</h2>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Full Name</label>
                    <p className="text-gray-900 mt-1 font-medium">{owner?.name || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      Email Address
                    </label>
                    <p className="text-gray-900 mt-1 font-medium">{owner?.email || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      Phone Number
                    </label>
                    <p className="text-gray-900 mt-1 font-medium">{owner?.phone || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Role</label>
                    <p className="text-gray-900 mt-1 font-medium capitalize">{owner?.role || 'owner'}</p>
                  </div>
                </div>
              </div>

              {/* Address Information */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-green-600" />
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">Address</h2>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Full Address</label>
                  <p className="text-gray-900 mt-1 font-medium">{formatAddress(owner?.address)}</p>
                </div>
              </div>

              {/* Business Information */}
              {owner?.businessInfo && (
                <div className="bg-white rounded-lg shadow-sm p-6 lg:col-span-2">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-purple-600" />
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900">Business Information</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {owner.businessInfo.companyName && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Company Name</label>
                        <p className="text-gray-900 mt-1 font-medium">{owner.businessInfo.companyName}</p>
                      </div>
                    )}
                    {owner.businessInfo.gstNumber && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">GST Number</label>
                        <p className="text-gray-900 mt-1 font-medium">{owner.businessInfo.gstNumber}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    
  );
}

