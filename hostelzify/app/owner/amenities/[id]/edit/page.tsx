'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import { useToast } from '@/components/Toast';
import { ArrowLeft, Wifi, Package, DollarSign, Check, Loader2, Upload, X, Settings, Trash2 } from 'lucide-react';

export default function EditAmenityPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hostels, setHostels] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('basic');
  const [formData, setFormData] = useState({
    name: '',
    hostelId: '',
    category: 'wifi',
    description: '',
    isAvailable: true,
    quantity: 1,
    availableQuantity: 1,
    unit: 'unit',
    cost: 0,
    costType: 'free',
    details: {
      speed: '',
      type: '',
      machines: 0,
      mealType: '',
      timings: {
        breakfast: '',
        lunch: '',
        dinner: '',
      },
      vehicleType: '',
      slots: 0,
      equipment: [] as string[],
      books: 0,
      capacity: 0,
      location: '',
      operatingHours: '',
    },
  });
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);

  useEffect(() => {
    if (!user || user.role !== 'owner') {
      router.replace('/login');
      return;
    }
    if (id) {
      loadData();
    }
  }, [id, user, router]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [hostelsRes, amenityRes] = await Promise.all([
        api.getHostels(),
        api.getAmenity(id),
      ]);

      setHostels(hostelsRes.data || []);
      const amenity = amenityRes.data;

      if (amenity) {
        setFormData({
          name: amenity.name || '',
          hostelId: amenity.hostelId?._id || amenity.hostelId || '',
          category: amenity.category || 'wifi',
          description: amenity.description || '',
          isAvailable: amenity.isAvailable !== undefined ? amenity.isAvailable : true,
          quantity: amenity.quantity || 1,
          availableQuantity: amenity.availableQuantity || 1,
          unit: amenity.unit || 'unit',
          cost: amenity.cost || 0,
          costType: amenity.costType || 'free',
          details: {
            speed: amenity.details?.speed || '',
            type: amenity.details?.type || '',
            machines: amenity.details?.machines || 0,
            mealType: amenity.details?.mealType || '',
            timings: {
              breakfast: amenity.details?.timings?.breakfast || '',
              lunch: amenity.details?.timings?.lunch || '',
              dinner: amenity.details?.timings?.dinner || '',
            },
            vehicleType: amenity.details?.vehicleType || '',
            slots: amenity.details?.slots || 0,
            equipment: amenity.details?.equipment || [],
            books: amenity.details?.books || 0,
            capacity: amenity.details?.capacity || 0,
            location: amenity.details?.location || '',
            operatingHours: amenity.details?.operatingHours || '',
          },
        });

        setExistingImages(amenity.images || []);
      }
    } catch (error: any) {
      showToast(error.message || 'Failed to load amenity data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const newPreviews: string[] = [];
      
      newFiles.forEach((file) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          newPreviews.push(reader.result as string);
          if (newPreviews.length === newFiles.length) {
            setImages([...images, ...newFiles]);
            setImagePreviews([...imagePreviews, ...newPreviews]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
    setImagePreviews(imagePreviews.filter((_, i) => i !== index));
  };

  const handleDeleteExistingImage = async (imageUrl: string) => {
    try {
      await api.deleteAmenityImage(id, imageUrl);
      showToast('Image deleted successfully', 'success');
      setExistingImages(existingImages.filter(img => img !== imageUrl));
    } catch (error: any) {
      showToast(error.message || 'Failed to delete image', 'error');
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.hostelId) {
      showToast('Please fill in all required fields (Name, Hostel)', 'warning');
      setActiveTab('basic');
      return;
    }

    setSaving(true);
    try {
      const amenityData = {
        ...formData,
        quantity: Number(formData.quantity),
        availableQuantity: Number(formData.availableQuantity),
        cost: Number(formData.cost),
        details: {
          ...formData.details,
          machines: Number(formData.details.machines) || 0,
          slots: Number(formData.details.slots) || 0,
          books: Number(formData.details.books) || 0,
          capacity: Number(formData.details.capacity) || 0,
        },
      };

      await api.updateAmenity(id, amenityData);

      // Upload new images if any
      if (images.length > 0) {
        await api.uploadAmenityImages(id, images);
      }

      showToast('Amenity updated successfully', 'success');
      router.push(`/owner/amenities/${id}`);
    } catch (error: any) {
      showToast(error.message || 'Failed to update amenity', 'error');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'basic', label: 'Basic Info', icon: Wifi },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'pricing', label: 'Pricing', icon: DollarSign },
    { id: 'details', label: 'Details', icon: Settings },
    { id: 'images', label: 'Images', icon: Upload },
  ];

  const renderCategorySpecificFields = () => {
    switch (formData.category) {
      case 'wifi':
        return (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Internet Speed</label>
            <input
              type="text"
              value={formData.details.speed}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  details: { ...formData.details, speed: e.target.value },
                })
              }
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., 100 Mbps"
            />
          </div>
        );
      case 'laundry':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Type</label>
              <select
                value={formData.details.type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    details: { ...formData.details, type: e.target.value },
                  })
                }
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Type</option>
                <option value="self-service">Self-Service</option>
                <option value="service">Service</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Number of Machines</label>
              <input
                type="number"
                value={formData.details.machines}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    details: { ...formData.details, machines: Number(e.target.value) },
                  })
                }
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
              />
            </div>
          </div>
        );
      case 'mess':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Meal Type</label>
              <select
                value={formData.details.mealType}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    details: { ...formData.details, mealType: e.target.value },
                  })
                }
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Meal Type</option>
                <option value="vegetarian">Vegetarian</option>
                <option value="non-vegetarian">Non-Vegetarian</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Breakfast Timing</label>
                <input
                  type="text"
                  value={formData.details.timings.breakfast}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      details: {
                        ...formData.details,
                        timings: { ...formData.details.timings, breakfast: e.target.value },
                      },
                    })
                  }
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 7:00 AM - 9:00 AM"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Lunch Timing</label>
                <input
                  type="text"
                  value={formData.details.timings.lunch}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      details: {
                        ...formData.details,
                        timings: { ...formData.details.timings, lunch: e.target.value },
                      },
                    })
                  }
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 12:00 PM - 2:00 PM"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Dinner Timing</label>
                <input
                  type="text"
                  value={formData.details.timings.dinner}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      details: {
                        ...formData.details,
                        timings: { ...formData.details.timings, dinner: e.target.value },
                      },
                    })
                  }
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 7:00 PM - 9:00 PM"
                />
              </div>
            </div>
          </div>
        );
      case 'parking':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Vehicle Type</label>
              <select
                value={formData.details.vehicleType}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    details: { ...formData.details, vehicleType: e.target.value },
                  })
                }
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Vehicle Type</option>
                <option value="two-wheeler">Two-Wheeler</option>
                <option value="four-wheeler">Four-Wheeler</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Number of Slots</label>
              <input
                type="number"
                value={formData.details.slots}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    details: { ...formData.details, slots: Number(e.target.value) },
                  })
                }
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
              />
            </div>
          </div>
        );
      case 'gym':
        return (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Equipment (comma-separated)</label>
            <input
              type="text"
              value={formData.details.equipment.join(', ')}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  details: {
                    ...formData.details,
                    equipment: e.target.value.split(',').map((item) => item.trim()).filter(Boolean),
                  },
                })
              }
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Treadmill, Dumbbells, Bench Press"
            />
          </div>
        );
      case 'library':
        return (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Number of Books</label>
            <input
              type="number"
              value={formData.details.books}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  details: { ...formData.details, books: Number(e.target.value) },
                })
              }
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="0"
            />
          </div>
        );
      case 'common-room':
      case 'tv-room':
      case 'study-room':
        return (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Capacity</label>
            <input
              type="number"
              value={formData.details.capacity}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  details: { ...formData.details, capacity: Number(e.target.value) },
                })
              }
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="0"
              placeholder="Maximum capacity"
            />
          </div>
        );
      default:
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Location</label>
              <input
                type="text"
                value={formData.details.location}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    details: { ...formData.details, location: e.target.value },
                  })
                }
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Ground Floor, Building A"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Operating Hours</label>
              <input
                type="text"
                value={formData.details.operatingHours}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    details: { ...formData.details, operatingHours: e.target.value },
                  })
                }
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 6:00 AM - 10:00 PM"
              />
            </div>
          </div>
        );
    }
  };

  if (loading) {
    return (
      
        <div className="flex justify-center items-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      
    );
  }

  return (
    
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="px-4 md:px-6 py-4">
            <div className="flex items-center gap-4">
              <Link
                href={`/owner/amenities/${id}`}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Edit Amenity</h1>
                <p className="text-sm text-gray-600 mt-1">Update amenity information</p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 md:px-6 py-6">
          <div className="bg-white rounded-lg shadow-sm">
            {/* Tabs */}
            <div className="border-b border-gray-200">
              <div className="flex space-x-1 px-4 md:px-6 overflow-x-auto">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-4 py-3 flex items-center gap-2 font-medium text-sm transition-colors whitespace-nowrap ${
                        activeTab === tab.id
                          ? 'text-blue-600 border-b-2 border-blue-600'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-4 md:p-6">
              {/* Basic Info Tab */}
              {activeTab === 'basic' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., High-Speed WiFi, Laundry Service"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Hostel <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.hostelId}
                        onChange={(e) => setFormData({ ...formData, hostelId: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Category <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
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
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Status <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.isAvailable ? 'true' : 'false'}
                        onChange={(e) => setFormData({ ...formData, isAvailable: e.target.value === 'true' })}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="true">Available</option>
                        <option value="false">Unavailable</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={4}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Amenity description, features, etc."
                    />
                  </div>
                </div>
              )}

              {/* Inventory Tab */}
              {activeTab === 'inventory' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Total Quantity <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        value={formData.quantity}
                        onChange={(e) => {
                          const qty = Number(e.target.value);
                          setFormData({
                            ...formData,
                            quantity: qty,
                            availableQuantity: Math.min(formData.availableQuantity, qty),
                          });
                        }}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="1"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Available Quantity <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        value={formData.availableQuantity}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            availableQuantity: Math.min(Number(e.target.value), formData.quantity),
                          })
                        }
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="0"
                        max={formData.quantity}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Unit <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.unit}
                        onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="unit">Unit</option>
                        <option value="piece">Piece</option>
                        <option value="room">Room</option>
                        <option value="machine">Machine</option>
                        <option value="slot">Slot</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Pricing Tab */}
              {activeTab === 'pricing' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Cost Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.costType}
                        onChange={(e) => setFormData({ ...formData, costType: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="free">Free</option>
                        <option value="monthly">Monthly</option>
                        <option value="per-use">Per Use</option>
                        <option value="one-time">One-Time</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Cost (₹)
                      </label>
                      <input
                        type="number"
                        value={formData.cost}
                        onChange={(e) => setFormData({ ...formData, cost: Number(e.target.value) })}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="0"
                        disabled={formData.costType === 'free'}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Details Tab */}
              {activeTab === 'details' && (
                <div className="space-y-6">
                  {renderCategorySpecificFields()}
                </div>
              )}

              {/* Images Tab */}
              {activeTab === 'images' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Upload New Images
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageChange}
                        className="hidden"
                        id="amenity-images"
                      />
                      <label
                        htmlFor="amenity-images"
                        className="cursor-pointer flex flex-col items-center gap-2"
                      >
                        <Upload className="w-8 h-8 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          Click to upload or drag and drop
                        </span>
                        <span className="text-xs text-gray-500">PNG, JPG up to 10MB</span>
                      </label>
                    </div>
                  </div>

                  {/* New Image Previews */}
                  {imagePreviews.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">New Images</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {imagePreviews.map((preview, index) => (
                          <div key={index} className="relative group">
                            <img
                              src={preview}
                              alt={`Preview ${index + 1}`}
                              className="w-full h-32 object-cover rounded-lg"
                            />
                            <button
                              onClick={() => removeImage(index)}
                              className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Existing Images */}
                  {existingImages.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">Existing Images</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {existingImages.map((imageUrl, index) => (
                          <div key={index} className="relative group">
                            <img
                              src={imageUrl}
                              alt={`Existing ${index + 1}`}
                              className="w-full h-32 object-cover rounded-lg"
                            />
                            <button
                              onClick={() => handleDeleteExistingImage(imageUrl)}
                              className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 md:px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <Link
                href={`/owner/amenities/${id}`}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-white transition-colors"
              >
                Cancel
              </Link>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="animate-spin h-5 w-5" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Update Amenity
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    
  );
}

