'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '../../../../services/api';
import { ChevronLeft, Ticket, RefreshCw } from 'lucide-react';

const STATUS_OPTIONS = ['open', 'in-progress', 'resolved', 'closed'];

export default function SuperAdminSupportTicketsPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [replyModal, setReplyModal] = useState<{ id: string; subject: string } | null>(null);
  const [replyMessage, setReplyMessage] = useState('');

  const loadTickets = async () => {
    setLoading(true);
    try {
      const res = await api.getSuperadminSupportTickets(
        statusFilter ? { status: statusFilter } : undefined
      );
      setTickets(res?.data ?? []);
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, [statusFilter]);

  const handleStatusChange = async (id: string, status: string) => {
    setUpdatingId(id);
    try {
      await api.updateSuperadminSupportTicket(id, { status });
      loadTickets();
    } finally {
      setUpdatingId(null);
    }
  };

  const handleReply = async () => {
    if (!replyModal || !replyMessage.trim()) return;
    setUpdatingId(replyModal.id);
    try {
      await api.updateSuperadminSupportTicket(replyModal.id, { message: replyMessage.trim() });
      setReplyModal(null);
      setReplyMessage('');
      loadTickets();
    } finally {
      setUpdatingId(null);
    }
  };

  const statusColor: Record<string, string> = {
    open: 'bg-blue-100 text-blue-800',
    'in-progress': 'bg-amber-100 text-amber-800',
    resolved: 'bg-green-100 text-green-800',
    closed: 'bg-gray-100 text-gray-800',
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <Link
          href="/superadmin"
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
          aria-label="Back"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 flex items-center gap-2">
          <Ticket className="w-6 h-6 text-indigo-600" />
          <h1 className="text-xl font-bold text-gray-900">Support Tickets</h1>
        </div>
      </header>

      <main className="p-6 max-w-4xl mx-auto">
        <div className="flex flex-wrap gap-4 mb-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button
            onClick={() => loadTickets()}
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : tickets.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-500">
            No support tickets found.
          </div>
        ) : (
          <div className="space-y-4">
            {tickets.map((t) => (
              <div
                key={t._id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <div>
                    <span className="font-mono text-sm text-indigo-600">{t.ticketNumber}</span>
                    <h2 className="font-semibold text-gray-900 mt-1">{t.subject}</h2>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      statusColor[t.status] || 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {t.status}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{t.description}</p>
                <div className="flex flex-wrap gap-2 text-xs text-gray-500 mb-3">
                  {t.raisedBy && (
                    <span>
                      By: {typeof t.raisedBy === 'object' ? t.raisedBy.name : t.raisedBy}
                    </span>
                  )}
                  {t.hostelId && (
                    <span>
                      Hostel: {typeof t.hostelId === 'object' ? t.hostelId.name : t.hostelId}
                    </span>
                  )}
                  <span>{new Date(t.createdAt).toLocaleString()}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={t.status}
                    onChange={(e) => handleStatusChange(t._id, e.target.value)}
                    disabled={updatingId === t._id}
                    className="text-sm border border-gray-300 rounded px-2 py-1"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setReplyModal({ id: t._id, subject: t.subject })}
                    className="text-sm text-indigo-600 hover:underline"
                  >
                    Add reply
                  </button>
                </div>
                {t.responses?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-500 mb-1">Replies</p>
                    {t.responses.map((r: any, i: number) => (
                      <div key={i} className="text-sm text-gray-700 bg-gray-50 rounded p-2 mb-1">
                        {r.message}
                        <span className="text-xs text-gray-400 ml-2">
                          {r.timestamp ? new Date(r.timestamp).toLocaleString() : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {replyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="font-semibold text-gray-900 mb-2">Reply to: {replyModal.subject}</h3>
            <textarea
              value={replyMessage}
              onChange={(e) => setReplyMessage(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm min-h-[100px]"
              placeholder="Your reply..."
            />
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => { setReplyModal(null); setReplyMessage(''); }}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReply}
                disabled={!replyMessage.trim() || updatingId !== null}
                className="flex-1 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
