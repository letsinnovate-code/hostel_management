'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { API_BASE_URL } from '../../../constants/config';
import {
  MapPin, Users, Bed, Building2, Phone, Mail, Clock, Shield, Camera, Zap,
  Droplet, Activity, Dumbbell, BookOpen, Tv, Coffee, Car, Wifi, UtensilsCrossed,
  Shirt, ArrowLeft
} from 'lucide-react';
import GoogleMap from '../../../components/GoogleMap';
import EnquiryForm from '../../../components/marketplace/EnquiryForm';
import CallbackForm from '../../../components/marketplace/CallbackForm';
import PublicNavbar from '../../../components/layout/PublicNavbar';
import PublicFooter from '../../../components/layout/PublicFooter';
import toast from 'react-hot-toast';

export default function MarketplaceHostelDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string;
  const action = searchParams?.get('action'); // 'enquire' or 'callback'

  const [hostel, setHostel] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showEnquiryForm, setShowEnquiryForm] = useState(action === 'enquire');
  const [showCallbackForm, setShowCallbackForm] = useState(action === 'callback');

  useEffect(() => {
    if (id) {
      loadHostel();
    }
  }, [id]);

  useEffect(() => {
    if (action === 'enquire') {
      setShowEnquiryForm(true);
      setShowCallbackForm(false);
    } else if (action === 'callback') {
      setShowCallbackForm(true);
      setShowEnquiryForm(false);
    }
  }, [action]);

  const loadHostel = async () => {
    setLoading(true);
    try {
      const apiUrl = API_BASE_URL.replace('/api', '') || 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/api/public/hostels/${id}`);
      if (response.ok) {
        const data = await response.json();
        setHostel(data.data);
      } else {
        console.error('Failed to load hostel:', response.statusText);
      }
    } catch (error) {
      console.error('Failed to load hostel:', error);
    } finally {
      setLoading(false);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <PublicNavbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading details...</p>
          </div>
        </div>
        <PublicFooter />
      </div>
    );
  }

  if (!hostel) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <PublicNavbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-600 mb-4">Hostel not found</p>
            <Link href="/marketplace" className="text-blue-600 hover:underline">
              Back to Marketplace
            </Link>
          </div>
        </div>
        <PublicFooter />
      </div>
    );
  }

  const images = Array.isArray(hostel.images) ? hostel.images.filter((img: string) => img && img.trim() !== '') : [];
  const displayImage = hostel.coverImage || (images.length > 0 ? images[0] : null);
  const occupancyRate = hostel.capacity
    ? Math.round((hostel.currentOccupancy || 0) / hostel.capacity * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <PublicNavbar />

      {/* Detail Header - Sticky */}
      {/* Added `top-0` but we need to handle Navbar overlap if Navbar is fixed. 
          If PublicNavbar is fixed, we should use top-[var] or just let it slide under.
          Better UX: Make this header static or sticky BELOW nav. 
          Assuming Navbar is ~80px.
      */}
      <div className="bg-white border-b border-gray-200 sticky top-16 z-40 shadow-sm mt-20 md:mt-24">
        <div className="px-4 md:px-6 py-4">
          <div className="max-w-7xl mx-auto">
            <Link href="/marketplace" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back to Marketplace
            </Link>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{hostel.name}</h1>
                  {hostel.type && (
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getTypeColor(hostel.type)}`}>
                      {hostel.type.charAt(0).toUpperCase() + hostel.type.slice(1)}
                    </span>
                  )}
                </div>
                <p className="text-sm md:text-base text-gray-600 flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {formatAddress(hostel.address)}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowEnquiryForm(true);
                    setShowCallbackForm(false);
                  }}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
                >
                  Enquire Now
                </button>
                <button
                  onClick={() => {
                    setShowCallbackForm(true);
                    setShowEnquiryForm(false);
                  }}
                  className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Request Callback
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 md:px-6 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Modals */}
          {showEnquiryForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <div className="max-w-md w-full">
                <EnquiryForm
                  hostelId={id}
                  hostelName={hostel.name}
                  onClose={() => setShowEnquiryForm(false)}
                  onSuccess={() => {
                    setShowEnquiryForm(false);
                    toast.success('Enquiry submitted successfully! We will get back to you soon.');
                  }}
                />
              </div>
            </div>
          )}

          {showCallbackForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <div className="max-w-md w-full">
                <CallbackForm
                  hostelId={id}
                  hostelName={hostel.name}
                  onClose={() => setShowCallbackForm(false)}
                  onSuccess={() => {
                    setShowCallbackForm(false);
                    toast.success('Callback request submitted successfully! We will call you soon.');
                  }}
                />
              </div>
            </div>
          )}

          {/* Cover Image */}
          {displayImage && (
            <div className="mb-6 rounded-2xl overflow-hidden shadow-sm border border-gray-100">
              <div className="relative w-full h-64 sm:h-80 md:h-96 bg-gray-200">
                <img
                  src={displayImage}
                  alt={hostel.name}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}

          {/* Key Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard icon={Users} color="blue" label="Capacity" value={hostel.capacity || 0} />
            <StatCard icon={Bed} color="green" label="Available" value={hostel.availableRooms || 0} />
            <StatCard icon={Building2} color="purple" label="Rooms" value={hostel.totalRooms || 0} />
            <StatCard icon={Activity} color="orange" label="Occupancy" value={`${occupancyRate}%`} />
          </div>

          {/* Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Left Column - Main Info */}
            <div className="lg:col-span-2 space-y-8">

              {/* Overview */}
              {(hostel.shortDescription || hostel.description || hostel.highlights) && (
                <Section title="Overview">
                  {hostel.shortDescription && <p className="text-gray-700 mb-4">{hostel.shortDescription}</p>}
                  {hostel.description && <p className="text-gray-600 mb-6 leading-relaxed">{hostel.description}</p>}
                  {hostel.highlights && hostel.highlights.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100">
                      {hostel.highlights.map((highlight: string, index: number) => (
                        <span key={index} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                          {highlight}
                        </span>
                      ))}
                    </div>
                  )}
                </Section>
              )}

              {/* Amenities */}
              {hostel.amenities && (
                <Section title="Amenities">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {hostel.amenities.wifi && <AmenityItem icon={Wifi} label="WiFi" sub={hostel.amenities.wifiSpeed} />}
                    {hostel.amenities.laundry && <AmenityItem icon={Shirt} label="Laundry" />}
                    {hostel.amenities.mess && <AmenityItem icon={UtensilsCrossed} label="Mess" />}
                    {hostel.amenities.parking && <AmenityItem icon={Car} label="Parking" />}
                    {hostel.amenities.gym && <AmenityItem icon={Dumbbell} label="Gym" />}
                    {hostel.amenities.library && <AmenityItem icon={BookOpen} label="Library" />}
                    {hostel.amenities.commonRoom && <AmenityItem icon={Coffee} label="Common Room" />}
                    {hostel.amenities.tvRoom && <AmenityItem icon={Tv} label="TV Room" />}
                  </div>
                </Section>
              )}

              {/* Facilities */}
              {hostel.facilities && (
                <Section title="Facilities">
                  <div className="grid grid-cols-2 gap-4">
                    {hostel.facilities.security && <FacilityItem icon={Shield} label="24/7 Security" />}
                    {hostel.facilities.cctv && <FacilityItem icon={Camera} label="CCTV Surveillance" />}
                    {hostel.facilities.powerBackup && <FacilityItem icon={Zap} label="Power Backup" />}
                    {hostel.facilities.waterSupply && <FacilityItem icon={Droplet} label="24x7 Water Supply" />}
                    {hostel.facilities.medicalFacility && <FacilityItem icon={Activity} label="Medical Assistance" />}
                  </div>
                </Section>
              )}
            </div>

            {/* Right Column - Sticky Sidebar Info */}
            <div className="space-y-6">

              {/* Pricing Card */}
              {hostel.pricing && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-32">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-100 pb-4">Pricing</h3>

                  {(hostel.pricing.minRent || hostel.pricing.maxRent) && (
                    <div className="mb-6">
                      <p className="text-sm text-gray-500 mb-1">Monthly Rent</p>
                      <p className="text-3xl font-bold text-blue-600">
                        ₹{hostel.pricing.minRent?.toLocaleString()}
                        {hostel.pricing.maxRent > hostel.pricing.minRent && ` - ₹${hostel.pricing.maxRent.toLocaleString()}`}
                      </p>
                    </div>
                  )}

                  <div className="space-y-3 mb-6">
                    {hostel.pricing.securityDeposit > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Security Deposit</span>
                        <span className="font-semibold">₹{hostel.pricing.securityDeposit.toLocaleString()}</span>
                      </div>
                    )}
                    {hostel.pricing.maintenanceCharges > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Maintenance</span>
                        <span className="font-semibold">₹{hostel.pricing.maintenanceCharges.toLocaleString()}/mo</span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => setShowEnquiryForm(true)}
                    className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold transition-colors mb-2"
                  >
                    Book a Visit
                  </button>
                </div>
              )}

              {/* Contact */}
              {hostel.contact && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Contact Info</h3>
                  <div className="space-y-3">
                    {hostel.contact.phone && (
                      <div className="flex items-center gap-3 text-gray-700">
                        <Phone className="w-5 h-5 text-gray-400" />
                        <a href={`tel:${hostel.contact.phone}`} className="hover:text-blue-600">{hostel.contact.phone}</a>
                      </div>
                    )}
                    {hostel.contact.email && (
                      <div className="flex items-center gap-3 text-gray-700">
                        <Mail className="w-5 h-5 text-gray-400" />
                        <a href={`mailto:${hostel.contact.email}`} className="hover:text-blue-600 break-all">{hostel.contact.email}</a>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Map Section - Full Width at bottom */}
          {hostel.address?.coordinates && (
            <div className="mt-12">
              <Section title="Location">
                <div className="h-96 rounded-xl overflow-hidden bg-gray-100">
                  <GoogleMap
                    latitude={hostel.address.coordinates.latitude}
                    longitude={hostel.address.coordinates.longitude}
                    height="100%"
                    zoom={15}
                  />
                </div>
              </Section>
            </div>
          )}

        </div>
      </div>

      <PublicFooter />
    </div>
  );
}

// Components Helpers
function Section({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8">
      <h2 className="text-xl font-bold text-gray-900 mb-6">{title}</h2>
      {children}
    </div>
  );
}

function StatCard({ icon: Icon, color, label, value }: any) {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600'
  };
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${colors[color]}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium uppercase">{label}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function AmenityItem({ icon: Icon, label, sub }: any) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
      <Icon className="w-5 h-5 text-blue-600" />
      <div>
        <p className="font-medium text-gray-900">{label}</p>
        {sub && <p className="text-xs text-gray-500">{sub}</p>}
      </div>
    </div>
  );
}

function FacilityItem({ icon: Icon, label }: any) {
  return (
    <div className="flex items-center gap-3">
      <div className="p-1 rounded-full bg-green-100 text-green-600">
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-gray-700 font-medium">{label}</p>
    </div>
  );
}
