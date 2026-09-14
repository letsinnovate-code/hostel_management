'use client';

import UnifiedSidebar, { UnifiedSidebarProps } from './Sidebar/UnifiedSidebar';

export interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  return <UnifiedSidebar role="owner" isOpen={isOpen} onClose={onClose} />;
}
