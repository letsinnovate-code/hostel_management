'use client';

import { useEffect } from 'react';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import { useAlertSocket } from '../contexts/AlertSocketContext';
import { alertApi } from '../services/alertApi';
import { useAuth } from '../contexts/AuthContext';

interface AlertBellProps {
  href: string;   // e.g. '/student/alerts' or '/warden/alerts'
  hostelId?: string;
}

export default function AlertBell({ href, hostelId }: AlertBellProps) {
  const { unreadCount, setUnreadCount } = useAlertSocket();
  const { user } = useAuth();

  // Hydrate badge count from API on first render
  useEffect(() => {
    if (!user) return;
    alertApi.getUnreadCount(hostelId).then((res) => {
      const count = res?.data?.count ?? res?.count ?? 0;
      setUnreadCount(count);
    }).catch(() => {});
  }, [user, hostelId, setUnreadCount]);

  return (
    <Link
      href={href}
      className="relative inline-flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 transition-colors"
      aria-label={`Alerts (${unreadCount} unread)`}
    >
      <Bell className="w-5 h-5 text-gray-600" />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold shadow-sm animate-pulse">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  );
}
