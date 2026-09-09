
'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import Link from 'next/link';
import {
  Home,
  User,
  Shield,
  FileText,
  Bell,
  UtensilsCrossed,
  MapPin,
  LogOut,
  ChevronDown,
  Sparkles,
  X,
  Zap,
  CreditCard,
  UserCheck,
} from 'lucide-react';

interface StudentSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const STORAGE_KEY = 'student_sidebar_expanded_items';

export default function StudentSidebar({ isOpen, onClose }: StudentSidebarProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setExpandedItems(JSON.parse(stored));
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(expandedItems));
    }
  }, [expandedItems]);

  const menuItems = [
    {
      title: 'Dashboard',
      icon: Home,
      href: '/student/dashboard',
      color: '#0a7ea4',
    },
    {
      title: 'Hostel Onboarding',
      icon: UserCheck,
      href: '/student/onboarding',
      color: '#6366F1',
    },
    {
      title: 'Housing & Cleaning',
      icon: Sparkles,
      color: '#00BCD4',
      subItems: [
        { label: 'Request Cleaning', href: '/student/cleaning' },
        { label: 'Maintenance Issues', href: '/student/complaints' },
      ],
    },
    {
      title: 'Presence & Check-in',
      icon: MapPin,
      color: '#4CAF50',
      subItems: [
        { label: 'Check In/Out', href: '/student/dashboard#checkin' },
        { label: 'Attendance History', href: '/student/attendance' },
      ],
    },
    {
      title: 'Profile & Settings',
      icon: User,
      color: '#2196F3',
      subItems: [
        { label: 'My Profile', href: '/student/profile' },
        { label: 'Documents', href: '/student/documents' },
      ],
    },
    {
      title: 'Finance & Payments',
      icon: CreditCard,
      color: '#4CAF50',
      subItems: [
        { label: 'Fees & Online Payments', href: '/student/payments' },
      ],
    },
    {
      title: 'Permissions',
      icon: Shield,
      color: '#FF9800',
      subItems: [
        { label: 'Leave Requests', href: '/student/permissions' },
        { label: 'Visitor Requests', href: '/student/visitors' },
      ],
    },
    {
      title: 'Compliance',
      icon: FileText,
      color: '#f44336',
      subItems: [
        { label: 'Violations', href: '/student/violations' },
      ],
    },
    {
      title: 'Communication',
      icon: Bell,
      color: '#9C27B0',
      subItems: [
        { label: 'My Alerts', href: '/student/alerts' },
        { label: 'Notice Board', href: '/student/notifications' },
      ],
    },
    {
      title: 'Services',
      icon: UtensilsCrossed,
      color: '#795548',
      subItems: [
        { label: 'Mess Schedule', href: '/student/mess' },
        { label: 'Mess Feedback', href: '/student/mess-feedback' },
      ],
    },
  ];

  // Auto-expand sections containing the current active page
  useEffect(() => {
    menuItems.forEach((item) => {
      if (item.subItems) {
        const isActive = item.subItems.some((subItem) => pathname === subItem.href);
        if (isActive && !expandedItems.includes(item.title)) {
          setExpandedItems((prev) => [...prev, item.title]);
        }
      }
    });

    // Special check for cleaning page if accessed directly
    if (pathname.includes('/student/cleaning') && !expandedItems.includes('Housing & Cleaning')) {
      setExpandedItems((prev) => [...prev, 'Housing & Cleaning']);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggleExpand = (title: string) => {
    setExpandedItems((prev) => {
      const newItems = prev.includes(title)
        ? prev.filter((item) => item !== title)
        : [...prev, title];
      return newItems;
    });
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden transition-all duration-300 ease-in-out ${isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
          }`}
        onClick={onClose}
        aria-hidden={!isOpen}
      />

      <aside
        className={`fixed left-0 top-0 h-full w-72 sm:w-80 lg:w-64 bg-gradient-to-b from-gray-50 to-white border-r border-gray-200 shadow-2xl z-50 transform transition-all duration-300 ease-out ${isOpen
          ? 'translate-x-0 opacity-100'
          : '-translate-x-full opacity-0 lg:translate-x-0 lg:opacity-100'
          }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center text-white font-bold shadow-md">
                {user?.name?.charAt(0).toUpperCase() || 'S'}
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{user?.name || 'Student'}</p>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-gray-500 uppercase font-medium">{user?.currentRole || user?.role || 'STUDENT'}</p>
                  {user?.hasMultipleRoles && (
                    <Link
                      href="/select-role?switch=true"
                      className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100 font-bold hover:bg-blue-600 hover:text-white transition-colors"
                    >
                      Switch
                    </Link>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Menu Items */}
          <div className="flex-1 overflow-y-auto py-2 sidebar-scroll">
            {menuItems.map((item, index) => {
              const IconComponent = item.icon;
              const isExpanded = expandedItems.includes(item.title);
              const hasActiveSubItem = item.subItems?.some((subItem) => pathname === subItem.href);
              const isActive = pathname === item.href || hasActiveSubItem;

              return (
                <div key={index} className="mb-1">
                  {item.subItems ? (
                    <>
                      <button
                        onClick={() => toggleExpand(item.title)}
                        className={`w-full flex items-center justify-between px-4 py-3 mx-2 rounded-lg transition-all duration-200 group ${isActive
                          ? 'bg-blue-100 border-l-4 border-blue-600 shadow-md'
                          : 'hover:bg-gray-100 hover:shadow-sm'
                          }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`p-1.5 rounded-md transition-colors ${isActive ? 'bg-blue-600' : 'bg-gray-100 group-hover:bg-gray-200'
                            }`}>
                            <IconComponent className={`w-4 h-4 transition-colors ${isActive ? 'text-white' : 'text-gray-600'
                              }`} />
                          </div>
                          <span className={`font-medium text-sm transition-colors ${isActive ? 'text-blue-900 font-semibold' : 'text-gray-700 group-hover:text-gray-900'
                            }`}>
                            {item.title}
                          </span>
                        </div>
                        <ChevronDown
                          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''
                            }`}
                        />
                      </button>
                      <div
                        className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                          }`}
                      >
                        <div className="mt-1 ml-2 pl-6 border-l-2 border-gray-200">
                          {item.subItems.map((subItem, subIndex) => {
                            const isSubActive = pathname === subItem.href;
                            return (
                              <Link
                                key={subIndex}
                                href={subItem.href}
                                onClick={onClose}
                                className={`block px-4 py-2.5 mx-2 rounded-lg transition-all duration-200 group ${isSubActive
                                  ? 'bg-blue-100 border-l-4 border-blue-600 shadow-md'
                                  : 'hover:bg-gray-50 hover:pl-5 hover:shadow-sm'
                                  }`}
                              >
                                <span className={`text-sm transition-colors ${isSubActive
                                  ? 'text-blue-900 font-semibold'
                                  : 'text-gray-600 group-hover:text-gray-900'
                                  }`}>
                                  {subItem.label}
                                </span>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  ) : (
                    <Link
                      href={item.href || '#'}
                      onClick={onClose}
                      className={`flex items-center space-x-3 px-4 py-3 mx-2 rounded-lg transition-all duration-200 group ${isActive
                        ? 'bg-blue-100 border-l-4 border-blue-600 shadow-md'
                        : 'hover:bg-gray-100 hover:shadow-sm'
                        }`}
                    >
                      <div className={`p-1.5 rounded-md transition-colors ${isActive ? 'bg-blue-600' : 'bg-gray-100 group-hover:bg-gray-200'
                        }`}>
                        <IconComponent className={`w-4 h-4 transition-colors ${isActive ? 'text-white' : 'text-gray-600'
                          }`} />
                      </div>
                      <span className={`font-medium text-sm transition-colors ${isActive ? 'text-blue-900 font-semibold' : 'text-gray-700 group-hover:text-gray-900'
                        }`}>
                        {item.title}
                      </span>
                    </Link>
                  )}
                </div>
              );
            })}
          </div>

          <div className="p-4 border-t border-gray-200 bg-white">
            <button
              onClick={handleLogout}
              className="w-full flex items-center space-x-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 group"
            >
              <div className="p-1.5 rounded-md bg-red-100 group-hover:bg-red-200 transition-colors">
                <LogOut className="w-4 h-4" />
              </div>
              <span className="font-semibold text-sm">Logout</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

