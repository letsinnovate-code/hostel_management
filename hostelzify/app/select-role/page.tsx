'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import {
  Shield,
  Sparkles,
  UserCheck,
  Lock,
  Users,
  ArrowRight,
  LogIn,
  User,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';

const roleConfig: Record<string, { label: string; icon: typeof Shield; color: string; bgColor: string; textColor: string; borderColor?: string; description: string; dashboardPath: string }> = {
  warden: {
    label: 'Warden',
    icon: Shield,
    color: 'from-blue-500 to-blue-600',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-600',
    borderColor: 'border-blue-300',
    description: 'Manage permissions and violations',
    dashboardPath: '/warden/dashboard',
  },
  cleaner: {
    label: 'Cleaner',
    icon: Sparkles,
    color: 'from-purple-500 to-purple-600',
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-600',
    borderColor: 'border-purple-300',
    description: 'Manage cleaning tasks and complaints',
    dashboardPath: '/cleaner/dashboard',
  },
  supervisor: {
    label: 'Supervisor',
    icon: UserCheck,
    color: 'from-green-500 to-green-600',
    bgColor: 'bg-green-50',
    textColor: 'text-green-600',
    borderColor: 'border-green-300',
    description: 'Supervise hostel operations',
    dashboardPath: '/cleaner/dashboard',
  },
  security: {
    label: 'Security Guard',
    icon: Lock,
    color: 'from-orange-500 to-orange-600',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-600',
    borderColor: 'border-orange-300',
    description: 'Monitor student check-in/check-out',
    dashboardPath: '/security/dashboard',
  },
  owner: {
    label: 'Owner',
    icon: Users,
    color: 'from-indigo-500 to-indigo-600',
    bgColor: 'bg-indigo-50',
    textColor: 'text-indigo-600',
    borderColor: 'border-indigo-300',
    description: 'Manage hostel operations',
    dashboardPath: '/owner/dashboard',
  },
  student: {
    label: 'Student',
    icon: User,
    color: 'from-pink-500 to-pink-600',
    bgColor: 'bg-pink-50',
    textColor: 'text-pink-600',
    borderColor: 'border-pink-300',
    description: 'Access student portal',
    dashboardPath: '/student/dashboard',
  },
};

