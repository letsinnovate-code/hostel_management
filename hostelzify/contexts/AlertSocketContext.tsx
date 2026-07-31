'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { io, Socket } from 'socket.io-client';
import { STORAGE_KEYS } from '../constants/config';
import { toastManager } from '../components/Toast';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export interface LiveAlert {
  _id?: string;
  type: string;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category?: string;
  hostelId?: string;
  studentId?: string;
  createdAt?: string;
}

interface AlertSocketContextType {
  connected: boolean;
  unreadCount: number;
  latestAlert: LiveAlert | null;
  incrementUnread: () => void;
  decrementUnread: (by?: number) => void;
  setUnreadCount: (n: number) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────
const AlertSocketContext = createContext<AlertSocketContextType>({
  connected: false,
  unreadCount: 0,
  latestAlert: null,
  incrementUnread: () => {},
  decrementUnread: () => {},
  setUnreadCount: () => {},
});

export const useAlertSocket = () => useContext(AlertSocketContext);

// ─────────────────────────────────────────────────────────────────────────────
// Priority → toast type mapping
// ─────────────────────────────────────────────────────────────────────────────
const priorityToast = (priority: string) => {
  if (priority === 'urgent') return 'error';
  if (priority === 'high') return 'warning';
  return 'info';
};

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ?? 'http://localhost:4000';

export function AlertSocketProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestAlert, setLatestAlert] = useState<LiveAlert | null>(null);

  const incrementUnread = useCallback(() => setUnreadCount((c) => c + 1), []);
  const decrementUnread = useCallback(
    (by = 1) => setUnreadCount((c) => Math.max(0, c - by)),
    []
  );

  useEffect(() => {
    const token = typeof window !== 'undefined'
      ? localStorage.getItem(STORAGE_KEYS.TOKEN)
      : null;

    if (!token) return;

    const socket = io(BACKEND_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    // ── Connection ──────────────────────────────────────────────────────────
    socket.on('connect', () => {
      setConnected(true);
      console.log('[AlertSocket] Connected', socket.id);
    });

    socket.on('disconnect', (reason) => {
      setConnected(false);
      console.log('[AlertSocket] Disconnected:', reason);
    });

    socket.on('connected', (data: { rooms?: string[] }) => {
      console.log('[AlertSocket] Server confirmed rooms:', data.rooms);
    });

    // ── New alert received ──────────────────────────────────────────────────
    socket.on('alert:new', (data: { alert: LiveAlert }) => {
      const alert = data.alert;
      setLatestAlert(alert);
      setUnreadCount((c) => c + 1);
      toastManager.show(
        `🔔 ${alert.title}: ${alert.message.slice(0, 80)}`,
        priorityToast(alert.priority) as any,
        alert.priority === 'urgent' ? 8000 : 4000
      );
    });

    // ── Curfew violation ────────────────────────────────────────────────────
    socket.on('curfew:violation', (data: { violation: any }) => {
      toastManager.show(
        `⚠️ Curfew Violation: ${data.violation?.studentId?.name ?? 'A student'} is outside after curfew`,
        'warning',
        6000
      );
    });

    // ── Emergency broadcast ─────────────────────────────────────────────────
    socket.on('emergency:broadcast', (data: { title: string; message: string }) => {
      toastManager.show(
        `🚨 EMERGENCY — ${data.title}: ${data.message}`,
        'error',
        10000
      );
    });

    // ── Leave status changes ────────────────────────────────────────────────
    socket.on('leave:status', (data: { status: string; permissionId: string }) => {
      const statusLabel =
        data.status === 'approved' ? '✅ Approved' : '❌ Rejected';
      toastManager.show(
        `Leave Request ${statusLabel}`,
        data.status === 'approved' ? 'success' : 'error',
        5000
      );
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  return (
    <AlertSocketContext.Provider
      value={{
        connected,
        unreadCount,
        latestAlert,
        incrementUnread,
        decrementUnread,
        setUnreadCount,
      }}
    >
      {children}
    </AlertSocketContext.Provider>
  );
}
