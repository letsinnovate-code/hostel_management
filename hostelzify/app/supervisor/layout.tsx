"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../contexts/AuthContext";

export default function SupervisorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const isAuthenticated = !!user;
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        router.push("/login");
      } else if (user?.role !== "supervisor") {
        router.push("/dashboard");
      }
    }
  }, [isAuthenticated, loading, user, router]);

  if (loading || !isAuthenticated || user?.role !== "supervisor") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar Placeholder */}
      <aside className="w-64 bg-white border-r hidden md:flex flex-col">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold text-gray-800">Hostelzify</h2>
          <p className="text-xs text-gray-500 mt-1">Supervisor Portal</p>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <a href="/supervisor/dashboard" className="flex items-center gap-3 px-4 py-3 bg-blue-50 text-blue-700 rounded-lg font-medium">
            Dashboard
          </a>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="bg-white border-b px-8 py-4 flex justify-between items-center sticky top-0 z-10">
          <h1 className="text-2xl font-semibold text-gray-800">Operations Control</h1>
          <div className="flex items-center gap-4">
            <span className="font-medium text-sm">{user.name}</span>
            <span className="px-3 py-1 bg-gray-100 rounded-full text-xs font-semibold text-gray-600 uppercase tracking-wider">
              {user.role}
            </span>
          </div>
        </header>
        <div className="p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
