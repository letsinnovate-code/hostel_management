'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import ApiService from '../../../services/api';
import toast from 'react-hot-toast';
import { Sparkles, Calendar, Clock, Image as ImageIcon, CheckCircle, Clock3 } from 'lucide-react';
import { format } from 'date-fns';

interface CleaningRequest {
    _id: string;
    title: string;
    description: string;
    status: string;
    priority: string;
    createdAt: string;
}

export default function CleaningPage() {
    const { user } = useAuth();
    const [requests, setRequests] = useState<CleaningRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [description, setDescription] = useState('');
    const [preferredTime, setPreferredTime] = useState('Morning (09:00 - 12:00)');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadRequests();
    }, []);

    const loadRequests = async () => {
        try {
            const response = await ApiService.getComplaints();
            const cleaningRequests = response.data.filter((c: any) => c.complaintType === 'cleaning');
            setRequests(cleaningRequests);
        } catch (error) {
            console.error('Failed to load requests:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            await ApiService.requestCleaning({
                description,
                preferredTime,
                title: 'Room Cleaning Request',
            });

            toast.success('Cleaning request submitted!');
            setDescription('');
            loadRequests();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to submit request');
        } finally {
            setSubmitting(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'open': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'assigned':
            case 'in-progress': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'resolved':
            case 'closed': return 'bg-green-100 text-green-800 border-green-200';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Sparkles className="w-8 h-8 text-blue-600" />
                        Room Cleaning
                    </h1>
                    <p className="text-gray-500 mt-1">Request housekeeping for room {(user?.roomId && typeof user.roomId === 'object' && 'roomNumber' in user.roomId ? (user.roomId as { roomNumber?: string }).roomNumber : null) || 'your room'}</p>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Request Form */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sticky top-24">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-blue-500" />
                            New Request
                        </h2>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Preferred Time Slot
                                </label>
                                <div className="grid grid-cols-1 gap-2">
                                    {['Morning (09:00 - 12:00)', 'Afternoon (14:00 - 17:00)', 'Evening (17:00 - 19:00)'].map((slot) => (
                                        <button
                                            key={slot}
                                            type="button"
                                            onClick={() => setPreferredTime(slot)}
                                            className={`px-4 py-2 rounded-lg text-sm border text-left transition-all ${preferredTime === slot
                                                    ? 'bg-blue-50 border-blue-500 text-blue-700 font-medium'
                                                    : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                                                }`}
                                        >
                                            {slot}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Additional Notes (Optional)
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="E.g., Please clean the balcony as well..."
                                    className="w-full h-32 px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all resize-none text-sm placeholder:text-gray-400"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium rounded-xl shadow-lg shadow-blue-600/20 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {submitting ? (
                                    <>Processing...</>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4" />
                                        Request Cleaning
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>

                {/* History List */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                <Clock className="w-5 h-5 text-gray-500" />
                                Recent Requests
                            </h2>
                            <span className="text-sm text-gray-500">{requests.length} total</span>
                        </div>

                        {loading ? (
                            <div className="p-8 text-center text-gray-500">Loading requests...</div>
                        ) : requests.length === 0 ? (
                            <div className="p-12 text-center flex flex-col items-center">
                                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                                    <Sparkles className="w-8 h-8 text-blue-400" />
                                </div>
                                <h3 className="text-lg font-medium text-gray-900 mb-1">No cleaning history</h3>
                                <p className="text-gray-500">You haven't requested any cleaning yet.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {requests.map((req) => (
                                    <div key={req._id} className="p-6 hover:bg-gray-50/50 transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-3">
                                                <div className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(req.status)} uppercase tracking-wide`}>
                                                    {req.status}
                                                </div>
                                                <span className="text-sm text-gray-400 flex items-center gap-1">
                                                    <Calendar className="w-3.5 h-3.5" />
                                                    {format(new Date(req.createdAt), 'MMM d, yyyy h:mm a')}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="pl-1">
                                            <p className="text-gray-900 font-medium mb-1">{req.description}</p>
                                            <div className="flex items-center gap-4 text-sm text-gray-500 mt-2">
                                                <span className="flex items-center gap-1.5">
                                                    <Clock3 className="w-4 h-4" />
                                                    Wait time: ~2 hours average
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
