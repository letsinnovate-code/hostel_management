import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type NotificationsOverlayContextType = {
  isVisible: boolean;
  show: () => void;
  hide: () => void;
};

const NotificationsOverlayContext = createContext<NotificationsOverlayContextType | undefined>(undefined);

export function NotificationsOverlayProvider({ children }: { children: ReactNode }) {
  const [isVisible, setIsVisible] = useState(false);
  const show = useCallback(() => setIsVisible(true), []);
  const hide = useCallback(() => setIsVisible(false), []);
  return (
    <NotificationsOverlayContext.Provider value={{ isVisible, show, hide }}>
      {children}
    </NotificationsOverlayContext.Provider>
  );
}

export function useNotificationsOverlay() {
  const ctx = useContext(NotificationsOverlayContext);
  if (ctx === undefined) throw new Error('useNotificationsOverlay must be used within NotificationsOverlayProvider');
  return ctx;
}
