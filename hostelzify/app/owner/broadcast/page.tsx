'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import { useOwnerHostel } from '../../../contexts/OwnerHostelContext';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import {
  Bell,
  Plus,
  Edit,
  Trash2,
  Mail,
  Calendar,
  Users,
  AlertCircle,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  X,
  Filter,
  Search,
  Send,
} from 'lucide-react';

export default function OwnerBroadcast() {
  const { user } = useAuth();
  const { selectedHostel } = useOwnerHostel();
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingNotification, setEditingNotification] = useState<any>(null);
  const [filters, setFilters] = useState({
    type: 'announcement',
    priority: '',
    targetAudience: '',
    search: '',
  });

  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'announcement',
    targetAudience: 'all',
    priority: 'medium',
    expiresAt: '',
    sendEmail: true,
    hostelId: '',
  });

  useEffect(() => {
    if (!user || user.role !== 'owner') {
      router.replace('/login');
      return;
    }
  }, [user, router]);

  useEffect(() => {
    if (selectedHostel) {
      loadNotifications();
    }
  }, [selectedHostel, filters]);

  const loadNotifications = async () => {
    if (!selectedHostel) return;
    setLoading(true);
    try {
      const params: any = {};
      if (filters.type) params.type = filters.type;
      if (filters.priority) params.priority = filters.priority;
      if (filters.targetAudience) params.targetAudience = filters.targetAudience;

      const response = await api.getOwnerNotifications(selectedHostel as string, params);
      let filteredNotifications = response.data || [];

      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredNotifications = filteredNotifications.filter(
          (n: any) =>
            n.title?.toLowerCase().includes(searchLower) ||
            n.message?.toLowerCase().includes(searchLower)
        );
      }

      setNotifications(filteredNotifications);
    } catch (error: any) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingNotification) {
        await api.updateNotification(editingNotification._id, {
          title: formData.title,
          message: formData.message,
          type: formData.type,
          priority: formData.priority,
          expiresAt: formData.expiresAt || null,
        });
      } else {
        await api.createNotification({
          ...formData,
          hostelId: selectedHostel as string,
        });
      }
      setShowModal(false);
      setEditingNotification(null);
      setFormData({
        title: '',
        message: '',
        type: 'announcement',
        targetAudience: 'all',
        priority: 'medium',
        expiresAt: '',
        sendEmail: true,
        hostelId: selectedHostel as string,
      });
      toast.success(editingNotification ? 'Notice updated successfully' : 'Notice published to board');
      loadNotifications();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save notification');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this notice?')) return;
    try {
      await api.deleteNotification(id);
      toast.success('Notice deleted');
      loadNotifications();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete notification');
    }
  };

  const handleEdit = (notification: any) => {
    setEditingNotification(notification);
    setFormData({
      title: notification.title,
      message: notification.message,
      type: notification.type,
      targetAudience: notification.targetAudience,
      priority: notification.priority,
      expiresAt: notification.expiresAt ? new Date(notification.expiresAt).toISOString().split('T')[0] : '',
      sendEmail: false,
      hostelId: notification.hostelId,
    });
    setShowModal(true);
  };

  const handleSendReminder = async (notification: any) => {
    const id = notification._id;
    setSendingReminderId(id);
    try {
      const result = await api.sendNotificationReminder(id);
      const count = result?.pushSent ?? 0;
      toast.success(`Push reminder sent to ${count} device(s).`);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to send reminder');
    } finally {
      setSendingReminderId(null);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'emergency':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'alert':
        return <AlertCircle className="w-5 h-5 text-orange-600" />;
      case 'reminder':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      default:
        return <FileText className="w-5 h-5 text-blue-600" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
        <div className="p-6">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Notice Board</h1>
              <p className="text-sm text-gray-600 mt-1">Create and manage notices with optional email notifications to students and staff.</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setEditingNotification(null);
                  setFormData({
                    title: '',
                    message: '',
                    type: 'announcement',
                    targetAudience: 'all',
                    priority: 'medium',
                    expiresAt: '',
                    sendEmail: true,
                    hostelId: selectedHostel,
                  });
                  setShowModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span>New Notice</span>
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search notices..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <select
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Types</option>
                <option value="announcement">Announcement</option>
                <option value="alert">Alert</option>
                <option value="reminder">Reminder</option>
                <option value="emergency">Emergency</option>
              </select>
              <select
                value={filters.priority}
                onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Priorities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
              <select
                value={filters.targetAudience}
                onChange={(e) => setFilters({ ...filters, targetAudience: e.target.value })}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Audiences</option>
                <option value="all">All</option>
                <option value="students">Students</option>
                <option value="staff">Staff</option>
                <option value="wardens">Wardens</option>
              </select>
              <button
                onClick={() => setFilters({ type: 'announcement', priority: '', targetAudience: '', search: '' })}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>

          {/* Notifications List */}
          {loading ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <p className="text-gray-600">Loading notices...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <Bell className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-lg mb-2">No notices yet</p>
              <p className="text-gray-500 text-sm">Create your first notice to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {notifications.map((notification) => (
                <div
                  key={notification._id}
                  className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        {getTypeIcon(notification.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{notification.title}</h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(notification.priority)}`}>
                            {notification.priority}
                          </span>
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                            {notification.type}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-3 whitespace-pre-wrap">{notification.message}</p>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            <span>{notification.targetAudience || 'all'}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>{new Date(notification.createdAt).toLocaleDateString()}</span>
                          </div>
                          {notification.expiresAt && (
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              <span>Expires: {new Date(notification.expiresAt).toLocaleDateString()}</span>
                            </div>
                          )}
                          {notification.recipients && (
                            <div className="flex items-center gap-1">
                              <Mail className="w-4 h-4" />
                              <span>{notification.recipients.length} recipients</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSendReminder(notification)}
                        disabled={sendingReminderId === notification._id}
                        className="p-2 text-emerald-600 hover:bg-emerald-50 rounded transition-colors disabled:opacity-50"
                        title="Send push reminder"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleEdit(notification)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Edit notice"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(notification._id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete notice"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Create/Edit Modal */}
          {showModal && (
            <div 
              className="fixed inset-0 bg-opacity-5 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => {
                setShowModal(false);
                setEditingNotification(null);
              }}
            >
              <div 
                className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">
                    {editingNotification ? 'Edit Notice' : 'Create New Notice'}
                  </h2>
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setEditingNotification(null);
                    }}
                    className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                    aria-label="Close modal"
                  >
                    <X className="w-6 h-6 text-gray-500" />
                  </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter notice title"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Message *</label>
                    <textarea
                      required
                      rows={6}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter notice message"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                      <select
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="announcement">Announcement</option>
                        <option value="alert">Alert</option>
                        <option value="reminder">Reminder</option>
                        <option value="emergency">Emergency</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                      <select
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Target Audience</label>
                      <select
                        value={formData.targetAudience}
                        onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="all">All</option>
                        <option value="students">Students</option>
                        <option value="staff">Staff</option>
                        <option value="wardens">Wardens</option>
                        <option value="cleaners">Cleaners</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Expires At (Optional)</label>
                      <input
                        type="datetime-local"
                        value={formData.expiresAt}
                        onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  {!editingNotification && (
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="sendEmail"
                        checked={formData.sendEmail}
                        onChange={(e) => setFormData({ ...formData, sendEmail: e.target.checked })}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="sendEmail" className="text-sm font-medium text-gray-700">
                        Send email notifications to recipients
                      </label>
                    </div>
                  )}
                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => {
                        setShowModal(false);
                        setEditingNotification(null);
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
                    >
                      {loading ? 'Saving...' : editingNotification ? 'Update Notice' : 'Create Notice'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
  );
}
