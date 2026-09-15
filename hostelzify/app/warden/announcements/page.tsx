'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import {
  Megaphone,
  Bell,
  AlertOctagon,
  AlertTriangle,
  Send,
  Plus,
  RefreshCw,
  Search,
  Filter,
  Users,
  Building,
  Calendar,
  Clock,
  CheckCircle2,
  X,
  Shield,
  Radio,
  FileText,
  Flame,
  Info,
} from 'lucide-react';

interface AnnouncementItem {
  _id: string;
  title: string;
  message: string;
  type: string;
  priority: 'low' | 'medium' | 'high' | 'urgent' | 'emergency';
  targetAudience: 'all' | 'students' | 'staff' | string;
  createdBy?: {
    _id: string;
    name: string;
    role: string;
  } | any;
  createdAt: string;
}

export default function WardenAnnouncementsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Filters
  const [activeTab, setActiveTab] = useState<'all' | 'general' | 'emergency' | 'students' | 'staff'>('all');
  const [search, setSearch] = useState('');

  // Compose Modal State
  const [composeModal, setComposeModal] = useState({
    open: false,
    title: '',
    message: '',
    type: 'announcement',
    targetAudience: 'all',
    priority: 'medium',
  });

  // Emergency Quick Alert Modal
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);
  const [emergencyAlert, setEmergencyAlert] = useState({
    title: 'CRITICAL SAFETY ALERT',
    message: '',
  });

  useEffect(() => {
    if (!user) return;
    const role = Array.isArray(user.role) ? user.role[0] : user.role;
    if (!['warden', 'owner', 'superadmin'].includes(role as string)) {
      router.replace('/login');
    }
  }, [user, router]);

  const loadAnnouncements = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await api.getWardenAnnouncements();
      if (res?.success) {
        setAnnouncements(res.data || []);
      }
    } catch (err: any) {
      console.error('Failed to load announcements:', err);
      toast.error(err.message || 'Failed to fetch announcements');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  const handleComposeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeModal.title.trim() || !composeModal.message.trim()) {
      toast.error('Title and message are required');
      return;
    }
    setSubmitting(true);
    try {
      await api.createWardenAnnouncement({
        title: composeModal.title,
        message: composeModal.message,
        type: composeModal.type,
        targetAudience: composeModal.targetAudience,
        priority: composeModal.priority,
      });
      toast.success('Announcement broadcasted successfully');
      setComposeModal({
        open: false,
        title: '',
        message: '',
        type: 'announcement',
        targetAudience: 'all',
        priority: 'medium',
      });
      loadAnnouncements(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to broadcast announcement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmergencySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emergencyAlert.message.trim()) {
      toast.error('Please enter the emergency message');
      return;
    }
    setSubmitting(true);
    try {
      await api.createWardenAnnouncement({
        title: emergencyAlert.title,
        message: emergencyAlert.message,
        type: 'emergency',
        targetAudience: 'all',
        priority: 'urgent',
      });
      toast.success('EMERGENCY BROADCAST SENT TO ALL RESIDENTS & STAFF');
      setEmergencyModalOpen(false);
      setEmergencyAlert({ title: 'CRITICAL SAFETY ALERT', message: '' });
      loadAnnouncements(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send emergency broadcast');
    } finally {
      setSubmitting(false);
    }
  };

  // Metrics
  const metrics = useMemo(() => {
    const total = announcements.length;
    const emergencyCount = announcements.filter((a) => a.type === 'emergency' || a.priority === 'urgent' || a.priority === 'emergency').length;
    const studentCount = announcements.filter((a) => a.targetAudience === 'students' || a.type === 'student').length;
    const generalCount = announcements.filter((a) => a.targetAudience === 'all' || a.type === 'announcement').length;
    return { total, emergencyCount, studentCount, generalCount };
  }, [announcements]);

  // Filtered List
  const filteredAnnouncements = useMemo(() => {
    return announcements.filter((a) => {
      // Tab filter
      if (activeTab === 'general' && !(a.type === 'announcement' || a.targetAudience === 'all')) return false;
      if (activeTab === 'emergency' && !(a.type === 'emergency' || a.priority === 'urgent' || a.priority === 'emergency')) return false;
      if (activeTab === 'students' && !(a.targetAudience === 'students' || a.type === 'student')) return false;
      if (activeTab === 'staff' && !(a.targetAudience === 'staff')) return false;

      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesTitle = a.title?.toLowerCase().includes(q);
        const matchesMsg = a.message?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesMsg) return false;
      }
      return true;
    });
  }, [announcements, activeTab, search]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
                Hostel Broadcast Center
              </span>
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Building className="w-3.5 h-3.5" />
                {user?.hostelName || 'Resident Notice Board'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
              Announcements & Notifications
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              Broadcast official notices, student instructions, curfew warnings, and immediate emergency notifications.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            <button
              onClick={() => loadAnnouncements(true)}
              disabled={refreshing}
              className="p-2.5 text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors flex items-center justify-center disabled:opacity-50"
              title="Refresh notices"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-purple-600' : ''}`} />
            </button>

            <button
              onClick={() => setEmergencyModalOpen(true)}
              className="px-3.5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-colors flex items-center gap-1.5 shrink-0 animate-pulse"
            >
              <AlertOctagon className="w-4 h-4" />
              Emergency SOS Alert
            </button>

            <button
              onClick={() => setComposeModal({ ...composeModal, open: true })}
              className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-colors flex items-center gap-2 shrink-0"
            >
              <Plus className="w-4 h-4" />
              Broadcast Notice
            </button>
          </div>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6">
          <div className="bg-purple-50/70 border border-purple-200/80 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-purple-800">Total Notices</span>
              <Megaphone className="w-4 h-4 text-purple-600" />
            </div>
            <p className="text-2xl font-black text-purple-950 mt-1">{metrics.total}</p>
            <p className="text-[11px] text-purple-700 mt-0.5">Broadcasted across hostel</p>
          </div>

          <div className="bg-rose-50/70 border border-rose-200/80 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-rose-800">Emergency Alerts</span>
              <AlertOctagon className="w-4 h-4 text-rose-600" />
            </div>
            <p className="text-2xl font-black text-rose-950 mt-1">{metrics.emergencyCount}</p>
            <p className="text-[11px] text-rose-700 mt-0.5">High-priority urgent dispatches</p>
          </div>

          <div className="bg-sky-50/70 border border-sky-200/80 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-sky-800">Student Notices</span>
              <Users className="w-4 h-4 text-sky-600" />
            </div>
            <p className="text-2xl font-black text-sky-950 mt-1">{metrics.studentCount}</p>
            <p className="text-[11px] text-sky-700 mt-0.5">Student targeted circulars</p>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-gray-700">Hostel Notices</span>
              <Radio className="w-4 h-4 text-gray-500" />
            </div>
            <p className="text-2xl font-black text-gray-900 mt-1">{metrics.generalCount}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">General campus notifications</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b md:border-b-0 border-gray-100">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                activeTab === 'all'
                  ? 'bg-gray-900 text-white shadow-xs'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              All Broadcasts ({announcements.length})
            </button>

            <button
              onClick={() => setActiveTab('general')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                activeTab === 'general'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              General Hostel Notices
            </button>

            <button
              onClick={() => setActiveTab('emergency')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                activeTab === 'emergency'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Emergency & Urgent
              {metrics.emergencyCount > 0 && (
                <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-rose-200 text-rose-900 font-black">
                  {metrics.emergencyCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('students')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                activeTab === 'students'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Students Only
            </button>

            <button
              onClick={() => setActiveTab('staff')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                activeTab === 'staff'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Staff Only
            </button>
          </div>

          <div className="relative sm:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search notices..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        {/* Announcements Stream */}
        {loading ? (
          <div className="py-20 text-center">
            <div className="inline-block animate-spin text-purple-600 mb-3">
              <RefreshCw className="w-8 h-8" />
            </div>
            <p className="text-sm font-semibold text-gray-700">Loading notices...</p>
          </div>
        ) : filteredAnnouncements.length === 0 ? (
          <div className="py-16 text-center bg-gray-50/60 rounded-xl border border-dashed border-gray-200">
            <Megaphone className="w-10 h-10 text-gray-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-gray-800">No Announcements Found</p>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              {search || activeTab !== 'all'
                ? 'No notices match your current filters.'
                : 'No announcements have been published yet. Click "Broadcast Notice" to post one.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAnnouncements.map((a) => {
              const isEmergency = a.type === 'emergency' || a.priority === 'urgent' || a.priority === 'emergency';
              const isHigh = a.priority === 'high';

              return (
                <div
                  key={a._id}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                    isEmergency
                      ? 'bg-rose-50/70 border-rose-200 shadow-xs'
                      : isHigh
                      ? 'bg-amber-50/50 border-amber-200 shadow-2xs'
                      : 'bg-white border-gray-200/80 hover:border-gray-300'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                          isEmergency
                            ? 'bg-rose-600 text-white'
                            : isHigh
                            ? 'bg-amber-500 text-white'
                            : 'bg-purple-100 text-purple-700'
                        }`}
                      >
                        {isEmergency ? (
                          <AlertOctagon className="w-5 h-5" />
                        ) : isHigh ? (
                          <AlertTriangle className="w-5 h-5" />
                        ) : (
                          <Megaphone className="w-4 h-4" />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm sm:text-base font-bold text-gray-900">{a.title}</h3>

                          {/* Priority Badge */}
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              isEmergency
                                ? 'bg-rose-600 text-white'
                                : isHigh
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {a.priority || 'normal'}
                          </span>

                          {/* Audience Badge */}
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                            Audience: {a.targetAudience === 'all' ? 'All Residents' : a.targetAudience}
                          </span>

                          {/* Notice Type */}
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600 capitalize">
                            {a.type || 'Notice'}
                          </span>
                        </div>

                        <p className="text-xs sm:text-sm text-gray-700 mt-2 whitespace-pre-wrap leading-relaxed">
                          {a.message}
                        </p>
                      </div>
                    </div>

                    <div className="text-left sm:text-right shrink-0 mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 sm:border-none">
                      <div className="text-[11px] text-gray-500 flex items-center sm:justify-end gap-1">
                        <Clock className="w-3 h-3 text-gray-400" />
                        <span>
                          {new Date(a.createdAt).toLocaleString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        By: <span className="text-gray-600 font-medium">{a.createdBy?.name || 'Warden'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Compose Announcement */}
      {composeModal.open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-gray-200 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Megaphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Broadcast Notice</h3>
                  <p className="text-xs text-gray-500">Publish announcements to hostel residents and staff</p>
                </div>
              </div>
              <button
                onClick={() => setComposeModal({ ...composeModal, open: false })}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleComposeSubmit} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Notice Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mandatory Room Inspection / Mess Timings Update"
                  value={composeModal.title}
                  onChange={(e) => setComposeModal({ ...composeModal, title: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Notice Category</label>
                  <select
                    value={composeModal.type}
                    onChange={(e) => setComposeModal({ ...composeModal, type: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="announcement">General Announcement</option>
                    <option value="student">Student Instruction</option>
                    <option value="curfew">Curfew Reminder</option>
                    <option value="maintenance">Maintenance Alert</option>
                    <option value="mess">Mess & Food Notice</option>
                    <option value="emergency">Safety Alert</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Target Audience</label>
                  <select
                    value={composeModal.targetAudience}
                    onChange={(e) => setComposeModal({ ...composeModal, targetAudience: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="all">All Hostel Residents</option>
                    <option value="students">Students Only</option>
                    <option value="staff">Staff Only (Cleaners, Supervisors)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Priority</label>
                  <select
                    value={composeModal.priority}
                    onChange={(e) => setComposeModal({ ...composeModal, priority: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium / Standard</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Message Body *</label>
                <textarea
                  required
                  rows={5}
                  placeholder="Write notice details, instructions, dates, guidelines, or consequences..."
                  value={composeModal.message}
                  onChange={(e) => setComposeModal({ ...composeModal, message: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setComposeModal({ ...composeModal, open: false })}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  {submitting ? 'Broadcasting...' : 'Broadcast Notice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Emergency Immediate Broadcast */}
      {emergencyModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border-2 border-rose-500">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 animate-bounce">
                <AlertOctagon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-rose-900">EMERGENCY BROADCAST</h3>
                <p className="text-xs text-rose-600">Immediate push notification to all residents & staff</p>
              </div>
            </div>

            <form onSubmit={handleEmergencySubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Emergency Title</label>
                <input
                  type="text"
                  required
                  value={emergencyAlert.title}
                  onChange={(e) => setEmergencyAlert({ ...emergencyAlert, title: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-rose-50/50 border border-rose-300 rounded-xl font-bold text-rose-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Emergency Instructions *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="e.g. Fire alarm triggered in Block B. All residents assemble immediately at ground assembly area..."
                  value={emergencyAlert.message}
                  onChange={(e) => setEmergencyAlert({ ...emergencyAlert, message: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEmergencyModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Dispatching...' : 'Dispatch Emergency Alert'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
