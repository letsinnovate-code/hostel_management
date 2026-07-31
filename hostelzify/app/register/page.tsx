'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { Eye, EyeOff, QrCode, CheckCircle, AlertCircle, User, MapPin, Phone, FileText, ChevronRight, ChevronLeft, Upload, X, Shield, Users, Loader2, Check } from 'lucide-react';

const STEPS = [
  { id: 'basic',     label: 'Basic Info',  icon: 'User',     color: 'from-violet-500 to-purple-600' },
  { id: 'address',   label: 'Address',     icon: 'MapPin',   color: 'from-blue-500 to-cyan-600' },
  { id: 'contacts',  label: 'Contacts',    icon: 'Phone',    color: 'from-emerald-500 to-teal-600' },
  { id: 'documents', label: 'Documents',   icon: 'FileText', color: 'from-amber-500 to-orange-600' },
  { id: 'review',    label: 'Review',      icon: 'Check',    color: 'from-rose-500 to-pink-600' },
];

const DOC_TYPES = [
  { value: 'aadhar',        label: 'Aadhar Card' },
  { value: 'pan',           label: 'PAN Card' },
  { value: 'college-id',    label: 'College ID' },
  { value: 'address-proof', label: 'Address Proof' },
  { value: 'other',         label: 'Other' },
];

function InputField({ label, required: req, ...props }: { label: string; required?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
        {label}{req && <span className="text-rose-400 ml-1">*</span>}
      </label>
      <input
        {...props}
        className="w-full bg-white/5 border border-white/10 text-white placeholder-slate-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500 transition-all duration-200"
      />
    </div>
  );
}

