'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import { useOwnerHostel } from '../../../contexts/OwnerHostelContext';
import api from '../../../services/api';
import { MapPin, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

function toDateString(d: Date) {
  return d.toISOString().slice(0, 10);
}
function addDays(dateStr: string, delta: number) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + delta);
  return toDateString(d);
}
function daysBetween(from: string, to: string) {
  const a = new Date(from + 'T12:00:00').getTime();
  const b = new Date(to + 'T12:00:00').getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000)) + 1;
}
function isToday(dateStr: string) {
  return dateStr === toDateString(new Date());
}
function formatRangeLabel(from: string, to: string) {
  if (from === to) {
    return new Date(from + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }
  return `${new Date(from + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${new Date(to + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

export default function AttendanceCheckPage() {
  const { user } = useAuth();
  const { selectedHostel } = useOwnerHostel();
  const router = useRouter();
  const today = toDateString(new Date());
  const [dateFrom, setDateFrom] = useState<string>(() => today);
  const [dateTo, setDateTo] = useState<string>(() => today);
  const [dailyAttendance, setDailyAttendance] = useState<{ date: string; students: { name: string; email: string; studentNumber: string; totalMinutesInside: number; totalTimeFormatted: string }[] }[]>([]);
  const [loadingDaily, setLoadingDaily] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'owner') {
      router.replace('/login');
      return;
    }
  }, [user, router]);

  const loadDailyAttendance = async () => {
    if (!dateFrom || !dateTo) return;
    setLoadingDaily(true);
    try {
      const response = await api.getDailyAttendance({
        hostelId: selectedHostel || undefined,
        from: dateFrom,
        to: dateTo,
      });
      setDailyAttendance(response?.data ?? []);
    } catch (error: any) {
      console.error('Failed to load daily attendance:', error);
      setDailyAttendance([]);
    } finally {
      setLoadingDaily(false);
    }
  };

  useEffect(() => {
    if (selectedHostel && dateFrom && dateTo) loadDailyAttendance();
  }, [selectedHostel, dateFrom, dateTo]);

  const rangeDays = daysBetween(dateFrom, dateTo);
  const goPrev = () => {
    setDateFrom((f) => addDays(f, -rangeDays));
    setDateTo((t) => addDays(t, -rangeDays));
  };
  const goNext = () => {
    setDateFrom((f) => addDays(f, rangeDays));
    setDateTo((t) => addDays(t, rangeDays));
  };
  const setToday = () => {
    setDateFrom(today);
    setDateTo(today);
  };
  const canGoNext = dateTo < today;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MapPin className="w-6 h-6 text-red-600" />
            Attendance
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Time in hostel per student by day. Students with no record for the day show 0m.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Time in hostel (by day)</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={goPrev}
                disabled={loadingDaily}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                aria-label="Previous period"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <span className="min-w-[200px] text-center text-sm font-medium text-gray-700 flex items-center justify-center gap-1">
                <Calendar className="w-4 h-4 text-gray-500" />
                {formatRangeLabel(dateFrom, dateTo)}
              </span>
              <button
                type="button"
                onClick={goNext}
                disabled={loadingDaily || !canGoNext}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Next period"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
              <button
                type="button"
                onClick={setToday}
                disabled={loadingDaily || (dateFrom === today && dateTo === today)}
                className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-gray-700"
              >
                Today
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <span>From</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <span>To</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
              />
            </label>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Total time each student was present in the hostel. Time is saved when they check out or when location updates mark them outside.
          </p>
          {!selectedHostel ? (
            <p className="text-gray-500 text-sm">Select a hostel to see students and their time in hostel for the selected range.</p>
          ) : loadingDaily ? (
            <p className="text-gray-500 text-sm">Loading...</p>
          ) : dailyAttendance.length === 0 ? (
            <p className="text-gray-500 text-sm">No data for this range.</p>
          ) : (
            <div className="space-y-6">
              {dailyAttendance.map((day) => (
                <div key={day.date}>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    {new Date(day.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </h3>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total time in hostel</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {(day.students ?? []).map((s: any, i: number) => (
                            <tr key={s.studentId?._id ?? s.studentId ?? s.email ?? i}>
                              <td className="px-4 py-2 text-sm font-medium text-gray-900">{s.name || '—'}</td>
                              <td className="px-4 py-2 text-sm text-gray-600">{s.email || '—'}</td>
                              <td className="px-4 py-2 text-sm text-gray-900">{s.totalTimeFormatted || '0m'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
