'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../../contexts/AuthContext';
import api from '../../../../services/api';
import { useToast } from '../../../../components/Toast';
import { ArrowLeft, Key, Eye, EyeOff, Loader2, Check } from 'lucide-react';

export default function ChangePasswordPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleSubmit = async () => {
    if (!formData.currentPassword || !formData.newPassword || !formData.confirmPassword) {
      showToast('Please fill in all fields', 'warning');
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      showToast('New password and confirm password do not match', 'error');
      return;
    }

    if (formData.newPassword.length < 6) {
      showToast('Password must be at least 6 characters long', 'error');
      return;
    }

    if (formData.currentPassword === formData.newPassword) {
      showToast('New password must be different from current password', 'error');
      return;
    }

    setSaving(true);
    try {
      const userId = user?.id || user?._id;
      if (!userId) {
        showToast('User ID not found', 'error');
        return;
      }

      // Update password using updateUser endpoint
      await api.updateUser(userId, {
        password: formData.newPassword,
        currentPassword: formData.currentPassword, // Include current password for verification
      });

      showToast('Password changed successfully', 'success');
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      router.push('/owner/profile');
    } catch (error: any) {
      showToast(error.message || 'Failed to change password', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="px-6 py-4">
            <div className="flex items-center gap-4">
              <Link
                href="/owner/profile"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Change Password</h1>
                <p className="text-sm text-gray-600 mt-1">Update your account password</p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-6">
          <div className="w-full">
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-8">
                {/* Header Icon */}
                <div className="flex justify-center mb-8">
                  <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
                    <Key className="w-10 h-10 text-blue-600" />
                  </div>
                </div>

                {/* Password Form */}
                <div className="max-w-2xl mx-auto space-y-6">
                  {/* Current Password */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Current Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={formData.currentPassword}
                        onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                        className="w-full px-4 py-3 pr-12 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        placeholder="Enter your current password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                      >
                        {showCurrentPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* New Password */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      New Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={formData.newPassword}
                        onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                        className="w-full px-4 py-3 pr-12 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        placeholder="Enter your new password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                      >
                        {showNewPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Password must be at least 6 characters long</p>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Confirm New Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        className="w-full px-4 py-3 pr-12 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        placeholder="Confirm your new password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                    {formData.newPassword && formData.confirmPassword && formData.newPassword !== formData.confirmPassword && (
                      <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                    )}
                  </div>

                  {/* Password Requirements */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm font-medium text-blue-900 mb-2">Password Requirements:</p>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li className="flex items-center gap-2">
                        <span className={formData.newPassword.length >= 6 ? 'text-green-600' : ''}>
                          {formData.newPassword.length >= 6 ? '✓' : '○'}
                        </span>
                        At least 6 characters
                      </li>
                      <li className="flex items-center gap-2">
                        <span className={formData.newPassword !== formData.currentPassword && formData.newPassword.length > 0 ? 'text-green-600' : ''}>
                          {formData.newPassword !== formData.currentPassword && formData.newPassword.length > 0 ? '✓' : '○'}
                        </span>
                        Different from current password
                      </li>
                      <li className="flex items-center gap-2">
                        <span className={formData.newPassword === formData.confirmPassword && formData.newPassword.length > 0 ? 'text-green-600' : ''}>
                          {formData.newPassword === formData.confirmPassword && formData.newPassword.length > 0 ? '✓' : '○'}
                        </span>
                        Passwords match
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="px-8 py-6 border-t border-gray-200 bg-gray-50 rounded-b-lg">
                <div className="flex justify-end gap-3">
                  <Link
                    href="/owner/profile"
                    className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-white transition-colors font-medium"
                  >
                    Cancel
                  </Link>
                  <button
                    onClick={handleSubmit}
                    disabled={saving || !formData.currentPassword || !formData.newPassword || !formData.confirmPassword || formData.newPassword !== formData.confirmPassword}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="animate-spin h-5 w-5" />
                        Changing...
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5" />
                        Change Password
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    
  );
}

