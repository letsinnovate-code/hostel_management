'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import api from '../services/api';
import { STORAGE_KEYS } from '../constants/config';
import { useAuth, isOwnerUser } from './AuthContext';

export interface HostelOption {
  _id: string;
  id?: string;
  name: string;
  type?: string;
  capacity?: number;
  totalRooms?: number;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
    coordinates?: {
      latitude?: number;
      longitude?: number;
    };
  };
  [key: string]: unknown;
}

interface OwnerHostelContextType {
  hostels: HostelOption[];
  selectedHostel: string;
  activeHostel: HostelOption | null;
  setSelectedHostel: (id: string) => void;
  loading: boolean;
  refetchHostels: () => Promise<void>;
  updateHostelInState: (updated: Partial<HostelOption> & { _id?: string; id?: string }) => void;
}

const OwnerHostelContext = createContext<OwnerHostelContextType | null>(null);

export function OwnerHostelProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [hostels, setHostels] = useState<HostelOption[]>([]);
  const [selectedHostel, setSelectedHostelState] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const loadHostels = useCallback(async () => {
    if (!user || (!isOwnerUser(user) && user.role !== 'superadmin')) {
      setHostels([]);
      setSelectedHostelState('');
      setLoading(false);
      return;
    }
    try {
      const data = await api.getHostels();
      const list = Array.isArray(data) ? data : (data?.data ?? []);
      setHostels(list);
      if (list.length > 0) {
        const saved = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.OWNER_SELECTED_HOSTEL) : null;
        const validId = saved && list.some((h: HostelOption) => (h._id || h.id) === saved);
        const resolvedId = validId ? saved! : (list[0]._id || list[0].id || '');
        setSelectedHostelState(resolvedId);
        if (typeof window !== 'undefined' && resolvedId) {
          localStorage.setItem(STORAGE_KEYS.OWNER_SELECTED_HOSTEL, resolvedId);
        }
      } else {
        setSelectedHostelState('');
        if (typeof window !== 'undefined') {
          localStorage.removeItem(STORAGE_KEYS.OWNER_SELECTED_HOSTEL);
        }
      }
    } catch (e) {
      setHostels([]);
      setSelectedHostelState('');
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEYS.OWNER_SELECTED_HOSTEL);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadHostels();
  }, [loadHostels]);

  const setSelectedHostel = useCallback((id: string) => {
    setSelectedHostelState(id);
    if (typeof window !== 'undefined') {
      try {
        if (id) {
          localStorage.setItem(STORAGE_KEYS.OWNER_SELECTED_HOSTEL, id);
        } else {
          localStorage.removeItem(STORAGE_KEYS.OWNER_SELECTED_HOSTEL);
        }
      } catch (_) {}
    }
  }, []);

  // Persist to localStorage when selectedHostel changes (e.g. after load defaulting to first)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        if (selectedHostel) {
          localStorage.setItem(STORAGE_KEYS.OWNER_SELECTED_HOSTEL, selectedHostel);
        } else {
          localStorage.removeItem(STORAGE_KEYS.OWNER_SELECTED_HOSTEL);
        }
      } catch (_) {}
    }
  }, [selectedHostel]);

  const activeHostel = hostels.find((h) => (h._id || h.id) === selectedHostel) || null;

  const updateHostelInState = useCallback((updated: Partial<HostelOption> & { _id?: string; id?: string }) => {
    const targetId = updated._id || updated.id;
    if (!targetId) return;
    setHostels((prev) =>
      prev.map((h) => {
        if ((h._id || h.id) === targetId) {
          return { ...h, ...updated };
        }
        return h;
      })
    );
  }, []);

  const value: OwnerHostelContextType = {
    hostels,
    selectedHostel,
    activeHostel,
    setSelectedHostel,
    loading,
    refetchHostels: loadHostels,
    updateHostelInState,
  };

  return (
    <OwnerHostelContext.Provider value={value}>
      {children}
    </OwnerHostelContext.Provider>
  );
}

export function useOwnerHostel(): OwnerHostelContextType {
  const ctx = useContext(OwnerHostelContext);
  if (!ctx) {
    throw new Error('useOwnerHostel must be used within OwnerHostelProvider');
  }
  return ctx;
}

export function useOwnerHostelOptional(): OwnerHostelContextType | null {
  return useContext(OwnerHostelContext);
}
