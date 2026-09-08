'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import {
  Calendar,
  Clock,
  CheckCircle,
  Play,
  Square,
  Plus,
  RefreshCw,
  AlertCircle,
  CalendarDays,
  FileText,
  UserCheck,
} from 'lucide-react';
import { format } from 'date-fns';

export default function CleanerSchedulePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [schedule, setSchedule] = useState<any>(null);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [clocking, setClocking] = useState(false);
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [clockInTime, setClockInTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    type: 'sick',
    startDate: '',
    endDate: '',
    reason: '',
  });
  const [submittingLeave, setSubmittingLeave] = useState(false);

  useEffect(() => {
    if (!user || (user.role !== 'cleaner' && user.role !== 'supervisor' && !user.roles?.includes('cleaner'))) {
      router.replace('/login');
      return;
    }
    loadScheduleData();
  }, [user, router]);

  // Live timer when clocked in
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isClockedIn && clockInTime) {
      interval = setInterval(() => {
        const diff = Math.floor((new Date().getTime() - clockInTime.getTime()) / 1000);
        const hours = String(Math.floor(diff / 3600)).padStart(2, '0');
        const minutes = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
        const seconds = String(diff % 60).padStart(2, '0');
        setElapsedTime(`${hours}:${minutes}:${seconds}`);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isClockedIn, clockInTime]);

  const loadScheduleData = async () => {
    setLoading(true);
    try {
      const [schedRes, leavesRes] = await Promise.allSettled([
        api.getShiftSchedule(),
        api.getCleanerLeaveRequests(),
      ]);

      if (schedRes.status === 'fulfilled') {
        const data = (schedRes.value as any)?.data ?? schedRes.value;
        setSchedule(data);
      }
      if (leavesRes.status === 'fulfilled') {
        const data = (leavesRes.value as any)?.data ?? leavesRes.value;
        setLeaves(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Failed to load schedule data:', error);
      toast.error('Could not load shift information');
    } finally {
      setLoading(false);
    }
  };

  const handleClockToggle = async () => {
    setClocking(true);
    try {
      if (!isClockedIn) {
        await api.clockIn();
        setIsClockedIn(true);
        setClockInTime(new Date());
        toast.success('Clocked in! Shift timer started.');
      } else {
        await api.clockOut();
        setIsClockedIn(false);
        setClockInTime(null);
        setElapsedTime('00:00:00');
        toast.success('Clocked out! Shift logged successfully.');
      }
      loadScheduleData();
    } catch (error: any) {
      toast.error(error.message || 'Clock in/out failed');
    } finally {
      setClocking(false);
    }
  };

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveForm.startDate || !leaveForm.endDate || !leaveForm.reason.trim()) {
      toast.error('Please fill in all leave fields');
      return;
    }

    setSubmittingLeave(true);
    try {
      await api.createCleanerLeaveRequest(leaveForm);
      toast.success('Leave request submitted to supervisor!');
      setLeaveModalOpen(false);
      setLeaveForm({ type: 'sick', startDate: '', endDate: '', reason: '' });
      loadScheduleData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit leave request');
    } finally {
      setSubmittingLeave(false);
    }
  };

  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <CalendarDays className="w-7 h-7 text-blue-600" />
            Work Schedule & Attendance
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Log shift attendance, view assigned working hours, and request time off.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadScheduleData}
            disabled={loading}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setLeaveModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm transition-all shadow-blue-200"
          >
            <Plus className="w-4 h-4" />
            Apply Leave
          </button>
        </div>
      </div>

      {/* Clock In / Out Card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white ${
            isClockedIn ? 'bg-green-600 animate-pulse' : 'bg-gray-400'
          }`}>
            <Clock className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900">
                {isClockedIn ? 'Shift In Progress' : 'Ready for Shift'}
              </h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                isClockedIn ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
              }`}>
                {isClockedIn ? 'CLOCKED IN' : 'OFF DUTY'}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5 font-mono">
              Elapsed Time: <span className="font-bold text-gray-900">{elapsedTime}</span>
            </p>
          </div>
        </div>

        <button
          onClick={handleClockToggle}
          disabled={clocking}
          className={`px-6 py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all shadow-md ${
            isClockedIn
              ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'
              : 'bg-green-600 hover:bg-green-700 shadow-green-200'
          } disabled:opacity-50`}
        >
          {clocking ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              Logging...
            </>
          ) : isClockedIn ? (
            <>
              <Square className="w-5 h-5" />
              Clock Out (End Shift)
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              Clock In (Start Shift)
            </>
          )}
        </button>
      </div>

      {/* Weekly Schedule Grid */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          Weekly Shift Roster
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {DAYS.map((day, idx) => {
            const isToday = new Date().getDay() === (idx === 6 ? 0 : idx + 1);
            const isOff = idx === 6; // Sunday off
            return (
              <div
                key={day}
                className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 ${
                  isToday
                    ? 'bg-blue-50/70 border-blue-300 ring-2 ring-blue-500/20'
                    : isOff
                    ? 'bg-gray-50 border-gray-200 opacity-60'
                    : 'bg-white border-gray-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-500 uppercase">{day.slice(0, 3)}</span>
                    {isToday && (
                      <span className="text-[10px] bg-blue-600 text-white font-bold px-1.5 py-0.5 rounded">
                        Today
                      </span>
                    )}
                  </div>
                  <p className="font-semibold text-gray-900 text-sm mt-1">{day}</p>
                </div>

                <div className="text-xs space-y-1">
                  {isOff ? (
                    <span className="text-gray-400 font-medium">Weekly Off</span>
                  ) : (
                    <>
                      <p className="font-bold text-blue-700">08:00 - 16:00</p>
                      <p className="text-gray-500">Floors 1 & 2</p>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Leave Requests Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-600" />
              My Leave Requests
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Status of your submitted time-off requests.</p>
          </div>
          <button
            onClick={() => setLeaveModalOpen(true)}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            New Request
          </button>
        </div>

        {leaves.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No leave requests on record.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs font-semibold uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3">Leave Type</th>
                  <th className="px-5 py-3">Dates</th>
                  <th className="px-5 py-3">Reason</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leaves.map((leave, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-5 py-3.5 font-semibold text-gray-900 capitalize">{leave.type} Leave</td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs">
                      {leave.startDate && format(new Date(leave.startDate), 'dd MMM')} -{' '}
                      {leave.endDate && format(new Date(leave.endDate), 'dd MMM yyyy')}
                    </td>
                    <td className="px-5 py-3.5 text-gray-700">{leave.reason}</td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                        leave.status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : leave.status === 'rejected'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {leave.status || 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Leave Application Modal */}
      {leaveModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-900 text-lg">Apply for Leave</h3>
              <button
                onClick={() => setLeaveModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleApplyLeave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Leave Type
                </label>
                <select
                  value={leaveForm.type}
                  onChange={(e) => setLeaveForm({ ...leaveForm, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="sick">Sick Leave</option>
                  <option value="casual">Casual Leave</option>
                  <option value="emergency">Family Emergency</option>
                  <option value="unpaid">Unpaid Leave</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={leaveForm.startDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={leaveForm.endDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Reason for Leave
                </label>
                <textarea
                  rows={3}
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  required
                  placeholder="Explain why you are requesting leave..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setLeaveModalOpen(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingLeave}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {submittingLeave ? 'Submitting...' : 'Submit Leave'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
