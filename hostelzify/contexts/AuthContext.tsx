'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { STORAGE_KEYS } from '../constants/config';
import api from '../services/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'warden' | 'cleaner' | 'supervisor' | 'student' | 'security' | 'superadmin' | string | string[];
  roles?: string[];
  currentRole?: string;
  hasMultipleRoles?: boolean;
  hostelId?: string;
  roomId?: string;
  [key: string]: any;
}

/** Normalize role to string; use for owner/role checks across the app. */
export function getRoleString(role: string | string[] | undefined): string | null {
  if (role == null) return null;
  return Array.isArray(role) ? (role[0] ?? null) : String(role);
}

export function isOwnerUser(user: User | null): boolean {
  return getRoleString(user?.role) === 'owner';
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User | void>;
  register: (data: any) => Promise<User | void>;
  logout: () => Promise<void>;
  updateUser: (userData: User) => void;
  setCurrentRole: (role: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      if (typeof window !== 'undefined') {
        const storedToken = localStorage.getItem(STORAGE_KEYS.TOKEN);
        const storedUser = localStorage.getItem(STORAGE_KEYS.USER);

        if (storedToken && storedUser) {
          const parsed = JSON.parse(storedUser);
          if (parsed?.role && Array.isArray(parsed.role)) {
            parsed.role = parsed.role[0];
          }
          if (parsed?.roles && !Array.isArray(parsed.roles)) {
            parsed.roles = undefined;
          }
          document.cookie = `hostel_token=${storedToken}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax`;
          setToken(storedToken);
          setUser(parsed);
        }
      }
    } catch (error) {
      console.error('Error loading stored auth:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await api.login(email, password);
      // API returns { success: true, data: { id, name, email, role, token, hostelId, ... } }
      const userData = response?.data ?? response;
      const newToken = userData?.token;

      if (!newToken || !userData?.id) {
        console.error('Login response:', response);
        throw new Error('Invalid response from server');
      }

      const hasMultipleRoles = userData.hasMultipleRoles || (userData.roles && userData.roles.length > 1);
      const role = userData.role || userData.currentRole || (userData.roles && userData.roles[0]);
      const roles = userData.roles && Array.isArray(userData.roles) ? userData.roles : (role ? [role] : undefined);

      const user = {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        role: Array.isArray(role) ? role[0] : role,
        roles,
        currentRole: userData.currentRole || (Array.isArray(role) ? role[0] : role),
        hasMultipleRoles,
        hostelId: userData.hostelId,
        roomId: userData.roomId,
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.TOKEN, newToken);
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
        localStorage.removeItem(STORAGE_KEYS.OWNER_SELECTED_HOSTEL);
        document.cookie = `hostel_token=${newToken}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax`;
      }

      setToken(newToken);
      setUser(user);
      return user;
    } catch (error: any) {
      console.error('Login error:', error);
      throw new Error(error.response?.data?.message || error.message || 'Login failed');
    }
  };

  const register = async (data: any) => {
    try {
      const response = await api.register(data);
      const userData = response?.data ?? response;
      const newToken = userData?.token;

      if (!newToken || !userData?.id) {
        console.error('Register response:', response);
        throw new Error('Invalid response from server');
      }

      const hasMultipleRoles = userData.hasMultipleRoles || (userData.roles && userData.roles.length > 1);
      const role = userData.role || userData.currentRole || (userData.roles && userData.roles[0]);
      const roles = userData.roles && Array.isArray(userData.roles) ? userData.roles : (role ? [role] : undefined);

      const user = {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        role: Array.isArray(role) ? role[0] : role,
        roles,
        currentRole: userData.currentRole || (Array.isArray(role) ? role[0] : role),
        hasMultipleRoles,
        hostelId: userData.hostelId,
        roomId: userData.roomId,
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.TOKEN, newToken);
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
        localStorage.removeItem(STORAGE_KEYS.OWNER_SELECTED_HOSTEL);
        document.cookie = `hostel_token=${newToken}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax`;
      }

      setToken(newToken);
      setUser(user);
      return user;
    } catch (error: any) {
      console.error('Register error:', error);
      throw new Error(error.response?.data?.message || error.message || 'Registration failed');
    }
  };

  const logout = async () => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEYS.TOKEN);
        localStorage.removeItem(STORAGE_KEYS.USER);
        localStorage.removeItem(STORAGE_KEYS.OWNER_SELECTED_HOSTEL);
        document.cookie = 'hostel_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax';
      }
      setToken(null);
      setUser(null);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const updateUser = (userData: User) => {
    setUser(userData);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData));
    }
  };

  const setCurrentRole = async (role: string) => {
    try {
      const response = await api.setCurrentRole(role);
      const updatedUser: User = {
        ...user!,
        currentRole: role as 'owner' | 'warden' | 'cleaner' | 'supervisor' | 'student' | 'security',
        role: role as 'owner' | 'warden' | 'cleaner' | 'supervisor' | 'student' | 'security', // Update role for backward compatibility
      };
      updateUser(updatedUser);
    } catch (error: any) {
      console.error('Error setting current role:', error);
      throw new Error(error.response?.data?.message || error.message || 'Failed to set role');
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateUser, setCurrentRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
