'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const isLoginPage = pathname === '/superadmin/login';

  useEffect(() => {
    if (loading) return;
    if (isLoginPage) return;
    const role = Array.isArray(user?.role) ? user?.role?.[0] : user?.role;
    if (!user || role !== 'superadmin') {
      router.replace('/superadmin/login');
    }
  }, [user, loading, isLoginPage, router]);

  if (loading && !isLoginPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  return <>{children}</>;
}
