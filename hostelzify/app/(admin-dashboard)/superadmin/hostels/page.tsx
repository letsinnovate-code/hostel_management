'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '../../../../services/api';
import { ChevronLeft, Building2 } from 'lucide-react';

export default function SuperAdminHostelsPage() {
  const [hostels, setHostels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getSuperadminHostels()
      .then((res) => setHostels(res?.data ?? []))
      .catch(() => setHostels([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <Link
          href="/superadmin"
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
          aria-label="Back"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 flex items-center gap-2">
          <Building2 className="w-6 h-6 text-emerald-600" />
          <h1 className="text-xl font-bold text-gray-900">All Hostels</h1>
        </div>
      </header>

      <main className="p-6 max-w-4xl mx-auto">
        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : hostels.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-500">
            No hostels found.
          </div>
        ) : (
          <div className="space-y-4">
            {hostels.map((h) => (
              <div
                key={h._id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"
              >
                <h2 className="font-semibold text-gray-900">{h.name}</h2>
                {h.type && (
                  <p className="text-sm text-gray-500 capitalize">{h.type}</p>
                )}
                {h.ownerId && (
                  <p className="text-sm text-gray-600 mt-1">
                    Owner: {typeof h.ownerId === 'object' ? h.ownerId.name : h.ownerId}
                    {typeof h.ownerId === 'object' && h.ownerId.email && (
                      <span className="text-gray-500"> ({h.ownerId.email})</span>
                    )}
                  </p>
                )}
                {h.address && (h.address.city || h.address.state) && (
                  <p className="text-sm text-gray-500 mt-1">
                    {[h.address.city, h.address.state, h.address.pincode].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
