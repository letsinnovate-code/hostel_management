'use client';

import UnifiedSidebar from './Sidebar/UnifiedSidebar';

export interface StudentSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function StudentSidebar({ isOpen, onClose }: StudentSidebarProps) {
  return <UnifiedSidebar role="student" isOpen={isOpen} onClose={onClose} />;
}
