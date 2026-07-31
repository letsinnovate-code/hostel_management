'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../contexts/AuthContext';
import StudentLayout from '../../../components/StudentLayout';
import api from '../../../services/api';
import { UtensilsCrossed, Clock, Loader2, MessageSquare } from 'lucide-react';

function formatTime(t: string) {
  if (!t) return '';
  const [h, m] = String(t).split(':');
  const hour = parseInt(h, 10);
  const min = m ? parseInt(m, 10) : 0;
  const am = hour < 12;
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${min.toString().padStart(2, '0')} ${am ? 'AM' : 'PM'}`;
}

const MEAL_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
};

export default function StudentMessPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [schedule, setSchedule] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== 'student') {
      router.replace('/login');
      return;
    }
    (async () => {
      try {
        const data = await api.getMessSchedule();
        setSchedule(Array.isArray(data) ? data : []);
      } catch {
        setSchedule([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, router]);

  return (
    <StudentLayout>
      <div className="min-h-screen bg-gray-50">
        <div className="p-6 max-w-4xl mx-auto">
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Mess & Food</h1>
              <p className="text-sm text-gray-600 mt-1">Meal timings and menu for your hostel</p>
            </div>
            <Link
              href="/student/mess-feedback"
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              Give Mess Feedback
            </Link>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : schedule.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <UtensilsCrossed className="w-14 h-14 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No schedule yet</h3>
              <p className="text-gray-500">Your hostel has not added mess timings. Check back later.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {schedule.map((item) => (
                <div
                  key={item._id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <UtensilsCrossed className="w-5 h-5 text-orange-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 capitalize">
                      {item.title || MEAL_LABELS[item.mealType] || item.mealType}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                    <Clock className="w-4 h-4" />
                    <span>{formatTime(item.startTime)} – {formatTime(item.endTime)}</span>
                  </div>
                  {item.items && item.items.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-gray-500 uppercase mb-1">Served</p>
                      <p className="text-sm text-gray-700">{item.items.join(' • ')}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </StudentLayout>
  );
}
