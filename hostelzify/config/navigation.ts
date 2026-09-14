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
        icon: Home,
        href: '/owner/dashboard',
        color: '#0a7ea4',
      },
      {
        title: 'System & Hostel Setup',
        icon: Building2,
        color: '#0a7ea4',
        subItems: [
          { label: 'Manage Hostels', href: '/owner/hostels' },
          { label: 'Room Configuration', href: '/owner/rooms' },
          { label: 'Amenities Setup', href: '/owner/amenities' },
        ],
      },
      {
        title: 'Student Management',
        icon: GraduationCap,
        color: '#9C27B0',
        subItems: [
          { label: 'Students (presence & management)', href: '/owner/students/presence' },
          { label: 'Leave / Outpass', href: '/owner/leave-requests' },
          { label: 'Maintenance', href: '/owner/maintenance' },
        ],
      },
      {
        title: 'Staff Management',
        icon: Users,
        color: '#FF9800',
        subItems: [{ label: 'Staff Management', href: '/owner/staff' }],
      },
      {
        title: 'Rule Engine & Policies',
        icon: Settings,
        color: '#4CAF50',
        subItems: [{ label: 'Rules & Policies', href: '/owner/rules' }],
      },
      {
        title: 'Security & Presence',
        icon: Shield,
        color: '#f44336',
        subItems: [
          { label: 'Geo-Fence Setup', href: '/owner/geo-fence' },
          { label: 'Violations', href: '/owner/violations' },
          { label: 'Gate logs', href: '/owner/gate-logs' },
          { label: 'All Students (map)', href: '/owner/students-map' },
        ],
      },
      {
        title: 'Finance & Payments',
        icon: DollarSign,
        color: '#4CAF50',
        subItems: [{ label: 'Fee structure & payments', href: '/owner/fee-structure' }],
      },
      {
        title: 'Communication',
        icon: MessageSquare,
        color: '#2196F3',
        subItems: [
          { label: 'Alert Centre', href: '/owner/alerts' },
          { label: 'Notice Board', href: '/owner/broadcast' },
          { label: 'Message Templates', href: '/owner/templates' },
        ],
      },
      {
        title: 'Mess & Food',
        icon: UtensilsCrossed,
        color: '#e65100',
        subItems: [
          { label: 'Mess Schedule', href: '/owner/mess' },
          { label: 'Mess Feedback', href: '/owner/mess-feedback' },
        ],
      },
      {
        title: 'Analytics & Reports',
        icon: BarChart3,
        color: '#FF5722',
        subItems: [{ label: 'Analytics', href: '/owner/analytics' }],
      },
      {
        title: 'Compliance & Audit',
        icon: FileText,
        color: '#607D8B',
        subItems: [{ label: 'Audit Trail & Export', href: '/owner/audit' }],
      },
      {
        title: 'System Governance',
        icon: Wrench,
        color: '#795548',
        subItems: [{ label: 'Support Tickets', href: '/owner/support' }],
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
        title: 'Onboarding Applications',
        href: '/warden/onboarding',
        icon: UserPlus,
      },
      {
        title: 'Students',
        href: '/warden/students',
        icon: Users,
      },
      {
        title: 'Rooms & Beds',
        href: '/warden/rooms',
        icon: BedDouble,
      },
      {
        title: 'Attendance',
        href: '/warden/attendance',
        icon: UserCheck,
      },
      {
        title: 'Curfew Control',
        href: '/warden/curfew',
        icon: ShieldAlert,
      },
      {
        title: 'Alerts & Broadcasts',
        href: '/warden/alerts',
        icon: Bell,
      },
      {
        title: 'Leave & Permissions',
        href: '/warden/permissions',
        icon: FileCheck2,
      },
      {
        title: 'Disciplinary Records',
        href: '/warden/violations',
        icon: AlertTriangle,
      },
      {
        title: 'Complaints',
        href: '/warden/complaints',
        icon: LifeBuoy,
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
