'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import api from '../services/api';
import { STORAGE_KEYS } from '../constants/config';

export interface HostelOption {
  _id: string;
  id?: string;
  name: string;
  [key: string]: unknown;
}

interface OwnerHostelContextType {
  hostels: HostelOption[];
  selectedHostel: string;
  setSelectedHostel: (id: string) => void;
  loading: boolean;
  refetchHostels: () => Promise<void>;
}

const OwnerHostelContext = createContext<OwnerHostelContextType | null>(null);

export function OwnerHostelProvider({ children }: { children: ReactNode }) {
  const [hostels, setHostels] = useState<HostelOption[]>([]);
  const [selectedHostel, setSelectedHostelState] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const loadHostels = useCallback(async () => {
    try {
      const data = await api.getHostels();
      const list = Array.isArray(data) ? data : (data?.data ?? []);
      setHostels(list);
      if (list.length > 0) {
        const saved = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.OWNER_SELECTED_HOSTEL) : null;
        const validId = saved && list.some((h: HostelOption) => (h._id || h.id) === saved);
        setSelectedHostelState(validId ? saved! : (list[0]._id || list[0].id || ''));
      } else {
        setSelectedHostelState('');
      }
    } catch (e) {
      setHostels([]);
      setSelectedHostelState('');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHostels();
  }, [loadHostels]);

  const setSelectedHostel = useCallback((id: string) => {
    setSelectedHostelState(id);
    if (typeof window !== 'undefined' && id) {
      try {
        localStorage.setItem(STORAGE_KEYS.OWNER_SELECTED_HOSTEL, id);
      } catch (_) {}
    }
  }, []);

  // Persist to localStorage when selectedHostel changes (e.g. after load defaulting to first)
  useEffect(() => {
    if (selectedHostel && typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEYS.OWNER_SELECTED_HOSTEL, selectedHostel);
      } catch (_) {}
    }
  }, [selectedHostel]);

  const value: OwnerHostelContextType = {
    hostels,
    selectedHostel,
    setSelectedHostel,
    loading,
    refetchHostels: loadHostels,
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
