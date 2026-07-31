'use client';

import { ReactNode } from 'react';
import SecuritySidebar from './SecuritySidebar';

interface SecurityLayoutProps {
  children: ReactNode;
}

export default function SecurityLayout({ children }: SecurityLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      <SecuritySidebar />
      <main className="flex-1 overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}

