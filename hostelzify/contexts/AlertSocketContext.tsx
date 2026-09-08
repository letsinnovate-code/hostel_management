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
  lastCurfewEvent: { type: string; data: any; timestamp: number } | null;
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
  lastCurfewEvent: null,
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
const getSocketEndpoint = (): string | null => {
  // If explicitly configured with a dedicated socket server (e.g. Render/Railway), use it
  if (process.env.NEXT_PUBLIC_SOCKET_URL && process.env.NEXT_PUBLIC_SOCKET_URL.trim()) {
    return process.env.NEXT_PUBLIC_SOCKET_URL.trim().replace(/\/+$/, '');
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
  const isVercelServerless = apiUrl.includes('.vercel.app');

  // Vercel Serverless functions do not support persistent WebSockets
  if (isVercelServerless) {
    return null;
  }

  return apiUrl.replace(/\/api\/?$/, '') || 'http://localhost:4000';
};

export function AlertSocketProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestAlert, setLatestAlert] = useState<LiveAlert | null>(null);
  const [lastCurfewEvent, setLastCurfewEvent] = useState<{ type: string; data: any; timestamp: number } | null>(null);

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

    const socketEndpoint = getSocketEndpoint();
    if (!socketEndpoint) {
      if (process.env.NODE_ENV !== 'production') {
        console.info('[AlertSocket] Live WebSocket connection skipped: backend is running on Vercel Serverless. To enable persistent real-time alerts, set NEXT_PUBLIC_SOCKET_URL to point to a persistent server (e.g. Render/Railway).');
      }
      return;
    }

    const socket = io(socketEndpoint, {
      auth: { token },
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 3,
      reconnectionDelay: 3000,
      timeout: 10000,
    });

    socketRef.current = socket;

    // ── Connection ──────────────────────────────────────────────────────────
    socket.on('connect', () => {
      setConnected(true);
      console.log('[AlertSocket] Connected', socket.id);
    });

    socket.on('connect_error', (err) => {
      setConnected(false);
      // Suppress unhandled connection crash
      console.warn('[AlertSocket] Connection issue:', err.message);
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
      setLastCurfewEvent({ type: 'curfew:violation', data, timestamp: Date.now() });
      toastManager.show(
        `⚠️ Curfew Violation: ${data.violation?.studentId?.name ?? 'A student'} is outside after curfew`,
        'warning',
        6000
      );
    });

    // ── Curfew timer auto-terminated (student returned inside geofence) ──────
    socket.on('curfew:timer_terminated', (data: { studentName?: string; reason?: string }) => {
      setLastCurfewEvent({ type: 'curfew:timer_terminated', data, timestamp: Date.now() });
      toastManager.show(
        `✅ Timer Terminated: ${data.studentName || 'Student'} returned inside geofence`,
        'success',
        5000
      );
    });

    // ── Curfew escalation (15m grace expired or parent notified) ────────────
    socket.on('curfew:escalated', (data: { studentName?: string; message?: string }) => {
      setLastCurfewEvent({ type: 'curfew:escalated', data, timestamp: Date.now() });
      toastManager.show(
        `🚨 Curfew Escalation: ${data.studentName || 'Student'} - ${data.message || '15m grace expired'}`,
        'error',
        8000
      );
    });

    // ── Curfew schedule updated ─────────────────────────────────────────────
    socket.on('curfew:schedule_updated', (data: { curfewTime: string }) => {
      setLastCurfewEvent({ type: 'curfew:schedule_updated', data, timestamp: Date.now() });
      toastManager.show(
        `⏰ Curfew Schedule Updated: Starts at ${data.curfewTime}`,
        'info',
        4000
      );
    });

    // ── Curfew sweep completed ──────────────────────────────────────────────
    socket.on('curfew:sweep_completed', (data: { summary?: any }) => {
      setLastCurfewEvent({ type: 'curfew:sweep_completed', data, timestamp: Date.now() });
      const summary = data.summary || {};
      toastManager.show(
        `🛡️ Curfew Sweep: ${summary.present || 0} Present, ${summary.outside || 0} in Grace Period`,
        'info',
        5000
      );
    });

    // ── Curfew session ended ────────────────────────────────────────────────
    socket.on('curfew:ended', (data: any) => {
      setLastCurfewEvent({ type: 'curfew:ended', data, timestamp: Date.now() });
      toastManager.show('🛑 Curfew session concluded by Warden.', 'info', 4000);
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
        lastCurfewEvent,
        incrementUnread,
        decrementUnread,
        setUnreadCount,
      }}
    >
      {children}
    </AlertSocketContext.Provider>
  );
}
