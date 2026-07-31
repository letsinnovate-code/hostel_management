'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, isOwnerUser } from '../../../contexts/AuthContext';
import { useOwnerHostel } from '../../../contexts/OwnerHostelContext';
import api from '../../../services/api';
import { LogIn, LogOut, ChevronLeft, ChevronRight, Calendar, Filter } from 'lucide-react';

function toDateString(d: Date) {
  return d.toISOString().slice(0, 10);
}
function addDays(dateStr: string, delta: number) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + delta);
  return toDateString(d);
}
function formatTime(date: string | Date) {
  if (!date) return '—';
  const d = new Date(date);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
}

/** Minutes since midnight (0–24*60) for time-of-day comparison. */
function minutesSinceMidnight(date: string | Date): number {
  const d = new Date(date);
  return d.getHours() * 60 + d.getMinutes();
}

function parseTimeToMinutes(hhmm: string): number {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return -1;
  const [h, m] = hhmm.split(':').map(Number);
  if (h < 0 || h > 23 || m < 0 || m > 59) return -1;
  return h * 60 + m;
}

const CLUB_IN_OUT_MINUTES = 2;

type GateEvent = {
  time: string;
  type: 'in' | 'out';
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentNumber: string;
};

/** Single row: one event or merged in→out within CLUB_IN_OUT_MINUTES */
type GateRow =
  | { kind: 'single'; time: string; type: 'in' | 'out'; studentId: string; studentName: string; studentEmail: string; studentNumber: string }
  | { kind: 'inout'; inTime: string; outTime: string; studentId: string; studentName: string; studentEmail: string; studentNumber: string };

function buildGateRows(events: GateEvent[]): GateRow[] {
  const rows: GateRow[] = [];
  const ms = CLUB_IN_OUT_MINUTES * 60 * 1000;
  let i = 0;
  while (i < events.length) {
    const cur = events[i];
    const next = events[i + 1];
    if (
      cur.type === 'in' &&
      next &&
      next.type === 'out' &&
      next.studentId === cur.studentId &&
      new Date(next.time).getTime() - new Date(cur.time).getTime() <= ms
    ) {
      rows.push({
        kind: 'inout',
        inTime: cur.time,
        outTime: next.time,
        studentId: cur.studentId,
        studentName: cur.studentName,
        studentEmail: cur.studentEmail,
        studentNumber: cur.studentNumber,
      });
      i += 2;
    } else {
      rows.push({
        kind: 'single',
        time: cur.time,
        type: cur.type,
        studentId: cur.studentId,
        studentName: cur.studentName,
        studentEmail: cur.studentEmail,
        studentNumber: cur.studentNumber,
      });
      i += 1;
    }
  }
  return rows;
}

