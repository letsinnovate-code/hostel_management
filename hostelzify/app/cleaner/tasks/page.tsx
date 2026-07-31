'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import Link from 'next/link';

export default function CleanerTasks() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || (user.role !== 'cleaner' && user.role !== 'supervisor')) {
      router.replace('/login');
      return;
    }
    loadTasks();
  }, [user, router]);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const response = await api.getTasks();
      setTasks(response.data || []);
    } catch (error: any) {
      console.error('Failed to load tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTaskStatus = async (taskId: string, status: string) => {
    try {
      await api.updateTaskStatus(taskId, status);
      loadTasks();
    } catch (error: any) {
      alert(error.message || 'Failed to update task');
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-black 900">Cleaner Dashboard</h1>
              <p className="text-sm text-black 600">Welcome, {user?.name}</p>
            </div>
            <div className="flex gap-2">
              {user?.hasMultipleRoles && (
                <Link
                  href="/select-role?switch=true"
                  className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100"
                >
                  Switch Role
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link
            href="/cleaner/complaints"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            View Complaints
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <p className="text-black 600">Loading tasks...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-black 600">No tasks assigned</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => (
              <div key={task.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold text-black 900">{task.title || 'Task'}</h3>
                    <p className="text-sm text-black 600 mt-1">{task.description}</p>
                    <p className="text-sm text-black 500 mt-2">
                      Status: <span className="font-medium">{task.status}</span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {task.status === 'pending' && (
                      <button
                        onClick={() => handleTaskStatus(task.id, 'in_progress')}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Start
                      </button>
                    )}
                    {task.status === 'in_progress' && (
                      <button
                        onClick={() => handleTaskStatus(task.id, 'completed')}
                        className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        Complete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

