'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { Eye, EyeOff } from 'lucide-react';
import { STORAGE_KEYS } from '../../constants/config';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && user?.role) {
      if (user.hasMultipleRoles && user.roles && user.roles.length > 1) {
        router.replace('/select-role');
      } else {
        navigateToRole(user.role);
      }
    }
  }, [user, authLoading]);

  const getReturnPath = (): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      const path = sessionStorage.getItem(STORAGE_KEYS.RETURN_PATH);
      if (path) sessionStorage.removeItem(STORAGE_KEYS.RETURN_PATH);
      return path;
    } catch {
      return null;
    }
  };

  const navigateToRole = (role: string | string[] | undefined, useReturnPath = true) => {
    if (useReturnPath) {
      const returnPath = getReturnPath();
      if (returnPath && returnPath.startsWith('/')) {
        router.replace(returnPath);
        return;
      }
    }
    const roleStr = typeof role === 'string' ? role : Array.isArray(role) && role.length > 0 ? role[0] : '';
    const routes: Record<string, string> = {
      student: '/student/dashboard',
      warden: '/warden/dashboard',
      cleaner: '/cleaner/tasks',
      supervisor: '/cleaner/tasks',
      owner: '/owner/dashboard',
      security: '/security/dashboard',
      superadmin: '/superadmin',
    };
    router.replace(routes[roleStr] || '/login');
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const loggedInUser = await login(email, password);
      if (!loggedInUser?.role) return;
      if (loggedInUser.roles && loggedInUser.roles.length > 1) {
        router.replace('/select-role');
      } else {
        navigateToRole(loggedInUser.role);
      }
    } catch (err: any) {
      const message =
        err?.message ||
        err.response?.data?.message ||
        (err.response?.status === 500 && 'Server error. Please try again later.') ||
        (err.response?.status === 404 && 'Service not found. Please check if the server is running.') ||
        (err.code === 'ECONNABORTED' || err.message?.toLowerCase?.().includes('network') ? 'Connection failed. Check your network and try again.' : 'Invalid credentials. Please try again.');
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-lg">
        <div>
          <h2 className="text-center text-3xl font-bold text-gray-900">Hostel Management</h2>
          <p className="mt-2 text-center text-sm text-gray-600">Sign in to continue</p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 p-4" role="alert">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 pr-10 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
          <p className="text-center text-sm">
            <a href="/register" className="text-blue-600">Don&apos;t have an account? Sign up</a>
          </p>
        </form>
      </div>
    </div>
  );
}
