'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../contexts/AuthContext';
import { useOwnerHostelOptional } from '../../../../contexts/OwnerHostelContext';
import api from '../../../../services/api';
import AddressInput from '../../../../components/AddressInput';
import { useToast } from '../../../../components/Toast';
import Link from 'next/link';

export default function CreateHostelPage() {
  const { user } = useAuth();
  const ownerHostelContext = useOwnerHostelOptional();
  const router = useRouter();
  const { showToast } = useToast();
  const [activeSection, setActiveSection] = useState('basic');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<any>({
    name: '',
    type: 'boys',
    description: '',
    shortDescription: '',
    capacity: '',
    totalRooms: '',
    totalBlocks: '',
    totalFloors: '',
    address: {
      street: '',
      city: '',
      state: '',
      pincode: '',
      country: 'India',
    },
    contact: {
      phone: '',
      email: '',
      alternatePhone: '',
      managerName: '',
      managerPhone: '',
      managerEmail: '',
      wardenName: '',
      wardenPhone: '',
      wardenEmail: '',
    },
    pricing: {
      minRent: '',
      maxRent: '',
      securityDeposit: '',
      maintenanceCharges: '',
      electricityCharges: 'separate',
      waterCharges: 'included',
      currency: 'INR',
    },
    operatingHours: {
      officeHours: '',
      checkInTime: '',
      checkOutTime: '',
      maintenanceHours: '',
    },
    amenities: {
      wifi: false,
      wifiSpeed: '',
      wifiCost: '',
      laundry: false,
      laundryType: 'self-service',
      laundryCost: '',
      mess: false,
      messType: 'both',
      messCost: '',
      parking: false,
      parkingType: 'two-wheeler',
      parkingCost: '',
      gym: false,
      library: false,
      commonRoom: false,
      tvRoom: false,
      studyRoom: false,
    },
    facilities: {
      security: false,
      securityGuards: '',
      cctv: false,
      cctvCount: '',
      powerBackup: false,
      powerBackupHours: '',
      waterSupply: true,
      waterSupplyType: '24x7',
      medicalFacility: false,
      sportsFacility: false,
      fireSafety: false,
      lift: false,
      generator: false,
    },
    rules: {
      curfewTime: '',
      weekendCurfewTime: '',
      lateEntryAllowed: false,
      lateEntryFine: '',
      visitorAllowed: true,
      visitorTimings: '',
      messTimings: {
        breakfast: '',
        lunch: '',
        dinner: '',
      },
      smokingAllowed: false,
      alcoholAllowed: false,
      petsAllowed: false,
      oppositeGenderAllowed: false,
    },
    businessInfo: {
      gstNumber: '',
      licenseNumber: '',
      registrationNumber: '',
      panNumber: '',
      bankAccountNumber: '',
      bankName: '',
      ifscCode: '',
      accountHolderName: '',
    },
    highlights: [],
    tags: [],
    status: 'active',
  });
  const [highlightInput, setHighlightInput] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [imageFiles, setImageFiles] = useState<File[]>([]);

  const sections = [
    { id: 'basic', label: 'Basic Info' },
    { id: 'images', label: 'Images' },
    { id: 'address', label: 'Address' },
    { id: 'contact', label: 'Contact' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'amenities', label: 'Amenities' },
    { id: 'facilities', label: 'Facilities' },
    { id: 'rules', label: 'Rules' },
    { id: 'business', label: 'Business' },
  ];

  const getCurrentSectionIndex = () => {
    return sections.findIndex(s => s.id === activeSection);
  };

  const goToNextSection = () => {
    const currentIndex = getCurrentSectionIndex();
    if (currentIndex < sections.length - 1) {
      setActiveSection(sections[currentIndex + 1].id);
    }
  };

  const goToPreviousSection = () => {
    const currentIndex = getCurrentSectionIndex();
    if (currentIndex > 0) {
      setActiveSection(sections[currentIndex - 1].id);
    }
  };


  const addHighlight = () => {
    if (highlightInput.trim()) {
      setFormData({
        ...formData,
        highlights: [...formData.highlights, highlightInput.trim()],
      });
      setHighlightInput('');
    }
  };

  const removeHighlight = (index: number) => {
    setFormData({
      ...formData,
      highlights: formData.highlights.filter((_: any, i: number) => i !== index),
    });
  };

  const addTag = () => {
    if (tagInput.trim()) {
      setFormData({
        ...formData,
        tags: [...formData.tags, tagInput.trim()],
      });
      setTagInput('');
    }
  };

  const removeTag = (index: number) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((_: any, i: number) => i !== index),
    });
  };


  const handleSubmit = async () => {
    if (!formData.name || !formData.capacity) {
      showToast('Please fill in all required fields (Name, Capacity)', 'warning');
      return;
    }

    setLoading(true);
    try {
      const { nearbyPlaces: _np, ...restForm } = formData;
      const submitData = {
        ...restForm,
        capacity: parseInt(formData.capacity) || 0,
        totalRooms: parseInt(formData.totalRooms) || 0,
        totalBlocks: parseInt(formData.totalBlocks) || 0,
        totalFloors: parseInt(formData.totalFloors) || 0,
        pricing: {
          ...formData.pricing,
          minRent: parseFloat(formData.pricing.minRent) || 0,
          maxRent: parseFloat(formData.pricing.maxRent) || 0,
          securityDeposit: parseFloat(formData.pricing.securityDeposit) || 0,
          maintenanceCharges: parseFloat(formData.pricing.maintenanceCharges) || 0,
        },
        facilities: {
          ...formData.facilities,
          securityGuards: parseInt(formData.facilities.securityGuards) || 0,
          cctvCount: parseInt(formData.facilities.cctvCount) || 0,
          powerBackupHours: parseInt(formData.facilities.powerBackupHours) || 0,
        },
        amenities: {
          ...formData.amenities,
          wifiCost: parseFloat(formData.amenities.wifiCost) || 0,
          laundryCost: parseFloat(formData.amenities.laundryCost) || 0,
          messCost: parseFloat(formData.amenities.messCost) || 0,
          parkingCost: parseFloat(formData.amenities.parkingCost) || 0,
        },
        rules: {
          ...formData.rules,
          lateEntryFine: parseFloat(formData.rules.lateEntryFine) || 0,
        },
      };

      const response = await api.createHostel(submitData);
      const newId = (response?.data?._id ?? response?.data?.id ?? response?._id ?? response?.id) as string;
      if (imageFiles.length > 0 && newId) {
        const formDataImages = new FormData();
        imageFiles.forEach((file) => formDataImages.append('images', file));
        await api.uploadHostelImages(newId, formDataImages);
      }
      if (ownerHostelContext) {
        if (newId) {
          ownerHostelContext.setSelectedHostel(newId);
        }
        await ownerHostelContext.refetchHostels();
      }
      showToast('Hostel created successfully', 'success');
      router.push(`/owner/hostels/${newId}`);
    } catch (error: any) {
      showToast(error.message || 'Failed to create hostel', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Create New Hostel</h1>
          <Link
            href="/owner/hostels"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow">
          {/* Section Tabs */}
          <div className="px-6 py-3 border-b border-gray-200 overflow-x-auto">
            <div className="flex space-x-2">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap ${
                    activeSection === section.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {section.label}
                </button>
              ))}
            </div>
          </div>

          {/* Form Content */}
          <div className="p-6">
            {activeSection === 'basic' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hostel Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <div className="flex space-x-2">
                    {['boys', 'girls', 'co-ed'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFormData({ ...formData, type })}
                        className={`px-4 py-2 rounded-md ${
                          formData.type === type
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Short Description
                  </label>
                  <textarea
                    value={formData.shortDescription}
                    onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Total Capacity *
                    </label>
                    <input
                      type="number"
                      value={formData.capacity}
                      onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Total Rooms
                    </label>
                    <input
                      type="number"
                      value={formData.totalRooms}
                      onChange={(e) => setFormData({ ...formData, totalRooms: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Total Blocks
                    </label>
                    <input
                      type="number"
                      value={formData.totalBlocks}
                      onChange={(e) => setFormData({ ...formData, totalBlocks: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Total Floors
                    </label>
                    <input
                      type="number"
                      value={formData.totalFloors}
                      onChange={(e) => setFormData({ ...formData, totalFloors: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Highlights
                  </label>
                  <div className="flex space-x-2 mb-2">
                    <input
                      type="text"
                      value={highlightInput}
                      onChange={(e) => setHighlightInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addHighlight()}
                      placeholder="Add highlight"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={addHighlight}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.highlights.map((highlight: string, index: number) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                      >
                        {highlight}
                        <button
                          type="button"
                          onClick={() => removeHighlight(index)}
                          className="ml-2 text-blue-600 hover:text-blue-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                  <div className="flex space-x-2 mb-2">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addTag()}
                      placeholder="Add tag"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={addTag}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.tags.map((tag: string, index: number) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(index)}
                          className="ml-2 text-gray-600 hover:text-gray-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'images' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Add photos of your hostel. You can select multiple images. First image will be used as cover.
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hostel Images</label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      const files = e.target.files ? Array.from(e.target.files) : [];
                      setImageFiles((prev) => [...prev, ...files]);
                      e.target.value = '';
                    }}
                    className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>
                {imageFiles.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">Selected images ({imageFiles.length})</p>
                    <div className="flex flex-wrap gap-2">
                      {imageFiles.map((file, index) => (
                        <div
                          key={`${file.name}-${index}`}
                          className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg text-sm"
                        >
                          <span className="truncate max-w-[180px]">{file.name}</span>
                          <button
                            type="button"
                            onClick={() => setImageFiles((prev) => prev.filter((_, i) => i !== index))}
                            className="text-red-600 hover:text-red-800 font-medium"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeSection === 'address' && (
              <div className="space-y-4">
                <AddressInput
                  value={formData.address.street || formData.address.formattedAddress}
                  onChange={(address, coordinates, placeId) => {
                    // Parse address components if available
                    const addressParts = address.split(',').map((part: string) => part.trim());

                    setFormData({
                      ...formData,
                      address: {
                        ...formData.address,
                        street: addressParts[0] || formData.address.street,
                        formattedAddress: address,
                        coordinates: coordinates ? {
                          latitude: coordinates.latitude,
                          longitude: coordinates.longitude,
                        } : formData.address.coordinates,
                        placeId: placeId || formData.address.placeId,
                      },
                    });
                  }}
                  onGeocode={(coordinates, formattedAddress, placeId) => {
                    // Store coordinates directly - no backend geocoding needed
                    setFormData({
                      ...formData,
                      address: {
                        ...formData.address,
                        formattedAddress,
                        coordinates: {
                          latitude: coordinates.latitude,
                          longitude: coordinates.longitude,
                        },
                        placeId,
                      },
                    });
                  }}
                  onAddressComponents={(components) => {
                    // Auto-fill address fields from parsed components
                    setFormData({
                      ...formData,
                      address: {
                        ...formData.address,
                        street: components.street || formData.address.street,
                        city: components.city || formData.address.city,
                        state: components.state || formData.address.state,
                        pincode: components.pincode || formData.address.pincode,
                        country: components.country || formData.address.country || 'India',
                      },
                    });
                  }}
                  error={undefined}
                  required={false}
                />

                {/* Additional address fields - Read Only */}
                <div className="space-y-4 pt-4 border-t border-gray-200">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                  <input
                    type="text"
                    value={formData.address.street}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        address: { ...formData.address, street: e.target.value },
                      })
                    }
                    placeholder="e.g., 123 Hostel Street"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                    <input
                      type="text"
                      value={formData.address.city}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          address: { ...formData.address, city: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                    <input
                      type="text"
                      value={formData.address.state}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          address: { ...formData.address, state: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
                    <input
                      type="text"
                      value={formData.address.pincode}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          address: { ...formData.address, pincode: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                    <input
                      type="text"
                      value={formData.address.country}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          address: { ...formData.address, country: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {formData.address.coordinates && (
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
                    <h4 className="text-sm font-semibold text-green-900 mb-2">Geocoded Address</h4>
                    {formData.address.formattedAddress && (
                      <p className="text-sm text-green-800 mb-2">
                        <strong>Formatted:</strong> {formData.address.formattedAddress}
                      </p>
                    )}
                    <div className="text-sm text-green-800">
                      <strong>Coordinates:</strong>
                      <br />
                      Latitude: {formData.address.coordinates.latitude?.toFixed(6)}
                      <br />
                      Longitude: {formData.address.coordinates.longitude?.toFixed(6)}
                    </div>
                    {formData.address.placeId && (
                      <p className="text-xs text-green-700 mt-2">Place ID: {formData.address.placeId}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
            )}

            {activeSection === 'contact' && (
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">Primary Contact</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone *
                    </label>
                    <input
                      type="tel"
                      value={formData.contact.phone}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          contact: { ...formData.contact, phone: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={formData.contact.email}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          contact: { ...formData.contact, email: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <h3 className="font-semibold text-gray-900 mt-6">Manager Details</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      value={formData.contact.managerName}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          contact: { ...formData.contact, managerName: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={formData.contact.managerPhone}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          contact: { ...formData.contact, managerPhone: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.contact.managerEmail}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          contact: { ...formData.contact, managerEmail: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <h3 className="font-semibold text-gray-900 mt-6">Warden Details</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      value={formData.contact.wardenName}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          contact: { ...formData.contact, wardenName: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={formData.contact.wardenPhone}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          contact: { ...formData.contact, wardenPhone: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.contact.wardenEmail}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          contact: { ...formData.contact, wardenEmail: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'pricing' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Minimum Rent (₹)
                    </label>
                    <input
                      type="number"
                      value={formData.pricing.minRent}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          pricing: { ...formData.pricing, minRent: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Maximum Rent (₹)
                    </label>
                    <input
                      type="number"
                      value={formData.pricing.maxRent}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          pricing: { ...formData.pricing, maxRent: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Security Deposit (₹)
                    </label>
                    <input
                      type="number"
                      value={formData.pricing.securityDeposit}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          pricing: { ...formData.pricing, securityDeposit: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Maintenance Charges (₹/month)
                    </label>
                    <input
                      type="number"
                      value={formData.pricing.maintenanceCharges}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          pricing: { ...formData.pricing, maintenanceCharges: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'amenities' && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">WiFi</h3>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="wifi"
                      checked={formData.amenities.wifi}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          amenities: { ...formData.amenities, wifi: e.target.checked },
                        })
                      }
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="wifi" className="text-sm font-medium text-gray-700">
                      WiFi Available
                    </label>
                  </div>
                  {formData.amenities.wifi && (
                    <div className="grid grid-cols-2 gap-4 ml-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          WiFi Speed
                        </label>
                        <input
                          type="text"
                          value={formData.amenities.wifiSpeed}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              amenities: { ...formData.amenities, wifiSpeed: e.target.value },
                            })
                          }
                          placeholder="e.g., 100 Mbps"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          WiFi Cost (₹/month)
                        </label>
                        <input
                          type="number"
                          value={formData.amenities.wifiCost}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              amenities: { ...formData.amenities, wifiCost: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">Laundry</h3>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="laundry"
                      checked={formData.amenities.laundry}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          amenities: { ...formData.amenities, laundry: e.target.checked },
                        })
                      }
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="laundry" className="text-sm font-medium text-gray-700">
                      Laundry Available
                    </label>
                  </div>
                  {formData.amenities.laundry && (
                    <div className="grid grid-cols-2 gap-4 ml-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Laundry Type
                        </label>
                        <select
                          value={formData.amenities.laundryType}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              amenities: { ...formData.amenities, laundryType: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="self-service">Self-Service</option>
                          <option value="full-service">Full-Service</option>
                          <option value="both">Both</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Laundry Cost (₹/load)
                        </label>
                        <input
                          type="number"
                          value={formData.amenities.laundryCost}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              amenities: { ...formData.amenities, laundryCost: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">Mess/Canteen</h3>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="mess"
                      checked={formData.amenities.mess}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          amenities: { ...formData.amenities, mess: e.target.checked },
                        })
                      }
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="mess" className="text-sm font-medium text-gray-700">
                      Mess/Canteen Available
                    </label>
                  </div>
                  {formData.amenities.mess && (
                    <div className="grid grid-cols-2 gap-4 ml-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Mess Type
                        </label>
                        <select
                          value={formData.amenities.messType}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              amenities: { ...formData.amenities, messType: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="veg">Vegetarian</option>
                          <option value="non-veg">Non-Vegetarian</option>
                          <option value="both">Both</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Mess Cost (₹/month)
                        </label>
                        <input
                          type="number"
                          value={formData.amenities.messCost}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              amenities: { ...formData.amenities, messCost: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">Parking</h3>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="parking"
                      checked={formData.amenities.parking}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          amenities: { ...formData.amenities, parking: e.target.checked },
                        })
                      }
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="parking" className="text-sm font-medium text-gray-700">
                      Parking Available
                    </label>
                  </div>
                  {formData.amenities.parking && (
                    <div className="grid grid-cols-2 gap-4 ml-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Parking Type
                        </label>
                        <select
                          value={formData.amenities.parkingType}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              amenities: { ...formData.amenities, parkingType: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="two-wheeler">Two-Wheeler</option>
                          <option value="four-wheeler">Four-Wheeler</option>
                          <option value="both">Both</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Parking Cost (₹/month)
                        </label>
                        <input
                          type="number"
                          value={formData.amenities.parkingCost}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              amenities: { ...formData.amenities, parkingCost: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-900">Other Amenities</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { id: 'gym', label: 'Gym' },
                      { id: 'library', label: 'Library' },
                      { id: 'commonRoom', label: 'Common Room' },
                      { id: 'tvRoom', label: 'TV Room' },
                      { id: 'studyRoom', label: 'Study Room' },
                    ].map((amenity) => (
                      <div key={amenity.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={amenity.id}
                          checked={formData.amenities[amenity.id as keyof typeof formData.amenities] as boolean}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              amenities: {
                                ...formData.amenities,
                                [amenity.id]: e.target.checked,
                              },
                            })
                          }
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor={amenity.id} className="text-sm font-medium text-gray-700">
                          {amenity.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'facilities' && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">Security</h3>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="security"
                      checked={formData.facilities.security}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          facilities: { ...formData.facilities, security: e.target.checked },
                        })
                      }
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="security" className="text-sm font-medium text-gray-700">
                      Security Available
                    </label>
                  </div>
                  {formData.facilities.security && (
                    <div className="ml-6">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Number of Security Guards
                      </label>
                      <input
                        type="number"
                        value={formData.facilities.securityGuards}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            facilities: { ...formData.facilities, securityGuards: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">CCTV</h3>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="cctv"
                      checked={formData.facilities.cctv}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          facilities: { ...formData.facilities, cctv: e.target.checked },
                        })
                      }
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="cctv" className="text-sm font-medium text-gray-700">
                      CCTV Available
                    </label>
                  </div>
                  {formData.facilities.cctv && (
                    <div className="ml-6">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Number of CCTV Cameras
                      </label>
                      <input
                        type="number"
                        value={formData.facilities.cctvCount}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            facilities: { ...formData.facilities, cctvCount: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">Power Backup</h3>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="powerBackup"
                      checked={formData.facilities.powerBackup}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          facilities: { ...formData.facilities, powerBackup: e.target.checked },
                        })
                      }
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="powerBackup" className="text-sm font-medium text-gray-700">
                      Power Backup Available
                    </label>
                  </div>
                  {formData.facilities.powerBackup && (
                    <div className="ml-6">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Power Backup Hours
                      </label>
                      <input
                        type="number"
                        value={formData.facilities.powerBackupHours}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            facilities: { ...formData.facilities, powerBackupHours: e.target.value },
                          })
                        }
                        placeholder="Hours"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">Water Supply</h3>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="waterSupply"
                      checked={formData.facilities.waterSupply}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          facilities: { ...formData.facilities, waterSupply: e.target.checked },
                        })
                      }
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="waterSupply" className="text-sm font-medium text-gray-700">
                      Water Supply Available
                    </label>
                  </div>
                  {formData.facilities.waterSupply && (
                    <div className="ml-6">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Water Supply Type
                      </label>
                      <select
                        value={formData.facilities.waterSupplyType}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            facilities: { ...formData.facilities, waterSupplyType: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="24x7">24x7</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="limited">Limited Hours</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-900">Other Facilities</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { id: 'medicalFacility', label: 'Medical Facility' },
                      { id: 'sportsFacility', label: 'Sports Facility' },
                      { id: 'fireSafety', label: 'Fire Safety' },
                      { id: 'lift', label: 'Lift/Elevator' },
                      { id: 'generator', label: 'Generator' },
                    ].map((facility) => (
                      <div key={facility.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={facility.id}
                          checked={formData.facilities[facility.id as keyof typeof formData.facilities] as boolean}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              facilities: {
                                ...formData.facilities,
                                [facility.id]: e.target.checked,
                              },
                            })
                          }
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor={facility.id} className="text-sm font-medium text-gray-700">
                          {facility.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'rules' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Curfew Time
                    </label>
                    <input
                      type="time"
                      value={formData.rules.curfewTime}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          rules: { ...formData.rules, curfewTime: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Weekend Curfew Time
                    </label>
                    <input
                      type="time"
                      value={formData.rules.weekendCurfewTime}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          rules: { ...formData.rules, weekendCurfewTime: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="lateEntryAllowed"
                      checked={formData.rules.lateEntryAllowed}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          rules: { ...formData.rules, lateEntryAllowed: e.target.checked },
                        })
                      }
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="lateEntryAllowed" className="text-sm font-medium text-gray-700">
                      Late Entry Allowed
                    </label>
                  </div>
                  {formData.rules.lateEntryAllowed && (
                    <div className="ml-6">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Late Entry Fine (₹)
                      </label>
                      <input
                        type="number"
                        value={formData.rules.lateEntryFine}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            rules: { ...formData.rules, lateEntryFine: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="visitorAllowed"
                      checked={formData.rules.visitorAllowed}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          rules: { ...formData.rules, visitorAllowed: e.target.checked },
                        })
                      }
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="visitorAllowed" className="text-sm font-medium text-gray-700">
                      Visitors Allowed
                    </label>
                  </div>
                  {formData.rules.visitorAllowed && (
                    <div className="ml-6">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Visitor Timings
                      </label>
                      <input
                        type="text"
                        value={formData.rules.visitorTimings}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            rules: { ...formData.rules, visitorTimings: e.target.value },
                          })
                        }
                        placeholder="e.g., 10:00 AM - 8:00 PM"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">Mess Timings</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Breakfast
                      </label>
                      <input
                        type="text"
                        value={formData.rules.messTimings.breakfast}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            rules: {
                              ...formData.rules,
                              messTimings: {
                                ...formData.rules.messTimings,
                                breakfast: e.target.value,
                              },
                            },
                          })
                        }
                        placeholder="e.g., 7:00 AM - 9:00 AM"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Lunch</label>
                      <input
                        type="text"
                        value={formData.rules.messTimings.lunch}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            rules: {
                              ...formData.rules,
                              messTimings: {
                                ...formData.rules.messTimings,
                                lunch: e.target.value,
                              },
                            },
                          })
                        }
                        placeholder="e.g., 12:00 PM - 2:00 PM"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Dinner</label>
                      <input
                        type="text"
                        value={formData.rules.messTimings.dinner}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            rules: {
                              ...formData.rules,
                              messTimings: {
                                ...formData.rules.messTimings,
                                dinner: e.target.value,
                              },
                            },
                          })
                        }
                        placeholder="e.g., 7:00 PM - 9:00 PM"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-900">Other Rules</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { id: 'smokingAllowed', label: 'Smoking Allowed' },
                      { id: 'alcoholAllowed', label: 'Alcohol Allowed' },
                      { id: 'petsAllowed', label: 'Pets Allowed' },
                      { id: 'oppositeGenderAllowed', label: 'Opposite Gender Allowed' },
                    ].map((rule) => (
                      <div key={rule.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={rule.id}
                          checked={formData.rules[rule.id as keyof typeof formData.rules] as boolean}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              rules: {
                                ...formData.rules,
                                [rule.id]: e.target.checked,
                              },
                            })
                          }
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor={rule.id} className="text-sm font-medium text-gray-700">
                          {rule.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'business' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      License Number
                    </label>
                    <input
                      type="text"
                      value={formData.businessInfo.licenseNumber}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          businessInfo: { ...formData.businessInfo, licenseNumber: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Registration Number
                    </label>
                    <input
                      type="text"
                      value={formData.businessInfo.registrationNumber}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          businessInfo: { ...formData.businessInfo, registrationNumber: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      PAN Number
                    </label>
                    <input
                      type="text"
                      value={formData.businessInfo.panNumber}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          businessInfo: { ...formData.businessInfo, panNumber: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-4">Bank Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Bank Account Number
                      </label>
                      <input
                        type="text"
                        value={formData.businessInfo.bankAccountNumber}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            businessInfo: { ...formData.businessInfo, bankAccountNumber: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Bank Name
                      </label>
                      <input
                        type="text"
                        value={formData.businessInfo.bankName}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            businessInfo: { ...formData.businessInfo, bankName: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        IFSC Code
                      </label>
                      <input
                        type="text"
                        value={formData.businessInfo.ifscCode}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            businessInfo: { ...formData.businessInfo, ifscCode: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Account Holder Name
                      </label>
                      <input
                        type="text"
                        value={formData.businessInfo.accountHolderName}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            businessInfo: { ...formData.businessInfo, accountHolderName: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
            <div className="flex space-x-3">
              {getCurrentSectionIndex() > 0 && (
                <button
                  onClick={goToPreviousSection}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  ← Previous
                </button>
              )}
              {getCurrentSectionIndex() < sections.length - 1 && (
                <button
                  onClick={goToNextSection}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Next →
                </button>
              )}
            </div>
            <div className="flex space-x-3">
              <Link
                href="/owner/hostels"
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </Link>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Hostel'}
              </button>
            </div>
          </div>
        </div>
      </div>
    
  );
}


