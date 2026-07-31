'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, isOwnerUser } from '../../contexts/AuthContext';
import { OwnerHostelProvider } from '../../contexts/OwnerHostelContext';
import OwnerLayout from '../../components/OwnerLayout';

/**
 * Owner route layout: wait for auth, then render OwnerLayout (sidebar + shell) once.
 * Children (current page) swap on navigation without remounting the sidebar.
 */
export default function OwnerRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user || !isOwnerUser(user)) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!user || !isOwnerUser(user)) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-gray-500">Redirecting...</div>
      </div>
    );
  }

  return (
    <OwnerHostelProvider>
      <OwnerLayout>{children}</OwnerLayout>
    </OwnerHostelProvider>
  );
}
