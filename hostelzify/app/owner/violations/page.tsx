'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, isOwnerUser } from '../../../contexts/AuthContext';
import { useOwnerHostel } from '../../../contexts/OwnerHostelContext';
import api from '../../../services/api';
import Link from 'next/link';
import { AlertCircle, User, ChevronRight, ChevronLeft, Calendar } from 'lucide-react';

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
function formatRangeLabel(from: string, to: string) {
  if (from === to) {
    return new Date(from + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }
  return `${new Date(from + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${new Date(to + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

function formatViolationType(type: string) {
  const labels: Record<string, string> = {
    'improper-checkout': 'Left without checking out',
    'curfew': 'Curfew breach',
    'late-entry': 'Late entry',
    'unauthorized-visitor': 'Unauthorized visitor',
    'noise': 'Noise',
    'damage': 'Damage',
    'other': 'Other',
  };
  return labels[type] || type?.replace(/-/g, ' ') || 'Violation';
}

function formatViolationTime(date: string | Date) {
  if (!date) return '—';
  const d = new Date(date);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function getStudentId(v: any): string | null {
  if (!v?.studentId) return null;
  return typeof v.studentId === 'object' ? v.studentId._id : v.studentId;
}

function getStudentName(v: any): string {
  if (!v?.studentId) return 'Unknown';
  return typeof v.studentId === 'object' ? v.studentId.name : 'Student';
}

function dedupeViolations(violations: any[]): any[] {
  const seen = new Set<string>();
  return violations.filter((v) => {
    const studentId = getStudentId(v) ?? '';
    const type = v?.violationType ?? '';
    const createdAt = v?.createdAt ? new Date(v.createdAt).getTime() : 0;
    const key = `${studentId}|${type}|${Math.floor(createdAt / 60000)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function groupViolationsByDay(violations: any[]): { date: string; list: any[] }[] {
  const byDay: Record<string, any[]> = {};
  for (const v of violations) {
    const dateStr = v?.createdAt ? toDateString(new Date(v.createdAt)) : '';
    if (!dateStr) continue;
    if (!byDay[dateStr]) byDay[dateStr] = [];
    byDay[dateStr].push(v);
  }
  return Object.keys(byDay)
    .sort()
    .reverse()
    .map((date) => ({ date, list: byDay[date] }));
}

export default function OwnerViolationsPage() {
  const { user } = useAuth();
  const { selectedHostel } = useOwnerHostel();
  const router = useRouter();
  const today = toDateString(new Date());
  const [dateFrom, setDateFrom] = useState<string>(() => today);
  const [dateTo, setDateTo] = useState<string>(() => today);
  const [violations, setViolations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !isOwnerUser(user)) {
      router.replace('/login');
      return;
    }
  }, [user, router]);

  const loadViolations = async () => {
    setLoading(true);
    try {
      const res = await api.getRecentViolations(selectedHostel || undefined, 500, dateFrom, dateTo);
      const raw = Array.isArray(res?.data) ? res.data : [];
      setViolations(dedupeViolations(raw));
    } catch (error: any) {
      console.error('Failed to load violations:', error);
      setViolations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (dateFrom && dateTo) loadViolations();
  }, [dateFrom, dateTo, selectedHostel]);

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
  const isTodayRange = dateFrom === today && dateTo === today;

  const byDay = groupViolationsByDay(violations);
  const totalCount = violations.length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="w-6 h-6 text-red-600" />
            <h1 className="text-2xl font-bold text-gray-900">All Violations</h1>
          </div>
          <p className="text-sm text-gray-600">View and manage violation records by day</p>
        </div>
      </div>

      <div className="p-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {/* Date range controls */}
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={loading}
                  className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50"
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
                  disabled={loading || !canGoNext}
                  className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Next period"
                >
                  <ChevronRight className="w-5 h-5 text-gray-600" />
                </button>
                <button
                  type="button"
                  onClick={setToday}
                  disabled={loading || isTodayRange}
                  className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-gray-700"
                >
                  Today
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-4">
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
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto" />
              <p className="text-gray-600 mt-4">Loading violations...</p>
            </div>
          ) : totalCount === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <AlertCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="font-medium">No violations in this range</p>
              <p className="text-sm mt-1">Try a different date range or check back later.</p>
              <Link
                href="/owner/dashboard"
                className="inline-flex items-center gap-1 mt-4 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Back to dashboard
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <>
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-sm text-gray-500">
                Showing {totalCount} violation{totalCount !== 1 ? 's' : ''} in {byDay.length} day{byDay.length !== 1 ? 's' : ''}
              </div>
              <div className="divide-y divide-gray-200">
                {byDay.map(({ date, list }) => (
                  <div key={date}>
                    <h3 className="px-4 py-3 text-sm font-semibold text-gray-800 bg-gray-50 sticky top-0 z-10">
                      {new Date(date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                      <span className="ml-2 text-gray-500 font-normal">({list.length})</span>
                    </h3>
                    <ul className="divide-y divide-gray-100">
                      {list.map((v: any) => {
                        const studentId = getStudentId(v);
                        const studentName = getStudentName(v);
                        const description = v.description?.trim() || '—';
                        const content = (
                          <>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                                  {formatViolationType(v.violationType)}
                                </span>
                                <span className="text-xs text-gray-500">{formatViolationTime(v.createdAt)}</span>
                              </div>
                              {description && description !== '—' && (
                                <p className="text-sm text-gray-600 mt-1 line-clamp-2">{description}</p>
                              )}
                              <div className="mt-2 flex items-center gap-2 text-sm">
                                <User className="w-4 h-4 text-gray-400 shrink-0" />
                                <span className={`font-medium truncate ${studentId ? 'text-gray-900 group-hover:text-blue-600' : 'text-gray-700'}`}>
                                  {studentName}
                                </span>
                                {studentId && <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 shrink-0" />}
                              </div>
                            </div>
                            {studentId && (
                              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded border border-blue-200 shrink-0">
                                View student
                              </span>
                            )}
                          </>
                        );
                        return (
                          <li key={v._id}>
                            {studentId ? (
                              <Link
                                href={`/owner/students/${studentId}`}
                                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 hover:bg-gray-50 transition-colors group"
                              >
                                {content}
                              </Link>
                            ) : (
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4">{content}</div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
