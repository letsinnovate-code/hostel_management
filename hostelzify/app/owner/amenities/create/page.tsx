'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../../contexts/AuthContext';
import api from '../../../../services/api';
import { useToast } from '../../../../components/Toast';
import { ArrowLeft, ArrowRight, Check, Loader2, Upload, X, Wifi, Package, DollarSign, Settings, Image as ImageIcon } from 'lucide-react';

interface FormData {
  name: string;
  hostelId: string;
  category: string;
  description: string;
  isAvailable: boolean;
  quantity: number;
  availableQuantity: number;
  unit: string;
  cost: number;
  costType: string;
  details: {
    speed?: string;
    type?: string;
    machines?: number;
    mealType?: string;
    timings?: {
      breakfast?: string;
      lunch?: string;
      dinner?: string;
    };
    vehicleType?: string;
    slots?: number;
    equipment?: string[];
    books?: number;
    capacity?: number;
    location?: string;
    operatingHours?: string;
  };
}

export default function CreateAmenityPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [hostels, setHostels] = useState<any[]>([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
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
    details: {},
  });
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  const totalSteps = 5;
  const categoriesRequiringInventory = ['laundry', 'parking', 'gym', 'library', 'common-room', 'tv-room', 'study-room', 'sports', 'medical'];
  const requiresInventory = categoriesRequiringInventory.includes(formData.category);

  useEffect(() => {
    if (!user || user.role !== 'owner') {
      router.replace('/login');
      return;
    }
    loadHostels();
  }, [user, router]);

  const loadHostels = async () => {
    try {
      const response = await api.getHostels();
      setHostels(response.data || []);
    } catch (error: any) {
      showToast('Failed to load hostels', 'error');
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

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!formData.name.trim()) {
          showToast('Please enter amenity name', 'warning');
          return false;
        }
        if (!formData.hostelId) {
          showToast('Please select a hostel', 'warning');
          return false;
        }
        return true;
      case 2:
        // Category-specific validation
        if (formData.category === 'wifi' && !formData.details.speed?.trim()) {
          showToast('Please enter internet speed', 'warning');
          return false;
        }
        if (formData.category === 'laundry') {
          if (!formData.details.type) {
            showToast('Please select laundry type', 'warning');
            return false;
          }
          if (!formData.details.machines || formData.details.machines < 1) {
            showToast('Please enter number of machines', 'warning');
            return false;
          }
        }
        if (formData.category === 'mess') {
          if (!formData.details.mealType) {
            showToast('Please select meal type', 'warning');
            return false;
          }
        }
        if (formData.category === 'parking') {
          if (!formData.details.vehicleType) {
            showToast('Please select vehicle type', 'warning');
            return false;
          }
          if (!formData.details.slots || formData.details.slots < 1) {
            showToast('Please enter number of parking slots', 'warning');
            return false;
          }
        }
        if (formData.category === 'library' && (!formData.details.books || formData.details.books < 0)) {
          showToast('Please enter number of books', 'warning');
          return false;
        }
        if (['common-room', 'tv-room', 'study-room'].includes(formData.category)) {
          if (!formData.details.capacity || formData.details.capacity < 1) {
            showToast('Please enter room capacity', 'warning');
            return false;
          }
        }
        return true;
      case 3:
        if (requiresInventory) {
          if (!formData.quantity || formData.quantity < 1) {
            showToast('Please enter total quantity', 'warning');
            return false;
          }
          if (formData.availableQuantity > formData.quantity) {
            showToast('Available quantity cannot exceed total quantity', 'warning');
            return false;
          }
        }
        return true;
      case 4:
        if (formData.costType !== 'free' && (!formData.cost || formData.cost < 0)) {
          showToast('Please enter a valid cost', 'warning');
          return false;
        }
        return true;
      case 5:
        return true; // Images are optional
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      // Skip inventory step if not required
      if (currentStep === 2 && !requiresInventory) {
        setCurrentStep(4);
      } else {
        setCurrentStep(Math.min(currentStep + 1, totalSteps));
      }
    }
  };

  const prevStep = () => {
    // Skip inventory step if not required when going back
    if (currentStep === 4 && !requiresInventory) {
      setCurrentStep(2);
    } else {
      setCurrentStep(Math.max(currentStep - 1, 1));
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) {
      return;
    }

    setLoading(true);
    try {
      const amenityData: any = {
        name: formData.name.trim(),
        hostelId: formData.hostelId,
        category: formData.category,
        description: formData.description.trim() || undefined,
        isAvailable: formData.isAvailable,
        cost: formData.costType === 'free' ? 0 : Number(formData.cost),
        costType: formData.costType,
      };

      // Add inventory fields only if required
      if (requiresInventory) {
        amenityData.quantity = Number(formData.quantity);
        amenityData.availableQuantity = Number(formData.availableQuantity);
        amenityData.unit = formData.unit;
      } else {
        amenityData.quantity = 1;
        amenityData.availableQuantity = formData.isAvailable ? 1 : 0;
        amenityData.unit = 'unit';
      }

      // Build details object with only defined values
      const details: any = {};

      // Add category-specific details
      if (formData.category === 'wifi') {
        if (formData.details.speed?.trim()) {
          details.speed = formData.details.speed.trim();
        }
      } else if (formData.category === 'laundry') {
        if (formData.details.type) {
          details.type = formData.details.type;
        }
        if (formData.details.machines !== undefined && formData.details.machines !== null) {
          details.machines = Number(formData.details.machines);
        }
      } else if (formData.category === 'mess') {
        if (formData.details.mealType) {
          details.mealType = formData.details.mealType;
        }
        const timings: any = {};
        if (formData.details.timings?.breakfast?.trim()) {
          timings.breakfast = formData.details.timings.breakfast.trim();
        }
        if (formData.details.timings?.lunch?.trim()) {
          timings.lunch = formData.details.timings.lunch.trim();
        }
        if (formData.details.timings?.dinner?.trim()) {
          timings.dinner = formData.details.timings.dinner.trim();
        }
        if (Object.keys(timings).length > 0) {
          details.timings = timings;
        }
      } else if (formData.category === 'parking') {
        if (formData.details.vehicleType) {
          details.vehicleType = formData.details.vehicleType;
        }
        if (formData.details.slots !== undefined && formData.details.slots !== null) {
          details.slots = Number(formData.details.slots);
        }
      } else if (formData.category === 'gym') {
        if (formData.details.equipment && formData.details.equipment.length > 0) {
          details.equipment = formData.details.equipment;
        }
      } else if (formData.category === 'library') {
        if (formData.details.books !== undefined && formData.details.books !== null) {
          details.books = Number(formData.details.books);
        }
      } else if (['common-room', 'tv-room', 'study-room'].includes(formData.category)) {
        if (formData.details.capacity !== undefined && formData.details.capacity !== null) {
          details.capacity = Number(formData.details.capacity);
        }
      }

      // Add generic fields
      if (formData.details.location?.trim()) {
        details.location = formData.details.location.trim();
      }
      if (formData.details.operatingHours?.trim()) {
        details.operatingHours = formData.details.operatingHours.trim();
      }

      // Only add details if it has at least one property
      if (Object.keys(details).length > 0) {
        amenityData.details = details;
      }

      const response = await api.createAmenity(amenityData);
      const amenityId = response.data._id || response.data.id;

      // Upload images if any
      if (images.length > 0) {
        await api.uploadAmenityImages(amenityId, images);
      }

      showToast('Amenity created successfully', 'success');
      router.push(`/owner/amenities/${amenityId}`);
    } catch (error: any) {
      showToast(error.message || 'Failed to create amenity', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 1:
        return 'Basic Information';
      case 2:
        return 'Amenity Details';
      case 3:
        return 'Inventory & Availability';
      case 4:
        return 'Pricing';
      case 5:
        return 'Images';
      default:
        return '';
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Amenity Name <span className="text-red-500">*</span>
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
                  onChange={(e) => {
                    setFormData({ 
                      ...formData, 
                      category: e.target.value,
                      details: {} // Reset details when category changes
                    });
                  }}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="wifi">WiFi / Internet</option>
                  <option value="laundry">Laundry</option>
                  <option value="mess">Mess / Dining</option>
                  <option value="parking">Parking</option>
                  <option value="gym">Gym / Fitness</option>
                  <option value="library">Library</option>
                  <option value="common-room">Common Room</option>
                  <option value="tv-room">TV Room</option>
                  <option value="study-room">Study Room</option>
                  <option value="security">Security</option>
                  <option value="medical">Medical / First Aid</option>
                  <option value="sports">Sports Facilities</option>
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
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Describe the amenity, its features, and benefits..."
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            {formData.category === 'wifi' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Internet Speed <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.details.speed || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      details: { ...formData.details, speed: e.target.value },
                    })
                  }
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 100 Mbps, 1 Gbps"
                />
                <p className="text-xs text-gray-500 mt-1">Enter the internet speed provided</p>
              </div>
            )}

            {formData.category === 'laundry' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Service Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.details.type || ''}
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
                      <option value="service">Full Service</option>
                      <option value="both">Both</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Number of Machines <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={formData.details.machines || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          details: { ...formData.details, machines: Number(e.target.value) },
                        })
                      }
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="1"
                      placeholder="e.g., 5"
                    />
                  </div>
                </div>
              </div>
            )}

            {formData.category === 'mess' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Meal Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.details.mealType || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        details: { ...formData.details, mealType: e.target.value },
                      })
                    }
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Meal Type</option>
                    <option value="vegetarian">Vegetarian Only</option>
                    <option value="non-vegetarian">Non-Vegetarian</option>
                    <option value="both">Both Options</option>
                  </select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Breakfast Timing
                    </label>
                    <input
                      type="text"
                      value={formData.details.timings?.breakfast || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          details: {
                            ...formData.details,
                            timings: { 
                              breakfast: e.target.value,
                              lunch: formData.details.timings?.lunch ?? '',
                              dinner: formData.details.timings?.dinner ?? '',
                            },
                          },
                        })
                      }
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., 7:00 AM - 9:00 AM"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Lunch Timing
                    </label>
                    <input
                      type="text"
                      value={formData.details.timings?.lunch || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          details: {
                            ...formData.details,
                            timings: { 
                              breakfast: formData.details.timings?.breakfast ?? '',
                              lunch: e.target.value,
                              dinner: formData.details.timings?.dinner ?? '',
                            },
                          },
                        })
                      }
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., 12:00 PM - 2:00 PM"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Dinner Timing
                    </label>
                    <input
                      type="text"
                      value={formData.details.timings?.dinner || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          details: {
                            ...formData.details,
                            timings: { 
                              breakfast: formData.details.timings?.breakfast ?? '',
                              lunch: formData.details.timings?.lunch ?? '',
                              dinner: e.target.value,
                            },
                          },
                        })
                      }
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., 7:00 PM - 9:00 PM"
                    />
                  </div>
                </div>
              </div>
            )}

            {formData.category === 'parking' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Vehicle Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.details.vehicleType || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        details: { ...formData.details, vehicleType: e.target.value },
                      })
                    }
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Vehicle Type</option>
                    <option value="two-wheeler">Two-Wheeler Only</option>
                    <option value="four-wheeler">Four-Wheeler Only</option>
                    <option value="both">Both</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Number of Parking Slots <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.details.slots || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        details: { ...formData.details, slots: Number(e.target.value) },
                      })
                    }
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="1"
                    placeholder="e.g., 50"
                  />
                </div>
              </div>
            )}

            {formData.category === 'gym' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Equipment List
                </label>
                <input
                  type="text"
                  value={(formData.details.equipment || []).join(', ')}
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
                  placeholder="e.g., Treadmill, Dumbbells, Bench Press, Squat Rack"
                />
                <p className="text-xs text-gray-500 mt-1">Separate multiple items with commas</p>
              </div>
            )}

            {formData.category === 'library' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Number of Books
                </label>
                <input
                  type="number"
                  value={formData.details.books || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      details: { ...formData.details, books: Number(e.target.value) },
                    })
                  }
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                  placeholder="e.g., 5000"
                />
              </div>
            )}

            {['common-room', 'tv-room', 'study-room'].includes(formData.category) && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Room Capacity <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.details.capacity || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      details: { ...formData.details, capacity: Number(e.target.value) },
                    })
                  }
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                  placeholder="Maximum number of people"
                />
              </div>
            )}

            {['security', 'medical', 'sports', 'other'].includes(formData.category) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    value={formData.details.location || ''}
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
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Operating Hours
                  </label>
                  <input
                    type="text"
                    value={formData.details.operatingHours || ''}
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
            )}
          </div>
        );

      case 3:
        if (!requiresInventory) {
          return null;
        }
        return (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Set the total quantity and available quantity for this amenity. Available quantity cannot exceed total quantity.
              </p>
            </div>
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
                  <option value="machine">Machine</option>
                  <option value="slot">Slot</option>
                  <option value="room">Room</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Cost Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.costType}
                  onChange={(e) => setFormData({ ...formData, costType: e.target.value, cost: e.target.value === 'free' ? 0 : formData.cost })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="free">Free</option>
                  <option value="monthly">Monthly Fee</option>
                  <option value="per-use">Per Use</option>
                  <option value="one-time">One-Time Fee</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Cost (₹)
                  {formData.costType !== 'free' && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="number"
                  value={formData.cost}
                  onChange={(e) => setFormData({ ...formData, cost: Number(e.target.value) })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                  step="0.01"
                  disabled={formData.costType === 'free'}
                  placeholder="0.00"
                />
                {formData.costType === 'free' && (
                  <p className="text-xs text-gray-500 mt-1">This amenity is free for students</p>
                )}
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-600">
                Upload images to showcase this amenity. Images help students better understand what's available.
              </p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Amenity Images
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
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
                  <Upload className="w-10 h-10 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">
                    Click to upload or drag and drop
                  </span>
                  <span className="text-xs text-gray-500">PNG, JPG up to 10MB each</span>
                </label>
              </div>
            </div>

            {imagePreviews.length > 0 && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Uploaded Images ({imagePreviews.length})
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {imagePreviews.map((preview, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={preview}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-40 object-cover rounded-lg border-2 border-gray-200"
                      />
                      <button
                        onClick={() => removeImage(index)}
                        className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                        type="button"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const getEffectiveStep = (step: number) => {
    // Adjust step numbers to account for skipped inventory step
    if (!requiresInventory && step >= 3) {
      return step + 1;
    }
    return step;
  };

  return (
    
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="px-4 md:px-6 py-4">
            <div className="flex items-center gap-4">
              <Link
                href="/owner/amenities"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Create Amenity</h1>
                <p className="text-sm text-gray-600 mt-1">Add a new amenity to your hostel</p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 md:px-6 py-6 max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm">
            {/* Progress Steps */}
            <div className="border-b border-gray-200 px-4 md:px-6 py-4">
              <div className="flex items-center justify-between">
                {[1, 2, 3, 4, 5].map((step) => {
                  const effectiveStep = getEffectiveStep(step);
                  const isActive = currentStep === step;
                  const isCompleted = currentStep > step;
                  const isSkipped = step === 3 && !requiresInventory;
                  
                  if (isSkipped) return null;

                  const stepLabels = ['Basic', 'Details', 'Inventory', 'Pricing', 'Images'];
                  const stepIcons = [Settings, Wifi, Package, DollarSign, ImageIcon];
                  const Icon = stepIcons[step - 1];

                  return (
                    <div key={step} className="flex items-center flex-1">
                      <div className="flex flex-col items-center flex-1">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                            isActive
                              ? 'bg-blue-600 border-blue-600 text-white'
                              : isCompleted
                              ? 'bg-green-500 border-green-500 text-white'
                              : 'bg-white border-gray-300 text-gray-400'
                          }`}
                        >
                          {isCompleted ? (
                            <Check className="w-5 h-5" />
                          ) : (
                            <Icon className="w-5 h-5" />
                          )}
                        </div>
                        <span className={`text-xs mt-2 font-medium ${
                          isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-400'
                        }`}>
                          {stepLabels[step - 1]}
                        </span>
                      </div>
                      {step < totalSteps && step !== 3 && (
                        <div className={`flex-1 h-0.5 mx-2 ${
                          isCompleted ? 'bg-green-500' : 'bg-gray-300'
                        }`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step Content */}
            <div className="p-4 md:p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">{getStepTitle()}</h2>
              {renderStepContent()}
            </div>

            {/* Footer Navigation */}
            <div className="px-4 md:px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between gap-3">
              <div>
                {currentStep > 1 && (
                  <button
                    onClick={prevStep}
                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-white transition-colors flex items-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Previous
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <Link
                  href="/owner/amenities"
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-white transition-colors"
                >
                  Cancel
                </Link>
                {currentStep < totalSteps ? (
                  <button
                    onClick={nextStep}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    Next
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="animate-spin h-5 w-5" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5" />
                        Create Amenity
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    
  );
}