export default function GateLogsPage() {
  const { user } = useAuth();
  const { selectedHostel } = useOwnerHostel();
  const router = useRouter();
  const today = toDateString(new Date());
  const [dateFrom, setDateFrom] = useState<string>(() => today);
  const [dateTo, setDateTo] = useState<string>(() => today);
  const [events, setEvents] = useState<GateEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'all' | 'in' | 'out'>('all');
  const [timeFrom, setTimeFrom] = useState<string>('');
  const [timeTo, setTimeTo] = useState<string>('');

  useEffect(() => {
    if (!user || !isOwnerUser(user)) {
      router.replace('/login');
      return;
    }
  }, [user, router]);

  const loadGateLogs = async () => {
    if (!dateFrom || !dateTo) return;
    setLoading(true);
    try {
      const res = await api.getGateLogs({
        hostelId: selectedHostel || undefined,
        from: dateFrom,
        to: dateTo,
      });
      setEvents(Array.isArray(res?.data?.events) ? res.data.events : []);
    } catch (e) {
      console.error('Failed to load gate logs', e);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGateLogs();
  }, [dateFrom, dateTo, selectedHostel]);

  const goPrev = () => {
    setDateFrom((f) => addDays(f, -1));
    setDateTo((t) => addDays(t, -1));
  };
  const goNext = () => {
    setDateFrom((f) => addDays(f, 1));
    setDateTo((t) => addDays(t, 1));
  };
  const setToday = () => {
    setDateFrom(today);
    setDateTo(today);
  };
  const canGoNext = dateTo < today;
  const isTodayRange = dateFrom === today && dateTo === today;

  const allRows = buildGateRows(events);
  const filteredRows = allRows.filter((row) => {
    if (typeFilter === 'in') {
      if (row.kind === 'single' && row.type === 'out') return false;
    } else if (typeFilter === 'out') {
      if (row.kind === 'single' && row.type === 'in') return false;
    }
    const fromMin = parseTimeToMinutes(timeFrom);
    const toMin = parseTimeToMinutes(timeTo);
    if (fromMin >= 0 && toMin >= 0) {
      const rowTime = row.kind === 'inout' ? row.inTime : row.time;
      const min = minutesSinceMidnight(rowTime);
      if (fromMin <= toMin) {
        if (min < fromMin || min > toMin) return false;
      } else {
        if (min < fromMin && min > toMin) return false;
      }
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 shadow-sm">
        <Link href="/owner/dashboard" className="p-2 rounded-lg hover:bg-gray-100 text-gray-600" aria-label="Back">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">Gate logs</h1>
          <p className="text-sm text-gray-500">Check-in and check-out by time</p>
        </div>
      </header>

      <main className="p-6 mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={goPrev}
                disabled={loading}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50"
                aria-label="Previous day"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <span className="min-w-[200px] text-center text-sm font-medium text-gray-700 flex items-center justify-center gap-1">
                <Calendar className="w-4 h-4 text-gray-500" />
                {dateFrom === dateTo
                  ? new Date(dateFrom + 'T12:00:00').toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : `${new Date(dateFrom + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${new Date(dateTo + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`}
              </span>
              <button
                type="button"
                onClick={goNext}
                disabled={loading || !canGoNext}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Next day"
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
            <div className="flex flex-wrap items-center gap-4 border-l border-gray-200 pl-4">
              <span className="flex items-center gap-1.5 text-sm font-medium text-gray-600">
                <Filter className="w-4 h-4" />
                Filter
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-500">Type:</span>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as 'all' | 'in' | 'out')}
                  className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white"
                >
                  <option value="all">All (IN & OUT)</option>
                  <option value="in">IN only</option>
                  <option value="out">OUT only</option>
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-500">Time of day:</span>
                <input
                  type="time"
                  value={timeFrom}
                  onChange={(e) => setTimeFrom(e.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-28"
                  title="From time (e.g. 06:00)"
                />
                <span className="text-gray-400">–</span>
                <input
                  type="time"
                  value={timeTo}
                  onChange={(e) => setTimeTo(e.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-28"
                  title="To time (e.g. 22:00)"
                />
                {(timeFrom || timeTo) && (
                  <button
                    type="button"
                    onClick={() => { setTimeFrom(''); setTimeTo(''); }}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Clear time
                  </button>
                )}
              </div>
            </div>
          </div>

          {!selectedHostel ? (
            <div className="p-8 text-center text-gray-500">
              Select a hostel to view gate logs.
            </div>
          ) : loading ? (
            <div className="p-12 text-center text-gray-500">Loading...</div>
          ) : events.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <LogIn className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="font-medium">No check-ins or check-outs on this date</p>
              <p className="text-sm mt-1">Logs will appear when students check in or out.</p>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Filter className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="font-medium">No events match the current filters</p>
              <p className="text-sm mt-1">Try changing type or time of day.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Time
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Student
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">
                      Email
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredRows.map((row, i) => (
                    <tr key={row.kind === 'inout' ? `inout-${row.inTime}-${row.studentId}-${i}` : `single-${row.time}-${row.studentId}-${row.type}-${i}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                        {row.kind === 'inout'
                          ? `${formatTime(row.inTime)} – ${formatTime(row.outTime)}`
                          : formatTime(row.time)}
                      </td>
                      <td className="px-4 py-3">
                        {row.kind === 'inout' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
                            <LogIn className="w-3.5 h-3.5" />
                            IN
                            <span className="opacity-70">→</span>
                            <LogOut className="w-3.5 h-3.5" />
                            OUT
                          </span>
                        ) : row.type === 'in' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <LogIn className="w-3.5 h-3.5" />
                            IN
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                            <LogOut className="w-3.5 h-3.5" />
                            OUT
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        <Link
                          href={`/owner/students/${row.studentId}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {row.studentName || '—'}
                        </Link>
                        {row.studentNumber ? (
                          <span className="block text-xs text-gray-500 font-normal">{row.studentNumber}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">
                        {row.studentEmail || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {events.length > 0 && (
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-sm text-gray-500">
              {filteredRows.length === events.length
                ? `${events.length} event${events.length !== 1 ? 's' : ''} (sorted by time)`
                : `${filteredRows.length} of ${events.length} event${events.length !== 1 ? 's' : ''} shown (filters applied)`}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
