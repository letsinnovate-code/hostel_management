'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import { useOwnerHostel } from '../../../contexts/OwnerHostelContext';
import api from '../../../services/api';
import { useToast } from '../../../components/Toast';
import { useConfirmModal } from '../../../components/ConfirmModal';
import {
  Plus,
  Edit,
  Trash2,
  Loader2,
  UtensilsCrossed,
  Clock,
  Calendar,
  Eye,
  X,
  Sprout,
} from 'lucide-react';

const MEAL_TYPES = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snacks', label: 'Snacks' },
];

const DAYS = [
  { value: null as number | null, label: 'Daily' },
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export interface MessSchedule {
  _id: string;
  mealType: string;
  title?: string;
  items?: string[];
  startTime: string;
  endTime: string;
  dayOfWeek?: number | null;
  active: boolean;
  order?: number;
}

function formatTime(t: string) {
  if (!t) return '';
  const [h, m] = String(t).split(':');
  const hour = parseInt(h, 10);
  const min = m ? parseInt(m, 10) : 0;
  const am = hour < 12;
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${min.toString().padStart(2, '0')} ${am ? 'AM' : 'PM'}`;
}

function parseTimeToAmPm(t: string): { hour12: number; minute: number; ampm: 'AM' | 'PM' } {
  const [h, m] = String(t || '07:00').split(':').map((x) => parseInt(x, 10));
  const hour24 = isNaN(h) ? 7 : Math.min(23, Math.max(0, h));
  const minute = isNaN(m) ? 0 : Math.min(59, Math.max(0, m));
  const ampm: 'AM' | 'PM' = hour24 < 12 ? 'AM' : 'PM';
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
  return { hour12, minute, ampm };
}

function amPmToTimeString(hour12: number, minute: number, ampm: 'AM' | 'PM'): string {
  const m = Math.min(59, Math.max(0, minute));
  const h24 = hour12 === 12 ? (ampm === 'AM' ? 0 : 12) : ampm === 'PM' ? hour12 + 12 : hour12;
  return `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => i);

export default function OwnerMessPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const { confirm } = useConfirmModal();
  const { hostels, selectedHostel: selectedHostelId } = useOwnerHostel();
  const [schedules, setSchedules] = useState<MessSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MessSchedule | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [form, setForm] = useState({
    mealType: 'breakfast',
    title: '',
    itemsText: '',
    startTime: '07:00',
    endTime: '09:00',
    dayOfWeek: null as number | null,
    active: true,
    order: 0,
  });

  useEffect(() => {
    if (!user || user.role !== 'owner') {
      router.replace('/login');
      return;
    }
  }, [user, router]);

  const loadSchedules = useCallback(() => {
    if (!selectedHostelId) return;
    setLoading(true);
    api
      .getMessSchedules(selectedHostelId)
      .then((data) => setSchedules(Array.isArray(data) ? data : []))
      .catch((e: any) => {
        showToast(e.message || 'Failed to load mess schedule', 'error');
        setSchedules([]);
      })
      .finally(() => setLoading(false));
  }, [selectedHostelId, showToast]);

  useEffect(() => {
    if (!selectedHostelId) return;
    loadSchedules();
  }, [selectedHostelId, loadSchedules]);

  const openAdd = () => {
    setEditing(null);
    setForm({
      mealType: 'breakfast',
      title: '',
      itemsText: '',
      startTime: '07:00',
      endTime: '09:00',
      dayOfWeek: null,
      active: true,
      order: schedules.length,
    });
    setModalOpen(true);
  };

  const openEdit = (s: MessSchedule) => {
    setEditing(s);
    setForm({
      mealType: s.mealType,
      title: s.title || '',
      itemsText: (s.items || []).join('\n'),
      startTime: s.startTime || '07:00',
      endTime: s.endTime || '09:00',
      dayOfWeek: s.dayOfWeek ?? null,
      active: s.active !== false,
      order: s.order ?? 0,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHostelId) return;
    const items = form.itemsText
      .split(/[\n,]+/)
      .map((x) => x.trim())
      .filter(Boolean);
    setSaving(true);
    try {
      if (editing?._id) {
        await api.updateMessSchedule(selectedHostelId, editing._id, {
          mealType: form.mealType,
          title: form.title || undefined,
          items,
          startTime: form.startTime,
          endTime: form.endTime,
          dayOfWeek: form.dayOfWeek,
          active: form.active,
          order: form.order,
        });
        showToast('Schedule updated successfully', 'success');
      } else {
        await api.createMessSchedule(selectedHostelId, {
          mealType: form.mealType,
          title: form.title || undefined,
          items,
          startTime: form.startTime,
          endTime: form.endTime,
          dayOfWeek: form.dayOfWeek,
          active: form.active,
          order: form.order,
        });
        showToast('Schedule added successfully', 'success');
      }
      setModalOpen(false);
      loadSchedules();
    } catch (e: any) {
      showToast(e.message || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSeed = async () => {
    if (!selectedHostelId) return;
    const ok = await confirm({
      title: 'Seed weekly schedule',
      message: 'This will replace all existing mess slots with a Sunday–Saturday plan (3 meals per day, Indian veg). Continue?',
      confirmText: 'Seed',
      cancelText: 'Cancel',
      confirmButtonClass: 'bg-green-600 hover:bg-green-700',
    });
    if (!ok) return;
    setSeeding(true);
    try {
      await api.seedMessSchedules(selectedHostelId);
      showToast('Weekly mess schedule seeded successfully', 'success');
      loadSchedules();
    } catch (e: any) {
      showToast(e.message || 'Failed to seed schedule', 'error');
    } finally {
      setSeeding(false);
    }
  };

  const handleDelete = async (s: MessSchedule) => {
    if (!selectedHostelId) return;
    const ok = await confirm({
      title: 'Delete meal slot',
      message: `Remove "${s.title || s.mealType}" (${s.startTime}–${s.endTime})? Students will no longer see this slot.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      confirmButtonClass: 'bg-red-600 hover:bg-red-700',
    });
    if (ok) {
      try {
        await api.deleteMessSchedule(selectedHostelId, s._id);
        showToast('Schedule deleted', 'success');
        loadSchedules();
      } catch (e: any) {
        showToast(e.message || 'Failed to delete', 'error');
      }
    }
  };

  const selectedHostelInfo = hostels.find((h: any) => (h._id || h.id) === selectedHostelId);
  const activeSchedules = schedules.filter((s) => s.active);

  // Group by day: null = "Daily", 0 = Sunday ... 6 = Saturday
  const dayOrder: (number | null)[] = [null, 0, 1, 2, 3, 4, 5, 6];
  const schedulesByDay = dayOrder.map((day) => ({
    day,
    label: day === null ? 'Daily (all days)' : DAYS.find((d) => d.value === day)?.label ?? `Day ${day}`,
    slots: schedules.filter((s) => (s.dayOfWeek ?? null) === day).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
  })).filter((g) => g.slots.length > 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto px-4 md:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Mess Schedule</h1>
              <p className="text-sm md:text-base text-gray-600 mt-1">
                Set meal timings and menu items students see in the app
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleSeed}
                disabled={seeding || !selectedHostelId}
                className="px-4 py-2 border border-green-600 text-green-700 rounded-lg hover:bg-green-50 flex items-center gap-2 disabled:opacity-50"
              >
                {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sprout className="w-4 h-4" />}
                Seed schedule
              </button>
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-gray-700"
              >
                <Eye className="w-4 h-4" />
                Student preview
              </button>
              <button
                type="button"
                onClick={openAdd}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add meal slot
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto px-4 md:px-6 py-6">
        {/* Hostel selector */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <UtensilsCrossed className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total slots</p>
                    <p className="text-xl font-semibold text-gray-900">{schedules.length}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Clock className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Active (visible to students)</p>
                    <p className="text-xl font-semibold text-gray-900">{activeSchedules.length}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Calendar className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Meal types</p>
                    <p className="text-xl font-semibold text-gray-900">
                      {[...new Set(schedules.map((s) => s.mealType))].length}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Day-wise schedule */}
            {schedules.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <UtensilsCrossed className="w-14 h-14 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No mess schedule yet</h3>
                <p className="text-gray-500 mb-4">Add meal timings and menu items so students can see when food is served.</p>
                <button
                  type="button"
                  onClick={openAdd}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  Add meal slot
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {schedulesByDay.map(({ day, label, slots }) => (
                  <div key={day ?? 'daily'} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                      <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-blue-600" />
                        {label}
                      </h3>
                    </div>
                    <div className="p-4">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {slots.map((s) => (
                          <div
                            key={s._id}
                            className="flex flex-col rounded-lg border border-gray-200 bg-gray-50/50 p-4"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-medium text-gray-900 capitalize">{s.title || s.mealType}</p>
                                <p className="text-sm text-gray-600 mt-0.5">
                                  {formatTime(s.startTime)} – {formatTime(s.endTime)}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {s.active ? (
                                  <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800">Active</span>
                                ) : (
                                  <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">Hidden</span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => openEdit(s)}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                                  aria-label="Edit"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(s)}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                                  aria-label="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            {s.items && s.items.length > 0 && (
                              <p className="text-sm text-gray-500 mt-2">
                                {s.items.join(', ')}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setModalOpen(false)} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">{editing ? 'Edit meal slot' : 'Add meal slot'}</h2>
                <button type="button" onClick={() => setModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Meal type</label>
                  <select
                    value={form.mealType}
                    onChange={(e) => setForm({ ...form, mealType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {MEAL_TYPES.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title (optional)</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. Breakfast"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start time</label>
                    <div className="flex flex-wrap gap-2 items-center">
                      <select
                        value={parseTimeToAmPm(form.startTime).hour12}
                        onChange={(e) => {
                          const { minute, ampm } = parseTimeToAmPm(form.startTime);
                          setForm({ ...form, startTime: amPmToTimeString(parseInt(e.target.value, 10), minute, ampm) });
                        }}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        {HOUR_OPTIONS.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                      <span className="text-gray-500">:</span>
                      <select
                        value={parseTimeToAmPm(form.startTime).minute}
                        onChange={(e) => {
                          const { hour12, ampm } = parseTimeToAmPm(form.startTime);
                          setForm({ ...form, startTime: amPmToTimeString(hour12, parseInt(e.target.value, 10), ampm) });
                        }}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        {MINUTE_OPTIONS.map((m) => (
                          <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                        ))}
                      </select>
                      <select
                        value={parseTimeToAmPm(form.startTime).ampm}
                        onChange={(e) => {
                          const { hour12, minute } = parseTimeToAmPm(form.startTime);
                          setForm({ ...form, startTime: amPmToTimeString(hour12, minute, e.target.value as 'AM' | 'PM') });
                        }}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End time</label>
                    <div className="flex flex-wrap gap-2 items-center">
                      <select
                        value={parseTimeToAmPm(form.endTime).hour12}
                        onChange={(e) => {
                          const { minute, ampm } = parseTimeToAmPm(form.endTime);
                          setForm({ ...form, endTime: amPmToTimeString(parseInt(e.target.value, 10), minute, ampm) });
                        }}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        {HOUR_OPTIONS.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                      <span className="text-gray-500">:</span>
                      <select
                        value={parseTimeToAmPm(form.endTime).minute}
                        onChange={(e) => {
                          const { hour12, ampm } = parseTimeToAmPm(form.endTime);
                          setForm({ ...form, endTime: amPmToTimeString(hour12, parseInt(e.target.value, 10), ampm) });
                        }}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        {MINUTE_OPTIONS.map((m) => (
                          <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                        ))}
                      </select>
                      <select
                        value={parseTimeToAmPm(form.endTime).ampm}
                        onChange={(e) => {
                          const { hour12, minute } = parseTimeToAmPm(form.endTime);
                          setForm({ ...form, endTime: amPmToTimeString(hour12, minute, e.target.value as 'AM' | 'PM') });
                        }}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Day of week</label>
                  <select
                    value={form.dayOfWeek ?? ''}
                    onChange={(e) => setForm({ ...form, dayOfWeek: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {DAYS.map((d) => (
                      <option key={d.label} value={d.value ?? ''}>{d.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Menu items (one per line or comma-separated)</label>
                  <textarea
                    value={form.itemsText}
                    onChange={(e) => setForm({ ...form, itemsText: e.target.value })}
                    placeholder="Rice, Dal, Curry"
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="active"
                    checked={form.active}
                    onChange={(e) => setForm({ ...form, active: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="active" className="text-sm text-gray-700">Visible to students</label>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {editing ? 'Update' : 'Add'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Student preview modal */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setPreviewOpen(false)} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">What students see</h2>
                <button type="button" onClick={() => setPreviewOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                {selectedHostelInfo?.name || 'This hostel'}: meal timings and menu in the Mess tab.
              </p>
              {activeSchedules.length === 0 ? (
                <p className="text-gray-500 text-sm">No active slots — students will see “No schedule yet”.</p>
              ) : (
                <div className="space-y-3">
                  {activeSchedules.map((s) => (
                    <div key={s._id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="font-medium text-gray-900 capitalize">{s.title || s.mealType}</p>
                      <p className="text-sm text-gray-600 mt-1">
                        {formatTime(s.startTime)} – {formatTime(s.endTime)}
                      </p>
                      {s.items && s.items.length > 0 && (
                        <p className="text-sm text-gray-500 mt-1">Served: {s.items.join(', ')}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
