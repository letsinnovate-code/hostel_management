'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MapPin, Building2 } from 'lucide-react';

interface HostelCardProps {
    hostel: any;
}

export default function HostelCard({ hostel }: HostelCardProps) {
    const router = useRouter();

    const getCoverImage = (h: any) => {
        if (h.coverImage) return h.coverImage;
        if (h.images && Array.isArray(h.images) && h.images.length > 0) {
            return h.images[0];
        }
        return null;
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

    const formatAddress = (address: any) => {
        if (!address) return 'Address not available';
        if (typeof address === 'string') return address;
        if (address.formattedAddress) return address.formattedAddress;

        const parts = [];
        if (address.city) parts.push(address.city);
        if (address.state) parts.push(address.state);
        return parts.length > 0 ? parts.join(', ') : 'Address not available';
    };

    const coverImage = getCoverImage(hostel);
    const hostelId = hostel._id || hostel.id;

    const handleNavigation = (e: React.MouseEvent, path: string) => {
        e.preventDefault();
        e.stopPropagation();
        router.push(path);
    };

    return (
        <div
            onClick={() => router.push(`/marketplace/${hostelId}`)}
            className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group cursor-pointer border border-gray-100"
        >
            {/* Cover Image */}
            <div className="relative h-48 bg-gray-200 overflow-hidden">
                {coverImage ? (
                    <img
                        src={coverImage}
                        alt={hostel.name || 'Hostel'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100">
                        <Building2 className="w-16 h-16 text-gray-300" />
                    </div>
                )}
                {hostel.type && (
                    <span className={`absolute top-3 left-3 px-2 py-1 rounded-md text-xs font-medium ${getTypeColor(hostel.type)}`}>
                        {hostel.type.charAt(0).toUpperCase() + hostel.type.slice(1)}
                    </span>
                )}
            </div>

            {/* Content */}
            <div className="p-5">
                <h3 className="text-xl font-bold text-gray-900 mb-2 line-clamp-1">
                    {hostel.name || 'Unnamed Hostel'}
                </h3>

                {/* Address */}
                <div className="flex items-start gap-2 mb-3">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-gray-600 line-clamp-2 flex-1">
                        {formatAddress(hostel.address)}
                    </p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 mb-3 pb-3 border-b border-gray-100">
                    <div className="text-center">
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Capacity</p>
                        <p className="text-sm font-semibold text-gray-900">{hostel.capacity || 0}</p>
                    </div>
                    <div className="text-center border-l border-gray-100">
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Rooms</p>
                        <p className="text-sm font-semibold text-gray-900">{hostel.totalRooms || 0}</p>
                    </div>
                    <div className="text-center border-l border-gray-100">
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Open</p>
                        <p className="text-sm font-semibold text-gray-900">{hostel.availableRooms || 0}</p>
                    </div>
                </div>

                {/* Pricing */}
                {hostel.pricing && (hostel.pricing.minRent || hostel.pricing.maxRent) && (
                    <div className="mb-4">
                        <p className="text-xs text-gray-500 mb-1">Starting from</p>
                        <p className="text-lg font-bold text-blue-600">
                            ₹{hostel.pricing.minRent?.toLocaleString() || hostel.pricing.maxRent?.toLocaleString() || '0'}
                            <span className="text-sm font-normal text-gray-500">/month</span>
                        </p>
                    </div>
                )}

                {/* Highlights */}
                {hostel.highlights && hostel.highlights.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4 h-6 overflow-hidden">
                        {hostel.highlights.slice(0, 3).map((highlight: string, index: number) => (
                            <span key={index} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs whitespace-nowrap">
                                {highlight}
                            </span>
                        ))}
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 mt-auto">
                    <button
                        onClick={(e) => handleNavigation(e, `/marketplace/${hostelId}?action=enquire`)}
                        className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium text-center shadow-sm"
                    >
                        Enquire Now
                    </button>
                    <button
                        onClick={(e) => handleNavigation(e, `/marketplace/${hostelId}?action=callback`)}
                        className="flex-1 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-center"
                    >
                        Callback
                    </button>
                </div>
            </div>
        </div>
    );
}
