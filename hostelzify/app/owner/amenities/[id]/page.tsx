'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../../contexts/AuthContext';
import api from '../../../../services/api';
import { useToast } from '../../../../components/Toast';
import { useConfirmModal } from '../../../../components/ConfirmModal';
import { ArrowLeft, Edit, Trash2, Wifi, Package, DollarSign, CheckCircle, XCircle, Upload, X, Loader2, MapPin, Clock, Settings } from 'lucide-react';

export default function AmenityDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const { showToast } = useToast();
  const { confirm } = useConfirmModal();
  const [amenity, setAmenity] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'owner') {
      router.replace('/login');
      return;
    }
    if (id) {
      loadAmenity();
    }
  }, [id, user, router]);

  const loadAmenity = async () => {
    setLoading(true);
    try {
      const response = await api.getAmenity(id);
      setAmenity(response.data);
    } catch (error: any) {
      showToast(error.message || 'Failed to load amenity', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const result = await confirm({
      title: 'Delete Amenity',
      message: `Are you sure you want to delete ${amenity?.name}? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      confirmButtonClass: 'bg-red-600 hover:bg-red-700',
    });

    if (result) {
      try {
        await api.deleteAmenity(id);
        showToast('Amenity deleted successfully', 'success');
        router.push('/owner/amenities');
      } catch (error: any) {
        showToast(error.message || 'Failed to delete amenity', 'error');
      }
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      await api.uploadAmenityImages(id, Array.from(files));
      showToast('Images uploaded successfully', 'success');
      loadAmenity();
    } catch (error: any) {
      showToast(error.message || 'Failed to upload images', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteImage = async (imageUrl: string) => {
    const result = await confirm({
      title: 'Delete Image',
      message: 'Are you sure you want to delete this image?',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      confirmButtonClass: 'bg-red-600 hover:bg-red-700',
    });

    if (result) {
      try {
        await api.deleteAmenityImage(id, imageUrl);
        showToast('Image deleted successfully', 'success');
        loadAmenity();
      } catch (error: any) {
        showToast(error.message || 'Failed to delete image', 'error');
      }
    }
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
      
        <div className="flex justify-center items-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      
    );
  }

  if (!amenity) {
    return (
      
        <div className="text-center py-12">
          <p className="text-gray-600">Amenity not found</p>
          <Link href="/owner/amenities" className="text-blue-600 hover:underline mt-4 inline-block">
            Back to Amenities
          </Link>
        </div>
      
    );
  }

  const images = Array.isArray(amenity.images) ? amenity.images.filter((img: string) => img && img.trim() !== '') : [];
  const displayImage = images.length > 0 ? images[0] : null;

  return (
    
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="px-4 md:px-6 py-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <Link
                  href="/owner/amenities"
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <ArrowLeft className="w-6 h-6" />
                </Link>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{amenity.name}</h1>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getCategoryColor(amenity.category)}`}>
                      {amenity.category.replace('-', ' ')}
                    </span>
                    {amenity.isAvailable ? (
                      <CheckCircle className="w-6 h-6 text-green-500" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-500" />
                    )}
                  </div>
                  {amenity.hostelId?.name && (
                    <p className="text-sm md:text-base text-gray-600 mt-1 flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {amenity.hostelId.name}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/owner/amenities/${id}/edit`}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </Link>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 md:px-6 py-6">
          {/* Cover Image */}
          {displayImage && (
            <div className="mb-6 rounded-lg overflow-hidden shadow-sm">
              <div className="relative w-full h-48 sm:h-64 md:h-96 bg-gray-200">
                <img
                  src={displayImage}
                  alt={amenity.name}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}

          {/* Image Gallery */}
          {images.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg md:text-xl font-semibold text-gray-900">Gallery</h2>
                <label className="px-3 md:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2 cursor-pointer text-sm">
                  <Upload className="w-4 h-4" />
                  <span className="hidden sm:inline">Upload Images</span>
                  <span className="sm:hidden">Upload</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
                {images.map((imageUrl: string, index: number) => (
                  <div key={index} className="relative group">
                    <div className="relative w-full h-32 sm:h-40 md:h-48 bg-gray-200 rounded-lg overflow-hidden">
                      <img
                        src={imageUrl}
                        alt={`${amenity.name} - Image ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity rounded-lg flex items-center justify-center">
                      <button
                        onClick={() => handleDeleteImage(imageUrl)}
                        className="opacity-0 group-hover:opacity-100 px-2 md:px-3 py-1 bg-red-600 text-white text-xs md:text-sm rounded transition-opacity flex items-center gap-1"
                      >
                        <X className="w-3 h-3 md:w-4 md:h-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Basic Information */}
          <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 mb-6">
            <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-4">Basic Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs md:text-sm text-gray-600">Category</p>
                <p className="text-base md:text-lg font-medium text-gray-900 capitalize mt-1">
                  {amenity.category.replace('-', ' ')}
                </p>
              </div>
              <div>
                <p className="text-xs md:text-sm text-gray-600">Status</p>
                <p className="text-base md:text-lg font-medium text-gray-900 capitalize mt-1">
                  {amenity.isAvailable ? 'Available' : 'Unavailable'}
                </p>
              </div>
              {amenity.description && (
                <div className="sm:col-span-2 pt-4 border-t border-gray-200">
                  <p className="text-xs md:text-sm text-gray-600 mb-1">Description</p>
                  <p className="text-sm md:text-base text-gray-900">{amenity.description}</p>
                </div>
              )}
            </div>
          </div>

          {/* Inventory Information */}
          <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 mb-6">
            <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5" />
              Inventory
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs md:text-sm text-gray-600">Total Quantity</p>
                <p className="text-base md:text-lg font-medium text-gray-900 mt-1">
                  {amenity.quantity || 0} {amenity.unit || 'unit'}
                </p>
              </div>
              <div>
                <p className="text-xs md:text-sm text-gray-600">Available Quantity</p>
                <p className={`text-base md:text-lg font-medium mt-1 ${
                  amenity.availableQuantity > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {amenity.availableQuantity || 0} {amenity.unit || 'unit'}
                </p>
              </div>
              <div>
                <p className="text-xs md:text-sm text-gray-600">In Use</p>
                <p className="text-base md:text-lg font-medium text-gray-900 mt-1">
                  {(amenity.quantity || 0) - (amenity.availableQuantity || 0)} {amenity.unit || 'unit'}
                </p>
              </div>
            </div>
          </div>

          {/* Pricing Information */}
          {amenity.cost > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 mb-6">
              <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Pricing
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs md:text-sm text-gray-600">Cost Type</p>
                  <p className="text-base md:text-lg font-medium text-gray-900 capitalize mt-1">
                    {amenity.costType?.replace('-', ' ')}
                  </p>
                </div>
                <div>
                  <p className="text-xs md:text-sm text-gray-600">Cost</p>
                  <p className="text-base md:text-lg font-medium text-gray-900 mt-1">
                    ₹{amenity.cost?.toLocaleString()}
                    {amenity.costType === 'monthly' && '/month'}
                    {amenity.costType === 'per-use' && '/use'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Category-Specific Details */}
          {amenity.details && Object.keys(amenity.details).some(key => amenity.details[key]) && (
            <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 mb-6">
              <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Additional Details
              </h2>
              <div className="space-y-4">
                {amenity.details.speed && (
                  <div>
                    <p className="text-xs md:text-sm text-gray-600">Internet Speed</p>
                    <p className="text-sm md:text-base text-gray-900 mt-1">{amenity.details.speed}</p>
                  </div>
                )}
                {amenity.details.type && (
                  <div>
                    <p className="text-xs md:text-sm text-gray-600">Type</p>
                    <p className="text-sm md:text-base text-gray-900 capitalize mt-1">{amenity.details.type}</p>
                  </div>
                )}
                {amenity.details.machines > 0 && (
                  <div>
                    <p className="text-xs md:text-sm text-gray-600">Number of Machines</p>
                    <p className="text-sm md:text-base text-gray-900 mt-1">{amenity.details.machines}</p>
                  </div>
                )}
                {amenity.details.mealType && (
                  <div>
                    <p className="text-xs md:text-sm text-gray-600">Meal Type</p>
                    <p className="text-sm md:text-base text-gray-900 capitalize mt-1">{amenity.details.mealType}</p>
                  </div>
                )}
                {amenity.details.timings && (amenity.details.timings.breakfast || amenity.details.timings.lunch || amenity.details.timings.dinner) && (
                  <div>
                    <p className="text-xs md:text-sm text-gray-600 mb-2 flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      Meal Timings
                    </p>
                    <div className="space-y-1">
                      {amenity.details.timings.breakfast && (
                        <p className="text-sm md:text-base text-gray-900">Breakfast: {amenity.details.timings.breakfast}</p>
                      )}
                      {amenity.details.timings.lunch && (
                        <p className="text-sm md:text-base text-gray-900">Lunch: {amenity.details.timings.lunch}</p>
                      )}
                      {amenity.details.timings.dinner && (
                        <p className="text-sm md:text-base text-gray-900">Dinner: {amenity.details.timings.dinner}</p>
                      )}
                    </div>
                  </div>
                )}
                {amenity.details.vehicleType && (
                  <div>
                    <p className="text-xs md:text-sm text-gray-600">Vehicle Type</p>
                    <p className="text-sm md:text-base text-gray-900 capitalize mt-1">{amenity.details.vehicleType}</p>
                  </div>
                )}
                {amenity.details.slots > 0 && (
                  <div>
                    <p className="text-xs md:text-sm text-gray-600">Parking Slots</p>
                    <p className="text-sm md:text-base text-gray-900 mt-1">{amenity.details.slots}</p>
                  </div>
                )}
                {amenity.details.equipment && amenity.details.equipment.length > 0 && (
                  <div>
                    <p className="text-xs md:text-sm text-gray-600">Equipment</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {amenity.details.equipment.map((item: string, idx: number) => (
                        <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-sm">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {amenity.details.books > 0 && (
                  <div>
                    <p className="text-xs md:text-sm text-gray-600">Number of Books</p>
                    <p className="text-sm md:text-base text-gray-900 mt-1">{amenity.details.books}</p>
                  </div>
                )}
                {amenity.details.capacity > 0 && (
                  <div>
                    <p className="text-xs md:text-sm text-gray-600">Capacity</p>
                    <p className="text-sm md:text-base text-gray-900 mt-1">{amenity.details.capacity} people</p>
                  </div>
                )}
                {amenity.details.location && (
                  <div>
                    <p className="text-xs md:text-sm text-gray-600">Location</p>
                    <p className="text-sm md:text-base text-gray-900 mt-1">{amenity.details.location}</p>
                  </div>
                )}
                {amenity.details.operatingHours && (
                  <div>
                    <p className="text-xs md:text-sm text-gray-600 flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      Operating Hours
                    </p>
                    <p className="text-sm md:text-base text-gray-900 mt-1">{amenity.details.operatingHours}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    
  );
}

