'use client';

import UnifiedSidebar from './Sidebar/UnifiedSidebar';

export interface WardenSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WardenSidebar({ isOpen, onClose }: WardenSidebarProps) {
  return <UnifiedSidebar role="warden" isOpen={isOpen} onClose={onClose} />;
}
