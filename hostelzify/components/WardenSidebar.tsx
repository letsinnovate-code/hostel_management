'use client';

import UnifiedSidebar from './Sidebar/UnifiedSidebar';

export interface WardenSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function WardenSidebar({
  isOpen,
  onClose,
  isCollapsed = false,
  onToggleCollapse,
}: WardenSidebarProps) {
  return (
    <UnifiedSidebar
      role="warden"
      isOpen={isOpen}
      onClose={onClose}
      isCollapsed={isCollapsed}
      onToggleCollapse={onToggleCollapse}
    />
  );
}
