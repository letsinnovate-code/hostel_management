import { ComponentType } from 'react';
import {
  Home,
  Building2,
  Settings,
  Users,
  UserCheck,
  GraduationCap,
  Shield,
  DollarSign,
  MessageSquare,
  BarChart3,
  FileText,
  Wrench,
  UtensilsCrossed,
  ShieldAlert,
  Megaphone,
  UserPlus,
  BedDouble,
  FileCheck2,
  AlertTriangle,
  LifeBuoy,
  Bell,
  Sparkles,
  MapPin,
  User,
  CreditCard,
  Zap,
  Calendar,
  LogIn,
  LogOut,
  Map,
  LayoutDashboard,
  CheckSquare,
} from 'lucide-react';

export interface NavSubItem {
  label: string;
  href: string;
  badge?: string | number;
}

export interface NavItem {
  title?: string;
  label?: string;
  icon: ComponentType<{ className?: string; size?: number; style?: React.CSSProperties }>;
  href?: string;
  color?: string;
  subItems?: NavSubItem[];
  badge?: string | number;
}

export interface SidebarRoleConfig {
  role: string;
  portalTitle: string;
  portalSubtitle: string;
  badgeLabel: string;
  badgeBg: string;
  storageKey: string;
  defaultIcon: ComponentType<{ className?: string; size?: number }>;
  items: NavItem[];
}

