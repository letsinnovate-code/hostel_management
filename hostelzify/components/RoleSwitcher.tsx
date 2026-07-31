'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { User, ChevronDown, Loader2 } from 'lucide-react';

export default function RoleSwitcher() {
  const { user } = useAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  if (!user || !user.roles || user.roles.length <= 1) {
    return null;
  }

  const userRoles = user.roles || [user.role];
  const currentRole = user.currentRole || user.role;

  const handleSwitchRole = () => {
    router.push('/select-role?switch=true');
  };

  return (
    <div className="relative">
      <button
        onClick={handleSwitchRole}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        title="Switch Role"
      >
        <User className="w-4 h-4" />
        <span className="capitalize">{currentRole}</span>
        <ChevronDown className="w-4 h-4" />
      </button>
    </div>
  );
}

