'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import StudentLayout from '../../../components/StudentLayout';
import NotificationDriver from '../../../components/NotificationDriver';
import {
  Bell,
  Calendar,
  FileText,
  AlertCircle,
  Clock,
  Mail,
  CheckCircle,
  Filter,
  Search,
} from 'lucide-react';

export default function StudentNotifications() {
  const { user } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    type: '',
    priority: '',
    search: '',
  });

  useEffect(() => {
    if (!user || user.role !== 'student') {
      router.replace('/login');
      return;
    }
    loadNotifications();
  }, [user, router]);

  useEffect(() => {
    loadNotifications();
  }, [filters]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const response = await api.getNotifications();
      let filteredNotifications = response.data || [];

      // Apply filters
      if (filters.type) {
        filteredNotifications = filteredNotifications.filter((n: any) => n.type === filters.type);
      }
      if (filters.priority) {
        filteredNotifications = filteredNotifications.filter((n: any) => n.priority === filters.priority);
      }
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredNotifications = filteredNotifications.filter(
          (n: any) =>
            n.title?.toLowerCase().includes(searchLower) ||
            n.message?.toLowerCase().includes(searchLower)
        );
      }

      // Sort by priority and date
      filteredNotifications.sort((a: any, b: any) => {
        const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
        const priorityDiff = (priorityOrder[b.priority as keyof typeof priorityOrder] || 0) -
                            (priorityOrder[a.priority as keyof typeof priorityOrder] || 0);
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      setNotifications(filteredNotifications);
    } catch (error: any) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await api.markNotificationRead(notificationId);
      loadNotifications();
    } catch (error: any) {
      console.error('Failed to mark notification as read:', error);
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

  const isRead = (notification: any) => {
    if (!notification.isRead || !Array.isArray(notification.isRead)) return false;
    return notification.isRead.some((read: any) => read.userId?.toString() === user?.id);
  };

  const unreadCount = notifications.filter((n) => !isRead(n)).length;

  return (
    <StudentLayout>
      <div className="min-h-screen bg-gray-50">
        <div className="p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Notice Board</h1>
              <p className="text-sm text-gray-600 mt-1">
                View announcements and notices from your hostel
                {unreadCount > 0 && (
                  <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                    {unreadCount} new
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              <button
                onClick={() => setFilters({ type: '', priority: '', search: '' })}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>

          {loading ? (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <p className="text-gray-600">Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <Bell className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-lg mb-2">No notifications</p>
              <p className="text-gray-500 text-sm">You're all caught up!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {notifications.map((notification) => {
                const read = isRead(notification);
                return (
                  <div
                    key={notification._id || notification.id}
                    className={`bg-white rounded-2xl shadow-md p-6 hover:shadow-lg transition-all border border-gray-100 ${
                      !read ? 'border-l-4 border-blue-600 bg-blue-50/30' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-4 flex-1">
                        <NotificationDriver
                          type={notification.type || 'announcement'}
                          priority={notification.priority}
                          size="md"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <h3 className="text-lg font-bold text-gray-900">
                              {notification.title || 'Notification'}
                            </h3>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold border-2 ${getPriorityColor(notification.priority)}`}>
                              {notification.priority || 'medium'}
                            </span>
                            {!read && (
                              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-sm">
                                New
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mb-3 whitespace-pre-wrap">
                            {notification.message || notification.content || 'No content available'}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              <span>{new Date(notification.createdAt).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}</span>
                            </div>
                            {notification.expiresAt && (
                              <div className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                <span>Expires: {new Date(notification.expiresAt).toLocaleDateString()}</span>
                              </div>
                            )}
                            {notification.createdBy && (
                              <div className="flex items-center gap-1">
                                <span>By: {typeof notification.createdBy === 'object' ? notification.createdBy.name : 'Admin'}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    {!read && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <button
                          onClick={() => markAsRead(notification._id || notification.id)}
                          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Mark as read
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </StudentLayout>
  );
}

