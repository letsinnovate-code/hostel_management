'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import { useAuth, isOwnerUser } from '../contexts/AuthContext';
import { useOwnerHostelOptional } from '../contexts/OwnerHostelContext';
import Link from 'next/link';
import { Settings, User, LogOut, ChevronDown, Menu, X, Building2 } from 'lucide-react';

interface OwnerLayoutProps {
  children: React.ReactNode;
}

export default function OwnerLayout({ children }: OwnerLayoutProps) {
  const { user, loading, logout } = useAuth();
  const ownerHostel = useOwnerHostelOptional();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsDropdownOpen, setSettingsDropdownOpen] = useState(false);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  // Redirect to login if not owner (protects all owner routes)
  useEffect(() => {
    if (loading) return;
    if (!user || !isOwnerUser(user)) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  // Set sidebar open by default on desktop, closed on mobile (only on initial mount)
  useEffect(() => {
    // Only set initial state, don't override user actions
    if (window.innerWidth >= 1024) {
      setSidebarOpen(true);
    } else {
      setSidebarOpen(false);
    }
  }, []);

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  if (loading || !user || !isOwnerUser(user)) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar - stable onClose ref to avoid remount on parent re-render */}
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:ml-64 w-full">
        {/* Top Bar */}
        <header className="bg-white shadow-sm border-b border-gray-200 lg:static fixed top-0 left-0 right-0 z-30 lg:z-0">
          <div className="px-4 py-3 flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors relative z-50"
              aria-label="Toggle sidebar"
            >
              {sidebarOpen ? (
                <X className="w-6 h-6 text-gray-700" />
              ) : (
                <Menu className="w-6 h-6 text-gray-700" />
              )}
            </button>
            <h1 className="text-xl font-semibold text-gray-900 lg:block hidden">
              Hostel Management System
            </h1>
            {ownerHostel && ownerHostel.hostels.length > 0 && (
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-gray-500 hidden sm:block" />
                <select
                  value={ownerHostel.selectedHostel}
                  onChange={(e) => ownerHostel.setSelectedHostel(e.target.value)}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[140px] max-w-[200px]"
                  aria-label="Select hostel"
                >
                  {ownerHostel.hostels.map((h) => (
                    <option key={h._id || h.id} value={h._id || h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex items-center gap-3">
              {/* Logout button - visible on all owner pages */}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-200"
                aria-label="Logout"
              >
                <LogOut className="w-5 h-5" />
                <span className="hidden sm:block text-sm font-medium">Logout</span>
              </button>
              {/* Settings Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setSettingsDropdownOpen(!settingsDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Settings className="w-5 h-5" />
                  <span className="hidden md:block text-sm font-medium">Settings</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${settingsDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {settingsDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setSettingsDropdownOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                      <div className="py-2">
                        <Link
                          href="/owner/profile"
                          onClick={() => setSettingsDropdownOpen(false)}
                          className="flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <User className="w-4 h-4" />
                          <span className="text-sm font-medium">My Profile</span>
                        </Link>
                        <Link
                          href="/owner/profile/edit"
                          onClick={() => setSettingsDropdownOpen(false)}
                          className="flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <Settings className="w-4 h-4" />
                          <span className="text-sm font-medium">Edit Profile</span>
                        </Link>
                        <Link
                          href="/owner/profile/change-password"
                          onClick={() => setSettingsDropdownOpen(false)}
                          className="flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                          </svg>
                          <span className="text-sm font-medium">Change Password</span>
                        </Link>
                        <div className="border-t border-gray-200 my-2" />
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-3 px-4 py-2 text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          <span className="text-sm font-medium">Logout</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* User Avatar */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-semibold">
                  {user?.name?.charAt(0).toUpperCase() || 'O'}
                </div>
                <span className="hidden md:block text-sm font-medium text-gray-700">{user?.name || 'Owner'}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto pt-16 lg:pt-0">
          {children}
        </main>
      </div>
    </div>
  );
}
