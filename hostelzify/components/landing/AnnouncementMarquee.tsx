'use client';

import { Sparkles, MapPin, ShieldCheck, CreditCard, Bell, Zap, BarChart3, Users } from 'lucide-react';

const ITEMS = [
  { icon: Sparkles,   text: '13 Fully Synchronized Modules — Now Live' },
  { icon: MapPin,     text: 'OpenStreetMap Geo-Fencing — Zero API Cost' },
  { icon: ShieldCheck,text: 'Real-Time Student Location Tracking' },
  { icon: CreditCard, text: 'Automated Fee Collection & Digital Receipts' },
  { icon: Bell,       text: 'Instant Curfew Violation Alerts to Parents' },
  { icon: Zap,        text: 'QR-Based Gate Access Control — Live Entry/Exit' },
  { icon: BarChart3,  text: 'Executive Reports with CSV / PDF Export' },
  { icon: Users,      text: 'Role-Based Access: Owner · Warden · Security' },
];

export default function AnnouncementMarquee() {
  // Duplicate items for seamless infinite scroll
  const doubled = [...ITEMS, ...ITEMS];

  return (
    <div className="w-full bg-blue-600 text-white py-2.5 overflow-hidden select-none relative z-40">
      {/* Fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-blue-600 to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-blue-600 to-transparent z-10 pointer-events-none" />

      <div className="flex animate-marquee whitespace-nowrap">
        {doubled.map((item, idx) => {
          const Icon = item.icon;
          return (
            <span
              key={idx}
              className="inline-flex items-center gap-2 mx-8 text-xs font-semibold tracking-wide"
            >
              <Icon className="w-3.5 h-3.5 shrink-0 opacity-80" />
              {item.text}
              <span className="mx-4 opacity-30">|</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
