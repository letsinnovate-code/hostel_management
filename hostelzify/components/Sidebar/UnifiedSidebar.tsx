'use client';

import { useState, useEffect, useCallback, useId } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../contexts/AuthContext';
import {
  ChevronDown,
  ChevronRight,
  LogOut,
  X,
  Shield,
  Building2,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { NAVIGATION_CONFIGS, SidebarRoleConfig, NavItem } from '../../config/navigation';

export interface UnifiedSidebarProps {
  role?: 'owner' | 'warden' | 'student' | 'cleaner' | 'security' | string;
  isOpen?: boolean;
  onClose?: () => void;
  config?: SidebarRoleConfig;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function UnifiedSidebar({
  role = 'owner',
  isOpen = false,
  onClose,
  config: customConfig,
  isCollapsed = false,
  onToggleCollapse,
}: UnifiedSidebarProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const sidebarId = useId();

  // Pick configuration based on prop or user role
  const effectiveRole = role || (user as any)?.currentRole || (Array.isArray(user?.role) ? user.role[0] : user?.role) || 'owner';
  const roleConfig = customConfig || NAVIGATION_CONFIGS[effectiveRole] || NAVIGATION_CONFIGS.owner;

  // Track expanded menu sections with localStorage persistence
  const [expandedItems, setExpandedItems] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(roleConfig.storageKey);
        return stored ? JSON.parse(stored) : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(roleConfig.storageKey, JSON.stringify(expandedItems));
      } catch (_) {}
    }
  }, [expandedItems, roleConfig.storageKey]);

  // Keyboard accessibility: Escape key closes drawer on mobile
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const toggleExpand = useCallback((title: string) => {
    setExpandedItems((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]
    );
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      router.push('/login');
    }
  };

  const isActive = useCallback(
    (href?: string) => {
      if (!href) return false;
      if (pathname === href) return true;
      // Exact match for root dashboards to prevent matching everything
      if (
        href === '/owner/dashboard' ||
        href === '/warden/dashboard' ||
        href === '/student/dashboard' ||
        href === '/cleaner/dashboard' ||
        href === '/security/dashboard'
      ) {
        return pathname === href;
      }
      return pathname.startsWith(href + '/');
    },
    [pathname]
  );

  const HeaderIcon = roleConfig.defaultIcon || Building2;
  const userInitial = (user?.name?.charAt(0) || roleConfig.badgeLabel.charAt(0)).toUpperCase();

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300 ${
          isOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar Container */}
      <aside
        id={sidebarId}
        role="navigation"
        aria-label={`${roleConfig.portalSubtitle} Navigation`}
        className={`fixed left-0 top-0 h-full w-72 sm:w-80 ${
          isCollapsed ? 'lg:w-20' : 'lg:w-64'
        } bg-gradient-to-b from-gray-50 to-white border-r border-gray-200 shadow-xl z-50 transform transition-all duration-300 ease-in-out ${
          isOpen
            ? 'translate-x-0 opacity-100'
            : '-translate-x-full opacity-0 lg:translate-x-0 lg:opacity-100'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-3.5 border-b border-gray-200 bg-white flex items-center justify-between">
            <div className={`flex items-center space-x-3 min-w-0 ${isCollapsed ? 'lg:justify-center lg:w-full' : ''}`}>
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
                <HeaderIcon className="w-4.5 h-4.5" />
              </div>
              {!isCollapsed && (
                <div className="min-w-0 hidden lg:block">
                  <h1 className="font-bold text-gray-900 text-sm leading-tight truncate">
                    {roleConfig.portalTitle}
                  </h1>
                  <p className="text-[11px] text-gray-500 font-medium truncate">
                    {roleConfig.portalSubtitle}
                  </p>
                </div>
              )}
              {/* Always show on mobile regardless of desktop collapsed state */}
              <div className="min-w-0 lg:hidden">
                <h1 className="font-bold text-gray-900 text-sm leading-tight truncate">
                  {roleConfig.portalTitle}
                </h1>
                <p className="text-[11px] text-gray-500 font-medium truncate">
                  {roleConfig.portalSubtitle}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Desktop Collapse / Expand Toggle Button */}
              {onToggleCollapse && (
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  title={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
                  className="hidden lg:flex p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                  aria-label={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
                >
                  {isCollapsed ? (
                    <PanelLeftOpen className="w-4 h-4 text-blue-600" />
                  ) : (
                    <PanelLeftClose className="w-4 h-4" />
                  )}
                </button>
              )}

              {/* Mobile close button */}
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="lg:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                  aria-label="Close navigation"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* Navigation Items */}
          <div className="flex-1 overflow-y-auto py-3 px-2 sm:px-3 space-y-1 sidebar-scroll">
            {roleConfig.items.map((item: NavItem, index: number) => {
              const Icon = item.icon;
              const hasSubItems = Boolean(item.subItems && item.subItems.length > 0);
              const isExpanded = expandedItems.includes(item.title || '');
              const itemTitle = item.title || item.label || '';
              const itemActive = isActive(item.href) || (hasSubItems && item.subItems!.some((s) => isActive(s.href)));

              // 1. Item with Sub-Items (Collapsible)
              if (hasSubItems) {
                return (
                  <div key={itemTitle || index} className="space-y-0.5 group relative">
                    <button
                      type="button"
                      onClick={() => toggleExpand(itemTitle)}
                      aria-expanded={isExpanded}
                      className={`w-full flex items-center ${
                        isCollapsed ? 'lg:justify-center lg:px-2' : 'justify-between px-3'
                      } py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                        itemActive
                          ? 'text-blue-700 bg-blue-50/80 font-bold'
                          : 'text-gray-700 hover:bg-gray-100/80 hover:text-gray-900'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <span
                          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0"
                          style={{
                            backgroundColor: itemActive
                              ? `${item.color || '#0a7ea4'}18`
                              : '#f3f4f6',
                            color: item.color || '#4b5563',
                          }}
                        >
                          <Icon className="w-4 h-4" />
                        </span>
                        <span className={`truncate ${isCollapsed ? 'lg:hidden' : ''}`}>{itemTitle}</span>
                      </div>
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${
                          isCollapsed ? 'lg:hidden' : ''
                        } ${isExpanded ? 'rotate-180 text-blue-600' : ''}`}
                      />
                    </button>

                    {/* Desktop Collapsed Hover Tooltip */}
                    {isCollapsed && (
                      <div className="hidden lg:group-hover:flex absolute left-full ml-2 px-2.5 py-1 bg-slate-900 text-white text-[11px] font-bold rounded-lg shadow-xl whitespace-nowrap z-50 pointer-events-none items-center gap-1.5 animate-fadeIn">
                        <span>{itemTitle}</span>
                      </div>
                    )}

                    {/* Sub-items List (Visible when expanded or on mobile) */}
                    {isExpanded && (!isCollapsed || true) && (
                      <div className={`pl-9 pr-2 py-1 space-y-0.5 animate-fadeIn ${isCollapsed ? 'lg:hidden' : ''}`}>
                        {item.subItems!.map((sub) => {
                          const subActive = isActive(sub.href);
                          return (
                            <Link
                              key={sub.href}
                              href={sub.href}
                              onClick={onClose}
                              aria-current={subActive ? 'page' : undefined}
                              className={`block px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                subActive
                                  ? 'text-blue-700 bg-blue-50/80 font-semibold'
                                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                              }`}
                            >
                              {sub.label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              // 2. Direct Link Item (Flat)
              return (
                <div key={item.href || itemTitle} className="group relative">
                  <Link
                    href={item.href || '#'}
                    onClick={onClose}
                    aria-current={itemActive ? 'page' : undefined}
                    className={`flex items-center ${
                      isCollapsed ? 'lg:justify-center lg:px-2' : 'space-x-2.5 px-3'
                    } py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                      itemActive
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 font-bold'
                        : 'text-gray-700 hover:bg-gray-100/80 hover:text-gray-900'
                    }`}
                  >
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        itemActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className={`truncate ${isCollapsed ? 'lg:hidden' : ''}`}>{itemTitle}</span>
                  </Link>

                  {/* Desktop Collapsed Hover Tooltip */}
                  {isCollapsed && (
                    <div className="hidden lg:group-hover:flex absolute left-full ml-2 px-2.5 py-1 bg-slate-900 text-white text-[11px] font-bold rounded-lg shadow-xl whitespace-nowrap z-50 pointer-events-none items-center gap-1.5 animate-fadeIn">
                      <span>{itemTitle}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* User Profile & Logout Footer */}
          <div className="p-3 border-t border-gray-200 bg-white/80 backdrop-blur-sm space-y-2">
            <div className={`flex items-center ${isCollapsed ? 'lg:justify-center' : 'justify-between'} px-2 py-1.5 bg-gray-50/80 rounded-xl border border-gray-100`}>
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-xs">
                  {userInitial}
                </div>
                {!isCollapsed && (
                  <div className="min-w-0 hidden lg:block">
                    <p className="text-xs font-bold text-gray-900 truncate">
                      {user?.name || roleConfig.badgeLabel}
                    </p>
                    <span
                      className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-semibold text-white ${roleConfig.badgeBg}`}
                    >
                      {roleConfig.badgeLabel}
                    </span>
                  </div>
                )}
                {/* Always show on mobile */}
                <div className="min-w-0 lg:hidden">
                  <p className="text-xs font-bold text-gray-900 truncate">
                    {user?.name || roleConfig.badgeLabel}
                  </p>
                  <span
                    className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-semibold text-white ${roleConfig.badgeBg}`}
                  >
                    {roleConfig.badgeLabel}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              title="Log out of console"
              className={`w-full flex items-center ${
                isCollapsed ? 'lg:justify-center' : 'justify-center space-x-2'
              } px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-xl transition-colors`}
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span className={isCollapsed ? 'lg:hidden' : ''}>Log out</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
