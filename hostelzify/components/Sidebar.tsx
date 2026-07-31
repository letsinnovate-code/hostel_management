'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import Link from 'next/link';
import {
  Home,
  Building2,
  Settings,
  Users,
  UserCheck,
  GraduationCap,
  Shield,
  DollarSign,
  MessageSquare,
  BarChart3,
  FileText,
  Wrench,
  LogOut,
  ChevronDown,
  ChevronRight,
  X,
  UtensilsCrossed,
  ShieldAlert,
  Megaphone,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const STORAGE_KEY = 'sidebar_expanded_items';

// Static menu config outside component so it is not recreated on every render
const MENU_ITEMS = [
    {
      title: 'Dashboard',
      icon: Home,
      href: '/owner/dashboard',
      color: '#0a7ea4',
    },
    {
      title: 'System & Hostel Setup',
      icon: Building2,
      color: '#0a7ea4',
      subItems: [
        { label: 'Manage Hostels', href: '/owner/hostels' },
        { label: 'Room Configuration', href: '/owner/rooms' },
        { label: 'Amenities Setup', href: '/owner/amenities' },
      ],
    },
    {
      title: 'Student Management',
      icon: GraduationCap,
      color: '#9C27B0',
      subItems: [
        { label: 'Students (presence & management)', href: '/owner/students/presence' },
        { label: 'Leave / Outpass', href: '/owner/leave-requests' },
        { label: 'Maintenance', href: '/owner/maintenance' },
      ],
    },
    {
      title: 'Staff Management',
      icon: Users,
      color: '#FF9800',
      subItems: [
        { label: 'Staff Management', href: '/owner/staff' },
      ],
    },
    {
      title: 'Rule Engine & Policies',
      icon: Settings,
      color: '#4CAF50',
      subItems: [
        { label: 'Rules & Policies', href: '/owner/rules' },
      ],
    },
    {
      title: 'Security & Presence',
      icon: Shield,
      color: '#f44336',
      subItems: [
        { label: 'Geo-Fence Setup', href: '/owner/geo-fence' },
        { label: 'Violations', href: '/owner/violations' },
        { label: 'Gate logs', href: '/owner/gate-logs' },
        { label: 'All Students (map)', href: '/owner/students-map' },
      ],
    },
    {
      title: 'Finance & Payments',
      icon: DollarSign,
      color: '#4CAF50',
      subItems: [
        { label: 'Fee structure & payments', href: '/owner/fee-structure' },
      ],
    },
    {
      title: 'Communication',
      icon: MessageSquare,
      color: '#2196F3',
      subItems: [
        { label: 'Alert Centre', href: '/owner/alerts' },
        { label: 'Notice Board', href: '/owner/broadcast' },
      ],
    },
    {
      title: 'Mess & Food',
      icon: UtensilsCrossed,
      color: '#e65100',
      subItems: [
        { label: 'Mess Schedule', href: '/owner/mess' },
        { label: 'Mess Feedback', href: '/owner/mess-feedback' },
      ],
    },
    {
      title: 'Analytics & Reports',
      icon: BarChart3,
      color: '#FF5722',
      subItems: [
        { label: 'Analytics', href: '/owner/analytics' },
      ],
    },
    {
      title: 'Compliance & Audit',
      icon: FileText,
      color: '#607D8B',
      subItems: [
        { label: 'Audit Trail', href: '/owner/audit' },
      ],
    },
    {
      title: 'System Governance',
      icon: Wrench,
      color: '#795548',
      subItems: [
        { label: 'Support Tickets', href: '/owner/support' },
      ],
    },
  ];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Load expanded items from localStorage on mount
  const [expandedItems, setExpandedItems] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    }
    return [];
  });

  // Save to localStorage whenever expandedItems changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(expandedItems));
    }
  }, [expandedItems]);

  // Auto-expand sections containing the current active page (only when pathname changes)
  useEffect(() => {
    MENU_ITEMS.forEach((item) => {
      if (item.subItems) {
        const isActive = item.subItems.some((subItem) => pathname === subItem.href);
        if (isActive) {
          setExpandedItems((prev) => (prev.includes(item.title) ? prev : [...prev, item.title]));
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggleExpand = useCallback((title: string) => {
    setExpandedItems((prev) => {
      const newItems = prev.includes(title)
        ? prev.filter((item) => item !== title)
        : [...prev, title];
      // Save to localStorage immediately
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newItems));
      }
      return newItems;
    });
  }, []);

  const handleLogout = useCallback(async () => {
    await logout();
    router.push('/login');
  }, [logout, router]);

  return (
    <>
      {/* Overlay - only on mobile with smooth fade animation */}
      <div
        className={`fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden transition-all duration-300 ease-in-out ${isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
          }`}
        onClick={onClose}
        aria-hidden={!isOpen}
      />

      {/* Sidebar with improved slide animation */}
      <aside
        className={`fixed left-0 top-0 h-full w-72 sm:w-80 lg:w-64 bg-gradient-to-b from-gray-50 to-white border-r border-gray-200 shadow-2xl z-50 transform transition-all duration-300 ease-out ${isOpen
            ? 'translate-x-0 opacity-100'
            : '-translate-x-full opacity-0 lg:translate-x-0 lg:opacity-100'
          }`}
        aria-label="Navigation sidebar"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-[10px] border-b border-gray-200 bg-white flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center text-white font-bold shadow-md">
                {user?.name?.charAt(0).toUpperCase() || 'O'}
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{user?.name || 'Owner'}</p>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-gray-500 uppercase font-medium">{user?.currentRole || user?.role || 'OWNER'}</p>
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
            {MENU_ITEMS.map((item, index) => {
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

          {/* Footer */}
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
