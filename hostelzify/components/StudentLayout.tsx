'use client';

import { useState } from 'react';
import StudentSidebar from './StudentSidebar';
import { useAuth } from '../contexts/AuthContext';
import Link from 'next/link';
import { Settings, User, LogOut, ChevronDown } from 'lucide-react';

interface StudentLayoutProps {
  children: React.ReactNode;
}

export default function StudentLayout({ children }: StudentLayoutProps) {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsDropdownOpen, setSettingsDropdownOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <StudentSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:ml-64 w-full">
        {/* Top Bar */}
        <header className="bg-white shadow-sm border-b border-gray-200 lg:static fixed top-0 left-0 right-0 z-30 lg:z-0">
          <div className="px-4 py-3 flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}

              className="lg:hidden p-2 hover:bg-gray-100 rounded"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-xl font-semibold text-gray-900 lg:block hidden">
              Hostel Management System
            </h1>
            <div className="flex items-center gap-3">
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
                          href="/student/profile"
                          onClick={() => setSettingsDropdownOpen(false)}
                          className="flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <User className="w-4 h-4" />
                          <span className="text-sm font-medium">My Profile</span>
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
                  {user?.name?.charAt(0).toUpperCase() || 'S'}
                </div>
                <span className="hidden md:block text-sm font-medium text-gray-700">{user?.name || 'Student'}</span>
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

