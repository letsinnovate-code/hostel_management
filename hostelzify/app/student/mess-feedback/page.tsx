'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import StudentLayout from '../../../components/StudentLayout';
import api from '../../../services/api';
import { UtensilsCrossed, Star, Send } from 'lucide-react';

export default function StudentMessFeedback() {
  const { user } = useAuth();
  const router = useRouter();
  const [formData, setFormData] = useState({
    rating: 0,
    mealType: 'Lunch',
    quality: '',
    cleanliness: '',
    service: '',
    comments: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'student') {
      router.replace('/login');
      return;
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const parts = [formData.quality, formData.cleanliness, formData.service].filter(Boolean);
      const feedbackText = formData.comments || (parts.length > 0 ? parts.join('. ') : undefined);
      await api.submitMessFeedback({
        rating: formData.rating,
        feedback: feedbackText,
        mealType: formData.mealType,
      });
      alert('Feedback submitted successfully!');
      setFormData({
        rating: 0,
        mealType: 'Lunch',
        quality: '',
        cleanliness: '',
        service: '',
        comments: '',
      });
    } catch (error: any) {
      alert(error.message || 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <StudentLayout>
      <div className="min-h-screen bg-gray-50">
        <div className="p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Mess Feedback</h1>
            <p className="text-sm text-gray-600 mt-1">Share your feedback about the mess services</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-orange-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-orange-600 rounded-lg flex items-center justify-center">
                  <UtensilsCrossed className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Submit Feedback</h2>
                  <p className="text-sm text-gray-600">Help us improve our mess services</p>
                </div>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-6">
                {/* Meal */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Meal</label>
                  <select
                    value={formData.mealType}
                    onChange={(e) => setFormData({ ...formData, mealType: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="Breakfast">Breakfast</option>
                    <option value="Lunch">Lunch</option>
                    <option value="Dinner">Dinner</option>
                    <option value="Snacks">Snacks</option>
                  </select>
                </div>

                {/* Overall Rating */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Overall Rating</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFormData({ ...formData, rating: star })}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                          formData.rating >= star
                            ? 'bg-yellow-100 text-yellow-600'
                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        }`}
                      >
                        <Star className="w-5 h-5 fill-current" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Food Quality */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Food Quality</label>
                  <select
                    value={formData.quality}
                    onChange={(e) => setFormData({ ...formData, quality: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select rating</option>
                    <option value="excellent">Excellent</option>
                    <option value="good">Good</option>
                    <option value="average">Average</option>
                    <option value="poor">Poor</option>
                  </select>
                </div>

                {/* Cleanliness */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cleanliness</label>
                  <select
                    value={formData.cleanliness}
                    onChange={(e) => setFormData({ ...formData, cleanliness: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select rating</option>
                    <option value="excellent">Excellent</option>
                    <option value="good">Good</option>
                    <option value="average">Average</option>
                    <option value="poor">Poor</option>
                  </select>
                </div>

                {/* Service */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Service</label>
                  <select
                    value={formData.service}
                    onChange={(e) => setFormData({ ...formData, service: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select rating</option>
                    <option value="excellent">Excellent</option>
                    <option value="good">Good</option>
                    <option value="average">Average</option>
                    <option value="poor">Poor</option>
                  </select>
                </div>

                {/* Comments */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Additional Comments</label>
                  <textarea
                    value={formData.comments}
                    onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Share your thoughts and suggestions..."
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={submitting || formData.rating === 0}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                  <span>{submitting ? 'Submitting...' : 'Submit Feedback'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </StudentLayout>
  );
}