export const NAVIGATION_CONFIGS: Record<string, SidebarRoleConfig> = {
  owner: {
    role: 'owner',
    portalTitle: 'Hostelzify',
    portalSubtitle: 'Owner Administration',
    badgeLabel: 'Owner',
    badgeBg: 'bg-gradient-to-r from-blue-600 to-indigo-600',
    storageKey: 'sidebar_expanded_items_owner',
    defaultIcon: Building2,
    items: [
      {
        title: 'Dashboard',
        icon: LayoutDashboard,
        href: '/owner/dashboard',
        color: '#0a7ea4',
      },
      {
        title: 'My Hostels',
        icon: Building2,
        href: '/owner/hostels',
        color: '#2563eb',
      },
      {
        title: 'Rooms',
        icon: BedDouble,
        href: '/owner/rooms',
        color: '#10b981',
      },
      {
        title: 'Students',
        icon: GraduationCap,
        href: '/owner/students',
        color: '#8b5cf6',
      },
      {
        title: 'Staff',
        icon: Users,
        href: '/owner/staff',
        color: '#f59e0b',
      },
      {
        title: 'Finance',
        icon: CreditCard,
        href: '/owner/finance',
        color: '#059669',
      },
      {
        title: 'Complaints',
        icon: AlertTriangle,
        href: '/owner/complaints',
        color: '#dc2626',
      },
      {
        title: 'Maintenance',
        icon: Wrench,
        href: '/owner/maintenance',
        color: '#ea580c',
      },
      {
        title: 'Violations',
        icon: AlertTriangle,
        href: '/owner/violations',
        color: '#ef4444',
      },
      {
        title: 'Gate Logs',
        icon: LogIn,
        href: '/owner/gate-logs',
        color: '#0891b2',
      },
      {
        title: 'Geo-Fence',
        icon: MapPin,
        href: '/owner/geo-fence',
        color: '#16a34a',
      },
      {
        title: 'Student Map',
        icon: Map,
        href: '/owner/students-map',
        color: '#7c3aed',
      },
      {
        title: 'Reports',
        icon: BarChart3,
        href: '/owner/reports',
        color: '#6366f1',
      },
      {
        title: 'Settings',
        icon: Settings,
        href: '/owner/settings',
        color: '#64748b',
      },

    ],
  },

  warden: {
    role: 'warden',
    portalTitle: 'Hostelzify',
    portalSubtitle: 'Warden Portal',
    badgeLabel: 'Warden',
    badgeBg: 'bg-gradient-to-r from-amber-600 to-orange-600',
    storageKey: 'sidebar_expanded_items_warden',
    defaultIcon: ShieldCheckIcon(),
    items: [
      {
        title: 'Dashboard',
        href: '/warden/dashboard',
        icon: LayoutDashboard,
      },
      {
        title: 'Students',
        href: '/warden/students',
        icon: Users,
      },
      {
        title: 'Onboarding',
        href: '/warden/onboarding',
        icon: UserPlus,
      },
      {
        title: 'Rooms',
        href: '/warden/rooms',
        icon: BedDouble,
      },
      {
        title: 'Attendance',
        href: '/warden/attendance',
        icon: UserCheck,
      },
      {
        title: 'Leave Requests',
        href: '/warden/leave-requests',
        icon: FileCheck2,
      },
      {
        title: 'Curfew',
        href: '/warden/curfew',
        icon: ShieldAlert,
      },
      {
        title: 'Discipline',
        href: '/warden/discipline',
        icon: AlertTriangle,
      },
      {
        title: 'Complaints',
        href: '/warden/complaints',
        icon: LifeBuoy,
      },
      {
        title: 'Visitors',
        href: '/warden/visitors',
        icon: LogIn,
      },
      {
        title: 'Announcements',
        href: '/warden/announcements',
        icon: Megaphone,
      },
      {
        title: 'Reports',
        href: '/warden/reports',
        icon: BarChart3,
      },
    ],
  },

  student: {
    role: 'student',
    portalTitle: 'Hostelzify',
    portalSubtitle: 'Student Portal',
    badgeLabel: 'Resident',
    badgeBg: 'bg-gradient-to-r from-emerald-600 to-teal-600',
    storageKey: 'sidebar_expanded_items_student',
    defaultIcon: GraduationCap,
    items: [
      {
        title: 'Dashboard',
        icon: Home,
        href: '/student/dashboard',
        color: '#0a7ea4',
      },
      {
        title: 'Hostel Onboarding',
        icon: UserCheck,
        href: '/student/onboarding',
        color: '#6366F1',
      },
      {
        title: 'Housing & Cleaning',
        icon: Sparkles,
        color: '#00BCD4',
        subItems: [
          { label: 'Request Cleaning', href: '/student/cleaning' },
          { label: 'Maintenance Issues', href: '/student/complaints' },
        ],
      },
      {
        title: 'Presence & Check-in',
        icon: MapPin,
        color: '#4CAF50',
        subItems: [
          { label: 'Check In/Out', href: '/student/dashboard#checkin' },
          { label: 'Attendance History', href: '/student/attendance' },
        ],
      },
      {
        title: 'Profile & Settings',
        icon: User,
        color: '#2196F3',
        subItems: [
          { label: 'My Profile', href: '/student/profile' },
          { label: 'Documents', href: '/student/documents' },
        ],
      },
      {
        title: 'Finance & Payments',
        icon: CreditCard,
        color: '#4CAF50',
        subItems: [{ label: 'Fees & Online Payments', href: '/student/payments' }],
      },
      {
        title: 'Dining & Meals',
        icon: UtensilsCrossed,
        color: '#e65100',
        subItems: [
          { label: 'Mess Schedule', href: '/student/mess' },
          { label: 'Mess Feedback', href: '/student/mess-feedback' },
        ],
      },
      {
        title: 'Visitors',
        icon: Users,
        color: '#9C27B0',
        subItems: [{ label: 'Register Visitor', href: '/student/visitors' }],
      },
      {
        title: 'Disciplinary',
        icon: ShieldAlert,
        color: '#f44336',
        subItems: [{ label: 'My Violations', href: '/student/violations' }],
      },
    ],
  },

  cleaner: {
    role: 'cleaner',
    portalTitle: 'Hostelzify',
    portalSubtitle: 'Facility Management',
    badgeLabel: 'Cleaner',
    badgeBg: 'bg-gradient-to-r from-emerald-500 to-green-600',
    storageKey: 'sidebar_expanded_items_cleaner',
    defaultIcon: Sparkles,
    items: [
      {
        title: 'Dashboard & Tasks',
        icon: Home,
        href: '/cleaner/dashboard',
        color: '#0a7ea4',
      },
      {
        title: 'Assigned Complaints',
        icon: Wrench,
        href: '/cleaner/complaints',
        color: '#FF9800',
      },
      {
        title: 'Work Schedule',
        icon: Calendar,
        href: '/cleaner/schedule',
        color: '#4CAF50',
      },
      {
        title: 'My Profile',
        icon: User,
        href: '/cleaner/profile',
        color: '#2196F3',
      },
    ],
  },

  security: {
    role: 'security',
    portalTitle: 'Hostelzify',
    portalSubtitle: 'Guard Portal',
    badgeLabel: 'Security',
    badgeBg: 'bg-gradient-to-r from-blue-600 to-cyan-600',
    storageKey: 'sidebar_expanded_items_security',
    defaultIcon: Shield,
    items: [
      {
        title: 'Dashboard',
        href: '/security/dashboard',
        icon: LayoutDashboard,
      },
      {
        title: 'All Students',
        href: '/security/students',
        icon: Users,
      },
      {
        title: 'Students Map',
        href: '/security/students-map',
        icon: Map,
      },
      {
        title: 'Checked In',
        href: '/security/checked-in',
        icon: LogIn,
      },
      {
        title: 'Checked Out',
        href: '/security/checked-out',
        icon: LogOut,
      },
    ],
  },
};

function ShieldCheckIcon() {
  return Shield;
}
