'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import {
  ShieldCheck,
  Download,
  FileSpreadsheet,
  FileJson,
  Search,
  Filter,
  RefreshCw,
  Clock,
  User,
  Activity,
  Calendar,
  AlertCircle,
  Database,
} from 'lucide-react';

export default function OwnerAudit() {
  const { user } = useAuth();
  const router = useRouter();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Export State
  const [exportType, setExportType] = useState('students');
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'owner') {
      router.replace('/login');
      return;
    }
    loadAuditLogs();
  }, [user, router]);

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (entityTypeFilter !== 'ALL') params.entityType = entityTypeFilter.toLowerCase();
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const response = await api.getAuditLogs(params);
      setLogs(response.data || []);
    } catch (error: any) {
      console.error('Failed to load audit logs:', error);
      toast.error(error.message || 'Failed to fetch audit records');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await api.exportOwnerData({
        type: exportType,
        format: exportFormat,
        hostelId: user?.hostelId as string,
      });

      // Trigger browser download
      let blob: Blob;
      if (exportFormat === 'json') {
        const jsonStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
        blob = new Blob([jsonStr], { type: 'application/json' });
      } else {
        blob = data instanceof Blob ? data : new Blob([data], { type: 'text/csv' });
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${exportType}_export_${new Date().toISOString().slice(0, 10)}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(`Exported ${exportType} as ${exportFormat.toUpperCase()}`);
    } catch (error: any) {
      console.error('Export failed:', error);
      toast.error(error.message || 'Data export failed');
    } finally {
      setExporting(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    const action = log.action || '';
    const performer = log.performedBy?.name || log.performedBy?.email || '';
    const entity = log.entityType || '';
    const id = log.entityId || '';
    const matchesSearch =
      action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      performer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entity.toLowerCase().includes(searchQuery.toLowerCase()) ||
      id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Security & Compliance Audit Trail</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Immutable Log
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Track user administrative operations, role modifications, financial transactions, and data exports.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadAuditLogs}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Export Section Card */}
      <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-purple-900 text-white p-6 rounded-2xl shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-indigo-300" />
              <h2 className="text-lg font-bold">Hostel Compliance Data Export</h2>
            </div>
            <p className="text-sm text-indigo-200 mt-1">
              Generate standardized data archives for regulatory compliance, taxation audits, or backups.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={exportType}
              onChange={(e) => setExportType(e.target.value)}
              className="text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-white/40"
            >
              <option value="students" className="text-gray-900">Student Directory</option>
              <option value="payments" className="text-gray-900">Payment & Invoices Ledger</option>
              <option value="violations" className="text-gray-900">Disciplinary Violations</option>
            </select>

            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as 'csv' | 'json')}
              className="text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-white/40"
            >
              <option value="csv" className="text-gray-900">CSV Format</option>
              <option value="json" className="text-gray-900">JSON Archive</option>
            </select>

            <button
              onClick={handleExport}
              disabled={exporting}
              className="px-4 py-2.5 text-xs font-bold bg-white text-indigo-950 hover:bg-indigo-50 rounded-xl shadow transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Download className={`w-4 h-4 ${exporting ? 'animate-bounce' : ''}`} />
              {exporting ? 'Exporting...' : 'Download Export'}
            </button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search action, user, or entity ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={entityTypeFilter}
            onChange={(e) => setEntityTypeFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          >
            <option value="ALL">All Entities</option>
            <option value="user">User / Staff</option>
            <option value="student">Student</option>
            <option value="payment">Payment</option>
            <option value="room">Room</option>
            <option value="permission">Permission</option>
            <option value="complaint">Complaint</option>
          </select>

          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
          <span className="text-gray-400 text-xs">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />

          {(startDate || endDate || entityTypeFilter !== 'ALL') && (
            <button
              onClick={loadAuditLogs}
              className="px-3 py-2 text-xs font-semibold bg-indigo-50 text-indigo-700 rounded-xl hover:bg-indigo-100 transition-colors"
            >
              Apply Filter
            </button>
          )}
        </div>
      </div>

      {/* Log Entries Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-sm text-gray-500">Querying security audit logs...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-gray-900">No Audit Events Logged</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
              No audit records were found matching your current filter criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/75 text-gray-500 text-xs uppercase tracking-wider font-semibold">
                  <th className="py-3.5 px-6">Timestamp</th>
                  <th className="py-3.5 px-6">Action</th>
                  <th className="py-3.5 px-6">Entity</th>
                  <th className="py-3.5 px-6">Performed By</th>
                  <th className="py-3.5 px-6">IP / Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLogs.map((log, idx) => {
                  const performedBy = log.performedBy || {};
                  const performerName = performedBy.name || performedBy.email || 'System / Auto';
                  const performerRole = performedBy.role || 'system';

                  return (
                    <tr key={log._id || idx} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-4 px-6 text-gray-600 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <span>
                            {log.timestamp ? new Date(log.timestamp).toLocaleString('en-IN') : 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6 font-semibold text-gray-900 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-gray-100 text-gray-700">
                          {log.action || 'OPERATION'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-gray-600 whitespace-nowrap">
                        <div>
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                            {log.entityType || 'General'}
                          </span>
                          {log.entityId && (
                            <span className="text-xs font-mono text-gray-400 ml-2">
                              #{String(log.entityId).slice(-6)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600">
                            {performerName[0]?.toUpperCase() || 'U'}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 leading-tight">{performerName}</p>
                            <p className="text-xs text-gray-400 capitalize">{performerRole}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-xs text-gray-400 whitespace-nowrap">
                        {log.ipAddress || 'Internal Gateway'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
