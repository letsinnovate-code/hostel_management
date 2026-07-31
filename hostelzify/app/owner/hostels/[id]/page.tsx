'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../../../contexts/AuthContext';
import api from '../../../../services/api';
import GoogleMap from '../../../../components/GoogleMap';
import { useToast } from '../../../../components/Toast';
import { useConfirmModal } from '../../../../components/ConfirmModal';
import Link from 'next/link';
import { 
  Edit, Loader2, Upload, Trash2, MapPin, Phone, Mail, Users, Bed, Building2, 
  Calendar, Clock, Shield, Camera, Zap, Droplet, Activity, Dumbbell, BookOpen,
  Tv, Coffee, Car, Wifi, UtensilsCrossed, Shirt, AlertCircle, CheckCircle2, XCircle
} from 'lucide-react';

export default function HostelDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const { showToast } = useToast();
  const { confirm } = useConfirmModal();
  
  const [hostel, setHostel] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  useEffect(() => {
    if (!user || user.role !== 'owner') {
      router.replace('/login');
      return;
    }
    if (id) {
      loadHostel();
    }
  }, [id, user, router]);

  const loadHostel = async () => {
    setLoading(true);
    try {
      const response = await api.getHostel(id);
      setHostel(response.data);
    } catch (error: any) {
      showToast(error.message || 'Failed to load hostel details', 'error');
    } finally {
      setLoading(false);
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
        await api.deleteHostelImage(id, imageUrl);
        showToast('Image deleted successfully', 'success');
        loadHostel();
      } catch (error: any) {
        showToast(error.message || 'Failed to delete image', 'error');
      }
    }
  };

  const handleSetCover = async (imageUrl: string) => {
    try {
      await api.setCoverImage(id, imageUrl);
      showToast('Cover image updated', 'success');
      loadHostel();
    } catch (error: any) {
      showToast(error.message || 'Failed to set cover image', 'error');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append('images', file);
      });

      await api.uploadHostelImages(id, formData);
      showToast('Images uploaded successfully', 'success');
      loadHostel();
      setSelectedImageIndex(0);
    } catch (error: any) {
      showToast(error.message || 'Failed to upload images', 'error');
    } finally {
      setUploading(false);
    }
  };

  const formatAddress = (address: any) => {
    if (!address) return 'Address not available';
    if (typeof address === 'string') return address;
    if (address.formattedAddress) return address.formattedAddress;
    
    const parts = [];
    if (address.street) parts.push(address.street);
    if (address.city) parts.push(address.city);
    if (address.state) parts.push(address.state);
    if (address.pincode) parts.push(address.pincode);
    if (address.country && address.country !== 'India') parts.push(address.country);
    
    return parts.length > 0 ? parts.join(', ') : 'Address not available';
  };

  const getTypeColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'boys':
        return 'bg-blue-100 text-blue-800';
      case 'girls':
        return 'bg-pink-100 text-pink-800';
      case 'co-ed':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'suspended':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };


  if (loading) {
    return (
      
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
            <p className="text-gray-600">Loading hostel details...</p>
          </div>
        </div>
      
    );
  }

  if (!hostel) {
    return (
      
        <div className="p-4 md:p-6">
          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <p className="text-gray-600">Hostel not found</p>
            <Link href="/owner/hostels" className="text-blue-600 hover:underline mt-4 inline-block">
              Back to Hostels
            </Link>
          </div>
        </div>
      
    );
  }

  const images = Array.isArray(hostel.images) ? hostel.images.filter((img: string) => img && img.trim() !== '') : [];
  const displayImage = hostel.coverImage || (images.length > 0 ? images[0] : null);
  const occupancyRate = hostel?.capacity 
    ? Math.round((hostel.currentOccupancy || 0) / hostel.capacity * 100) 
    : 0;

  return (
    
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="px-4 md:px-6 py-4 md:py-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{hostel.name}</h1>
                  {hostel.type && (
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getTypeColor(hostel.type)}`}>
                      {hostel.type.charAt(0).toUpperCase() + hostel.type.slice(1)}
                    </span>
                  )}
                  {hostel.status && (
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(hostel.status)}`}>
                      {hostel.status.charAt(0).toUpperCase() + hostel.status.slice(1)}
                    </span>
                  )}
                </div>
                <p className="text-sm md:text-base text-gray-600 flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {formatAddress(hostel.address)}
                </p>
              </div>
              <Link
                href={`/owner/hostels/${id}/edit`}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 justify-center sm:justify-start"
              >
                <Edit className="w-4 h-4" />
                Edit Hostel
              </Link>
            </div>
          </div>
        </div>

        <div className="px-4 md:px-6 py-4 md:py-6">
          {/* Cover Image */}
          {displayImage && (
            <div className="mb-6 rounded-lg overflow-hidden shadow-sm">
              <div className="relative w-full h-64 sm:h-80 md:h-96 bg-gradient-to-br from-blue-400 to-blue-600">
                <img
                  src={displayImage}
                  alt={hostel.name}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}

          {/* Key Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-600">Capacity</p>
                  <p className="text-lg font-bold text-gray-900">{hostel.capacity || 0}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Bed className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-600">Occupied</p>
                  <p className="text-lg font-bold text-gray-900">{hostel.currentOccupancy || 0}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Building2 className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-600">Rooms</p>
                  <p className="text-lg font-bold text-gray-900">{hostel.totalRooms || 0}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Activity className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-600">Occupancy</p>
                  <p className="text-lg font-bold text-gray-900">{occupancyRate}%</p>
                </div>
              </div>
            </div>
          </div>

          {/* Pricing */}
          {hostel.pricing && (hostel.pricing.minRent || hostel.pricing.maxRent || hostel.pricing.securityDeposit || hostel.pricing.maintenanceCharges) && (
            <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 mb-6">
              <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-4">Pricing</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(hostel.pricing.minRent || hostel.pricing.maxRent) && (
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Monthly Rent</p>
                    {hostel.pricing.minRent && hostel.pricing.maxRent && hostel.pricing.minRent !== hostel.pricing.maxRent ? (
                      <p className="text-xl font-bold text-gray-900">
                        ₹{hostel.pricing.minRent.toLocaleString()} - ₹{hostel.pricing.maxRent.toLocaleString()}
                      </p>
                    ) : (
                      <p className="text-xl font-bold text-gray-900">
                        ₹{(hostel.pricing.minRent || hostel.pricing.maxRent || 0).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
                {hostel.pricing.securityDeposit > 0 && (
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Security Deposit</p>
                    <p className="text-xl font-bold text-gray-900">
                      ₹{hostel.pricing.securityDeposit.toLocaleString()}
                    </p>
                  </div>
                )}
                {hostel.pricing.maintenanceCharges > 0 && (
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Maintenance Charges</p>
                    <p className="text-xl font-bold text-gray-900">
                      ₹{hostel.pricing.maintenanceCharges.toLocaleString()}/month
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Amenities */}
          {hostel.amenities && (
            <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 mb-6">
              <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-4">Amenities</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {hostel.amenities.wifi && (
                  <div className="flex items-center gap-2">
                    <Wifi className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">WiFi</p>
                      {hostel.amenities.wifiSpeed && (
                        <p className="text-xs text-gray-600">{hostel.amenities.wifiSpeed}</p>
                      )}
                      {hostel.amenities.wifiCost > 0 && (
                        <p className="text-xs text-gray-600">₹{hostel.amenities.wifiCost}/month</p>
                      )}
                    </div>
                  </div>
                )}
                {hostel.amenities.laundry && (
                  <div className="flex items-center gap-2">
                    <Shirt className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Laundry</p>
                      {hostel.amenities.laundryType && (
                        <p className="text-xs text-gray-600 capitalize">{hostel.amenities.laundryType}</p>
                      )}
                    </div>
                  </div>
                )}
                {hostel.amenities.mess && (
                  <div className="flex items-center gap-2">
                    <UtensilsCrossed className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Mess/Canteen</p>
                      {hostel.amenities.messType && (
                        <p className="text-xs text-gray-600 capitalize">{hostel.amenities.messType}</p>
                      )}
                    </div>
                  </div>
                )}
                {hostel.amenities.parking && (
                  <div className="flex items-center gap-2">
                    <Car className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Parking</p>
                      {hostel.amenities.parkingType && (
                        <p className="text-xs text-gray-600 capitalize">{hostel.amenities.parkingType}</p>
                      )}
                    </div>
                  </div>
                )}
                {hostel.amenities.gym && (
                  <div className="flex items-center gap-2">
                    <Dumbbell className="w-5 h-5 text-blue-600" />
                    <p className="text-sm font-medium text-gray-900">Gym</p>
                  </div>
                )}
                {hostel.amenities.library && (
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                    <p className="text-sm font-medium text-gray-900">Library</p>
                  </div>
                )}
                {hostel.amenities.commonRoom && (
                  <div className="flex items-center gap-2">
                    <Coffee className="w-5 h-5 text-blue-600" />
                    <p className="text-sm font-medium text-gray-900">Common Room</p>
                  </div>
                )}
                {hostel.amenities.tvRoom && (
                  <div className="flex items-center gap-2">
                    <Tv className="w-5 h-5 text-blue-600" />
                    <p className="text-sm font-medium text-gray-900">TV Room</p>
                  </div>
                )}
                {hostel.amenities.studyRoom && (
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                    <p className="text-sm font-medium text-gray-900">Study Room</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Facilities */}
          {hostel.facilities && (
            <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 mb-6">
              <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-4">Facilities</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {hostel.facilities.security && (
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Security</p>
                      {hostel.facilities.securityGuards > 0 && (
                        <p className="text-xs text-gray-600">{hostel.facilities.securityGuards} guards</p>
                      )}
                    </div>
                  </div>
                )}
                {hostel.facilities.cctv && (
                  <div className="flex items-center gap-2">
                    <Camera className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">CCTV</p>
                      {hostel.facilities.cctvCount > 0 && (
                        <p className="text-xs text-gray-600">{hostel.facilities.cctvCount} cameras</p>
                      )}
                    </div>
                  </div>
                )}
                {hostel.facilities.powerBackup && (
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Power Backup</p>
                      {hostel.facilities.powerBackupHours > 0 && (
                        <p className="text-xs text-gray-600">{hostel.facilities.powerBackupHours} hours</p>
                      )}
                    </div>
                  </div>
                )}
                {hostel.facilities.waterSupply && (
                  <div className="flex items-center gap-2">
                    <Droplet className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Water Supply</p>
                      {hostel.facilities.waterSupplyType && (
                        <p className="text-xs text-gray-600 capitalize">{hostel.facilities.waterSupplyType}</p>
                      )}
                    </div>
                  </div>
                )}
                {hostel.facilities.medicalFacility && (
                  <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-green-600" />
                    <p className="text-sm font-medium text-gray-900">Medical Facility</p>
                  </div>
                )}
                {hostel.facilities.sportsFacility && (
                  <div className="flex items-center gap-2">
                    <Dumbbell className="w-5 h-5 text-green-600" />
                    <p className="text-sm font-medium text-gray-900">Sports Facility</p>
                  </div>
                )}
                {hostel.facilities.fireSafety && (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-green-600" />
                    <p className="text-sm font-medium text-gray-900">Fire Safety</p>
                  </div>
                )}
                {hostel.facilities.lift && (
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-green-600" />
                    <p className="text-sm font-medium text-gray-900">Lift/Elevator</p>
                  </div>
                )}
                {hostel.facilities.generator && (
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-green-600" />
                    <p className="text-sm font-medium text-gray-900">Generator</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Rules & Policies */}
          {hostel.rules && (
            <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 mb-6">
              <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-4">Rules & Policies</h2>
              <div className="space-y-4">
                {(hostel.rules.curfewTime || hostel.rules.weekendCurfewTime) && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Curfew Timings
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 ml-6">
                      {hostel.rules.curfewTime && (
                        <div>
                          <p className="text-xs text-gray-600">Weekdays</p>
                          <p className="text-sm text-gray-900">{hostel.rules.curfewTime}</p>
                        </div>
                      )}
                      {hostel.rules.weekendCurfewTime && (
                        <div>
                          <p className="text-xs text-gray-600">Weekends</p>
                          <p className="text-sm text-gray-900">{hostel.rules.weekendCurfewTime}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {hostel.rules.messTimings && (hostel.rules.messTimings.breakfast || hostel.rules.messTimings.lunch || hostel.rules.messTimings.dinner) && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <UtensilsCrossed className="w-4 h-4" />
                      Mess Timings
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 ml-6">
                      {hostel.rules.messTimings.breakfast && (
                        <div>
                          <p className="text-xs text-gray-600">Breakfast</p>
                          <p className="text-sm text-gray-900">{hostel.rules.messTimings.breakfast}</p>
                        </div>
                      )}
                      {hostel.rules.messTimings.lunch && (
                        <div>
                          <p className="text-xs text-gray-600">Lunch</p>
                          <p className="text-sm text-gray-900">{hostel.rules.messTimings.lunch}</p>
                        </div>
                      )}
                      {hostel.rules.messTimings.dinner && (
                        <div>
                          <p className="text-xs text-gray-600">Dinner</p>
                          <p className="text-sm text-gray-900">{hostel.rules.messTimings.dinner}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="flex items-center gap-2">
                    {hostel.rules.lateEntryAllowed ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600" />
                    )}
                    <span className="text-sm text-gray-900">Late Entry Allowed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {hostel.rules.visitorAllowed ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600" />
                    )}
                    <span className="text-sm text-gray-900">Visitors Allowed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {hostel.rules.smokingAllowed ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600" />
                    )}
                    <span className="text-sm text-gray-900">Smoking</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {hostel.rules.alcoholAllowed ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600" />
                    )}
                    <span className="text-sm text-gray-900">Alcohol</span>
                  </div>
                </div>
                {hostel.rules.visitorTimings && (
                  <div className="ml-6">
                    <p className="text-xs text-gray-600">Visitor Timings</p>
                    <p className="text-sm text-gray-900">{hostel.rules.visitorTimings}</p>
                  </div>
                )}
                {hostel.rules.lateEntryFine > 0 && (
                  <div className="ml-6">
                    <p className="text-xs text-gray-600">Late Entry Fine</p>
                    <p className="text-sm text-gray-900">₹{hostel.rules.lateEntryFine}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Operating Hours */}
          {hostel.operatingHours && (hostel.operatingHours.officeHours || hostel.operatingHours.checkInTime || hostel.operatingHours.checkOutTime) && (
            <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 mb-6">
              <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-4">Operating Hours</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {hostel.operatingHours.officeHours && (
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Office Hours</p>
                    <p className="text-sm font-medium text-gray-900">{hostel.operatingHours.officeHours}</p>
                  </div>
                )}
                {hostel.operatingHours.checkInTime && (
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Check-in Time</p>
                    <p className="text-sm font-medium text-gray-900">{hostel.operatingHours.checkInTime}</p>
                  </div>
                )}
                {hostel.operatingHours.checkOutTime && (
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Check-out Time</p>
                    <p className="text-sm font-medium text-gray-900">{hostel.operatingHours.checkOutTime}</p>
                  </div>
                )}
              </div>
            </div>
          )}

                    {/* Contact Information */}
                    {hostel.contact && (hostel.contact.phone || hostel.contact.email || hostel.contact.managerName || hostel.contact.wardenName) && (
            <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 mb-6">
              <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-4">Contact Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(hostel.contact.phone || hostel.contact.email) && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-gray-700">Primary Contact</h3>
                    {hostel.contact.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <a href={`tel:${hostel.contact.phone}`} className="text-sm text-gray-900 hover:text-blue-600">
                          {hostel.contact.phone}
                        </a>
                      </div>
                    )}
                    {hostel.contact.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <a href={`mailto:${hostel.contact.email}`} className="text-sm text-gray-900 hover:text-blue-600 break-words">
                          {hostel.contact.email}
                        </a>
                      </div>
                    )}
                    {hostel.contact.alternatePhone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <a href={`tel:${hostel.contact.alternatePhone}`} className="text-sm text-gray-900 hover:text-blue-600">
                          {hostel.contact.alternatePhone} (Alternate)
                        </a>
                      </div>
                    )}
                  </div>
                )}
                {hostel.contact.managerName && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-gray-700">Manager</h3>
                    <p className="text-sm text-gray-900">{hostel.contact.managerName}</p>
                    {hostel.contact.managerPhone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <a href={`tel:${hostel.contact.managerPhone}`} className="text-sm text-gray-900 hover:text-blue-600">
                          {hostel.contact.managerPhone}
                        </a>
                      </div>
                    )}
                    {hostel.contact.managerEmail && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <a href={`mailto:${hostel.contact.managerEmail}`} className="text-sm text-gray-900 hover:text-blue-600">
                          {hostel.contact.managerEmail}
                        </a>
                      </div>
                    )}
                  </div>
                )}
                {hostel.contact.wardenName && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-gray-700">Warden</h3>
                    <p className="text-sm text-gray-900">{hostel.contact.wardenName}</p>
                    {hostel.contact.wardenPhone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <a href={`tel:${hostel.contact.wardenPhone}`} className="text-sm text-gray-900 hover:text-blue-600">
                          {hostel.contact.wardenPhone}
                        </a>
                      </div>
                    )}
                    {hostel.contact.wardenEmail && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <a href={`mailto:${hostel.contact.wardenEmail}`} className="text-sm text-gray-900 hover:text-blue-600">
                          {hostel.contact.wardenEmail}
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Map */}
          {hostel.address?.coordinates && (
            <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 mb-6">
              <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-4">Location</h2>
              <div className="w-full h-64 sm:h-80 md:h-96 rounded-lg overflow-hidden">
                <GoogleMap
                  latitude={hostel.address.coordinates.latitude}
                  longitude={hostel.address.coordinates.longitude}
                  height="100%"
                  zoom={15}
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
                    <div className="relative w-full h-32 sm:h-40 md:h-48 rounded-lg overflow-hidden">
                      <img
                        src={imageUrl}
                        alt={`${hostel.name} - Image ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      {hostel.coverImage === imageUrl && (
                        <div className="absolute top-2 left-2 px-2 py-1 bg-blue-600 text-white text-xs rounded">
                          Cover
                        </div>
                      )}
                    </div>
                    <div className="absolute inset-0 bg-opacity-0 group-hover:bg-opacity-50 transition-opacity rounded-lg flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleSetCover(imageUrl)}
                        className="opacity-0 group-hover:opacity-100 px-2 md:px-3 py-1 bg-blue-600 text-white text-xs md:text-sm rounded transition-opacity"
                      >
                        Set Cover
                      </button>
                      <button
                        onClick={() => handleDeleteImage(imageUrl)}
                        className="opacity-0 group-hover:opacity-100 px-2 md:px-3 py-1 bg-red-600 text-white text-xs md:text-sm rounded transition-opacity flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    
  );
}

