'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '../../../../services/api';
import { useToast } from '../../../../components/Toast';
import { ArrowLeft, BarChart3, TrendingUp, Users, Building2, AlertTriangle, Download } from 'lucide-react';

export default function ReportsPage() {
  const [reports, setReports] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const res = await api.getReports();
      if (res?.success) {
        setReports(res.data);
      }
    } catch {
      showToast('Failed to load reports', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link
              href="/superadmin"
              className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 mb-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-indigo-600" />
              Platform Reports
            </h1>
            <p className="text-slate-500 mt-1">
              Aggregated statistics and trends across all platform tenants.
            </p>
          </div>
          <button className="inline-flex items-center px-4 py-2 bg-white border border-slate-200 text-sm font-bold rounded-lg text-slate-700 hover:bg-slate-50 shadow-sm transition-colors">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                Last 30 Days Growth
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-50 rounded-lg p-5 border border-slate-100">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                      <Users className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-slate-700">New Users</h3>
                  </div>
                  <p className="text-3xl font-black text-slate-900">{reports?.last30Days?.newUsers || 0}</p>
                </div>

                <div className="bg-slate-50 rounded-lg p-5 border border-slate-100">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-slate-700">New Hostels</h3>
                  </div>
                  <p className="text-3xl font-black text-slate-900">{reports?.last30Days?.newHostels || 0}</p>
                </div>

                <div className="bg-slate-50 rounded-lg p-5 border border-slate-100">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-rose-100 text-rose-700 rounded-lg">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-slate-700">New Complaints</h3>
                  </div>
                  <p className="text-3xl font-black text-slate-900">{reports?.last30Days?.newComplaints || 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 text-center">
              <h3 className="text-lg font-bold text-indigo-900 mb-2">Advanced Analytics</h3>
              <p className="text-indigo-700 text-sm max-w-2xl mx-auto">
                Full multi-tenant reporting, financial aggregates, and occupancy heatmaps are scheduled for a future release. 
                Currently, data can be exported to CSV for manual analysis.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
