'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../../contexts/AuthContext';
import api from '../../../../services/api';
import { useToast } from '../../../../components/Toast';
import { useConfirmModal } from '../../../../components/ConfirmModal';
import { ArrowLeft, Edit, Trash2, Users, Home, DollarSign, CheckCircle, Wrench, Upload, X, Loader2, Image as ImageIcon, MapPin, Building2, Layers, Calendar, Star, FileText } from 'lucide-react';

export default function RoomDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const { showToast } = useToast();
  const { confirm } = useConfirmModal();
  const [room, setRoom] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'owner') {
      router.replace('/login');
      return;
    }
    if (id) {
      loadRoom();
    }
  }, [id, user, router]);

  const loadRoom = async () => {
    setLoading(true);
    try {
      const response = await api.getRoom(id);
      const payload = response?.data ?? response;
      setRoom(payload ?? null);
    } catch (error: any) {
      showToast(error.message || 'Failed to load room', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const result = await confirm({
      title: 'Delete Room',
      message: `Are you sure you want to delete room ${room?.roomNumber}? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      confirmButtonClass: 'bg-red-600 hover:bg-red-700',
    });

    if (result) {
      try {
        await api.deleteRoom(id);
        showToast('Room deleted successfully', 'success');
        router.push('/owner/rooms');
      } catch (error: any) {
        showToast(error.message || 'Failed to delete room', 'error');
      }
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      await api.uploadRoomImages(id, Array.from(files));
      showToast('Images uploaded successfully', 'success');
      loadRoom();
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
        await api.deleteRoomImage(id, imageUrl);
        showToast('Image deleted successfully', 'success');
        loadRoom();
      } catch (error: any) {
        showToast(error.message || 'Failed to delete image', 'error');
      }
    }
  };

  const handleSetCover = async (imageUrl: string) => {
    try {
      await api.setRoomCoverImage(id, imageUrl);
      showToast('Cover image updated', 'success');
      loadRoom();
    } catch (error: any) {
      showToast(error.message || 'Failed to set cover image', 'error');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'occupied':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'maintenance':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Calculate occupancy from students array (similar to student dashboard room relationship handling)
  const getOccupancy = (room: any) => {
    if (!room) return 0;
    // Calculate from students array if available (more accurate)
    const studentsCount = Array.isArray(room.students) ? room.students.length : 0;
    // Use students count if available, otherwise fall back to currentOccupancy
    return studentsCount > 0 ? studentsCount : (room.currentOccupancy || 0);
  };

  if (loading) {
    return (
      
        <div className="flex justify-center items-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      
    );
  }

  if (!room) {
    return (
      
        <div className="text-center py-12">
          <p className="text-gray-600">Room not found</p>
          <Link href="/owner/rooms" className="text-blue-600 hover:underline mt-4 inline-block">
            Back to Rooms
          </Link>
        </div>
      
    );
  }

  const coverImage = room.coverImage || (room.images && room.images.length > 0 ? room.images[0] : null);
  const otherImages = room.images?.filter((img: string) => img !== coverImage) || [];

  return (
    
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        {/* Header with Cover Image */}
        <div className="relative">
          {coverImage ? (
            <div className="h-64 md:h-80 w-full relative overflow-hidden">
              <img
                src={coverImage}
                alt="Room cover"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
            </div>
          ) : (
            <div className="h-64 md:h-80 w-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Home className="w-20 h-20 text-white/50" />
            </div>
          )}
          
          {/* Header Content */}
          <div className="absolute bottom-0 left-0 right-0 px-6 pb-6">
            <div className="max-w-7xl mx-auto">
              <div className="flex items-end justify-between">
                <div className="flex items-center gap-4">
                  <Link
                    href="/owner/rooms"
                    className="p-2 bg-white/90 backdrop-blur-sm rounded-lg hover:bg-white transition-colors shadow-lg"
                  >
                    <ArrowLeft className="w-5 h-5 text-gray-700" />
                  </Link>
                  <div>
                    {room.hostelId && (
                      <div className="text-white/90 text-sm font-medium drop-shadow mb-1 flex items-center gap-1.5">
                        <Building2 className="w-4 h-4" />
                        {typeof room.hostelId === 'object' && room.hostelId?.name
                          ? room.hostelId.name
                          : String(room.hostelId)}
                      </div>
                    )}
                    <div className="flex items-center gap-3 mb-2">
                      <h1 className="text-3xl md:text-4xl font-bold text-white drop-shadow-lg">
                        Room {room.roomNumber}
                      </h1>
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full border ${getStatusColor(
                          room.status
                        )}`}
                      >
                        {room.status === 'available' && <CheckCircle className="w-3.5 h-3.5" />}
                        {room.status === 'occupied' && <Users className="w-3.5 h-3.5" />}
                        {room.status === 'maintenance' && <Wrench className="w-3.5 h-3.5" />}
                        {room.status || 'available'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-white/90 text-sm">
                      {room.blockId && (
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-4 h-4" />
                          <span>{typeof room.blockId === 'string' ? room.blockId : room.blockId.name || 'N/A'}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <Layers className="w-4 h-4" />
                        <span>Floor {room.floorNumber}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="w-4 h-4" />
                        <span>{getOccupancy(room)} / {room.capacity}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href={`/owner/rooms/${id}/edit`}
                    className="px-5 py-2.5 bg-white/90 backdrop-blur-sm text-gray-900 rounded-lg hover:bg-white transition-all flex items-center gap-2 font-medium shadow-lg"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </Link>
                  <button
                    onClick={handleDelete}
                    className="px-5 py-2.5 bg-red-600/90 backdrop-blur-sm text-white rounded-lg hover:bg-red-700 transition-all flex items-center gap-2 font-medium shadow-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-8 space-y-6">
              {/* Occupancy & Assigned Students */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-blue-600" />
                      <h2 className="text-lg font-bold text-gray-900">Assigned Students</h2>
                      <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-semibold rounded-full">
                        {room.students?.length || 0} / {room.capacity}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      Occupancy: <span className="font-semibold text-blue-600">{getOccupancy(room)}</span> / <span className="font-semibold">{room.capacity}</span>
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  {room.students && room.students.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {room.students.map((student: any) => (
                        <div
                          key={student._id || student.id}
                          className="flex items-center gap-4 p-4 bg-gradient-to-r from-gray-50 to-white rounded-lg border border-gray-200 hover:border-blue-300 transition-all group"
                        >
                          {student.profileImage ? (
                            <img
                              src={student.profileImage}
                              alt={student.name}
                              className="w-16 h-16 rounded-full object-cover ring-2 ring-gray-200 group-hover:ring-blue-300 transition-all"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-xl ring-2 ring-gray-200 group-hover:ring-blue-300 transition-all">
                              {student.name?.charAt(0) || 'S'}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors text-base">
                              {student.name}
                            </div>
                            <div className="text-sm text-gray-600 truncate">{student.email}</div>
                            {student.studentId && (
                              <div className="text-xs text-gray-500 mt-0.5">ID: {student.studentId}</div>
                            )}
                          </div>
                          <Link
                            href={`/owner/students/${student._id || student.id}`}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2 whitespace-nowrap"
                          >
                            View Details
                          </Link>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600 font-medium">No students assigned</p>
                      <p className="text-sm text-gray-500 mt-1">This room is currently available</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Image Gallery */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-5 h-5 text-gray-600" />
                      <h2 className="text-lg font-bold text-gray-900">Photo Gallery</h2>
                      {room.images && room.images.length > 0 && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                          {room.images.length}
                        </span>
                      )}
                    </div>
                    <label className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer flex items-center gap-2 text-sm font-medium shadow-sm">
                      <Upload className="w-4 h-4" />
                      {uploading ? 'Uploading...' : 'Upload'}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageUpload}
                        className="hidden"
                        disabled={uploading}
                      />
                    </label>
                  </div>
                </div>
                <div className="p-4">
                  {room.images && room.images.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {room.images.map((imageUrl: string, index: number) => (
                        <div key={index} className="relative group">
                          <div className="w-full aspect-square bg-gray-100 rounded-lg overflow-hidden shadow-sm">
                            <img
                              src={imageUrl}
                              alt={`Room image ${index + 1}`}
                              className="w-full h-full object-cover transition-transform group-hover:scale-105"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                              }}
                            />
                          </div>
                          {room.coverImage === imageUrl && (
                            <div className="absolute top-2 left-2 px-2.5 py-1 bg-blue-600 text-white text-xs font-semibold rounded-lg shadow-md z-10 flex items-center gap-1">
                              <Star className="w-3 h-3 fill-current" />
                              Cover
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-all duration-200 rounded-lg flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                            <button
                              onClick={() => handleSetCover(imageUrl)}
                              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors font-medium shadow-lg"
                            >
                              Set Cover
                            </button>
                            <button
                              onClick={() => handleDeleteImage(imageUrl)}
                              className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors font-medium shadow-lg"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-16 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50">
                      <ImageIcon className="w-16 h-16 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600 font-medium">No images uploaded</p>
                      <p className="text-sm text-gray-500 mt-1">Upload images to showcase this room</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              {room.description && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-gray-600" />
                    Description
                  </h2>
                  <p className="text-gray-700 leading-relaxed text-sm">{room.description}</p>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-4 space-y-4">
              {/* Basic Information Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
                  <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <Home className="w-4 h-4 text-blue-600" />
                    Basic Information
                  </h2>
                </div>
                <div className="p-4 space-y-3">
                  {room.blockId && (
                    <div className="flex items-center justify-between py-1.5">
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Building2 className="w-3.5 h-3.5" />
                        <span className="text-xs font-medium">Block</span>
                      </div>
                      <div className="font-semibold text-gray-900 text-sm">
                        {typeof room.blockId === 'string' ? room.blockId : room.blockId.name || 'N/A'}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <Layers className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">Floor</span>
                    </div>
                    <div className="font-semibold text-gray-900 text-sm">Floor {room.floorNumber}</div>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <Users className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">Capacity</span>
                    </div>
                    <div className="font-semibold text-gray-900 text-sm">
                      <span className="text-blue-600">{getOccupancy(room)}</span>
                      <span className="text-gray-400 mx-1">/</span>
                      <span>{room.capacity}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pricing Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-gray-200">
                  <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-green-600" />
                    Pricing
                  </h2>
                </div>
                <div className="p-4 space-y-3">
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-100">
                    <div className="text-xs text-gray-600 font-medium mb-0.5">Monthly Rent</div>
                    <div className="text-xl font-bold text-blue-700">
                      ₹{room.pricing?.monthly?.toLocaleString() || 0}
                      <span className="text-xs font-normal text-gray-600 ml-1">/month</span>
                    </div>
                  </div>
                  {room.pricing?.perBed && (
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-3 border border-purple-100">
                      <div className="text-xs text-gray-600 font-medium mb-0.5">Per Bed</div>
                      <div className="text-lg font-bold text-purple-700">
                        ₹{room.pricing.perBed.toLocaleString()}
                        <span className="text-xs font-normal text-gray-600 ml-1">/bed</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Amenities Card */}
              {room.amenities && room.amenities.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-4 bg-gradient-to-r from-orange-50 to-amber-50 border-b border-gray-200">
                    <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                      <Star className="w-4 h-4 text-orange-600" />
                      Amenities
                    </h2>
                  </div>
                  <div className="p-4">
                    <div className="flex flex-wrap gap-2">
                      {room.amenities.map((amenity: string, index: number) => (
                        <span
                          key={index}
                          className="px-2.5 py-1 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 text-xs font-semibold rounded-lg border border-blue-200"
                        >
                          {amenity}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    
  );
}
