'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import {
  User,
  Lock,
  Mail,
  Phone,
  Building2,
  Shield,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
} from 'lucide-react';

export default function CleanerProfilePage() {
  const { user } = useAuth();
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    setUpdatingPassword(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      toast.success('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update password');
    } finally {
      setUpdatingPassword(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
          <User className="w-7 h-7 text-blue-600" />
          My Staff Profile
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          View your staff credentials, assigned hostel, and update your login password.
        </p>
      </div>

      {/* Staff Info Card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-4 border-b border-gray-100 pb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center text-white text-2xl font-bold shadow-md">
            {user?.name?.charAt(0).toUpperCase() || 'C'}
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{user?.name || 'Staff Member'}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2.5 py-0.5 bg-green-100 text-green-800 text-xs font-bold rounded-full uppercase">
                {user?.currentRole || user?.role || 'Housekeeping'}
              </span>
              {user?.roles && user.roles.length > 1 && (
                <span className="text-xs text-gray-400">
                  ({user.roles.join(', ')})
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
          <div className="space-y-1">
            <span className="text-xs text-gray-500 font-semibold uppercase flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              Email Address
            </span>
            <p className="font-medium text-gray-900">{user?.email || '—'}</p>
          </div>

          <div className="space-y-1">
            <span className="text-xs text-gray-500 font-semibold uppercase flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" />
              Contact Phone
            </span>
            <p className="font-medium text-gray-900">{user?.phone || '—'}</p>
          </div>

          <div className="space-y-1">
            <span className="text-xs text-gray-500 font-semibold uppercase flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              Assigned Hostel
            </span>
            <p className="font-medium text-gray-900">{user?.hostelId ? 'Hostel Assigned' : 'General Staff Pool'}</p>
          </div>

          <div className="space-y-1">
            <span className="text-xs text-gray-500 font-semibold uppercase flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              Account Status
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
              <CheckCircle2 className="w-3 h-3" />
              Active
            </span>
          </div>
        </div>
      </div>

      {/* Security & Password Form */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-5">
        <div className="border-b border-gray-100 pb-3">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-blue-600" />
            Change Password
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">Ensure your account is protected with a strong password.</p>
        </div>

        <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full pr-10 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                className="w-full pr-10 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={updatingPassword}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-all disabled:opacity-50"
          >
            {updatingPassword ? 'Saving Password...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
