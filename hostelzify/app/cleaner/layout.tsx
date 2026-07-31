'use client';

import { useState } from 'react';
import CleanerSidebar from '../../components/CleanerSidebar';
import { Menu } from 'lucide-react';

export default function CleanerLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="min-h-screen bg-gray-50 flex">
            <CleanerSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
                {/* Mobile Header */}
                <div className="lg:hidden bg-white border-b border-gray-200 p-4 sticky top-0 z-30 flex items-center justify-between">
                    <span className="font-semibold text-gray-900">Staff Portal</span>
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="p-2 -mr-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                </div>

                <main className="flex-1">
                    {children}
                </main>
            </div>
        </div>
    );
}
