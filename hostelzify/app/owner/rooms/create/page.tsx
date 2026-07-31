'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../../contexts/AuthContext';
import api from '../../../../services/api';
import { useToast } from '../../../../components/Toast';
import { ArrowLeft, Home, Users, DollarSign, Check, Loader2, Upload, X } from 'lucide-react';

export default function CreateRoomPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [hostelsLoading, setHostelsLoading] = useState(true);
  const [hostels, setHostels] = useState<any[]>([]);
  const [selectedHostelId, setSelectedHostelId] = useState<string>('');
  const [activeTab, setActiveTab] = useState('basic');
  const [formData, setFormData] = useState({
    roomNumber: '',
    blockId: '',
    floorNumber: 1,
    capacity: 2,
    category: 'Standard',
    status: 'available',
    pricing: {
      monthly: 0,
      yearly: 0,
      perBed: 0,
    },
    amenities: [] as string[],
    description: '',
  });
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  useEffect(() => {
    if (!user || user.role !== 'owner') {
      router.replace('/login');
      return;
    }
    loadHostels();
  }, [user, router]);


  const loadHostels = async () => {
    setHostelsLoading(true);
    try {
      const hostelsList = await api.getHostels();
      const list = Array.isArray(hostelsList) ? hostelsList : [];
      setHostels(list);
      // Set first hostel as default if available
      if (list.length > 0 && !selectedHostelId?.trim()) {
        const firstHostelId = list[0]._id || list[0].id;
        if (firstHostelId) setSelectedHostelId(String(firstHostelId));
      }
    } catch (error: any) {
      showToast('Failed to load hostels', 'error');
    } finally {
      setHostelsLoading(false);
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

  const handleSubmit = async () => {
    // Validate required fields
    const roomNumber = formData.roomNumber?.trim();
    
    if (!roomNumber) {
      showToast('Please enter a room number', 'warning');
      setActiveTab('basic');
      return;
    }
    
    // Check if hostel is selected - allow empty string check but also check if it's actually set
    if (!selectedHostelId || selectedHostelId === '' || selectedHostelId.trim() === '') {
      showToast('Please select a hostel', 'warning');
      setActiveTab('basic');
      return;
    }

    setLoading(true);
    try {
      const roomData = {
        ...formData,
        hostelId: selectedHostelId || undefined,
        blockId: formData.blockId || undefined, // Only include blockId if it's provided
        pricing: {
          monthly: Number(formData.pricing.monthly),
          yearly: Number(formData.pricing.yearly) || Number(formData.pricing.monthly) * 12,
          perBed: Number(formData.pricing.perBed) || Number(formData.pricing.monthly) / formData.capacity,
        },
      };

      const response = await api.createRoom(roomData);
      const payload = response?.data ?? response;
      const roomId = payload?._id || payload?.id;

      // Upload images if any
      if (images.length > 0) {
        await api.uploadRoomImages(roomId, images);
      }

      showToast('Room created successfully', 'success');
      router.push(`/owner/rooms/${roomId}`);
    } catch (error: any) {
      showToast(error.message || 'Failed to create room', 'error');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'basic', label: 'Basic Info', icon: Home },
    { id: 'pricing', label: 'Pricing', icon: DollarSign },
    { id: 'images', label: 'Images', icon: Upload },
  ];

  return (
    
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="px-6 py-4">
            <div className="flex items-center gap-4">
              <Link
                href="/owner/rooms"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Create Room</h1>
                <p className="text-sm text-gray-600 mt-1">Add a new room to your hostel</p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-6">
          <div className="bg-white rounded-lg shadow-sm">
            {/* Tabs */}
            <div className="border-b border-gray-200">
              <div className="flex space-x-1 px-6">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-4 py-3 flex items-center gap-2 font-medium text-sm transition-colors ${
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

            <div className="p-6">
              {/* Basic Info Tab */}
              {activeTab === 'basic' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Room Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.roomNumber}
                        onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., 101, A-201"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Hostel <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={selectedHostelId || ''}
                        onChange={(e) => {
                          const hostelId = e.target.value;
                          setSelectedHostelId(hostelId);
                        }}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        {hostelsLoading ? (
                          <option value="">Loading hostels...</option>
                        ) : hostels.length === 0 ? (
                          <option value="">No hostels found</option>
                        ) : (
                          hostels.map((hostel) => {
                            const hostelId = String(hostel._id || hostel.id);
                            return (
                              <option key={hostelId} value={hostelId}>
                                {hostel.name}
                              </option>
                            );
                          })
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Block <span className="text-gray-500 text-xs">(Optional)</span>
                      </label>
                      <input
                        type="text"
                        value={formData.blockId}
                        onChange={(e) => setFormData({ ...formData, blockId: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., Block A, Building 1"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Floor Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        value={formData.floorNumber}
                        onChange={(e) => setFormData({ ...formData, floorNumber: Number(e.target.value) })}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="1"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Capacity <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        value={formData.capacity}
                        onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="1"
                        required
                      />
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
                        <option value="Standard">Standard</option>
                        <option value="AC">AC</option>
                        <option value="Non-AC">Non-AC</option>
                        <option value="Deluxe">Deluxe</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Status <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="available">Available</option>
                        <option value="occupied">Occupied</option>
                        <option value="maintenance">Maintenance</option>
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
                      placeholder="Room description, features, etc."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Amenities</label>
                    <div className="flex flex-wrap gap-2">
                      {['WiFi', 'AC', 'TV', 'Attached Bathroom', 'Balcony', 'Study Table', 'Wardrobe', 'Geyser'].map((amenity) => (
                        <button
                          key={amenity}
                          type="button"
                          onClick={() => {
                            if (formData.amenities.includes(amenity)) {
                              setFormData({
                                ...formData,
                                amenities: formData.amenities.filter((a) => a !== amenity),
                              });
                            } else {
                              setFormData({
                                ...formData,
                                amenities: [...formData.amenities, amenity],
                              });
                            }
                          }}
                          className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                            formData.amenities.includes(amenity)
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {amenity}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Pricing Tab */}
              {activeTab === 'pricing' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Monthly Rent (₹)
                      </label>
                      <input
                        type="number"
                        value={formData.pricing.monthly}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            pricing: {
                              ...formData.pricing,
                              monthly: Number(e.target.value),
                              perBed: formData.capacity > 0 ? Number(e.target.value) / formData.capacity : 0,
                            },
                          })
                        }
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="0"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Yearly Rent (₹)
                      </label>
                      <input
                        type="number"
                        value={formData.pricing.yearly || formData.pricing.monthly * 12}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            pricing: { ...formData.pricing, yearly: Number(e.target.value) },
                          })
                        }
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="0"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Per Bed (₹)
                      </label>
                      <input
                        type="number"
                        value={formData.pricing.perBed || (formData.capacity > 0 ? formData.pricing.monthly / formData.capacity : 0)}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            pricing: { ...formData.pricing, perBed: Number(e.target.value) },
                          })
                        }
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Images Tab */}
              {activeTab === 'images' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Room Images
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageChange}
                        className="hidden"
                        id="room-images"
                      />
                      <label
                        htmlFor="room-images"
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

                  {imagePreviews.length > 0 && (
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
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <Link
                href="/owner/rooms"
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-white transition-colors"
              >
                Cancel
              </Link>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin h-5 w-5" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Create Room
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    
  );
}

