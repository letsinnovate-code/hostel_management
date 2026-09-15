'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  BedDouble,
  Users,
  UserCheck,
  CreditCard,
  AlertCircle,
  Wrench,
  ShieldAlert,
  DoorOpen,
  MapPin,
  Compass,
  BarChart3,
  Settings,
  ArrowRight,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

const MODULES = [
  {
    id: 'hostels',
    title: 'Hostels Property Hub',
    category: 'Core Setup',
    icon: Building2,
    color: 'from-blue-600 to-indigo-600',
    badge: 'OpenStreetMap Pinning',
    description: 'Multi-branch property portfolio with free OpenStreetMap geocoding and real-time operational status.',
    features: ['Nominatim GPS Auto-Locate', 'Branch Curfew Profiles', 'Interactive Pin-Drop Map'],
    href: '/owner/hostels',
  },
  {
    id: 'rooms',
    title: 'Room & Bed Inventory',
    category: 'Capacity',
    icon: BedDouble,
    color: 'from-cyan-600 to-blue-600',
    badge: 'Live Availability',
    description: 'Track room numbers, floor tiers, single/double sharing allocations, and vacant bed counters.',
    features: ['Visual Bed Allocator', 'Amenity Tagging', 'Rate Tier Pricing'],
    href: '/owner/rooms',
  },
  {
    id: 'students',
    title: 'Student Roster & KYC',
    category: 'Resident Lifecycle',
    icon: Users,
    color: 'from-emerald-600 to-teal-600',
    badge: 'Synchronized Database',
    description: 'Resident profiles, emergency parent contacts, room allocations, and verified identity documents.',
    features: ['Emergency Parent SOS', 'Room Transfer History', 'One-Click Resident Check-in'],
    href: '/owner/students',
  },
  {
    id: 'staff',
    title: 'Staff & Security Access',
    category: 'Operations',
    icon: UserCheck,
    color: 'from-violet-600 to-purple-600',
    badge: 'RBAC Security',
    description: 'Delegate operational duties to wardens, gate security, and cleaners with fine-grained access control.',
    features: ['Role Permission Guard', 'Duty Shift Logging', 'Direct Support Dispatch'],
    href: '/owner/staff',
  },
  {
    id: 'finance',
    title: 'Treasury & Fee Ledgers',
    category: 'Accounting',
    icon: CreditCard,
    color: 'from-amber-600 to-orange-600',
    badge: 'Auto Invoicing',
    description: 'Automate monthly rent, track cash/UPI collections, generate digital receipts, and view revenue analytics.',
    features: ['Dues & Arrears Tracker', 'Expense Categorization', 'CSV Audit Export'],
    href: '/owner/finance',
  },
  {
    id: 'complaints',
    title: 'Complaints & Ticketing',
    category: 'Resident Support',
    icon: AlertCircle,
    color: 'from-rose-600 to-red-600',
    badge: 'SLA Escalations',
    description: 'Resident grievance portal with priority tags, status pipelines, photo evidence, and resolution alerts.',
    features: ['Plumbing/WiFi/Mess Tags', 'Staff Assignment', 'Resolution Time SLA'],
    href: '/owner/complaints',
  },
  {
    id: 'maintenance',
    title: 'Facility Maintenance',
    category: 'Operations',
    icon: Wrench,
    color: 'from-yellow-600 to-amber-700',
    badge: 'Preventative Care',
    description: 'Schedule preventative maintenance for AC units, electrical fixtures, elevators, and water purifiers.',
    features: ['Vendor Cost Logging', 'Room Repair Status', 'Asset History Log'],
    href: '/owner/maintenance',
  },
  {
    id: 'violations',
    title: 'Violations & Discipline',
    category: 'Safety',
    icon: ShieldAlert,
    color: 'from-red-600 to-pink-600',
    badge: 'Curfew & Rules',
    description: 'Log and review disciplinary events, curfew infractions, noise complaints, and automated parent alerts.',
    features: ['Fine Management', 'Incident Severity Tier', 'Automated Parent SMS/Email'],
    href: '/owner/violations',
  },
  {
    id: 'gate-logs',
    title: 'Gate Logs & Access Control',
    category: 'Physical Security',
    icon: DoorOpen,
    color: 'from-teal-600 to-emerald-700',
    badge: 'Real-Time Gate Sync',
    description: 'Instant entry/exit tracking with contactless QR validation, visitor passes, and daily footfall metrics.',
    features: ['QR Gate Verification', 'Real-Time Map View', 'Late Return Flagging'],
    href: '/owner/gate-logs',
  },
  {
    id: 'geo-fence',
    title: 'Geo-Fence Boundary',
    category: 'Geospatial Radar',
    icon: MapPin,
    color: 'from-blue-700 to-indigo-800',
    badge: 'OpenStreetMap Polygon',
    description: 'Draw custom multi-point polygonal and circular perimeters directly on OpenStreetMap without API limits.',
    features: ['Interactive Polygon Drawing', 'Breach Buffer Zones', 'Live Perimeter Validation'],
    href: '/owner/geo-fence',
  },
  {
    id: 'students-map',
    title: 'Student Campus Map',
    category: 'Live Tracking',
    icon: Compass,
    color: 'from-indigo-600 to-blue-600',
    badge: 'Live Telemetry Radar',
    description: 'Track real-time resident telemetry, check-in status, and instant inside/outside geofence evaluations.',
    features: ['Real-Time GPS Pinging', 'Color-Coded Status Pins', 'Live Telemetry Simulator'],
    href: '/owner/students-map',
  },
  {
    id: 'reports',
    title: 'Executive Reports & Analytics',
    category: 'Intelligence',
    icon: BarChart3,
    color: 'from-slate-700 to-slate-900',
    badge: 'Comprehensive Audits',
    description: 'Deep dive into revenue trends, occupancy percentages, daily attendance rates, and one-click data exports.',
    features: ['Monthly P&L Statements', 'Attendance Heatmaps', 'Excel / CSV / PDF Exports'],
    href: '/owner/reports',
  },
  {
    id: 'settings',
    title: 'Property & System Settings',
    category: 'Configuration',
    icon: Settings,
    color: 'from-zinc-700 to-neutral-900',
    badge: 'Centralized Control',
    description: 'Configure hostel curfew cutoff times, late fine rates, notification templates, and multi-tenant profiles.',
    features: ['Curfew Cutoff Schedules', 'Custom Alert Rules', 'Multi-Hostel Sync'],
    href: '/owner/settings',
  },
];

