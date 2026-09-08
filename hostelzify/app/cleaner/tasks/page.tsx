'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CleanerTasksPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/cleaner/dashboard');
  }, [router]);

  return (
    <div className="p-8 text-center text-gray-500">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mx-auto mb-3" />
      <p className="text-sm">Loading tasks dashboard...</p>
    </div>
  );
}
