'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  Bell,
  Clock,
  Shield,
  ShieldAlert,
  FileCheck2,
  AlertTriangle,
  Users,
  BedDouble,
  UserCheck,
  LifeBuoy,
  LogOut,
  X,
  UserPlus,
} from 'lucide-react';

interface WardenSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WardenSidebar({ isOpen, onClose }: WardenSidebarProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const menuItems = [
    {
      label: 'Dashboard',
      href: '/warden/dashboard',
      icon: LayoutDashboard,
    },
    {
      label: 'Onboarding Applications',
      href: '/warden/onboarding',
      icon: UserPlus,
    },
    {
      label: 'Students',
      href: '/warden/students',
      icon: Users,
    },
    {
      label: 'Rooms & Beds',
      href: '/warden/rooms',
      icon: BedDouble,
    },
    {
      label: 'Attendance',
      href: '/warden/attendance',
      icon: UserCheck,
    },
    {
      label: 'Curfew Control',
      href: '/warden/curfew',
      icon: ShieldAlert,
    },
    {
      label: 'Alerts & Broadcasts',
      href: '/warden/alerts',
      icon: Bell,
    },
    {
      label: 'Leave & Permissions',
      href: '/warden/permissions',
      icon: FileCheck2,
    },
    {
      label: 'Disciplinary Records',
      href: '/warden/violations',
      icon: AlertTriangle,
    },
    {
      label: 'Complaints',
      href: '/warden/complaints',
      icon: LifeBuoy,
    },
  ];

  const isActive = (href: string) => pathname === href;

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={`fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden transition-all duration-300 ${isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
          }`}
        onClick={onClose}
      />

      {/* Sidebar container */}
      <aside
        className={`
          fixed left-0 top-0 h-full z-50
          w-64 bg-white border-r border-gray-200
          transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
          transition-transform duration-300 ease-in-out
          flex flex-col
        `}
      >
        {/* Header / Logo */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-100">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">Warden</h1>
              <p className="text-xs text-gray-500">Campus Oversight</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200
                  ${active
                    ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }
                `}
              >
                <Icon className={`w-5 h-5 ${active ? 'text-indigo-600' : 'text-gray-400'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User profile & Logout */}
        <div className="p-4 border-t border-gray-200 bg-white">
          <div className="p-3 bg-gray-50 rounded-xl mb-3">
            <p className="text-sm font-bold text-gray-900 truncate">{user?.name || 'Warden Staff'}</p>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                {user?.currentRole || 'Warden'}
              </span>
              {user?.hasMultipleRoles && (
                <Link
                  href="/select-role?switch=true"
                  className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md border border-indigo-100 font-bold hover:bg-indigo-600 hover:text-white transition-colors"
                >
                  Switch
                </Link>
              )}
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
