'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, isOwnerUser } from '../../../contexts/AuthContext';
import { useOwnerHostel } from '../../../contexts/OwnerHostelContext';
import api from '../../../services/api';
import {
  Settings,
  Building2,
  Shield,
  Clock,
  Wifi,
  Lock,
  Save,
  ChevronLeft,
  CheckCircle,
  AlertCircle,
  Phone,
  Mail,
  MapPin,
  FileText,
  CreditCard,
  Bell,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Check,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

type TabType = 'profile' | 'rules' | 'facilities' | 'billing' | 'notifications' | 'account';

export default function OwnerSettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { hostels, selectedHostel, setSelectedHostel, updateHostelInState, refetchHostels } = useOwnerHostel();

  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hostelData, setHostelData] = useState<any>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    type: 'co-ed',
    description: '',
    contact: {
      phone: '',
      email: '',
      managerName: '',
      managerPhone: '',
    },
    address: {
      street: '',
      city: '',
      state: '',
      pincode: '',
    },
    facilities: {
      security: true,
      cctv: true,
      powerBackup: false,
      waterSupply: true,
      lift: false,
      medicalFacility: false,
      fireSafety: true,
    },
    amenities: {
      wifi: true,
      laundry: false,
      mess: true,
      gym: false,
      library: false,
      parking: true,
    },
    rules: {
      curfewTime: '22:00',
      weekendCurfewTime: '23:00',
      curfewEndTime: '06:00',
      gracePeriodMinutes: 15,
      visitorAllowed: false,
      visitorEndTime: '19:00',
      autoLockGate: true,
    },
    billingPolicy: {
      rentDueDay: 5,
      lateFinePerDay: 50,
      graceDays: 3,
      securityDepositMonths: 2,
    },
    notifications: {
      curfewBreachSms: true,
      rentDueEmail: true,
      gatePassNotification: true,
      maintenanceUpdates: true,
    },
  });

  // Password update form
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (!user || !isOwnerUser(user)) {
      router.replace('/login');
      return;
    }
  }, [user, router]);

  useEffect(() => {
    if (!user || !selectedHostel) {
      setLoading(false);
      return;
    }
    loadHostelDetails(selectedHostel);
  }, [user, selectedHostel]);

  const loadHostelDetails = async (id: string) => {
    setLoading(true);
    try {
      const res = await api.getHostel(id);
      const h = res?.data ?? res;
      if (h) {
        setHostelData(h);
        setFormData({
          name: h.name || '',
          type: h.type || 'co-ed',
          description: h.description || '',
          contact: {
            phone: h.contact?.phone || '',
            email: h.contact?.email || '',
            managerName: h.contact?.managerName || '',
            managerPhone: h.contact?.managerPhone || '',
          },
          address: {
            street: h.address?.street || '',
            city: h.address?.city || '',
            state: h.address?.state || '',
            pincode: h.address?.pincode || '',
          },
          facilities: {
            security: !!h.facilities?.security,
            cctv: !!h.facilities?.cctv,
            powerBackup: !!h.facilities?.powerBackup,
            waterSupply: !!h.facilities?.waterSupply,
            lift: !!h.facilities?.lift,
            medicalFacility: !!h.facilities?.medicalFacility,
            fireSafety: !!h.facilities?.fireSafety,
          },
          amenities: {
            wifi: !!h.amenities?.wifi,
            laundry: !!h.amenities?.laundry,
            mess: !!h.amenities?.mess,
            gym: !!h.amenities?.gym,
            library: !!h.amenities?.library,
            parking: !!h.amenities?.parking,
          },
          rules: {
            curfewTime: h.rules?.curfewTime || '22:00',
            weekendCurfewTime: h.rules?.weekendCurfewTime || '23:00',
            curfewEndTime: h.rules?.curfewEndTime || '06:00',
            gracePeriodMinutes: h.rules?.gracePeriodMinutes || 15,
            visitorAllowed: !!h.rules?.visitorAllowed,
            visitorEndTime: h.rules?.visitorEndTime || '19:00',
            autoLockGate: h.rules?.autoLockGate !== undefined ? !!h.rules?.autoLockGate : true,
          },
          billingPolicy: {
            rentDueDay: h.billingPolicy?.rentDueDay || 5,
            lateFinePerDay: h.billingPolicy?.lateFinePerDay || 50,
            graceDays: h.billingPolicy?.graceDays || 3,
            securityDepositMonths: h.billingPolicy?.securityDepositMonths || 2,
          },
          notifications: {
            curfewBreachSms: h.notifications?.curfewBreachSms !== undefined ? !!h.notifications?.curfewBreachSms : true,
            rentDueEmail: h.notifications?.rentDueEmail !== undefined ? !!h.notifications?.rentDueEmail : true,
            gatePassNotification: h.notifications?.gatePassNotification !== undefined ? !!h.notifications?.gatePassNotification : true,
            maintenanceUpdates: h.notifications?.maintenanceUpdates !== undefined ? !!h.notifications?.maintenanceUpdates : true,
          },
        });
      }
    } catch (err: any) {
      toast.error('Failed to load hostel configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveHostel = async () => {
    if (!selectedHostel) {
      toast.error('Please select a property first');
      return;
    }
    setSaving(true);
    try {
      await api.updateHostel(selectedHostel, formData);
      updateHostelInState({ _id: selectedHostel, ...formData });
      refetchHostels();
      toast.success('Property settings updated successfully');
      loadHostelDetails(selectedHostel);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update property settings');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (passwords.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    try {
      await api.changePassword(passwords.currentPassword, passwords.newPassword);
      toast.success('Account password updated successfully');
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    }
  };

  const tabs: { id: TabType; label: string; icon: any }[] = [
    { id: 'profile', label: 'Property Profile', icon: Building2 },
    { id: 'rules', label: 'Curfew & Gate Schedule', icon: Clock },
    { id: 'facilities', label: 'Facilities & Amenities', icon: Wifi },
    { id: 'billing', label: 'Finance & Dues Policy', icon: CreditCard },
    { id: 'notifications', label: 'Automated Alerts', icon: Bell },
    { id: 'account', label: 'Security & Account', icon: Lock },
  ];

  const hostelLat = hostelData?.address?.coordinates?.latitude || 23.5235;
  const hostelLng = hostelData?.address?.coordinates?.longitude || 77.8139;

  return (
    <div className="min-h-screen bg-gray-50/70 pb-16">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link
                href="/owner/dashboard"
                className="p-2 rounded-xl hover:bg-gray-100 text-gray-600 transition-colors"
                aria-label="Back to dashboard"
              >
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-blue-600" />
                    Property Configuration
                  </span>
                </div>
                <h1 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">
                  Hostel & System Settings
                </h1>
              </div>
            </div>

            {/* Actions and Property Selector */}
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-xl px-3 py-1.5 shadow-2xs">
                <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
                <select
                  value={selectedHostel || ''}
                  onChange={(e) => setSelectedHostel(e.target.value)}
                  className="bg-transparent border-none text-xs font-bold text-gray-800 focus:ring-0 cursor-pointer"
                  aria-label="Select hostel"
                >
                  {hostels.map((h: any) => (
                    <option key={h._id} value={h._id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>

              {activeTab !== 'account' && (
                <button
                  type="button"
                  disabled={saving || loading}
                  onClick={handleSaveHostel}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Saving...' : 'Save Settings'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto mt-6 border-b border-gray-200 scrollbar-none">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                    isActive
                      ? 'border-blue-600 text-blue-600 bg-blue-50/40'
                      : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Settings Body */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 mt-6">
        {loading ? (
          <div className="bg-white rounded-2xl p-12 text-center text-gray-400 text-xs border border-gray-200">
            Loading hostel configuration parameters...
          </div>
        ) : (
          <div className="space-y-6">
            {/* TAB 1: PROPERTY PROFILE */}
            {activeTab === 'profile' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-2">
                    Property Identity & Managers
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Hostel Property Name</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full text-xs border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Hostel Type</label>
                      <select
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                        className="w-full text-xs border border-gray-300 rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="girls">Girls Hostel</option>
                        <option value="boys">Boys Hostel</option>
                        <option value="co-ed">Co-Ed Hostel</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Property Description</label>
                    <textarea
                      rows={3}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full text-xs border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-blue-500"
                      placeholder="About this property, proximity to colleges, etc."
                    />
                  </div>

                  <div className="pt-2 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Manager / Warden Name</label>
                      <input
                        type="text"
                        value={formData.contact.managerName}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            contact: { ...formData.contact, managerName: e.target.value },
                          })
                        }
                        className="w-full text-xs border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Manager Contact Number</label>
                      <input
                        type="tel"
                        value={formData.contact.managerPhone}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            contact: { ...formData.contact, managerPhone: e.target.value },
                          })
                        }
                        className="w-full text-xs border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-100">
                    <h4 className="text-xs font-bold text-gray-900 mb-3">Address & Physical Location</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Street Address</label>
                        <input
                          type="text"
                          value={formData.address.street}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              address: { ...formData.address, street: e.target.value },
                            })
                          }
                          className="w-full text-xs border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
                          <input
                            type="text"
                            value={formData.address.city}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                address: { ...formData.address, city: e.target.value },
                              })
                            }
                            className="w-full text-xs border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">State</label>
                          <input
                            type="text"
                            value={formData.address.state}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                address: { ...formData.address, state: e.target.value },
                              })
                            }
                            className="w-full text-xs border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Pincode</label>
                          <input
                            type="text"
                            value={formData.address.pincode}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                address: { ...formData.address, pincode: e.target.value },
                              })
                            }
                            className="w-full text-xs border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: OpenStreetMap Geocoding Card */}
                <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs flex flex-col justify-between space-y-4">
                  <div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 w-fit mb-3">
                      <CheckCircle className="w-3 h-3" />
                      Free OpenStreetMap Active
                    </span>

                    <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-2">
                      Geocoded GPS Coordinates
                    </h4>
                    <p className="text-xs text-gray-500 mb-4">
                      These coordinates anchor student geofence containment, automated curfew calculations, and campus radar pins.
                    </p>

                    <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 space-y-2 text-xs font-mono">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Latitude:</span>
                        <strong className="text-gray-900">{hostelLat.toFixed(6)}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Longitude:</span>
                        <strong className="text-gray-900">{hostelLng.toFixed(6)}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Link
                      href={`https://www.openstreetmap.org/?mlat=${hostelLat}&mlon=${hostelLng}#map=17/${hostelLat}/${hostelLng}`}
                      target="_blank"
                      className="w-full py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      View on OpenStreetMap
                    </Link>
                    <Link
                      href="/owner/geo-fence"
                      className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      Edit Geo-Fence Perimeter
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: CURFEW & GATE SCHEDULE */}
            {activeTab === 'rules' && (
              <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-1">
                    Curfew Timings & Automated Security Protocols
                  </h3>
                  <p className="text-xs text-gray-500">
                    Residents outside the campus perimeter past these hours trigger automatic curfew violation logs.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Weekday Curfew Time</label>
                    <input
                      type="time"
                      value={formData.rules.curfewTime}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          rules: { ...formData.rules, curfewTime: e.target.value },
                        })
                      }
                      className="w-full text-xs font-bold border border-gray-300 rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">Monday through Friday</p>
                  </div>

                  <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Weekend Curfew Time</label>
                    <input
                      type="time"
                      value={formData.rules.weekendCurfewTime}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          rules: { ...formData.rules, weekendCurfewTime: e.target.value },
                        })
                      }
                      className="w-full text-xs font-bold border border-gray-300 rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">Saturday and Sunday</p>
                  </div>

                  <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Morning Exit Permitted</label>
                    <input
                      type="time"
                      value={formData.rules.curfewEndTime}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          rules: { ...formData.rules, curfewEndTime: e.target.value },
                        })
                      }
                      className="w-full text-xs font-bold border border-gray-300 rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">Gate opens for routine exits</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                  <div className="p-4 rounded-xl border border-gray-200">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Curfew Grace Period (Minutes)</label>
                    <input
                      type="number"
                      value={formData.rules.gracePeriodMinutes}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          rules: { ...formData.rules, gracePeriodMinutes: Number(e.target.value) },
                        })
                      }
                      className="w-full text-xs border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">Tolerance buffer before alert is logged.</p>
                  </div>

                  <div className="p-4 rounded-xl border border-gray-200">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Visitor Cutoff Hour</label>
                    <input
                      type="time"
                      value={formData.rules.visitorEndTime}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          rules: { ...formData.rules, visitorEndTime: e.target.value },
                        })
                      }
                      className="w-full text-xs border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">All unregistered guests must exit.</p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: FACILITIES & AMENITIES */}
            {activeTab === 'facilities' && (
              <div className="space-y-6">
                {/* Security & Safety Facilities */}
                <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">
                    Security & Infrastructure Standards
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {[
                      { key: 'security', label: '24/7 Security Guard' },
                      { key: 'cctv', label: 'CCTV Surveillance' },
                      { key: 'powerBackup', label: 'Power Backup Generator' },
                      { key: 'waterSupply', label: 'Continuous Water Supply' },
                      { key: 'lift', label: 'Passenger Elevator / Lift' },
                      { key: 'fireSafety', label: 'Fire Extinguishers & Alarms' },
                      { key: 'medicalFacility', label: 'First Aid & Medical Desk' },
                    ].map((item) => {
                      const enabled = (formData.facilities as any)[item.key];
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() =>
                            setFormData({
                              ...formData,
                              facilities: { ...formData.facilities, [item.key]: !enabled },
                            })
                          }
                          className={`p-3.5 rounded-xl border text-left flex items-start justify-between transition-all ${
                            enabled
                              ? 'border-blue-500 bg-blue-50/50 text-blue-900 shadow-2xs'
                              : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <span className="text-xs font-bold leading-snug">{item.label}</span>
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ml-2 ${
                              enabled ? 'bg-blue-600 text-white' : 'border border-gray-300'
                            }`}
                          >
                            {enabled && <Check className="w-3 h-3" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Living Amenities */}
                <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">
                    Student Amenities & Perks
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {[
                      { key: 'wifi', label: 'High-Speed WiFi' },
                      { key: 'mess', label: 'Daily Mess Service' },
                      { key: 'laundry', label: 'Laundry Service' },
                      { key: 'gym', label: 'Fitness Gym' },
                      { key: 'library', label: 'Quiet Study Library' },
                      { key: 'parking', label: 'Two-Wheeler Parking' },
                    ].map((item) => {
                      const enabled = (formData.amenities as any)[item.key];
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() =>
                            setFormData({
                              ...formData,
                              amenities: { ...formData.amenities, [item.key]: !enabled },
                            })
                          }
                          className={`p-3.5 rounded-xl border text-left flex items-start justify-between transition-all ${
                            enabled
                              ? 'border-indigo-500 bg-indigo-50/50 text-indigo-900 shadow-2xs'
                              : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <span className="text-xs font-bold leading-snug">{item.label}</span>
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ml-2 ${
                              enabled ? 'bg-indigo-600 text-white' : 'border border-gray-300'
                            }`}
                          >
                            {enabled && <Check className="w-3 h-3" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: FINANCE & DUES POLICIES */}
            {activeTab === 'billing' && (
              <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-1">
                    Monthly Rent & Dues Policies
                  </h3>
                  <p className="text-xs text-gray-500">
                    Automate fee schedule, late fines, and collection terms across all registered rooms.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Rent Due Day</label>
                    <input
                      type="number"
                      min={1}
                      max={28}
                      value={formData.billingPolicy.rentDueDay}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          billingPolicy: { ...formData.billingPolicy, rentDueDay: Number(e.target.value) },
                        })
                      }
                      className="w-full text-xs font-bold border border-gray-300 rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">Day of each month invoices are issued.</p>
                  </div>

                  <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Grace Period (Days)</label>
                    <input
                      type="number"
                      min={0}
                      max={15}
                      value={formData.billingPolicy.graceDays}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          billingPolicy: { ...formData.billingPolicy, graceDays: Number(e.target.value) },
                        })
                      }
                      className="w-full text-xs font-bold border border-gray-300 rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">Days before late fine begins accumulating.</p>
                  </div>

                  <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Late Fine (₹ / Day)</label>
                    <input
                      type="number"
                      min={0}
                      value={formData.billingPolicy.lateFinePerDay}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          billingPolicy: { ...formData.billingPolicy, lateFinePerDay: Number(e.target.value) },
                        })
                      }
                      className="w-full text-xs font-bold border border-gray-300 rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">Daily penalty on past-due rent balances.</p>
                  </div>

                  <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Security Deposit (Months)</label>
                    <input
                      type="number"
                      min={0}
                      max={6}
                      value={formData.billingPolicy.securityDepositMonths}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          billingPolicy: { ...formData.billingPolicy, securityDepositMonths: Number(e.target.value) },
                        })
                      }
                      className="w-full text-xs font-bold border border-gray-300 rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">Standard refundable caution deposit.</p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold text-blue-900">Manage Subscription Plans & Tier Amounts</span>
                  </div>
                  <Link href="/owner/finance" className="text-xs font-bold text-blue-700 hover:underline">
                    Open Finance Ledger &rarr;
                  </Link>
                </div>
              </div>
            )}

            {/* TAB 5: AUTOMATED NOTIFICATIONS */}
            {activeTab === 'notifications' && (
              <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-1">
                    Automated Parent & Resident Alerts
                  </h3>
                  <p className="text-xs text-gray-500">
                    Configure real-time automated triggers for SMS, email notifications, and gate access logs.
                  </p>
                </div>

                <div className="space-y-3">
                  {[
                    {
                      key: 'curfewBreachSms',
                      title: 'Automated Parent Curfew SMS Alerts',
                      desc: 'Sends instant SMS to parent contact whenever resident exceeds curfew grace threshold.',
                    },
                    {
                      key: 'rentDueEmail',
                      title: 'Automated Rent Due Reminders',
                      desc: 'Sends polite email reminders 3 days prior to monthly due date with payment link.',
                    },
                    {
                      key: 'gatePassNotification',
                      title: 'Gate Pass Approval Notifications',
                      desc: 'Notifies resident instantly when leave request or late gate pass is granted by warden.',
                    },
                    {
                      key: 'maintenanceUpdates',
                      title: 'Maintenance Ticket Status Updates',
                      desc: 'Notifies student as work orders move from assigned to in-progress and resolved.',
                    },
                  ].map((item) => {
                    const enabled = (formData.notifications as any)[item.key];
                    return (
                      <div
                        key={item.key}
                        className="p-4 rounded-xl border border-gray-200 flex items-center justify-between gap-4 hover:border-gray-300 transition-colors"
                      >
                        <div>
                          <p className="text-xs font-bold text-gray-900">{item.title}</p>
                          <p className="text-[11px] text-gray-500 mt-0.5">{item.desc}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setFormData({
                              ...formData,
                              notifications: { ...formData.notifications, [item.key]: !enabled },
                            })
                          }
                          className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors shrink-0 ${
                            enabled ? 'bg-blue-600 justify-end' : 'bg-gray-300 justify-start'
                          }`}
                        >
                          <span className="w-4 h-4 rounded-full bg-white shadow-xs" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 6: SECURITY & OWNER ACCOUNT */}
            {activeTab === 'account' && (
              <div className="max-w-xl bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-1">
                    Owner Account & Security
                  </h3>
                  <p className="text-xs text-gray-500">
                    Update your console credentials and account password.
                  </p>
                </div>

                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Current Password</label>
                    <input
                      type="password"
                      required
                      value={passwords.currentPassword}
                      onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
                      className="w-full text-xs border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">New Password</label>
                    <input
                      type="password"
                      required
                      value={passwords.newPassword}
                      onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                      className="w-full text-xs border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Confirm New Password</label>
                    <input
                      type="password"
                      required
                      value={passwords.confirmPassword}
                      onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                      className="w-full text-xs border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                  >
                    Update Owner Password
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