export default function SelectRolePage() {
  const { user, setCurrentRole } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [switchingRole, setSwitchingRole] = useState<string | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsSwitching(window.location.search.includes('switch=true'));
    }
  }, []);

  useEffect(() => {
    if (!user) {
      router.replace('/login');
      return;
    }

    const userRoles = user.roles || (user.role ? [user.role] : []);
    const hasMultipleRoles = userRoles.length > 1;

    if (!hasMultipleRoles && user.role && !isSwitching) {
      const r = typeof user.role === 'string' ? user.role : userRoles[0];
      const roleStr = typeof r === 'string' ? r : (Array.isArray(r) ? r[0] : '') ?? '';
      navigateToRole(roleStr);
      return;
    }

    if (user.currentRole && userRoles.includes(user.currentRole) && !switchingRole && !isSwitching) {
      navigateToRole(user.currentRole);
      return;
    }

    if (user.currentRole && userRoles.includes(user.currentRole) && !selectedRole) {
      setSelectedRole(typeof user.currentRole === 'string' ? user.currentRole : String(user.currentRole ?? ''));
    } else if (userRoles.length > 0 && !selectedRole) {
      const first = userRoles[0];
      setSelectedRole(typeof first === 'string' ? first : (Array.isArray(first) ? first[0] : '') ?? '');
    }
  }, [user, router, isSwitching]);

  const navigateToRole = (role: string) => {
    switch (role) {
      case 'student':
        router.replace('/student/dashboard');
        break;
      case 'warden':
        router.replace('/warden/dashboard');
        break;
      case 'cleaner':
      case 'supervisor':
        router.replace('/cleaner/tasks');
        break;
      case 'owner':
        router.replace('/owner/dashboard');
        break;
      case 'security':
        router.replace('/security/dashboard');
        break;
      default:
        router.replace('/login');
    }
  };

  const handleRoleSelect = async (role: string) => {
    if (!role) return;

    setLoading(true);
    setSwitchingRole(role);
    try {
      await setCurrentRole(role);
      setTimeout(() => {
        navigateToRole(role);
      }, 100);
    } catch (error: any) {
      console.error('Error setting role:', error);
      setLoading(false);
      toast.error(error.message || 'Failed to set role');
    }
  };

  const userRoles = user?.roles || (user?.role ? [user.role] : []);
  const hasMultipleRoles = userRoles.length > 1;

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!hasMultipleRoles && !isSwitching) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Redirecting...</p>
        </div>
      </div>
    );
  }

  const availableRoles = userRoles;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-50 p-4">
      <div className="w-full max-w-4xl">
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <LogIn className="w-8 h-8 text-blue-600 mr-2" />
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {isSwitching ? 'Switch Role' : 'Login As'}
              </h1>
            </div>
            <p className="text-gray-600 mt-2">
              {isSwitching ? (
                <>
                  Currently logged in as <strong>{user.name}</strong>. Select a different role to switch.
                </>
              ) : (
                <>
                  Welcome, <strong>{user.name}</strong>! You have access to multiple roles. Please select which role you&apos;d like to use.
                </>
              )}
            </p>
            {user.currentRole && (
              <p className="text-sm text-gray-500 mt-2">
                Current role: <span className="font-semibold capitalize">{user.currentRole}</span>
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {availableRoles.map((role) => {
              const roleKey = typeof role === 'string' ? role : (Array.isArray(role) ? role[0] : '');
              const config = roleConfig[roleKey];
              if (!config) return null;

              const Icon = config.icon;
              const isSelected = selectedRole === roleKey;
              const isCurrentRole = user.currentRole === roleKey;

              return (
                <button
                  key={roleKey}
                  onClick={() => setSelectedRole(roleKey)}
                  disabled={loading}
                  className={`
                    relative p-6 rounded-xl border-2 transition-all duration-200
                    ${isSelected
                      ? `border-blue-500 bg-gradient-to-br ${config.color} text-white shadow-lg transform scale-105`
                      : isCurrentRole
                        ? `border-blue-300 ${config.bgColor} hover:border-blue-400 hover:shadow-md ring-2 ring-blue-200`
                        : `border-gray-200 ${config.bgColor} hover:border-gray-300 hover:shadow-md`
                    }
                    ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  <div className="flex items-start gap-4">
                    <div className={`
                      w-12 h-12 rounded-lg flex items-center justify-center
                      ${isSelected ? 'bg-white/20' : config.bgColor}
                    `}>
                      <Icon className={`w-6 h-6 ${isSelected ? 'text-white' : config.textColor}`} />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <h3 className={`text-lg font-bold mb-1 ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                          {config.label}
                        </h3>
                        {isCurrentRole && !isSelected && (
                          <span className="px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700 rounded-full">
                            Current
                          </span>
                        )}
                      </div>
                      <p className={`text-sm ${isSelected ? 'text-white/90' : 'text-gray-600'}`}>
                        {config.description}
                      </p>
                    </div>
                    {isSelected && (
                      <div className="absolute top-4 right-4">
                        <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                          <ArrowRight className="w-4 h-4 text-blue-600" />
                        </div>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex justify-center gap-4">
            {isSwitching && (
              <button
                onClick={() => {
                  const cur = user.currentRole;
                  if (cur && typeof cur === 'string') {
                    navigateToRole(cur);
                  } else {
                    router.back();
                  }
                }}
                disabled={loading}
                className="px-6 py-3 rounded-xl font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            )}
            <button
              onClick={() => handleRoleSelect(selectedRole)}
              disabled={!selectedRole || loading || selectedRole === (typeof user.currentRole === 'string' ? user.currentRole : '')}
              className={`
                px-8 py-3 rounded-xl font-semibold text-white
                bg-gradient-to-r from-blue-600 to-purple-600
                hover:from-blue-700 hover:to-purple-700
                transition-all duration-200 shadow-lg hover:shadow-xl
                transform hover:scale-105
                disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
                flex items-center gap-2
              `}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {isSwitching ? 'Switching...' : 'Setting Role...'}
                </>
              ) : selectedRole === (typeof user.currentRole === 'string' ? user.currentRole : '') ? (
                <>Already Selected</>
              ) : (
                <>
                  {isSwitching ? 'Switch to' : 'Continue as'} {selectedRole ? roleConfig[selectedRole]?.label : '...'}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>

          {selectedRole && (
            <p className="text-center text-sm text-gray-500 mt-4">
              {isSwitching
                ? 'You can switch roles anytime from your profile or dashboard'
                : 'You can switch roles later from your profile settings'
              }
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
