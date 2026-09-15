"use client";
import { useQuery } from "@tanstack/react-query";
import api from "../../../services/api";

export default function SupervisorDashboard() {
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["supervisorStats"],
    queryFn: () => api.getSupervisorDashboard(),
  });

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ["supervisorTasks"],
    queryFn: () => api.getSupervisorTasks(),
  });

  if (statsLoading || tasksLoading) {
    return <div>Loading operations data...</div>;
  }

  const stats = statsData?.data;
  const tasks = tasksData?.data || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl border shadow-sm flex flex-col items-center justify-center">
          <span className="text-gray-500 text-sm font-semibold uppercase tracking-wider">Assigned Staff</span>
          <span className="text-4xl font-bold mt-2 text-blue-600">{stats?.staffCount || 0}</span>
        </div>
        <div className="bg-white p-6 rounded-xl border shadow-sm flex flex-col items-center justify-center">
          <span className="text-gray-500 text-sm font-semibold uppercase tracking-wider">Pending Tasks</span>
          <span className="text-4xl font-bold mt-2 text-orange-500">{stats?.tasks?.pending || 0}</span>
        </div>
        <div className="bg-white p-6 rounded-xl border shadow-sm flex flex-col items-center justify-center">
          <span className="text-gray-500 text-sm font-semibold uppercase tracking-wider">In Progress</span>
          <span className="text-4xl font-bold mt-2 text-purple-500">{stats?.tasks?.inProgress || 0}</span>
        </div>
        <div className="bg-white p-6 rounded-xl border shadow-sm flex flex-col items-center justify-center">
          <span className="text-gray-500 text-sm font-semibold uppercase tracking-wider">Completed</span>
          <span className="text-4xl font-bold mt-2 text-green-500">{stats?.tasks?.completed || 0}</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden mt-8">
        <div className="p-6 border-b bg-gray-50">
          <h2 className="text-lg font-bold text-gray-800">Recent Cleaning & Maintenance Tasks</h2>
        </div>
        <div className="p-0">
          {tasks.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No tasks currently assigned.</div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-100 text-gray-600 text-sm">
                  <th className="px-6 py-3 font-semibold">Title</th>
                  <th className="px-6 py-3 font-semibold">Assigned To</th>
                  <th className="px-6 py-3 font-semibold">Type</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm">
                {tasks.map((task: any) => (
                  <tr key={task._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{task.title}</td>
                    <td className="px-6 py-4 text-gray-600">
                      {task.assignedTo ? task.assignedTo.name : "Unassigned"}
                    </td>
                    <td className="px-6 py-4 text-gray-500 uppercase">{task.taskType}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        task.status === 'completed' ? 'bg-green-100 text-green-700' :
                        task.status === 'in-progress' ? 'bg-purple-100 text-purple-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>
                        {task.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
