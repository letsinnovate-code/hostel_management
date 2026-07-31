'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../../../../contexts/AuthContext';
import api from '../../../../../services/api';
import { useToast } from '../../../../../components/Toast';
import Link from 'next/link';
import DocumentUploadModal from '../../../../../components/DocumentUploadModal';
import { User, MapPin, Phone, FileText, Plus, Check, Users, AlertCircle, Loader2, Home, Wifi, Eye, EyeOff } from 'lucide-react';

export default function EditStudentPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const studentId = params?.id as string;
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hostels, setHostels] = useState<any[]>([]);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [amenities, setAmenities] = useState<any[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [loadingAmenities, setLoadingAmenities] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    studentId: '',
    hostelId: '',
    blockId: '',
    roomId: '',
    planId: '',
    amenities: [] as string[],
    password: '',
    dateOfBirth: '',
    address: {
      street: '',
      city: '',
      state: '',
      pincode: '',
      country: 'India',
    },
    parentContact: {
      name: '',
      phone: '',
      email: '',
    },
    emergencyContact: {
      name: '',
      phone: '',
      relation: '',
    },
  });
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string>('');
  const [existingProfileImage, setExistingProfileImage] = useState<string>('');
  const [documents, setDocuments] = useState<{ file: File; type: string; name: string }[]>([]);
  const [existingDocuments, setExistingDocuments] = useState<any[]>([]);

  useEffect(() => {
    if (!user || user.role !== 'owner') {
      router.replace('/login');
      return;
    }
    if (studentId) {
      loadHostels();
      loadStudent();
    }
  }, [user, router, studentId]);

  const loadHostels = async () => {
    try {
      const response = await api.getHostels();
      setHostels(response.data || []);
    } catch (error: any) {
      console.error('Failed to load hostels:', error);
      showToast('Failed to load hostels', 'error');
    }
  };

  const loadBlocks = async (hostelId: string) => {
    if (!hostelId) {
      setBlocks([]);
      setRooms([]);
      return;
    }
    try {
      const response = await api.getBlocks(hostelId);
      setBlocks(response.data || []);
    } catch (error: any) {
      console.error('Failed to load blocks:', error);
      showToast('Failed to load blocks', 'error');
    }
  };

  const loadRooms = async (hostelId: string, blockId?: string) => {
    if (!hostelId) {
      setRooms([]);
      return;
    }
    setLoadingRooms(true);
    try {
      const params: any = { hostelId };
      if (blockId) params.blockId = blockId;
      const response = await api.getRooms(params);
      setRooms(response.data || []);
    } catch (error: any) {
      console.error('Failed to load rooms:', error);
      showToast('Failed to load rooms', 'error');
    } finally {
      setLoadingRooms(false);
    }
  };

  const loadAmenities = async (hostelId: string) => {
    if (!hostelId) {
      setAmenities([]);
      return;
    }
    setLoadingAmenities(true);
    try {
      const response = await api.getAmenities({ hostelId });
      setAmenities(response.data || []);
    } catch (error: any) {
      console.error('Failed to load amenities', error);
      showToast('Failed to load amenities', 'error');
    } finally {
      setLoadingAmenities(false);
    }
  };

  const loadPlans = async (hostelId: string) => {
    if (!hostelId) {
      setPlans([]);
      return;
    }
    try {
      const res = await api.getPlans(hostelId);
      const data = (res as any)?.data ?? res ?? [];
      setPlans(Array.isArray(data) ? data : []);
    } catch {
      setPlans([]);
    }
  };

  useEffect(() => {
    if (formData.hostelId) {
      loadBlocks(formData.hostelId);
      loadRooms(formData.hostelId, formData.blockId);
      loadAmenities(formData.hostelId);
      loadPlans(formData.hostelId);
    } else {
      setBlocks([]);
      setRooms([]);
      setPlans([]);
      setAmenities([]);
    }
  }, [formData.hostelId]);

  useEffect(() => {
    if (formData.hostelId && formData.blockId) {
      loadRooms(formData.hostelId, formData.blockId);
    } else if (formData.hostelId) {
      loadRooms(formData.hostelId);
    }
  }, [formData.blockId]);

  const loadStudent = async () => {
    setLoading(true);
    try {
      const response = await api.getUser(studentId);
      if (response.success && response.data) {
        const student = response.data;
        const hostelId = (student.hostelId?._id || student.hostelId?.id || student.hostelId) || '';
        const roomId = (student.roomId?._id || student.roomId?.id || student.roomId) || '';
        const blockId = (student.blockId?._id || student.blockId?.id || student.blockId) || '';
        const planId = (student.planId?._id || student.planId?.id || student.planId) || '';
        const studentAmenities = student.amenities?.map((a: any) => a._id || a.id || a) || [];
        
        setFormData({
          name: student.name || '',
          email: student.email || '',
          phone: student.phone || '',
          studentId: student.studentId || '',
          hostelId,
          blockId,
          roomId,
          planId,
          amenities: studentAmenities,
          password: '',
          dateOfBirth: student.dateOfBirth ? new Date(student.dateOfBirth).toISOString().split('T')[0] : '',
          address: {
            street: student.address?.street || '',
            city: student.address?.city || '',
            state: student.address?.state || '',
            pincode: student.address?.pincode || '',
            country: student.address?.country || 'India',
          },
          parentContact: {
            name: student.parentContact?.name || '',
            phone: student.parentContact?.phone || '',
            email: student.parentContact?.email || '',
          },
          emergencyContact: {
            name: student.emergencyContact?.name || '',
            phone: student.emergencyContact?.phone || '',
            relation: student.emergencyContact?.relation || '',
          },
        });
        if (student.profileImage) {
          setExistingProfileImage(student.profileImage);
          setProfileImagePreview(student.profileImage);
        }
        if (student.documents && student.documents.length > 0) {
          setExistingDocuments(student.documents);
        }
      }
    } catch (error: any) {
      showToast(error.message || 'Failed to load student details', 'error');
      router.push('/owner/students/presence');
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

  const handleDocumentAdd = (file: File, type: string, name: string) => {
    setDocuments([...documents, { file, type, name }]);
  };

  const removeDocument = (index: number) => {
    setDocuments(documents.filter((_, i) => i !== index));
  };

  const removeExistingDocument = async (documentId: string) => {
    try {
      await api.deleteStudentDocument(studentId, documentId);
      setExistingDocuments(existingDocuments.filter((doc: any) => (doc._id || doc.id) !== documentId));
      showToast('Document deleted successfully', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to delete document', 'error');
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.email || !formData.phone || !formData.hostelId) {
      showToast('Please fill in all required fields (Name, Email, Phone, Hostel)', 'warning');
      setActiveTab('basic');
      return;
    }

    setSaving(true);
    try {
      const studentData = {
        ...formData,
        dateOfBirth: formData.dateOfBirth || undefined,
        hostelId: formData.hostelId && formData.hostelId.trim() !== '' ? formData.hostelId : undefined,
        blockId: formData.blockId && formData.blockId.trim() !== '' ? formData.blockId : undefined,
        roomId: formData.roomId && formData.roomId.trim() !== '' ? formData.roomId : undefined,
        planId: formData.planId && formData.planId.trim() !== '' ? formData.planId : undefined,
        amenities: formData.amenities.length > 0 ? formData.amenities : undefined,
      };

      await api.updateUser(studentId, studentData);

      if (profileImage) {
        try {
          await api.uploadStudentProfileImage(studentId, profileImage);
        } catch (error: any) {
          console.error('Failed to upload profile image:', error);
          showToast('Student updated but failed to upload profile image', 'warning');
        }
      }

      if (documents.length > 0) {
        try {
          for (const doc of documents) {
            await api.uploadStudentDocuments(studentId, [doc.file], doc.type, doc.name);
          }
        } catch (error: any) {
          console.error('Failed to upload documents:', error);
          showToast('Student updated but some documents failed to upload', 'warning');
        }
      }

      showToast('Student updated successfully', 'success');
      router.push(`/owner/students/${studentId}`);
    } catch (error: any) {
      showToast(error.message || 'Failed to update student', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      
        <div className="p-6 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading student details...</p>
          </div>
        </div>
      
    );
  }

  const tabs = [
    { id: 'basic', label: 'Basic Info', icon: User },
    { id: 'address', label: 'Address', icon: MapPin },
    { id: 'contacts', label: 'Contacts', icon: Phone },
    { id: 'assignment', label: 'Assignment', icon: Home },
    { id: 'documents', label: 'Documents', icon: FileText },
  ];

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="mx-auto px-6 py-4">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Edit Student</h1>
                <p className="text-sm text-gray-600 mt-1">Update student information</p>
              </div>
              <Link
                href={`/owner/students/${studentId}`}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </Link>
            </div>
          </div>
        </div>

        <div className="mx-auto px-6 py-6">
          {/* Tabs */}
          <div className="bg-white rounded-lg shadow-sm mb-6">
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8 px-6" aria-label="Tabs">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors`}
                  >
                    {(() => {
                      const IconComponent = tab.icon;
                      return <IconComponent className="w-4 h-4" />;
                    })()}
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Form Content */}
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-8">
              {/* Basic Information Tab */}
              {activeTab === 'basic' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">Basic Information</h2>
                      <p className="text-sm text-gray-600">Student's personal details</p>
                    </div>
                  </div>

                  {/* Profile Image */}
                  <div className="mb-6 pb-6 border-b border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Profile Photo
                    </label>
                    <div className="flex items-center gap-6">
                      <div className="relative">
                        {(profileImagePreview || existingProfileImage) ? (
                          <img
                            src={profileImagePreview || existingProfileImage}
                            alt="Profile preview"
                            className="w-32 h-32 rounded-full object-cover border-4 border-gray-200 shadow-md"
                            onError={(e) => {
                              e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name || 'Student')}&background=0a7ea4&color=fff&size=128`;
                            }}
                          />
                        ) : (
                          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-4xl font-semibold border-4 border-gray-200 shadow-md">
                            {formData.name.charAt(0).toUpperCase() || 'S'}
                          </div>
                        )}
                        <label className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full cursor-pointer hover:bg-blue-700 shadow-lg">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleProfileImageChange}
                            className="hidden"
                          />
                        </label>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">
                          {existingProfileImage ? 'Update profile photo' : 'Upload a profile photo'}
                        </p>
                        <p className="text-xs text-gray-500">JPG, PNG up to 5MB</p>
                        {existingProfileImage && !profileImage && (
                          <p className="text-xs text-orange-600 mt-1">Current image will be replaced</p>
                        )}
                      </div>
                    </div>
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
                        placeholder="Enter full name"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Student ID
                      </label>
                      <input
                        type="text"
                        value={formData.studentId}
                        onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        placeholder="Enter student ID"
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
                        placeholder="student@example.com"
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
                        placeholder="+91 9876543210"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Date of Birth
                      </label>
                      <input
                        type="date"
                        value={formData.dateOfBirth}
                        onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Hostel <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.hostelId}
                        onChange={(e) => {
                          setFormData({ 
                            ...formData, 
                            hostelId: e.target.value,
                            blockId: '',
                            roomId: '',
                            planId: '',
                            amenities: []
                          });
                        }}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white"
                        required
                      >
                        <option value="">Select Hostel</option>
                        {hostels.map((hostel) => (
                          <option key={hostel._id || hostel.id} value={hostel._id || hostel.id}>
                            {hostel.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Password
                        <span className="text-gray-500 font-normal ml-2">(Leave empty to keep current password)</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          className="w-full px-4 py-2.5 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                          placeholder="Enter new password or leave empty"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Address Tab */}
              {activeTab === 'address' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">Address Information</h2>
                      <p className="text-sm text-gray-600">Student's residential address</p>
                    </div>
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
                        placeholder="House/Flat number, Street name"
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
                        placeholder="City"
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
                        placeholder="State"
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
                        placeholder="123456"
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
                        placeholder="Country"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Contacts Tab */}
              {activeTab === 'contacts' && (
                <div className="space-y-8">
                  {/* Parent Contact */}
                  <div>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <Users className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold text-gray-900">Parent Contact</h2>
                        <p className="text-sm text-gray-600">Parent or guardian information</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                        <input
                          type="text"
                          value={formData.parentContact.name}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              parentContact: { ...formData.parentContact, name: e.target.value },
                            })
                          }
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                          placeholder="Parent name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                        <input
                          type="tel"
                          value={formData.parentContact.phone}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              parentContact: { ...formData.parentContact, phone: e.target.value },
                            })
                          }
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                          placeholder="+91 9876543210"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                        <input
                          type="email"
                          value={formData.parentContact.email}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              parentContact: { ...formData.parentContact, email: e.target.value },
                            })
                          }
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                          placeholder="parent@example.com"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Emergency Contact */}
                  <div className="pt-6 border-t border-gray-200">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                        <AlertCircle className="w-5 h-5 text-red-600" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold text-gray-900">Emergency Contact</h2>
                        <p className="text-sm text-gray-600">Emergency contact person details</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                        <input
                          type="text"
                          value={formData.emergencyContact.name}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              emergencyContact: { ...formData.emergencyContact, name: e.target.value },
                            })
                          }
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                          placeholder="Emergency contact name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                        <input
                          type="tel"
                          value={formData.emergencyContact.phone}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              emergencyContact: { ...formData.emergencyContact, phone: e.target.value },
                            })
                          }
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                          placeholder="+91 9876543210"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Relation</label>
                        <input
                          type="text"
                          value={formData.emergencyContact.relation}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              emergencyContact: { ...formData.emergencyContact, relation: e.target.value },
                            })
                          }
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                          placeholder="e.g., Father, Mother, Guardian"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Assignment Tab */}
              {activeTab === 'assignment' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                      <Home className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">Room & Amenities Assignment</h2>
                      <p className="text-sm text-gray-600">Assign student to a room and select amenities</p>
                    </div>
                  </div>

                  {!formData.hostelId ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-sm text-yellow-800">
                        Please select a hostel in the Basic Information tab first.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Block Selection */}
                      {blocks.length > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Block (Optional)
                          </label>
                          <select
                            value={formData.blockId}
                            onChange={(e) => {
                              setFormData({ 
                                ...formData, 
                                blockId: e.target.value,
                                roomId: ''
                              });
                            }}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white"
                          >
                            <option value="">All Blocks</option>
                            {blocks.map((block) => (
                              <option key={block._id || block.id} value={block._id || block.id}>
                                {block.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Room Selection */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Room (Optional)
                        </label>
                        {loadingRooms ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                            <span className="ml-2 text-sm text-gray-600">Loading rooms...</span>
                          </div>
                        ) : (
                          <select
                            value={formData.roomId}
                            onChange={(e) => setFormData({ ...formData, roomId: e.target.value })}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white"
                          >
                            <option value="">Select Room (Optional)</option>
                            {rooms.map((room) => (
                              <option key={room._id || room.id} value={room._id || room.id}>
                                {room.roomNumber} - {room.category} ({room.currentOccupancy}/{room.capacity} occupied)
                              </option>
                            ))}
                          </select>
                        )}
                        {rooms.length === 0 && !loadingRooms && formData.hostelId && (
                          <p className="text-sm text-gray-500 mt-2">No rooms found for this hostel.</p>
                        )}
                      </div>

                      {/* Plan Selection */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Rent plan (Optional)
                        </label>
                        <select
                          value={formData.planId}
                          onChange={(e) => setFormData({ ...formData, planId: e.target.value })}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white"
                        >
                          <option value="">No plan selected</option>
                          {plans.map((p) => (
                            <option key={p._id || p.id} value={p._id || p.id}>
                              {p.name} — ₹{Number(p.amount || 0).toLocaleString()}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Amenities Selection */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Amenities (Optional)
                        </label>
                        {loadingAmenities ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                            <span className="ml-2 text-sm text-gray-600">Loading amenities...</span>
                          </div>
                        ) : amenities.length === 0 ? (
                          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                            <p className="text-sm text-gray-600">No amenities available for this hostel.</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto border border-gray-200 rounded-lg p-4">
                            {amenities.map((amenity) => (
                              <label
                                key={amenity._id || amenity.id}
                                className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                                  formData.amenities.includes(amenity._id || amenity.id)
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300 bg-white'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={formData.amenities.includes(amenity._id || amenity.id)}
                                  onChange={(e) => {
                                    const amenityId = amenity._id || amenity.id;
                                    if (e.target.checked) {
                                      setFormData({
                                        ...formData,
                                        amenities: [...formData.amenities, amenityId],
                                      });
                                    } else {
                                      setFormData({
                                        ...formData,
                                        amenities: formData.amenities.filter((id) => id !== amenityId),
                                      });
                                    }
                                  }}
                                  className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <Wifi className="w-4 h-4 text-gray-500" />
                                    <span className="font-medium text-gray-900">{amenity.name}</span>
                                    {!amenity.isAvailable && (
                                      <span className="text-xs px-2 py-0.5 bg-red-100 text-red-800 rounded">
                                        Unavailable
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-500 mt-1 capitalize">{amenity.category}</p>
                                  {amenity.description && (
                                    <p className="text-xs text-gray-600 mt-1">{amenity.description}</p>
                                  )}
                                  {amenity.quantity && (
                                    <p className="text-xs text-gray-500 mt-1">
                                      Available: {amenity.availableQuantity || 0} / {amenity.quantity} {amenity.unit}
                                    </p>
                                  )}
                                </div>
                              </label>
                            ))}
                          </div>
                        )}
                        {formData.amenities.length > 0 && (
                          <p className="text-sm text-gray-600 mt-2">
                            {formData.amenities.length} amenit{formData.amenities.length === 1 ? 'y' : 'ies'} selected
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Documents Tab */}
              {activeTab === 'documents' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-orange-600" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold text-gray-900">Documents</h2>
                        <p className="text-sm text-gray-600">Manage student documents and certificates</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowDocumentModal(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                      Add Document
                    </button>
                  </div>

                  {/* Existing Documents */}
                  {existingDocuments.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm font-medium text-gray-700 mb-3">Existing Documents</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {existingDocuments.map((doc: any, index: number) => (
                          <div
                            key={doc._id || index}
                            className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{doc.name || 'Document'}</p>
                                <p className="text-xs text-gray-500 capitalize">{doc.type?.replace('-', ' ') || 'other'}</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {doc.url && (
                                <a
                                  href={doc.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 p-2 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="View document"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => removeExistingDocument(doc._id || doc.id)}
                                className="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete document"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* New Documents */}
                  {documents.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-3">New Documents to Upload</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {documents.map((doc, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200 hover:border-blue-300 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                                <p className="text-xs text-gray-500 capitalize">{doc.type.replace('-', ' ')}</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeDocument(index)}
                              className="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {existingDocuments.length === 0 && documents.length === 0 && (
                    <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
                      <svg
                        className="mx-auto h-12 w-12 text-gray-400"
                        stroke="currentColor"
                        fill="none"
                        viewBox="0 0 48 48"
                      >
                        <path
                          d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <h3 className="mt-2 text-sm font-medium text-gray-900">No documents</h3>
                      <p className="mt-1 text-sm text-gray-500">Get started by uploading a document.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="px-8 py-6 border-t border-gray-200 bg-gray-50 rounded-b-lg">
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Required fields</span> are marked with <span className="text-red-500">*</span>
                </div>
                <div className="flex gap-3">
                  <Link
                    href={`/owner/students/${studentId}`}
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
                        Updating...
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5" />
                        Update Student
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Document Upload Modal */}
      <DocumentUploadModal
        isOpen={showDocumentModal}
        onClose={() => setShowDocumentModal(false)}
        onAdd={handleDocumentAdd}
      />
    </>
  );
}
