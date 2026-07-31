'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ApiService from '@/services/api';
import toast from 'react-hot-toast';
import {
    ClipboardList,
    MapPin,
    Clock,
    CheckCircle,
    Play,
    Box,
    ArrowRight,
    User,
    AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';

export default function CleanerDashboard() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'pool' | 'my-tasks'>('pool');
    const [poolRequests, setPoolRequests] = useState<any[]>([]);
    const [myTasks, setMyTasks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            // Load Open Requests (Pool)
            const poolRes = await ApiService.getAvailableCleaningRequests();
            setPoolRequests(poolRes.data);

            // Load Assigned Tasks (In Progress)
            const complaintsRes = await ApiService.getAssignedComplaints();
            const myActive = complaintsRes.data.filter((c: any) =>
                c.complaintType === 'cleaning' &&
                ['in-progress', 'assigned'].includes(c.status)
            );
            setMyTasks(myActive);
        } catch (error) {
            console.error('Failed to load tasks', error);
            toast.error('Failed to load tasks');
        } finally {
            setLoading(false);
        }
    };

    const handleAccept = async (id: string) => {
        try {
            await ApiService.acceptCleaningRequest(id);
            toast.success('Task accepted!');
            loadData(); // Refresh both lists
            setActiveTab('my-tasks');
        } catch (error: any) {
            toast.error(error.message || 'Failed to accept task');
        }
    };

    const handleComplete = async (id: string) => {
        try {
            await ApiService.updateComplaintStatus(id, 'resolved', 'Task completed.');
            toast.success('Task marked completed!');
            loadData();
        } catch (error: any) {
            toast.error(error.message || 'Failed to complete task');
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            {/* Header with Stats */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                    <p className="text-gray-500 mt-1">
                        Welcome back, {user?.name}. You are assigned to <span className="font-medium text-gray-900">Block A</span>.
                    </p>
                </div>

                <div className="flex gap-4">
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                            <Box className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 font-medium uppercase">Available</p>
                            <p className="text-xl font-bold text-gray-900">{poolRequests.length}</p>
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3">
                        <div className="p-2 bg-green-50 rounded-lg text-green-600">
                            <ClipboardList className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 font-medium uppercase">To-Do</p>
                            <p className="text-xl font-bold text-gray-900">{myTasks.length}</p>
                        </div>
                    </div>
                </div>
            </header>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                    <button
                        onClick={() => setActiveTab('pool')}
                        className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeTab === 'pool'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        <Box className="w-4 h-4" />
                        Available Requests
                        <span className="bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs ml-1">{poolRequests.length}</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('my-tasks')}
                        className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeTab === 'my-tasks'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        <ClipboardList className="w-4 h-4" />
                        My Active Tasks
                        <span className="bg-blue-100 text-blue-600 py-0.5 px-2 rounded-full text-xs ml-1">{myTasks.length}</span>
                    </button>
                </nav>
            </div>

            {/* Content Area */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 min-h-[400px]">
                {loading ? (
                    <div className="p-12 text-center text-gray-500">Loading tasks...</div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {(activeTab === 'pool' ? poolRequests : myTasks).length === 0 && (
                            <div className="p-12 text-center text-gray-500 flex flex-col items-center">
                                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                    <CheckCircle className="w-8 h-8 text-gray-300" />
                                </div>
                                <p>No tasks found in this section.</p>
                            </div>
                        )}

                        {(activeTab === 'pool' ? poolRequests : myTasks).map((task) => (
                            <div key={task._id} className="p-6 hover:bg-gray-50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                                            <MapPin className="w-3 h-3" />
                                            Room {task.roomId?.roomNumber || 'Unknown'}
                                        </span>
                                        <span className="text-xs text-gray-500 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {format(new Date(task.createdAt), 'MMM d, h:mm a')}
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{task.title}</h3>
                                    <p className="text-gray-500 text-sm line-clamp-2">{task.description}</p>
                                </div>

                                <div className="flex items-center gap-3">
                                    {activeTab === 'pool' && (
                                        <button
                                            onClick={() => handleAccept(task._id)}
                                            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm shadow-blue-200 transition-all active:scale-[0.98]"
                                        >
                                            <span>Accept Task</span>
                                            <ArrowRight className="w-4 h-4" />
                                        </button>
                                    )}

                                    {activeTab === 'my-tasks' && (
                                        <button
                                            onClick={() => handleComplete(task._id)}
                                            className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg shadow-sm shadow-green-200 transition-all active:scale-[0.98]"
                                        >
                                            <CheckCircle className="w-4 h-4" />
                                            <span>Mark Complete</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
