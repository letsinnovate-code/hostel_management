'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '../../../../services/api';
import { useToast } from '../../../../components/Toast';
import { ArrowLeft, Shield, ShieldAlert, CheckCircle2 } from 'lucide-react';

type RolePermission = {
  name: string;
  permissions: string[];
};

export default function RolesPermissionsPage() {
  const [roles, setRoles] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      const res = await api.getRoles();
      if (res?.success) {
        setRoles(res.data);
      }
    } catch {
      showToast('Failed to load roles and permissions', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link
              href="/superadmin"
              className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 mb-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Shield className="w-6 h-6 text-indigo-600" />
              Roles & Permissions
            </h1>
            <p className="text-slate-500 mt-1">
              View platform roles and their granular capabilities. (Read-only view)
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {roles.map((role) => (
              <div key={role.name} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-900 capitalize flex items-center gap-2">
                    {role.name === 'superadmin' ? (
                      <ShieldAlert className="w-5 h-5 text-rose-500" />
                    ) : (
                      <Shield className="w-5 h-5 text-slate-400" />
                    )}
                    {role.name}
                  </h2>
                  <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded-md border border-indigo-100">
                    {role.permissions.length === 1 && role.permissions[0] === '*' 
                      ? 'ALL ACCESS' 
                      : `${role.permissions.length} Permissions`}
                  </span>
                </div>
                <div className="p-6">
                  {role.permissions.length === 1 && role.permissions[0] === '*' ? (
                    <div className="bg-rose-50 border border-rose-100 rounded-lg p-4 flex items-start gap-3">
                      <ShieldAlert className="w-5 h-5 text-rose-600 mt-0.5" />
                      <div>
                        <h3 className="text-sm font-bold text-rose-900">Wildcard Access</h3>
                        <p className="text-xs text-rose-700 mt-1">This role bypasses all permission checks and tenant isolation boundaries.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      {role.permissions.map((perm) => (
                        <div key={perm} className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          <code className="text-xs font-mono text-slate-700">{perm}</code>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