export default function ModulesShowcase() {
  const [activeCategory, setActiveCategory] = useState('all');

  const categories = [
    { id: 'all', label: 'All 13 Modules' },
    { id: 'Geospatial Radar', label: 'Maps & Tracking' },
    { id: 'Operations', label: 'Operations & Staff' },
    { id: 'Accounting', label: 'Finance & Billing' },
    { id: 'Safety', label: 'Safety & Discipline' },
  ];

  const filteredModules = MODULES.filter((m) => {
    if (activeCategory === 'all') return true;
    if (activeCategory === 'Maps & Tracking') {
      return ['geo-fence', 'students-map', 'gate-logs', 'hostels'].includes(m.id);
    }
    return m.category === activeCategory;
  });

  return (
    <section className="py-24 bg-slate-900 text-white relative overflow-hidden" id="modules">
      {/* Background Glows */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            Complete Property Infrastructure
          </div>
          <h2 className="text-4xl lg:text-5xl font-black tracking-tight text-white">
            13 Synchronized Modules.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-teal-300 to-indigo-400">
              One Unified System.
            </span>
          </h2>
          <p className="text-slate-400 text-base lg:text-lg leading-relaxed font-medium">
            Everything your property operations require — from OpenStreetMap-powered geofencing and live student telemetry to fee ledgers, automated curfews, and maintenance pipelines.
          </p>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-4">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeCategory === c.id
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-750 hover:text-white border border-slate-700/60'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* 13-Module Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredModules.map((mod) => {
            const Icon = mod.icon;
            return (
              <div
                key={mod.id}
                className="group relative bg-slate-800/60 backdrop-blur-md border border-slate-700/60 hover:border-blue-500/50 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-blue-500/10 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${mod.color} flex items-center justify-center text-white shadow-md shadow-blue-500/20`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-700/80 text-blue-300 border border-slate-600/50">
                      {mod.badge}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">
                    {mod.title}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed mb-4">
                    {mod.description}
                  </p>

                  <div className="space-y-1.5 mb-6">
                    {mod.features.map((feat, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-slate-300 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Link
                  href={mod.href}
                  className="w-full py-2 px-3.5 rounded-xl bg-slate-700/50 hover:bg-blue-600 text-slate-300 hover:text-white text-xs font-bold transition-all flex items-center justify-between group/link border border-slate-600/50 hover:border-transparent"
                >
                  <span>Launch Module</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover/link:translate-x-1 transition-transform" />
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
