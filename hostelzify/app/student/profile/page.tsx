'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import StudentLayout from '../../../components/StudentLayout';
import { User, Mail, Home, Phone, Calendar, MapPin, Lock, Eye, EyeOff, CheckCircle, AlertCircle, Loader2, Shield, FileText, Users } from 'lucide-react';

export default function StudentProfile() {
  const { user } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'student') { router.replace('/login'); return; }
    loadProfile();
  }, [user, router]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const response = await api.getProfile();
      setProfile(response.data);
    } catch (error: any) {
      console.error('Failed to load profile:', error);
    } finally { setLoading(false); }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(''); setPwSuccess(false);
    if (!pwForm.current || !pwForm.newPw || !pwForm.confirm) { setPwError('All fields are required'); return; }
    if (pwForm.newPw.length < 6) { setPwError('New password must be at least 6 characters'); return; }
    if (pwForm.newPw !== pwForm.confirm) { setPwError('New passwords do not match'); return; }
    setPwLoading(true);
    try {
      await api.changePassword(pwForm.current, pwForm.newPw);
      setPwSuccess(true);
      setPwForm({ current: '', newPw: '', confirm: '' });
    } catch (err: any) {
      setPwError(err?.response?.data?.message || err.message || 'Failed to change password');
    } finally { setPwLoading(false); }
  };

  const profileData = profile?.profile || profile;

  return (
    <StudentLayout>
      <div className="min-h-screen bg-gray-50">
        <div className="p-6 max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
            <p className="text-sm text-gray-500 mt-1">View your information and manage your account settings</p>
          </div>

          {loading ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
              <p className="text-gray-500">Loading your profile...</p>
            </div>
          ) : (
            <>
              {/* Personal Info */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center"><User className="w-5 h-5 text-white" /></div>
                    <div>
                      <h2 className="text-base font-semibold text-gray-900">Personal Information</h2>
                      <p className="text-xs text-gray-500">Your basic profile details</p>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  {profileData ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {profileData.name || user?.name ? (
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center flex-shrink-0"><User className="w-5 h-5" /></div>
                          <div><p className="text-sm text-gray-500">Full Name</p><p className="font-semibold text-gray-900 mt-0.5">{profileData.name || user?.name}</p></div>
                        </div>
                      ) : null}
                      {profileData.email || user?.email ? (
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 bg-green-100 text-green-600 rounded-lg flex items-center justify-center flex-shrink-0"><Mail className="w-5 h-5" /></div>
                          <div><p className="text-sm text-gray-500">Email Address</p><p className="font-semibold text-gray-900 mt-0.5">{profileData.email || user?.email}</p></div>
                        </div>
                      ) : null}
                      {profileData.phone ? (
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center flex-shrink-0"><Phone className="w-5 h-5" /></div>
                          <div><p className="text-sm text-gray-500">Phone Number</p><p className="font-semibold text-gray-900 mt-0.5">{profileData.phone}</p></div>
                        </div>
                      ) : null}
                      {profileData.dateOfBirth ? (
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center flex-shrink-0"><Calendar className="w-5 h-5" /></div>
                          <div><p className="text-sm text-gray-500">Date of Birth</p><p className="font-semibold text-gray-900 mt-0.5">{new Date(profileData.dateOfBirth).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p></div>
                        </div>
                      ) : null}
                      {(profileData.hostelId?.name || profileData.hostel) ? (
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 bg-red-100 text-red-600 rounded-lg flex items-center justify-center flex-shrink-0"><MapPin className="w-5 h-5" /></div>
                          <div><p className="text-sm text-gray-500">Hostel</p><p className="font-semibold text-gray-900 mt-0.5">{profileData.hostelId?.name || profileData.hostel}</p></div>
                        </div>
                      ) : null}
                      {(profileData.roomId?.roomNumber || profileData.room) ? (
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 bg-yellow-100 text-yellow-600 rounded-lg flex items-center justify-center flex-shrink-0"><Home className="w-5 h-5" /></div>
                          <div><p className="text-sm text-gray-500">Room</p><p className="font-semibold text-gray-900 mt-0.5">{profileData.roomId?.roomNumber || profileData.room}</p></div>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400">No profile information available</div>
                  )}
                </div>
              </div>

              {/* Address */}
              {profileData?.address && Object.values(profileData.address).some((v: any) => v) && (
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center"><MapPin className="w-5 h-5 text-emerald-600" /></div>
                      <h2 className="text-base font-semibold text-gray-900">Home Address</h2>
                    </div>
                  </div>
                  <div className="p-6">
                    <p className="text-gray-700 leading-relaxed">
                      {[profileData.address.street, profileData.address.city, profileData.address.state, profileData.address.pincode, profileData.address.country].filter(Boolean).join(', ')}
                    </p>
                  </div>
                </div>
              )}

              {/* Contacts */}
              {(profileData?.parentContact?.name || profileData?.emergencyContact?.name) && (
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center"><Users className="w-5 h-5 text-purple-600" /></div>
                      <h2 className="text-base font-semibold text-gray-900">Emergency Contacts</h2>
                    </div>
                  </div>
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {profileData.parentContact?.name && (
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Parent / Guardian</p>
                        <p className="font-semibold text-gray-900">{profileData.parentContact.name}</p>
                        {profileData.parentContact.phone && <p className="text-sm text-gray-500">{profileData.parentContact.phone}</p>}
                        {profileData.parentContact.email && <p className="text-sm text-gray-500">{profileData.parentContact.email}</p>}
                      </div>
                    )}
                    {profileData.emergencyContact?.name && (
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Emergency Contact</p>
                        <p className="font-semibold text-gray-900">{profileData.emergencyContact.name}</p>
                        {profileData.emergencyContact.phone && <p className="text-sm text-gray-500">{profileData.emergencyContact.phone}</p>}
                        {profileData.emergencyContact.relation && <p className="text-xs text-gray-400">{profileData.emergencyContact.relation}</p>}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Documents */}
              {profileData?.documents?.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center"><FileText className="w-5 h-5 text-amber-600" /></div>
                      <h2 className="text-base font-semibold text-gray-900">Uploaded Documents</h2>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {profileData.documents.map((doc: any) => (
                        <a key={doc._id} href={doc.url} target="_blank" rel="noreferrer"
                          className="flex items-center gap-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg px-4 py-3 transition-colors">
                          <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{doc.name || doc.type}</p>
                            <p className="text-xs text-gray-400 capitalize">{doc.type}</p>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Change Password */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center"><Lock className="w-5 h-5 text-slate-600" /></div>
                    <div>
                      <h2 className="text-base font-semibold text-gray-900">Change Password</h2>
                      <p className="text-xs text-gray-500">Update your account password anytime</p>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  {pwSuccess && (
                    <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-emerald-700 text-sm mb-4">
                      <CheckCircle className="w-4 h-4 flex-shrink-0" />
                      Password changed successfully! Use your new password next time you log in.
                    </div>
                  )}
                  {pwError && (
                    <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm mb-4">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {pwError}
                    </div>
                  )}
                  <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Current Password</label>
                      <div className="relative">
                        <input id="pw-current" type={showCurrent ? 'text' : 'password'} value={pwForm.current}
                          onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))}
                          placeholder="Enter current password"
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" />
                        <button type="button" onClick={() => setShowCurrent(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
                      <div className="relative">
                        <input id="pw-new" type={showNew ? 'text' : 'password'} value={pwForm.newPw}
                          onChange={e => setPwForm(p => ({ ...p, newPw: e.target.value }))}
                          placeholder="Min. 6 characters"
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" />
                        <button type="button" onClick={() => setShowNew(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm New Password</label>
                      <input id="pw-confirm" type="password" value={pwForm.confirm}
                        onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))}
                        placeholder="Re-enter new password"
                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" />
                    </div>
                    <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
                      <Shield className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      <p className="text-xs text-blue-700">Choose a strong password with at least 6 characters. Your password is never displayed.</p>
                    </div>
                    <button type="submit" id="pw-submit" disabled={pwLoading}
                      className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 disabled:opacity-60 transition-colors">
                      {pwLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Updating...</> : <><Lock className="w-4 h-4" />Update Password</>}
                    </button>
                  </form>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </StudentLayout>
  );
}
