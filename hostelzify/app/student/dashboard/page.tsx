'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import Link from 'next/link';
import StudentLayout from '../../../components/StudentLayout';
import NotificationDriver from '../../../components/NotificationDriver';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../../../components/chart';
import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from 'recharts';
import StudentDashboardMap from '../../../components/StudentDashboardMap';
import {
  MapPin,
  User,
  Shield,
  FileText,
  AlertCircle,
  Bell,
  UtensilsCrossed,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  TrendingUp,
  BarChart3,
  Activity,
  Timer,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function StudentDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<any>(null);
  const [onboardingSummary, setOnboardingSummary] = useState<any>(null);
  const [boundary, setBoundary] = useState<any>(null);
  const [currentLocationForMap, setCurrentLocationForMap] = useState<{ latitude: number; longitude: number } | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [violations, setViolations] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'daily' | 'week' | 'month' | 'year'>('week');

  useEffect(() => {
    if (!user || user.role !== 'student') {
      router.replace('/login');
      return;
    }
    loadData();
  }, [user, router]);

  useEffect(() => {
    if (user) {
      loadAnalytics();
    }
  }, [analyticsPeriod, user]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Send current location asynchronously in background without blocking dashboard initial render
      if (typeof window !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (p) => {
            try {
              const loc = { latitude: p.coords.latitude, longitude: p.coords.longitude };
              await api.updateLocation(loc);
              setCurrentLocationForMap(loc);
            } catch (_) {}
          },
          () => {},
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
        );
      }
      const [statusRes, notificationsRes, permissionsRes, violationsRes, analyticsRes, boundaryRes, onboardingRes] = await Promise.all([
        api.getStatus().catch(() => ({ data: null })),
        api.getNotifications().catch(() => ({ data: [] })),
        api.getPermissionRequests().catch(() => ({ data: [] })),
        api.getViolationHistory().catch(() => ({ data: [] })),
        api.getAttendanceAnalytics(analyticsPeriod).catch(() => ({ data: null })),
        api.getHostelBoundary().catch(() => null),
        api.getStudentOnboardingState().catch(() => ({ data: null })),
      ]);

      let statusData = statusRes?.data ? {
        ...statusRes.data,
        status: statusRes.data.status === 'inside' ? 'checked in' :
          statusRes.data.status === 'outside' ? 'checked out' :
            statusRes.data.status || 'outside'
      } : null;

      setStatus(statusData);
      setBoundary(boundaryRes?.data ?? boundaryRes ?? null);
      setNotifications(notificationsRes?.data?.slice(0, 5) || []);
      setPermissions(permissionsRes?.data?.slice(0, 3) || []);
      setViolations(violationsRes?.data?.slice(0, 3) || []);
      setAnalytics(analyticsRes?.data || null);
      if (onboardingRes?.data) {
        setOnboardingSummary(onboardingRes.data);
      }
    } catch (error: any) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const response = await api.getAttendanceAnalytics(analyticsPeriod);
      setAnalytics(response.data);
    } catch (error: any) {
      console.error('Failed to load analytics:', error);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const getCurrentLocation = (): Promise<{ latitude: number; longitude: number; accuracy?: number; timestamp?: string }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date(position.timestamp || Date.now()).toISOString(),
          };
          console.log('Current location captured:', coords);
          resolve(coords);
        },
        (error) => {
          console.error('Geolocation error:', error);
          const errorMsg = error.code === 1
            ? 'Location access denied. Please enable GPS permissions in your browser.'
            : error.code === 2
            ? 'Location unavailable. Please ensure your device GPS is turned on.'
            : `Location acquisition error: ${error.message}`;
          reject(new Error(errorMsg));
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }
      );
    });
  };

  const handleCheckIn = async () => {
    try {
      const location = await getCurrentLocation();
      await api.checkIn(location);
      toast.success('Checked in successfully');
      // Reload data and analytics in parallel
      Promise.all([loadData(), loadAnalytics()]);
    } catch (error: any) {
      toast.error(error.message || 'Failed to check in');
    }
  };

  const handleCheckOut = async () => {
    try {
      const location = await getCurrentLocation();
      await api.checkOut(location);
      toast.success('Checked out successfully');
      // Reload data and analytics in parallel
      Promise.all([loadData(), loadAnalytics()]);
    } catch (error: any) {
      toast.error(error.message || 'Failed to check out');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'checked in':
      case 'present':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'checked out':
      case 'absent':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getPermissionStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return 'text-green-600';
      case 'rejected':
        return 'text-red-600';
      case 'pending':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  const formatTime = (hour: number) => {
    const h = Math.floor(hour);
    const m = Math.floor((hour - h) * 60);
    const period = h >= 12 ? 'PM' : 'AM';
    const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${displayHour}:${m.toString().padStart(2, '0')} ${period}`;
  };

  const formatDuration = (hours: number) => {
    if (hours < 1) {
      return `${Math.round(hours * 60)} min`;
    }
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const featureSections = [
    {
      title: 'Profile & Settings',
      color: '#2196F3',
      icon: User,
      items: [
        { label: 'My Profile', href: '/student/profile', description: 'View and manage your profile' },
      ],
    },
    {
      title: 'Permissions & Requests',
      color: '#FF9800',
      icon: Shield,
      items: [
        { label: 'Permission Requests', href: '/student/permissions', description: 'Request permissions and track status' },
        { label: 'Visitor Requests', href: '/student/visitors', description: 'Request visitor access' },
      ],
    },
    {
      title: 'Complaints & Support',
      color: '#f44336',
      icon: FileText,
      items: [
        { label: 'Submit Complaint', href: '/student/complaints', description: 'Submit and track complaints' },
        { label: 'Violation History', href: '/student/violations', description: 'View your violation records' },
      ],
    },
    {
      title: 'Notifications',
      color: '#9C27B0',
      icon: Bell,
      items: [
        { label: 'Notice Board', href: '/student/notifications', description: 'View announcements and notices' },
      ],
    },
    {
      title: 'Services',
      color: '#795548',
      icon: UtensilsCrossed,
      items: [
        { label: 'Mess Feedback', href: '/student/mess-feedback', description: 'Submit mess feedback' },
      ],
    },
  ];

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
        <div className="p-6 w-full">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Dashboard
            </h1>
            <p className="text-gray-600 mt-2">Welcome back, {user?.name || 'Student'}</p>
          </div>

          {/* Onboarding Incomplete Banner */}
          {onboardingSummary && onboardingSummary.status !== 'ONBOARDING_COMPLETED' && (
            <div className="mb-6 p-5 rounded-2xl bg-gradient-to-r from-indigo-900 via-blue-900 to-slate-900 text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                  <Sparkles className="w-4 h-4" />
                  Hostel Onboarding In Progress ({onboardingSummary.progressPercentage || 0}%)
                </div>
                <h3 className="text-base font-bold text-white">Complete Your Resident Onboarding</h3>
                <p className="text-xs text-blue-200">
                  Status:{' '}
                  <span className="font-semibold text-white">
                    {onboardingSummary.status?.replace(/_/g, ' ')}
                  </span>
                  . Complete profile, upload documents, and accept hostel agreement.
                </p>
              </div>

              <Link
                href="/student/onboarding"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold text-xs rounded-xl shadow-md transition-all whitespace-nowrap"
              >
                Continue Onboarding
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          {loading && !status ? (
            <div className="bg-white rounded-2xl shadow-lg p-12 text-center mb-6">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600"></div>
              <p className="text-gray-600 mt-4">Loading dashboard...</p>
            </div>
          ) : (
            <>
              {/* Status & Check-in Card */}
              {status && (
                <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border border-gray-100 overflow-hidden relative">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full -mr-32 -mt-32 opacity-50"></div>
                  <div className="relative">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                          <MapPin className="w-7 h-7 text-white" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-gray-900">Presence Status</h2>
                          <p className="text-sm text-gray-600">Current check-in status</p>
                        </div>
                      </div>
                      <span className={`px-4 py-2 rounded-full text-sm font-semibold border-2 ${getStatusColor(status.status || 'Unknown')}`}>
                        {status.status || 'Unknown'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                        <p className="text-sm text-gray-600 font-medium">Room</p>
                        <p className="text-xl font-bold text-gray-900 mt-2">
                          {status.room ? `Room ${status.room}` : 'N/A'}
                        </p>
                      </div>
                      <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                        <p className="text-sm text-gray-600 font-medium">Hostel</p>
                        <p className="text-xl font-bold text-gray-900 mt-2">{status.hostel || 'N/A'}</p>
                      </div>
                      <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                        <p className="text-sm text-gray-600 font-medium">Last Check-in</p>
                        <p className="text-lg font-semibold text-gray-900 mt-2">
                          {status.lastCheckIn
                            ? new Date(status.lastCheckIn).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                              : status.checkInTime
                              ? new Date(status.checkInTime).toLocaleString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                              : 'N/A'}
                        </p>
                      </div>
                    </div>
                    {(status.status === 'Unknown' || status.status === 'unknown' || !status.status) && (
                      <p className="text-sm text-amber-700 mb-2">Your position is unknown. See map below and ensure you are inside the hostel boundary, then try Check In.</p>
                    )}
                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Your location & hostel boundary</p>
                      <StudentDashboardMap boundary={boundary} currentLocation={currentLocationForMap} height="220px" />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={handleCheckIn}
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 transition-all font-semibold shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                      >
                        <CheckCircle className="w-5 h-5" />
                        Check In
                      </button>
                      <button
                        onClick={handleCheckOut}
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition-all font-semibold shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                      >
                        <XCircle className="w-5 h-5" />
                        Check Out
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Attendance Analytics */}
              <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border border-gray-100">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                      <BarChart3 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">Check-in/Check-out Analytics</h2>
                      <p className="text-sm text-gray-600">Your attendance statistics</p>
                    </div>
                  </div>
                  <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
                    {(['daily', 'week', 'month', 'year'] as const).map((period) => (
                      <button
                        key={period}
                        onClick={() => setAnalyticsPeriod(period)}
                        disabled={analyticsLoading}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${analyticsPeriod === period
                          ? 'bg-white text-indigo-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                          } ${analyticsLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {period.charAt(0).toUpperCase() + period.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {analyticsLoading && !analytics ? (
                  <div className="py-12 text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    <p className="text-gray-600 mt-2">Loading analytics...</p>
                  </div>
                ) : analytics ? (
                  <>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                      <div className="p-5 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                        <div className="flex items-center justify-between mb-2">
                          <Activity className="w-5 h-5 text-blue-600" />
                        </div>
                        <p className="text-sm text-gray-600 font-medium mb-1">Total Check-ins</p>
                        <p className="text-3xl font-bold text-gray-900">{analytics.totalCheckIns || 0}</p>
                      </div>
                      <div className="p-5 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200">
                        <div className="flex items-center justify-between mb-2">
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        </div>
                        <p className="text-sm text-gray-600 font-medium mb-1">Total Check-outs</p>
                        <p className="text-3xl font-bold text-gray-900">{analytics.totalCheckOuts || 0}</p>
                      </div>
                      <div className="p-5 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200">
                        <div className="flex items-center justify-between mb-2">
                          <Clock className="w-5 h-5 text-purple-600" />
                        </div>
                        <p className="text-sm text-gray-600 font-medium mb-1">Avg Check-in Time</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {analytics.avgCheckInHour ? formatTime(analytics.avgCheckInHour) : 'N/A'}
                        </p>
                      </div>
                      <div className="p-5 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl border border-orange-200">
                        <div className="flex items-center justify-between mb-2">
                          <Timer className="w-5 h-5 text-orange-600" />
                        </div>
                        <p className="text-sm text-gray-600 font-medium mb-1">Avg Duration</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {analytics.avgDurationHours ? formatDuration(analytics.avgDurationHours) : 'N/A'}
                        </p>
                      </div>
                    </div>

                    {/* Period Chart */}
                    {analytics.periodData && analytics.periodData.length > 0 && (
                      <div className="mt-6">
                        <ChartContainer
                          config={{
                            checkIns: {
                              label: "Check-ins",
                              color: "#3b82f6",
                            },
                            checkOuts: {
                              label: "Check-outs",
                              color: "#10b981",
                            },
                          }}
                          className="h-[300px] w-full"
                        >
                          <BarChart
                            data={analytics.periodData.map((item: any) => {
                              let dateLabel = '';
                              const date = new Date(item.date);

                              if (analyticsPeriod === 'daily') {
                                dateLabel = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                              } else if (analyticsPeriod === 'week') {
                                dateLabel = date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
                              } else if (analyticsPeriod === 'month') {
                                const weekEnd = new Date(date);
                                weekEnd.setDate(weekEnd.getDate() + 6);
                                dateLabel = `${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - ${weekEnd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
                              } else if (analyticsPeriod === 'year') {
                                dateLabel = date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
                              }

                              return {
                                date: dateLabel,
                                checkIns: item.checkIns,
                                checkOuts: item.checkOuts,
                              };
                            })}
                          >
                            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                            <XAxis
                              dataKey="date"
                              tickLine={false}
                              axisLine={false}
                              tickMargin={8}
                              className="text-xs text-gray-600"
                              angle={analyticsPeriod === 'month' ? -45 : 0}
                              textAnchor={analyticsPeriod === 'month' ? 'end' : 'middle'}
                              height={analyticsPeriod === 'month' ? 60 : 30}
                            />
                            <YAxis
                              tickLine={false}
                              axisLine={false}
                              tickMargin={8}
                              className="text-xs text-gray-600"
                            />
                            <ChartTooltip
                              cursor={false}
                              content={<ChartTooltipContent indicator="dot" />}
                            />
                            <Bar
                              dataKey="checkIns"
                              fill="rgb(59, 130, 246)"
                              radius={[4, 4, 0, 0]}
                              className="fill-blue-500"
                            />
                            <Bar
                              dataKey="checkOuts"
                              fill="rgb(16, 185, 129)"
                              radius={[4, 4, 0, 0]}
                              className="fill-green-500"
                            />
                          </BarChart>
                        </ChartContainer>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="py-8 text-center text-gray-500">
                    <p>No analytics data available</p>
                  </div>
                )}
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-blue-500 hover:shadow-lg transition-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 font-medium">Pending Permissions</p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">
                        {permissions.filter((p) => p.status?.toLowerCase() === 'pending').length}
                      </p>
                    </div>
                    <Shield className="w-10 h-10 text-blue-500" />
                  </div>
                </div>
                <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-purple-500 hover:shadow-lg transition-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 font-medium">Unread Notifications</p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">
                        {notifications.filter((n) => !n.read).length}
                      </p>
                    </div>
                    <Bell className="w-10 h-10 text-purple-500" />
                  </div>
                </div>
                <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-red-500 hover:shadow-lg transition-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 font-medium">Violations</p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">{violations.length}</p>
                    </div>
                    <AlertCircle className="w-10 h-10 text-red-500" />
                  </div>
                </div>
                <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-green-500 hover:shadow-lg transition-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 font-medium">Active Complaints</p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">0</p>
                    </div>
                    <FileText className="w-10 h-10 text-green-500" />
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Recent Notifications */}
                {notifications.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
                    <div className="px-6 py-4 bg-gradient-to-r from-purple-500 to-purple-600">
                      <div className="flex items-center gap-3">
                        <Bell className="w-5 h-5 text-white" />
                        <h2 className="text-lg font-semibold text-white">Recent Notifications</h2>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="space-y-3">
                        {notifications.map((notification, index) => (
                          <div
                            key={index}
                            className="p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all hover:shadow-md"
                          >
                            <div className="flex items-start gap-3">
                              <NotificationDriver
                                type={notification.type || 'announcement'}
                                priority={notification.priority}
                                size="sm"
                              />
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-gray-900">{notification.title || 'Notification'}</p>
                                <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                  {notification.message || notification.content}
                                </p>
                                {notification.createdAt && (
                                  <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(notification.createdAt).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <Link
                        href="/student/notifications"
                        className="block mt-4 text-center text-sm text-purple-600 hover:text-purple-700 font-semibold"
                      >
                        View All Notifications →
                      </Link>
                    </div>
                  </div>
                )}

                {/* Recent Permissions */}
                {permissions.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
                    <div className="px-6 py-4 bg-gradient-to-r from-orange-500 to-orange-600">
                      <div className="flex items-center gap-3">
                        <Shield className="w-5 h-5 text-white" />
                        <h2 className="text-lg font-semibold text-white">Recent Permissions</h2>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="space-y-3">
                        {permissions.map((permission) => (
                          <div
                            key={permission.id}
                            className="p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all hover:shadow-md"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-semibold text-gray-900">{permission.type || 'Permission Request'}</p>
                              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${getPermissionStatusColor(permission.status)} bg-opacity-10`}>
                                {permission.status || 'Pending'}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600">{permission.reason || permission.description}</p>
                            {permission.createdAt && (
                              <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(permission.createdAt).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                      <Link
                        href="/student/permissions"
                        className="block mt-4 text-center text-sm text-orange-600 hover:text-orange-700 font-semibold"
                      >
                        View All Permissions →
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Feature Sections */}
              <div className="space-y-6">
                {featureSections.map((section, index) => {
                  const IconComponent = section.icon;
                  return (
                    <div key={index} className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
                      <div
                        className="px-6 py-4 border-b border-gray-200"
                        style={{ borderLeft: `4px solid ${section.color}` }}
                      >
                        <div className="flex items-center gap-3">
                          <IconComponent className="w-5 h-5" style={{ color: section.color }} />
                          <h2 className="text-lg font-semibold text-gray-900">{section.title}</h2>
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {section.items.map((item, itemIndex) => (
                            <Link
                              key={itemIndex}
                              href={item.href}
                              className="block p-4 border border-gray-200 rounded-xl hover:bg-gradient-to-br hover:from-gray-50 hover:to-white hover:border-blue-500 transition-all hover:shadow-md group"
                            >
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <span className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                                    {item.label}
                                  </span>
                                  <p className="text-sm text-gray-500 mt-1">{item.description}</p>
                                </div>
                                <span className="text-gray-400 group-hover:text-blue-600 ml-2 transition-colors">→</span>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
