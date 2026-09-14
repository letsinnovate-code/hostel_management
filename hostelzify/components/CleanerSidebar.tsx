'use client';

import UnifiedSidebar from './Sidebar/UnifiedSidebar';

export interface CleanerSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CleanerSidebar({ isOpen, onClose }: CleanerSidebarProps) {
  return <UnifiedSidebar role="cleaner" isOpen={isOpen} onClose={onClose} />;
}
