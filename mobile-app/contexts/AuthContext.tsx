import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants/config';
import api from '../services/api';
import FirebaseNotificationService from '../services/FirebaseNotificationService';
import NotificationService from '../services/NotificationService';
import LocationService from '../services/LocationService';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'warden' | 'cleaner' | 'supervisor' | 'student';
  hostelId?: string;
  roomId?: string;
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (userData: User) => void;
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
      const storedToken = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
      const storedUser = await AsyncStorage.getItem(STORAGE_KEYS.USER);

      if (storedToken && storedUser) {
        setToken(storedToken);
        api.setToken(storedToken);
        setUser(JSON.parse(storedUser));

        // Register push token if student and notifications are enabled (e.g. app reopen)
        const userObj = JSON.parse(storedUser);
        const notificationsEnabled = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED);
        if (userObj.role === 'student' && notificationsEnabled !== 'false') {
          (async () => {
            try {
              const pushToken = await FirebaseNotificationService.getTokenAsync();
              if (pushToken) {
                console.log('[App open] FCM push token:', pushToken);
                await api.registerPushToken(pushToken);
                console.log('[App open] Push token re-registered');
              }
              const expoToken = await NotificationService.getExpoPushTokenOnly();
              if (expoToken) await api.registerExpoPushToken(expoToken);
            } catch (err: any) {
              console.error('[App open] Error registering push token:', err);
            }
          })();
        }
      }
    } catch (error) {
      console.error('Error loading stored auth:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await api.login(email, password);
    // Backend: { success: true, data: { id, name, email, role, roles?, currentRole?, hostelId?, token } }
    const userData = response.data;
    const newToken = userData?.token;

    if (!newToken || !userData?.id) {
      console.error('Login response:', response);
      throw new Error('Invalid response from server');
    }

    const user = {
      id: userData.id,
      name: userData.name,
      email: userData.email,
      role: userData.currentRole ?? userData.role,
      hostelId: userData.hostelId ?? undefined,
      roomId: userData.roomId ?? undefined,
    };

    await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, newToken);
    await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));

    api.setToken(newToken);
    setToken(newToken);
    setUser(user);

    // Automatically turn on push notifications for students on login (FCM + Expo for receipts)
    if (user.role === 'student') {
      try {
        const pushToken = await FirebaseNotificationService.getTokenAsync();
        if (pushToken) {
          console.log('[Login] FCM push token:', pushToken);
          await api.registerPushToken(pushToken);
          await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED, 'true');
          console.log('[Login] Push notifications enabled and token registered');
        } else {
          console.log('[Login] FCM token not available (permission denied or Expo Go)');
        }
        const expoToken = await NotificationService.getExpoPushTokenOnly();
        if (expoToken) {
          await api.registerExpoPushToken(expoToken);
          console.log('[Login] Expo push token registered (for receipt status)');
        }
      } catch (err: any) {
        console.error('[Login] Error registering push token:', err);
      }
      // Request location permission (foreground + background / "all the time") after login
      try {
        const locResult = await LocationService.requestPermissions();
        if (locResult.status === 'granted') {
          console.log('[Login] Location permission granted (all the time)');
          await LocationService.startTracking();
          console.log('[Login] Background location tracking started – auto check-in without opening app');
        } else {
          console.log('[Login] Location permission not granted:', locResult.error);
        }
      } catch (err: any) {
        console.error('[Login] Error requesting location permission:', err);
      }
    }
  };

  const register = async (data: any) => {
    const response = await api.register(data);
    const userData = response.data;
    const newToken = userData?.token;

    if (!newToken || !userData?.id) {
      console.error('Register response:', response);
      throw new Error('Invalid response from server');
    }

    const user = {
      id: userData.id,
      name: userData.name,
      email: userData.email,
      role: userData.currentRole ?? userData.role,
      hostelId: userData.hostelId ?? undefined,
      roomId: userData.roomId ?? undefined,
    };

    await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, newToken);
    await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));

    api.setToken(newToken);
    setToken(newToken);
    setUser(user);

    // Automatically turn on push notifications for students on register (FCM + Expo for receipts)
    if (user.role === 'student') {
      try {
        const pushToken = await FirebaseNotificationService.getTokenAsync();
        if (pushToken) {
          console.log('[Register] FCM push token:', pushToken);
          await api.registerPushToken(pushToken);
          await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED, 'true');
          console.log('[Register] Push notifications enabled and token registered');
        } else {
          console.log('[Register] FCM token not available (permission denied or Expo Go)');
        }
        const expoToken = await NotificationService.getExpoPushTokenOnly();
        if (expoToken) {
          await api.registerExpoPushToken(expoToken);
          console.log('[Register] Expo push token registered (for receipt status)');
        }
      } catch (err: any) {
        console.error('[Register] Error registering push token:', err);
      }
      // Request location permission (foreground + background / "all the time") after register
      try {
        const locResult = await LocationService.requestPermissions();
        if (locResult.status === 'granted') {
          console.log('[Register] Location permission granted (all the time)');
          await LocationService.startTracking();
          console.log('[Register] Background location tracking started – auto check-in without opening app');
        } else {
          console.log('[Register] Location permission not granted:', locResult.error);
        }
      } catch (err: any) {
        console.error('[Register] Error requesting location permission:', err);
      }
    }
  };

  const logout = async () => {
    try {
      api.setToken(null);
      await AsyncStorage.removeItem(STORAGE_KEYS.TOKEN);
      await AsyncStorage.removeItem(STORAGE_KEYS.USER);
      setToken(null);
      setUser(null);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const updateUser = (userData: User) => {
    setUser(userData);
    AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData));
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateUser }}>
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

