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

export interface SocketEventPayload {
  type: string;
  data: any;
  timestamp: number;
}

interface AlertSocketContextType {
  socket: Socket | null;
  connected: boolean;
  unreadCount: number;
  latestAlert: LiveAlert | null;
  lastCurfewEvent: SocketEventPayload | null;
  lastOperationalEvent: SocketEventPayload | null;
  refreshKey: number;
  triggerRefresh: () => void;
  incrementUnread: () => void;
  decrementUnread: (by?: number) => void;
  setUnreadCount: (n: number | ((prev: number) => number)) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────
const AlertSocketContext = createContext<AlertSocketContextType>({
  socket: null,
  connected: false,
  unreadCount: 0,
  latestAlert: null,
  lastCurfewEvent: null,
  lastOperationalEvent: null,
  refreshKey: 0,
  triggerRefresh: () => {},
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
  const [socketInstance, setSocketInstance] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestAlert, setLatestAlert] = useState<LiveAlert | null>(null);
  const [lastCurfewEvent, setLastCurfewEvent] = useState<SocketEventPayload | null>(null);
  const [lastOperationalEvent, setLastOperationalEvent] = useState<SocketEventPayload | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const triggerRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

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
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      timeout: 10000,
    });

    socketRef.current = socket;
    setSocketInstance(socket);

    // ── Connection ──────────────────────────────────────────────────────────
    socket.on('connect', () => {
      setConnected(true);
      console.log('[AlertSocket] Connected', socket.id);
    });

    socket.on('connect_error', (err) => {
      setConnected(false);
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
      setRefreshKey((k) => k + 1);
      toastManager.show(
        `🔔 ${alert.title}: ${alert.message.slice(0, 80)}`,
        priorityToast(alert.priority) as any,
        alert.priority === 'urgent' ? 8000 : 4000
      );
    });

    // ── Curfew events ───────────────────────────────────────────────────────
    socket.on('curfew:started', (data: any) => {
      setLastCurfewEvent({ type: 'curfew:started', data, timestamp: Date.now() });
      setRefreshKey((k) => k + 1);
      toastManager.show('🌙 Curfew Session Started: Presence monitoring is now active.', 'info', 5000);
    });

    socket.on('curfew:ended', (data: any) => {
      setLastCurfewEvent({ type: 'curfew:ended', data, timestamp: Date.now() });
      setRefreshKey((k) => k + 1);
      toastManager.show('🛑 Curfew session concluded.', 'info', 4000);
    });

    socket.on('curfew:reset', (data: any) => {
      setLastCurfewEvent({ type: 'curfew:reset', data, timestamp: Date.now() });
      setRefreshKey((k) => k + 1);
      toastManager.show('🔄 Curfew schedule and state reset.', 'info', 4000);
    });

    socket.on('curfew:schedule_updated', (data: any) => {
      setLastCurfewEvent({ type: 'curfew:schedule_updated', data, timestamp: Date.now() });
      setRefreshKey((k) => k + 1);
      const timeStr = data.configuration?.startTime || data.curfewTime || '';
      toastManager.show(`⏰ Curfew Schedule Updated${timeStr ? `: Starts at ${timeStr}` : ''}`, 'info', 4000);
    });

    socket.on('curfew:student_status_update', (data: any) => {
      setLastCurfewEvent({ type: 'curfew:student_status_update', data, timestamp: Date.now() });
      setRefreshKey((k) => k + 1);
    });

    socket.on('curfew:violation', (data: { violation: any }) => {
      setLastCurfewEvent({ type: 'curfew:violation', data, timestamp: Date.now() });
      setRefreshKey((k) => k + 1);
      toastManager.show(
        `⚠️ Curfew Violation: ${data.violation?.studentId?.name ?? 'A student'} is outside after curfew`,
        'warning',
        6000
      );
    });

    socket.on('curfew:timer_terminated', (data: { studentName?: string; reason?: string }) => {
      setLastCurfewEvent({ type: 'curfew:timer_terminated', data, timestamp: Date.now() });
      setRefreshKey((k) => k + 1);
      toastManager.show(
        `✅ Timer Terminated: ${data.studentName || 'Student'} returned inside geofence`,
        'success',
        5000
      );
    });

    socket.on('curfew:escalated', (data: { studentName?: string; message?: string }) => {
      setLastCurfewEvent({ type: 'curfew:escalated', data, timestamp: Date.now() });
      setRefreshKey((k) => k + 1);
      toastManager.show(
        `🚨 Curfew Escalation: ${data.studentName || 'Student'} - ${data.message || 'Grace period expired'}`,
        'error',
        8000
      );
    });

    socket.on('curfew:escalation_alert', (data: { studentName?: string; message?: string }) => {
      setLastCurfewEvent({ type: 'curfew:escalation_alert', data, timestamp: Date.now() });
      setRefreshKey((k) => k + 1);
    });

    socket.on('curfew:parent_notified', (data: { studentName?: string; message?: string }) => {
      setLastCurfewEvent({ type: 'curfew:parent_notified', data, timestamp: Date.now() });
      setRefreshKey((k) => k + 1);
      toastManager.show(`📱 Parent Alert Dispatched: ${data.studentName || 'Student'}`, 'warning', 5000);
    });

    socket.on('curfew:sweep_completed', (data: { summary?: any }) => {
      setLastCurfewEvent({ type: 'curfew:sweep_completed', data, timestamp: Date.now() });
      setRefreshKey((k) => k + 1);
      const summary = data.summary || {};
      toastManager.show(
        `🛡️ Curfew Sweep: ${summary.present || 0} Present, ${summary.outside || 0} in Grace Period`,
        'info',
        5000
      );
    });

    // ── Operational Events (Gate, Attendance, Leave, Discipline, Complaints) ────
    socket.on('gate:event', (data: any) => {
      setLastOperationalEvent({ type: 'gate:event', data, timestamp: Date.now() });
      setRefreshKey((k) => k + 1);
    });

    socket.on('gate:checkin', (data: any) => {
      setLastOperationalEvent({ type: 'gate:checkin', data, timestamp: Date.now() });
      setRefreshKey((k) => k + 1);
    });

    socket.on('gate:checkout', (data: any) => {
      setLastOperationalEvent({ type: 'gate:checkout', data, timestamp: Date.now() });
      setRefreshKey((k) => k + 1);
    });

    socket.on('attendance:update', (data: any) => {
      setLastOperationalEvent({ type: 'attendance:update', data, timestamp: Date.now() });
      setRefreshKey((k) => k + 1);
    });

    socket.on('occupancy:update', (data: any) => {
      setLastOperationalEvent({ type: 'occupancy:update', data, timestamp: Date.now() });
      setRefreshKey((k) => k + 1);
    });

    socket.on('leave:status', (data: { status: string; permissionId: string }) => {
      setLastOperationalEvent({ type: 'leave:status', data, timestamp: Date.now() });
      setRefreshKey((k) => k + 1);
      const statusLabel = data.status === 'approved' ? '✅ Approved' : '❌ Rejected';
      toastManager.show(`Leave Request ${statusLabel}`, data.status === 'approved' ? 'success' : 'error', 5000);
    });

    socket.on('permission:new', (data: any) => {
      setLastOperationalEvent({ type: 'permission:new', data, timestamp: Date.now() });
      setRefreshKey((k) => k + 1);
      toastManager.show('📄 New Permission / Leave Request submitted', 'info', 4000);
    });

    socket.on('violation:created', (data: any) => {
      setLastOperationalEvent({ type: 'violation:created', data, timestamp: Date.now() });
      setRefreshKey((k) => k + 1);
    });

    socket.on('violation:resolved', (data: any) => {
      setLastOperationalEvent({ type: 'violation:resolved', data, timestamp: Date.now() });
      setRefreshKey((k) => k + 1);
    });

    socket.on('violation:escalated', (data: any) => {
      setLastOperationalEvent({ type: 'violation:escalated', data, timestamp: Date.now() });
      setRefreshKey((k) => k + 1);
    });

    socket.on('complaint:new', (data: any) => {
      setLastOperationalEvent({ type: 'complaint:new', data, timestamp: Date.now() });
      setRefreshKey((k) => k + 1);
      toastManager.show('⚠️ New Student Complaint logged', 'warning', 4000);
    });

    socket.on('complaint:updated', (data: any) => {
      setLastOperationalEvent({ type: 'complaint:updated', data, timestamp: Date.now() });
      setRefreshKey((k) => k + 1);
    });

    socket.on('notification', (data: any) => {
      setLastOperationalEvent({ type: 'notification', data, timestamp: Date.now() });
      setRefreshKey((k) => k + 1);
    });

    socket.on('emergency:broadcast', (data: { title: string; message: string }) => {
      setLastOperationalEvent({ type: 'emergency:broadcast', data, timestamp: Date.now() });
      setRefreshKey((k) => k + 1);
      toastManager.show(`🚨 EMERGENCY — ${data.title}: ${data.message}`, 'error', 10000);
    });

    socket.on('dashboard:refresh', () => {
      setRefreshKey((k) => k + 1);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setSocketInstance(null);
    };
  }, []);

  return (
    <AlertSocketContext.Provider
      value={{
        socket: socketInstance,
        connected,
        unreadCount,
        latestAlert,
        lastCurfewEvent,
        lastOperationalEvent,
        refreshKey,
        triggerRefresh,
        incrementUnread,
        decrementUnread,
        setUnreadCount,
      }}
    >
      {children}
    </AlertSocketContext.Provider>
  );
}
