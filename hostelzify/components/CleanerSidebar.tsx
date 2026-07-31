'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import Link from 'next/link';
import {
    Home,
    User,
    CheckSquare,
    MapPin,
    Calendar,
    LogOut,
    ChevronDown,
    X,
} from 'lucide-react';

interface CleanerSidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

const STORAGE_KEY = 'cleaner_sidebar_expanded_items';

export default function CleanerSidebar({ isOpen, onClose }: CleanerSidebarProps) {
    const { user, logout } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    const [expandedItems, setExpandedItems] = useState<string[]>(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored ? JSON.parse(stored) : [];
        }
        return [];
    });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(expandedItems));
        }
    }, [expandedItems]);

    const menuItems = [
        {
            title: 'Dashboard',
            icon: Home,
            href: '/cleaner/dashboard', // Changed from /cleaner/tasks
            color: '#0a7ea4',
        },
        {
            title: 'Work Schedule',
            icon: Calendar,
            color: '#4CAF50',
            subItems: [
                { label: 'My Schedule', href: '/cleaner/schedule' },
            ],
        },
        {
            title: 'My Profile',
            icon: User,
            color: '#2196F3',
            subItems: [
                { label: 'Profile Settings', href: '/cleaner/profile' },
            ],
        },
    ];

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
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-600 to-green-700 flex items-center justify-center text-white font-bold shadow-md">
                                {user?.name?.charAt(0).toUpperCase() || 'C'}
                            </div>
                            <div>
                                <p className="font-semibold text-gray-900 text-sm">{user?.name || 'Cleaner'}</p>
                                <div className="flex items-center gap-2">
                                    <p className="text-xs text-gray-500 uppercase font-medium">{user?.currentRole || user?.role || 'HK'}</p>
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
                            const isActive = pathname === item.href || (item.subItems && item.subItems.some(sub => pathname === sub.href));

                            return (
                                <div key={index} className="mb-1">
                                    {item.subItems ? (
                                        item.subItems.map((subItem, subIndex) => (
                                            <Link
                                                key={subIndex}
                                                href={subItem.href}
                                                onClick={onClose}
                                                className={`flex items-center space-x-3 px-4 py-3 mx-2 rounded-lg transition-all duration-200 group ${pathname === subItem.href
                                                    ? 'bg-blue-100 border-l-4 border-blue-600 shadow-md'
                                                    : 'hover:bg-gray-100 hover:shadow-sm'
                                                    }`}
                                            >
                                                <div className={`p-1.5 rounded-md transition-colors ${pathname === subItem.href ? 'bg-blue-600' : 'bg-gray-100 group-hover:bg-gray-200'
                                                    }`}>
                                                    <IconComponent className={`w-4 h-4 transition-colors ${pathname === subItem.href ? 'text-white' : 'text-gray-600'
                                                        }`} />
                                                </div>
                                                <span className={`font-medium text-sm transition-colors ${pathname === subItem.href ? 'text-blue-900 font-semibold' : 'text-gray-700 group-hover:text-gray-900'
                                                    }`}>
                                                    {subItem.label}
                                                </span>
                                            </Link>
                                        ))
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
