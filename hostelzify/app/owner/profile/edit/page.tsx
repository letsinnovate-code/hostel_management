'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../../contexts/AuthContext';
import api from '../../../../services/api';
import { useToast } from '../../../../components/Toast';
import { ArrowLeft, User, Mail, Phone, MapPin, Building2, Loader2, Check } from 'lucide-react';

export default function EditOwnerProfilePage() {
  const { user } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: {
      street: '',
      city: '',
      state: '',
      pincode: '',
      country: 'India',
    },
    businessInfo: {
      companyName: '',
      gstNumber: '',
    },
  });
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string>('');

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
        const owner = response.data;
        setFormData({
          name: owner.name || '',
          email: owner.email || '',
          phone: owner.phone || '',
          address: {
            street: owner.address?.street || '',
            city: owner.address?.city || '',
            state: owner.address?.state || '',
            pincode: owner.address?.pincode || '',
            country: owner.address?.country || 'India',
          },
          businessInfo: {
            companyName: owner.businessInfo?.companyName || '',
            gstNumber: owner.businessInfo?.gstNumber || '',
          },
        });
        if (owner.profileImage) {
          setProfileImagePreview(owner.profileImage);
        }
      }
    } catch (error: any) {
      showToast(error.message || 'Failed to load profile', 'error');
      router.push('/owner/profile');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProfileImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.email || !formData.phone) {
      showToast('Please fill in all required fields (Name, Email, Phone)', 'warning');
      return;
    }

    setSaving(true);
    try {
      // Update profile using updateUser endpoint (owner can update their own profile)
      const userId = user?.id || user?._id;
      if (!userId) {
        showToast('User ID not found', 'error');
        return;
      }

      await api.updateUser(userId, formData);

      // Upload profile image if provided
      if (profileImage) {
        try {
          // For now, we'll need to add an endpoint for owner profile image upload
          // For now, just show a message
          showToast('Profile updated successfully. Profile image upload will be available soon.', 'success');
        } catch (error: any) {
          console.error('Failed to upload profile image:', error);
          showToast('Profile updated but failed to upload profile image', 'warning');
        }
      } else {
        showToast('Profile updated successfully', 'success');
      }

      router.push('/owner/profile');
    } catch (error: any) {
      showToast(error.message || 'Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
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
                href="/owner/profile"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Edit Profile</h1>
                <p className="text-sm text-gray-600 mt-1">Update your profile information</p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-6">
          <div className="w-full">
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-8">
                {/* Profile Image */}
                <div className="mb-6 pb-6 border-b border-gray-200">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Profile Photo
                  </label>
                  <div className="flex items-center gap-6">
                    <div className="relative">
                      {profileImagePreview ? (
                        <img
                          src={profileImagePreview}
                          alt="Profile preview"
                          className="w-32 h-32 rounded-full object-cover border-4 border-gray-200 shadow-md"
                        />
                      ) : (
                        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-4xl font-semibold border-4 border-gray-200 shadow-md">
                          {formData.name.charAt(0).toUpperCase() || 'O'}
                        </div>
                      )}
                      <label className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full cursor-pointer hover:bg-blue-700 shadow-lg">
                        <User className="w-5 h-5" />
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleProfileImageChange}
                          className="hidden"
                        />
                      </label>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Upload a profile photo</p>
                      <p className="text-xs text-gray-500">JPG, PNG up to 5MB</p>
                    </div>
                  </div>
                </div>

                {/* Basic Information */}
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900">Basic Information</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email Address <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phone Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Address */}
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-green-600" />
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900">Address</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Street Address
                      </label>
                      <input
                        type="text"
                        value={formData.address.street}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            address: { ...formData.address, street: e.target.value },
                          })
                        }
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                      <input
                        type="text"
                        value={formData.address.city}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            address: { ...formData.address, city: e.target.value },
                          })
                        }
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                      <input
                        type="text"
                        value={formData.address.state}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            address: { ...formData.address, state: e.target.value },
                          })
                        }
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Pincode</label>
                      <input
                        type="text"
                        value={formData.address.pincode}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            address: { ...formData.address, pincode: e.target.value },
                          })
                        }
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
                      <input
                        type="text"
                        value={formData.address.country}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            address: { ...formData.address, country: e.target.value },
                          })
                        }
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* Business Information */}
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-purple-600" />
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900">Business Information</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Company Name
                      </label>
                      <input
                        type="text"
                        value={formData.businessInfo.companyName}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            businessInfo: { ...formData.businessInfo, companyName: e.target.value },
                          })
                        }
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        GST Number
                      </label>
                      <input
                        type="text"
                        value={formData.businessInfo.gstNumber}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            businessInfo: { ...formData.businessInfo, gstNumber: e.target.value },
                          })
                        }
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="px-8 py-6 border-t border-gray-200 bg-gray-50 rounded-b-lg">
                <div className="flex justify-end gap-3">
                  <Link
                    href="/owner/profile"
                    className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-white transition-colors font-medium"
                  >
                    Cancel
                  </Link>
                  <button
                    onClick={handleSubmit}
                    disabled={saving}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="animate-spin h-5 w-5" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5" />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    
  );
}