function SelectField({ label, options, value, onChange }: {
  label: string; value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full bg-slate-800 border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500 transition-all duration-200">
        <option value="">Select...</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function QRRegistrationForm({ hostelId, hostelName }: { hostelId: string; hostelName?: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({
    name: '', email: '', phone: '', dateOfBirth: '', gender: '', course: '',
    address: { street: '', city: '', state: '', pincode: '', country: 'India' },
    parentContact: { name: '', phone: '', email: '' },
    emergencyContact: { name: '', phone: '', relation: '' },
  });
  const [documents, setDocuments] = useState<{ file: File; type: string; name: string }[]>([]);

  const setField = (path: string, value: string) => {
    setForm(prev => {
      const keys = path.split('.');
      if (keys.length === 1) return { ...prev, [keys[0]]: value };
      const nested = { ...(prev as any)[keys[0]], [keys[1]]: value };
      return { ...prev, [keys[0]]: nested };
    });
  };

  const validateStep = (): string | null => {
    if (step === 0) {
      if (!form.name.trim()) return 'Full name is required';
      if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) return 'Valid email is required';
      if (!form.phone.trim() || form.phone.trim().length < 10) return 'Valid phone number is required (min 10 digits)';
    }
    return null;
  };

  const handleNext = () => {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError('');
    setStep(s => Math.min(s + 1, STEPS.length - 1));
  };

  const handleBack = () => { setError(''); setStep(s => Math.max(s - 1, 0)); };

  const handleDocAdd = (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocuments(prev => [...prev, { file, type, name: file.name }]);
    e.target.value = '';
  };

  const handleDocRemove = (idx: number) => setDocuments(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const payload = {
        ...form,
        hostelId,
        address: Object.values(form.address).some((v: string) => v.trim() !== '') ? form.address : undefined,
        parentContact: Object.values(form.parentContact).some((v: string) => v.trim() !== '') ? form.parentContact : undefined,
        emergencyContact: Object.values(form.emergencyContact).some((v: string) => v.trim() !== '') ? form.emergencyContact : undefined,
      };
      const res = await api.registerStudentViaQR(payload);
      const studentId = res.data?.id;
      const token = res.data?.token;
      if (documents.length > 0 && studentId && token) {
        try { await api.uploadSelfDocuments(studentId, documents, token); } catch { /* non-fatal */ }
      }
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center py-8">
        <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-green-500/30">
          <CheckCircle className="w-12 h-12 text-white" />
        </div>
        <h2 className="text-3xl font-bold text-white mb-3">You are Registered! 🎉</h2>
        <p className="text-slate-300 mb-2 text-lg">Your account has been created successfully.</p>
        <p className="text-slate-400 mb-8 max-w-md mx-auto text-sm">
          Your login credentials have been sent to{' '}
          <span className="text-violet-400 font-semibold">{form.email}</span>.
          Please check your inbox and use those credentials to log in.
        </p>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 max-w-sm mx-auto mb-8 text-left space-y-3">
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">What is next?</p>
          {['Check your email for login credentials', 'Log in with your email and generated password', 'Change your password from the Profile page'].map((t, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-6 h-6 bg-violet-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{i + 1}</div>
              <span className="text-slate-300 text-sm">{t}</span>
            </div>
          ))}
        </div>
        <button onClick={() => router.push('/login')}
          className="px-8 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold rounded-xl hover:from-violet-500 hover:to-purple-500 transition-all duration-200 shadow-lg shadow-violet-500/30">
          Go to Login
        </button>
      </div>
    );
  }

  const currentStep = STEPS[step];
  const progress = (step / (STEPS.length - 1)) * 100;
  const iconMap: Record<string, React.ComponentType<any>> = { User, MapPin, Phone, FileText, Check };
  const StepIcon = iconMap[currentStep.icon] || User;

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div>
        <div className="flex justify-between items-end mb-3">
          {STEPS.map((s, i) => {
            const SIcon = iconMap[s.icon] || User;
            const isActive = i === step;
            const isDone = i < step;
            return (
              <button key={s.id} onClick={() => isDone && setStep(i)}
                className={`flex flex-col items-center gap-1 ${isDone ? 'cursor-pointer' : 'cursor-default'}`}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isDone ? 'bg-emerald-500 shadow-lg shadow-emerald-500/40' :
                  isActive ? `bg-gradient-to-br ${s.color} shadow-lg` :
                  'bg-white/10 border border-white/20'}`}>
                  {isDone ? <Check className="w-4 h-4 text-white" /> : <SIcon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-500'}`} />}
                </div>
                <span className={`text-[9px] font-medium hidden sm:block ${isActive ? 'text-white' : isDone ? 'text-emerald-400' : 'text-slate-600'}`}>{s.label}</span>
              </button>
            );
          })}
        </div>
        <div className="h-1 bg-white/10 rounded-full mx-4 relative">
          <div className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Step header */}
      <div className={`bg-gradient-to-r ${currentStep.color} p-px rounded-2xl`}>
        <div className="bg-slate-900/95 backdrop-blur rounded-2xl px-5 py-4 flex items-center gap-4">
          <div className={`w-11 h-11 bg-gradient-to-br ${currentStep.color} rounded-xl flex items-center justify-center shadow-lg`}>
            <StepIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Step {step + 1} of {STEPS.length}</p>
            <h3 className="text-base font-bold text-white">{currentStep.label}</h3>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Content */}
      <div className="min-h-[240px]">
        {step === 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><InputField label="Full Name" required type="text" value={form.name} placeholder="e.g. Rahul Sharma" onChange={e => setField('name', e.target.value)} /></div>
            <InputField label="Email Address" required type="email" value={form.email} placeholder="you@example.com" onChange={e => setField('email', e.target.value)} />
            <InputField label="Phone Number" required type="tel" value={form.phone} placeholder="+91 98765 43210" onChange={e => setField('phone', e.target.value)} />
            <InputField label="Date of Birth" type="date" value={form.dateOfBirth} onChange={e => setField('dateOfBirth', e.target.value)} />
            <SelectField label="Gender" value={form.gender} onChange={v => setField('gender', v)} options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other / Prefer not to say' }]} />
            <div className="sm:col-span-2"><InputField label="Course / College" type="text" value={form.course} placeholder="e.g. B.Tech CSE, IIT Delhi" onChange={e => setField('course', e.target.value)} /></div>
            <div className="sm:col-span-2 bg-violet-500/10 border border-violet-500/20 rounded-xl p-4 flex items-start gap-3">
              <Shield className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
              <p className="text-slate-400 text-xs leading-relaxed"><span className="text-violet-300 font-semibold">No password needed.</span> Your login credentials will be auto-generated and emailed to you after registration. Change your password anytime from your profile.</p>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><InputField label="Street Address" type="text" value={form.address.street} placeholder="House no, Street, Locality" onChange={e => setField('address.street', e.target.value)} /></div>
            <InputField label="City" type="text" value={form.address.city} placeholder="City" onChange={e => setField('address.city', e.target.value)} />
            <InputField label="State" type="text" value={form.address.state} placeholder="State" onChange={e => setField('address.state', e.target.value)} />
            <InputField label="Pincode" type="text" value={form.address.pincode} placeholder="000000" onChange={e => setField('address.pincode', e.target.value)} />
            <InputField label="Country" type="text" value={form.address.country} placeholder="India" onChange={e => setField('address.country', e.target.value)} />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2"><Users className="w-4 h-4 text-emerald-400" /><h4 className="text-sm font-semibold text-white">Parent / Guardian Contact</h4></div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <InputField label="Name" type="text" value={form.parentContact.name} placeholder="Parent name" onChange={e => setField('parentContact.name', e.target.value)} />
                <InputField label="Phone" type="tel" value={form.parentContact.phone} placeholder="+91 9876543210" onChange={e => setField('parentContact.phone', e.target.value)} />
                <InputField label="Email" type="email" value={form.parentContact.email} placeholder="parent@email.com" onChange={e => setField('parentContact.email', e.target.value)} />
              </div>
            </div>
            <div className="border-t border-white/10 pt-6 space-y-3">
              <div className="flex items-center gap-2"><AlertCircle className="w-4 h-4 text-rose-400" /><h4 className="text-sm font-semibold text-white">Emergency Contact</h4></div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <InputField label="Name" type="text" value={form.emergencyContact.name} placeholder="Contact name" onChange={e => setField('emergencyContact.name', e.target.value)} />
                <InputField label="Phone" type="tel" value={form.emergencyContact.phone} placeholder="+91 9876543210" onChange={e => setField('emergencyContact.phone', e.target.value)} />
                <InputField label="Relation" type="text" value={form.emergencyContact.relation} placeholder="e.g. Father, Sister" onChange={e => setField('emergencyContact.relation', e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-slate-400 text-sm">Upload your documents for hostel verification. All optional.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {DOC_TYPES.map(doc => {
                const uploaded = documents.filter(d => d.type === doc.value);
                return (
                  <div key={doc.value} className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-white">{doc.label}</span>
                      {uploaded.length > 0 && <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2 py-0.5 rounded-full">✓ Added</span>}
                    </div>
                    {uploaded.map((d) => (
                      <div key={d.name} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2 mb-2 text-xs text-slate-400">
                        <span className="truncate max-w-[120px]">{d.name}</span>
                        <button type="button" onClick={() => handleDocRemove(documents.indexOf(d))} className="text-rose-400 hover:text-rose-300 ml-2"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                    <label className="flex items-center gap-2 cursor-pointer text-violet-400 hover:text-violet-300 text-xs font-medium transition-colors mt-1">
                      <Upload className="w-3.5 h-3.5" />Add file
                      <input type="file" accept="image/*,application/pdf" className="hidden" onChange={e => handleDocAdd(e, doc.value)} />
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            {/* Basic */}
            <div className="bg-white/5 rounded-2xl p-5 space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Basic Info</h4>
              {[['Name', form.name], ['Email', form.email], ['Phone', form.phone], ['Date of Birth', form.dateOfBirth], ['Gender', form.gender], ['Course', form.course], ['Hostel', hostelName || '']].filter(([, v]) => v).map(([l, v]) => (
                <div key={l} className="flex justify-between text-sm py-1 border-b border-white/5">
                  <span className="text-slate-400">{l}</span>
                  <span className="text-white font-medium text-right max-w-[55%] truncate">{v}</span>
                </div>
              ))}
            </div>
            {/* Address */}
            {Object.values(form.address).some((v: string) => v.trim() !== '') && (
              <div className="bg-white/5 rounded-2xl p-5 space-y-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Address</h4>
                {[['Street', form.address.street], ['City', form.address.city], ['State', form.address.state], ['Pincode', form.address.pincode], ['Country', form.address.country]].filter(([, v]) => v).map(([l, v]) => (
                  <div key={l} className="flex justify-between text-sm py-1 border-b border-white/5">
                    <span className="text-slate-400">{l}</span>
                    <span className="text-white font-medium">{v}</span>
                  </div>
                ))}
              </div>
            )}
            {/* Docs */}
            {documents.length > 0 && (
              <div className="bg-white/5 rounded-2xl p-5">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Documents ({documents.length})</h4>
                {documents.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-slate-300 py-1">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    <span>{DOC_TYPES.find(t => t.value === d.type)?.label}</span>
                    <span className="text-slate-500 text-xs truncate">— {d.name}</span>
                  </div>
                ))}
              </div>
            )}
            {/* Notice */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-slate-400 text-xs">By submitting, your account is created and credentials are sent to <span className="text-amber-300 font-medium">{form.email}</span>. A secure password will be auto-generated.</p>
            </div>
          </div>
        )}
      </div>

      {/* Nav buttons */}
      <div className="flex justify-between pt-2">
        <button type="button" onClick={handleBack} disabled={step === 0}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/20 text-slate-300 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all font-medium text-sm">
          <ChevronLeft className="w-4 h-4" />Back
        </button>
        {step < STEPS.length - 1 ? (
          <button type="button" onClick={handleNext}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold text-sm hover:from-violet-500 hover:to-purple-500 transition-all shadow-lg shadow-violet-500/30">
            Next<ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button type="button" onClick={handleSubmit} disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold text-sm hover:from-emerald-500 hover:to-teal-500 disabled:opacity-60 transition-all shadow-lg shadow-emerald-500/30">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Submitting...</> : <><CheckCircle className="w-4 h-4" />Complete Registration</>}
          </button>
        )}
      </div>
    </div>
  );
}

function SimpleRegisterForm() {
  const [formData, setFormData] = useState({ name: '', email: '', password: '', phone: '', role: 'student' as 'student' | 'cleaner' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { register } = useAuth();
  const router = useRouter();

  const navigateToRole = (role: string | string[] | undefined) => {
    const roleStr = typeof role === 'string' ? role : Array.isArray(role) && role.length > 0 ? role[0] : '';
    switch (roleStr) {
      case 'student': router.replace('/student/dashboard'); break;
      case 'warden': router.replace('/warden/dashboard'); break;
      case 'cleaner': case 'supervisor': router.replace('/cleaner/tasks'); break;
      case 'owner': router.replace('/owner/dashboard'); break;
      default: router.replace('/login');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.password || !formData.phone) { setError('Please fill in all fields'); return; }
    setLoading(true); setError('');
    try {
      const registeredUser = await register(formData);
      if (registeredUser?.role) navigateToRole(registeredUser.role);
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-lg">
        <h2 className="text-center text-3xl font-bold text-gray-900">Create Account</h2>
        <form className="mt-8 space-y-6" onSubmit={handleRegister}>
          {error && <div className="rounded-md bg-red-50 p-4"><p className="text-sm text-red-800">{error}</p></div>}
          <div className="space-y-4">
            <div><label htmlFor="sr-name" className="block text-sm font-medium text-gray-700">Full Name</label><input id="sr-name" type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500" /></div>
            <div><label htmlFor="sr-email" className="block text-sm font-medium text-gray-700">Email</label><input id="sr-email" type="email" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500" /></div>
            <div><label htmlFor="sr-phone" className="block text-sm font-medium text-gray-700">Phone</label><input id="sr-phone" type="tel" required value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500" /></div>
            <div>
              <label htmlFor="sr-password" className="block text-sm font-medium text-gray-700">Password</label>
              <div className="relative"><input id="sr-password" type={showPassword ? 'text' : 'password'} required value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 pr-10 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 mt-[-5px] -translate-y-1/2 text-gray-500 hover:text-gray-700">{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></div>
            </div>
            <div><label htmlFor="sr-role" className="block text-sm font-medium text-gray-700">Role</label><select id="sr-role" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value as 'student' | 'cleaner' })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"><option value="student">Student</option><option value="cleaner">Cleaner</option></select></div>
          </div>
          <button type="submit" disabled={loading} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">{loading ? 'Creating...' : 'Sign Up'}</button>
          <div className="text-center"><a href="/login" className="text-sm text-blue-600 hover:text-blue-500">Already have an account? Sign In</a></div>
        </form>
      </div>
    </div>
  );
}

function RegisterContent() {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get('invite');
  const [inviteState, setInviteState] = useState<'loading' | 'valid' | 'invalid' | 'none'>('none');
  const [hostelId, setHostelId] = useState('');
  const [hostelName, setHostelName] = useState('');

  useEffect(() => {
    if (!inviteToken) { setInviteState('none'); return; }
    setInviteState('loading');
    api.verifyInviteToken(inviteToken)
      .then(res => {
        if (res.success && res.data?.hostelId) {
          setHostelId(res.data.hostelId);
          setHostelName(res.data.hostelName || '');
          setInviteState('valid');
        } else { setInviteState('invalid'); }
      })
      .catch(() => setInviteState('invalid'));
  }, [inviteToken]);

  if (!inviteToken) return <SimpleRegisterForm />;

  if (inviteState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4"><Loader2 className="w-10 h-10 text-violet-400 animate-spin" /><p className="text-slate-400 text-sm">Verifying your invite...</p></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col" style={{ fontFamily: 'Inter, Outfit, sans-serif' }}>
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl" />
      </div>
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-violet-500/40">
            <QrCode className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-white mb-2 tracking-tight">Hostel Registration</h1>
          <p className="text-slate-400 text-sm max-w-xs mx-auto">
            {inviteState === 'valid' ? `Invited to join ${hostelName || 'the hostel'}. Fill in your details below.` : 'Complete the form below to register.'}
          </p>
          {inviteState === 'invalid' && (
            <div className="mt-3 flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2.5 text-amber-400 text-sm max-w-xs mx-auto">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />Invite invalid/expired. Contact admin.
            </div>
          )}
          {inviteState === 'valid' && (
            <div className="mt-3 flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-2.5 text-emerald-400 text-sm max-w-xs mx-auto">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />Valid invite — hostel pre-assigned
            </div>
          )}
        </div>
        <div className="w-full max-w-xl bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl shadow-black/50">
          <QRRegistrationForm hostelId={hostelId} hostelName={hostelName} />
        </div>
        <p className="text-slate-600 text-xs mt-6">Already registered? <a href="/login" className="text-violet-400 hover:text-violet-300 transition-colors">Sign in here</a></p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-950"><Loader2 className="w-10 h-10 text-violet-400 animate-spin" /></div>}>
      <RegisterContent />
    </Suspense>
  );
}
