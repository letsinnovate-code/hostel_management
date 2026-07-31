'use client';

import { useState } from 'react';
import Link from 'next/link';
import api from '../../../../services/api';
import { ChevronLeft, UserPlus, Eye, EyeOff, CheckCircle2, Copy } from 'lucide-react';

export default function CreateOwnerPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<{ name: string; email: string; password: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim() || !email.trim() || !password || !phone.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.createSuperadminOwner({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        phone: phone.trim(),
      });
      const data = res?.data;
      if (data?.email) {
        setCreated({
          name: data.name || name.trim(),
          email: data.email,
          password,
        });
        setName('');
        setEmail('');
        setPassword('');
        setPhone('');
      } else {
        setError('Owner was created but response was invalid.');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to create owner.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-4 shadow-sm">
        <Link
          href="/superadmin"
          className="p-2 rounded-xl hover:bg-slate-100 text-slate-600"
          aria-label="Back"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 flex items-center gap-2">
          <UserPlus className="w-6 h-6 text-violet-600" />
          <h1 className="text-xl font-bold text-slate-900">Create hostel owner</h1>
        </div>
      </header>

      <main className="p-6 max-w-md mx-auto">
        {created ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center gap-2 text-emerald-600 mb-4">
              <CheckCircle2 className="w-6 h-6" />
              <span className="font-semibold">Owner created</span>
            </div>
            <p className="text-slate-600 text-sm mb-4">
              They can log in to the owner dashboard with these credentials. Save them securely.
            </p>
            <div className="space-y-3 bg-slate-50 rounded-xl p-4">
              <div className="flex justify-between items-center gap-2">
                <span className="text-sm text-slate-500">Name</span>
                <span className="font-medium text-slate-900">{created.name}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(created.name)}
                  className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500"
                  title="Copy"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-sm text-slate-500">Email</span>
                <span className="font-medium text-slate-900">{created.email}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(created.email)}
                  className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500"
                  title="Copy"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-sm text-slate-500">Password</span>
                <span className="font-mono text-slate-900">••••••••</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(created.password)}
                  className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500"
                  title="Copy password"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setCreated(null)}
                className="flex-1 py-2.5 bg-violet-600 text-white font-medium rounded-xl hover:bg-violet-700"
              >
                Create another
              </button>
              <Link
                href="/superadmin"
                className="flex-1 py-2.5 text-center bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200"
              >
                Back to dashboard
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  placeholder="Owner full name"
                  autoComplete="name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  placeholder="owner@example.com"
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent pr-12"
                    placeholder="Min 6 characters"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  placeholder="10-digit mobile"
                  autoComplete="tel"
                />
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 bg-violet-600 text-white font-medium rounded-xl hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating…' : 'Create owner'}
              </button>
              <Link
                href="/superadmin"
                className="py-2.5 px-4 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200"
              >
                Cancel
              </Link>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
