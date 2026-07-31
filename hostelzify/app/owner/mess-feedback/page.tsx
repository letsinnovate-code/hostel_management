'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, isOwnerUser } from '../../../contexts/AuthContext';
import { useOwnerHostel } from '../../../contexts/OwnerHostelContext';
import api from '../../../services/api';
import { UtensilsCrossed, Star, User, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function OwnerMessFeedbackPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { selectedHostel } = useOwnerHostel();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !isOwnerUser(user)) {
      router.replace('/login');
      return;
    }
  }, [user, router]);

  useEffect(() => {
    if (!user) return;
    loadFeedback();
  }, [user, selectedHostel]);

  const loadFeedback = async () => {
    setLoading(true);
    try {
      const data = await api.getMessFeedback(selectedHostel || undefined, 100);
      setList(Array.isArray(data) ? data : []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto px-4 md:px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/owner/dashboard"
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
              aria-label="Back"
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">Mess Feedback</h1>
              <p className="text-sm text-gray-600 mt-0.5">Student feedback on mess and food</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto px-4 md:px-6 py-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-orange-500 border-t-transparent" />
          </div>
        ) : list.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <UtensilsCrossed className="w-14 h-14 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No mess feedback yet</h3>
            <p className="text-gray-500">Student feedback will appear here once they submit from the app or student portal.</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {list.map((f: any) => {
              const studentName = f.raisedBy?.name ?? 'Student';
              const dateStr = f.createdAt
                ? new Date(f.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                : '—';
              const meal = f.mealType || (f.title && f.title.replace('Mess Feedback (', '').replace(')', '')) || null;
              return (
                <li key={f._id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-4">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      {f.rating != null && (
                        <span className="inline-flex items-center gap-0.5 text-amber-500">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <Star key={i} className={`w-5 h-5 ${i <= f.rating ? 'fill-current' : 'opacity-30'}`} />
                          ))}
                        </span>
                      )}
                      <span className="text-sm text-gray-500">{dateStr}</span>
                      {meal && (
                        <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-orange-100 text-orange-800">{meal}</span>
                      )}
                    </div>
                    {f.description && f.description !== 'No comment' && (
                      <p className="text-gray-700 mt-2">{f.description}</p>
                    )}
                    <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                      <User className="w-4 h-4 shrink-0" />
                      <span className="font-medium text-gray-900">{studentName}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
