'use client';

import { useState } from 'react';
import UnifiedSidebar from './Sidebar/UnifiedSidebar';
import { Menu, X } from 'lucide-react';

export interface SecuritySidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function SecuritySidebar({
  isOpen: externalOpen,
  onClose: externalClose,
}: SecuritySidebarProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;
  const onClose = externalClose || (() => setInternalOpen(false));

  return (
    <>
      {externalOpen === undefined && (
        <div className="lg:hidden fixed top-4 left-4 z-50">
          <button
            type="button"
            onClick={() => setInternalOpen(!internalOpen)}
            className="p-2 rounded-lg bg-white shadow-md border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Toggle security navigation"
          >
            {internalOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      )}
      <UnifiedSidebar role="security" isOpen={isOpen} onClose={onClose} />
    </>
  );
}
