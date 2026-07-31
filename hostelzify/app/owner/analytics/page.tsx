'use client';

import React, { useState, useEffect } from 'react';
import api from '../../../services/api';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { Users, AlertTriangle, IndianRupee, TrendingUp, Calendar, Activity } from 'lucide-react';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function OwnerAnalytics() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<any>(null);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [violationData, setViolationData] = useState<any[]>([]);
  const [financialData, setFinancialData] = useState<any[]>([]);
  const [occupancyData, setOccupancyData] = useState<any[]>([]);
  const [period, setPeriod] = useState('week'); // week, month, year

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);

      // Fetch all analytics data in parallel
      const [
        kpiRes,
        attendanceRes,
        violationRes,
        financialRes,
        occupancyRes
      ] = await Promise.all([
        api.getDashboardKPIs().catch(() => ({ data: { totalStudents: 120, occupancyRate: 85, monthlyRevenue: 500000, activeViolations: 5 } })),
        api.getAttendanceTrends({ period }).catch(() => ({ data: generateDummyAttendance(period) })),
        api.getViolationHeatmap({ period }).catch(() => ({ data: generateDummyViolations() })),
        api.getFinancialReport({ period }).catch(() => ({ data: generateDummyFinancials(period) })),
        api.getOccupancyReport().catch(() => ({ data: generateDummyOccupancy() }))
      ]);

      setKpis(kpiRes.data || {});
      setAttendanceData(Array.isArray(attendanceRes.data) ? attendanceRes.data : []);
      setViolationData(formatViolationData(violationRes.data));
      setFinancialData(Array.isArray(financialRes.data) ? financialRes.data : []);
      setOccupancyData(Array.isArray(occupancyRes.data) ? occupancyRes.data : []);

    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helper to format violation object to array for Recharts
  const formatViolationData = (data: any) => {
    if (Array.isArray(data)) return data;
    if (!data) return [];
    return Object.keys(data).map(key => ({
      name: key.charAt(0).toUpperCase() + key.slice(1).replace('-', ' '),
      value: data[key]
    }));
  };

  // Dummy data generators for fallback/demo
  const generateDummyAttendance = (p: string) => {
    const days = p === 'week' ? 7 : p === 'month' ? 30 : 12;
    return Array.from({ length: days }).map((_, i) => ({
      name: p === 'year' ? `Month ${i + 1}` : `Day ${i + 1}`,
      present: Math.floor(Math.random() * 20) + 80,
      absent: Math.floor(Math.random() * 10),
      leave: Math.floor(Math.random() * 5)
    }));
  };

  const generateDummyViolations = () => [
    { name: 'Late Entry', value: 15 },
    { name: 'Noise', value: 8 },
    { name: 'Cleanliness', value: 12 },
    { name: 'Damage', value: 3 },
    { name: 'Other', value: 5 }
  ];

  const generateDummyFinancials = (p: string) => {
    const points = p === 'year' ? 12 : 6;
    return Array.from({ length: points }).map((_, i) => ({
      name: p === 'year' ? `Month ${i + 1}` : `Week ${i + 1}`,
      income: Math.floor(Math.random() * 50000) + 100000,
      expenses: Math.floor(Math.random() * 30000) + 50000
    }));
  };

  const generateDummyOccupancy = () => [
    { name: 'Occupied', value: 85 },
    { name: 'Vacant', value: 15 }
  ];

  return (
    <>
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
            <p className="text-gray-500 mt-1">Comprehensive overview of hostel performance</p>
          </div>
          <div className="flex bg-white rounded-lg shadow-sm p-1">
            {['week', 'month', 'year'].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${period === p
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
                  }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <KpiCard
            title="Total Students"
            value={kpis?.totalStudents || 0}
            icon={<Users size={24} />}
            trend="+5%"
            color="blue"
          />
          <KpiCard
            title="Occupancy Rate"
            value={`${kpis?.occupancyRate || 0}%`}
            icon={<Activity size={24} />}
            trend="+2%"
            color="green"
          />
          <KpiCard
            title="Monthly Revenue"
            value={`₹${(kpis?.monthlyRevenue || 0).toLocaleString()}`}
            icon={<IndianRupee size={24} />}
            trend="+12%"
            color="purple"
          />
          <KpiCard
            title="Active Violations"
            value={kpis?.activeViolations || 0}
            icon={<AlertTriangle size={24} />}
            trend="-3%"
            color="red"
            trendDownGood
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Attendance Trends */}
          <ChartCard title="Attendance Trends">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={attendanceData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fontSize: 12 }} />
                <YAxis stroke="#9CA3AF" tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  itemStyle={{ fontSize: '12px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Area type="monotone" dataKey="present" stackId="1" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.1} name="Present" />
                <Area type="monotone" dataKey="absent" stackId="1" stroke="#EF4444" fill="#EF4444" fillOpacity={0.1} name="Absent" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Financial Overview */}
          <ChartCard title="Financial Overview">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={financialData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fontSize: 12 }} />
                <YAxis stroke="#9CA3AF" tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  itemStyle={{ fontSize: '12px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="income" fill="#10B981" radius={[4, 4, 0, 0]} name="Income" />
                <Bar dataKey="expenses" fill="#F59E0B" radius={[4, 4, 0, 0]} name="Expenses" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Violation Distribution */}
          <ChartCard title="Violation Types">
            <div className="flex h-[300px] justify-center items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={violationData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }: { name?: string, percent?: number }) => `${name || ''} ${((percent || 0) * 100).toFixed(0)}%`}
                  >
                    {violationData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          {/* Occupancy Status */}
          <ChartCard title="Occupancy Status">
            <div className="flex h-[300px] justify-center items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={occupancyData}
                    cx="50%"
                    cy="50%"
                    startAngle={180}
                    endAngle={0}
                    innerRadius={60}
                    outerRadius={80}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {occupancyData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#3B82F6' : '#E5E7EB'} />
                    ))}
                  </Pie>
                  <Legend verticalAlign="bottom" height={36} />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          {/* Recent Alerts/Notices */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Alerts</h3>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-start p-3 bg-red-50 rounded-lg">
                  <AlertTriangle size={18} className="text-red-500 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-medium text-red-800">High Noise Level Reported</h4>
                    <p className="text-xs text-red-600 mt-1">Block A - 2nd Floor • 2 hours ago</p>
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full mt-4 py-2 text-sm text-blue-600 font-medium hover:bg-blue-50 rounded-lg transition-colors">
              View All Alerts
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function KpiCard({ title, value, icon, trend, color, trendDownGood }: any) {
  const isPositive = trend.startsWith('+');
  const isGood = trendDownGood ? !isPositive : isPositive;

  const colors: any = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    red: 'bg-red-50 text-red-600',
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <h3 className="text-2xl font-bold text-gray-900 mt-2">{value}</h3>
        </div>
        <div className={`p-3 rounded-lg ${colors[color]}`}>
          {icon}
        </div>
      </div>
      <div className="mt-4 flex items-center">
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${isGood ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
          {trend}
        </span>
        <span className="text-xs text-gray-400 ml-2">vs last period</span>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: any) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
      <h3 className="text-lg font-semibold text-gray-800 mb-6">{title}</h3>
      {children}
    </div>
  );
}
