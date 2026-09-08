'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import {
  FileText,
  Plus,
  Copy,
  Mail,
  MessageSquare,
  Bell,
  Search,
  Filter,
  RefreshCw,
  Sparkles,
  Check,
  Tag,
  Send,
} from 'lucide-react';

export default function OwnerTemplates() {
  const { user } = useAuth();
  const router = useRouter();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');

  // Create Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    type: 'push',
    category: 'notice',
    subject: '',
    content: '',
    hostelId: '',
  });

  const availableVariables = ['{name}', '{room}', '{amount}', '{dueDate}', '{date}', '{hostelName}'];

  useEffect(() => {
    if (!user || user.role !== 'owner') {
      router.replace('/login');
      return;
    }
    loadTemplates();
  }, [user, router]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const hostelId = (user?.hostelId || (user as any)?.hostels?.[0]?._id || (user as any)?.hostels?.[0]) as string;
      if (!hostelId) {
        // Fetch hostels if not attached directly to user
        const hostelsRes = await api.getHostels();
        const firstHostel = hostelsRes.data?.[0];
        if (firstHostel?._id) {
          const res = await api.getTemplates(firstHostel._id);
          setTemplates(res.data || []);
          setFormData((prev) => ({ ...prev, hostelId: firstHostel._id }));
          return;
        }
      } else {
        const res = await api.getTemplates(hostelId);
        setTemplates(res.data || []);
        setFormData((prev) => ({ ...prev, hostelId }));
      }
    } catch (error: any) {
      console.error('Failed to load templates:', error);
      toast.error(error.message || 'Failed to fetch templates');
    } finally {
      setLoading(false);
    }
  };

  const insertVariable = (varName: string) => {
    setFormData((prev) => ({
      ...prev,
      content: prev.content + ' ' + varName,
    }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.content.trim()) {
      toast.error('Template name and content are required');
      return;
    }

    setSubmitting(true);
    try {
      let activeHostelId = formData.hostelId;
      if (!activeHostelId) {
        const hostelsRes = await api.getHostels();
        activeHostelId = hostelsRes.data?.[0]?._id;
      }

      await api.createTemplate({
        ...formData,
        hostelId: activeHostelId,
        variables: availableVariables.filter((v) => formData.content.includes(v)),
      });

      toast.success('Communication template created');
      setCreateModalOpen(false);
      setFormData({
        name: '',
        type: 'push',
        category: 'notice',
        subject: '',
        content: '',
        hostelId: activeHostelId,
      });
      loadTemplates();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create template');
    } finally {
      setSubmitting(false);
    }
  };

  const copyTemplateContent = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    toast.success('Template content copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredTemplates = templates.filter((t) => {
    const matchesSearch =
      (t.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.content || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.subject || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = filterCategory === 'ALL' || (t.category || '').toUpperCase() === filterCategory;
    const matchesType = filterType === 'ALL' || (t.type || '').toUpperCase() === filterType;
    return matchesSearch && matchesCat && matchesType;
  });

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Broadcast & Notification Templates</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              {templates.length} Saved
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Predefined message templates with dynamic merge tags for rapid fee reminders, circulars, and notices.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadTemplates}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Template
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search templates by title, subject or content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          >
            <option value="ALL">All Categories</option>
            <option value="NOTICE">General Notice</option>
            <option value="PAYMENT">Fee & Payment</option>
            <option value="EMERGENCY">Emergency</option>
            <option value="HOLIDAY">Holiday & Leave</option>
            <option value="VIOLATION">Disciplinary</option>
            <option value="OTHER">Other</option>
          </select>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          >
            <option value="ALL">All Channels</option>
            <option value="PUSH">In-App / Push</option>
            <option value="SMS">SMS Message</option>
            <option value="EMAIL">Email Letter</option>
          </select>
        </div>
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-sm text-gray-500">Loading communication templates...</p>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <FileText className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-gray-900">No Templates Found</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
            Create standard message templates to quickly broadcast updates to students, staff, and parents.
          </p>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Create First Template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => {
            const isPush = template.type === 'push';
            const isEmail = template.type === 'email';
            const isSms = template.type === 'sms';
            const isCopied = copiedId === template._id;

            return (
              <div
                key={template._id}
                className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:border-indigo-200 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 capitalize">
                      {isEmail && <Mail className="w-3.5 h-3.5 text-blue-600" />}
                      {isPush && <Bell className="w-3.5 h-3.5 text-indigo-600" />}
                      {isSms && <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />}
                      {template.type}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 capitalize">
                      {template.category}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-gray-900">{template.name}</h3>
                    {template.subject && (
                      <p className="text-xs font-medium text-gray-500 mt-0.5">
                        Subject: {template.subject}
                      </p>
                    )}
                  </div>

                  <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 text-xs text-gray-700 leading-relaxed font-mono whitespace-pre-wrap">
                    {template.content}
                  </div>

                  {template.variables && template.variables.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap pt-1">
                      {template.variables.map((v: string) => (
                        <span key={v} className="px-1.5 py-0.5 text-[10px] font-mono bg-indigo-50 text-indigo-600 rounded">
                          {v}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
                  <button
                    onClick={() => copyTemplateContent(template._id, template.content)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-indigo-600 transition-colors"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-green-600" />
                        <span className="text-green-600">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Text</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      router.push('/owner/broadcast');
                    }}
                    className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Use in Broadcast
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-indigo-600">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Create Notification Template</h3>
                <p className="text-xs text-gray-500">Design dynamic message templates for broadcast</p>
              </div>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Template Title *
                </label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Monthly Mess Fee Reminder"
                  className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Delivery Channel *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full text-sm border border-gray-200 rounded-xl p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="push">In-App Notification</option>
                    <option value="email">Email Message</option>
                    <option value="sms">SMS Text</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full text-sm border border-gray-200 rounded-xl p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="notice">General Notice</option>
                    <option value="payment">Payment Reminder</option>
                    <option value="holiday">Holiday Circular</option>
                    <option value="emergency">Emergency Alert</option>
                    <option value="violation">Disciplinary</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              {formData.type === 'email' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Email Subject Line *
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="e.g. Important notice regarding hostel fees"
                    className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-gray-700">
                    Template Content *
                  </label>
                  <span className="text-[11px] text-gray-400">Click tags below to insert</span>
                </div>
                <textarea
                  required
                  rows={4}
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Dear {name}, please be reminded that your fee of ₹{amount} for room {room} is due by {dueDate}."
                  className="w-full text-sm border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none font-mono"
                />
              </div>

              {/* Dynamic Variables Pill Bar */}
              <div>
                <span className="text-xs font-semibold text-gray-500 block mb-1.5 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Insert Dynamic Tags:
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {availableVariables.map((v) => (
                    <button
                      type="button"
                      key={v}
                      onClick={() => insertVariable(v)}
                      className="px-2 py-1 text-xs font-mono bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors"
                    >
                      + {v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
