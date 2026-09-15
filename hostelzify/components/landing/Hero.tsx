'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Search,
  Building2,
  Sparkles,
  Navigation,
  ShieldCheck,
  Users,
  Compass,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Radio,
  DoorOpen,
  DollarSign
} from 'lucide-react';

export default function Hero() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 0);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section className="relative pt-10 pb-20 lg:pt-16 lg:pb-32 overflow-hidden bg-gradient-to-b from-slate-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-5%] left-[-5%] w-[45%] h-[45%] bg-blue-100/60 rounded-full blur-[110px]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[45%] h-[45%] bg-indigo-100/50 rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:24px_24px] opacity-25" />
      </div>

      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col lg:flex-row items-center gap-14 lg:gap-16">

          {/* Text Content */}
          <div className={`flex-1 text-center lg:text-left transition-all duration-1000 transform ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-bold mb-6 shadow-xs">
              <Sparkles className="w-4 h-4 text-blue-600 animate-pulse" />
              <span>Full-Stack 13-Module Property Intelligence</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.1] mb-6">
              The Next-Gen <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-teal-500">
                Hostel & Resident
              </span>{' '}
              Ecosystem
            </h1>

            <p className="text-lg text-slate-600 dark:text-slate-300 mb-8 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-medium">
              Seamlessly operate rooms, automated fee collections, OpenStreetMap geofencing, and live resident tracking across all your hostel properties.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
              <Link
                href="/owner/dashboard"
                className="w-full sm:w-auto px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 group hover:-translate-y-0.5"
              >
                <span>Launch Owner Console</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/owner/students-map"
                className="w-full sm:w-auto px-7 py-3.5 bg-white border border-slate-200 text-slate-800 hover:bg-slate-50 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-xs hover:-translate-y-0.5"
              >
                <Compass className="w-4 h-4 text-indigo-600" />
                Live Student Radar
              </Link>
              <Link
                href="/marketplace"
                className="w-full sm:w-auto px-6 py-3.5 text-slate-600 hover:text-blue-600 font-bold text-sm transition-colors"
              >
                Browse Hostels &rarr;
              </Link>
            </div>

            {/* Quick Metrics */}
            <div className="mt-10 pt-8 border-t border-slate-200/80 dark:border-slate-700/50 grid grid-cols-3 gap-6 max-w-lg mx-auto lg:mx-0 text-center lg:text-left">
              <div>
                <p className="text-2xl lg:text-3xl font-black text-slate-900">13</p>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5">Live Modules</p>
              </div>
              <div>
                <p className="text-2xl lg:text-3xl font-black text-emerald-600">100%</p>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5">Free OSM Maps</p>
              </div>
              <div>
                <p className="text-2xl lg:text-3xl font-black text-indigo-600">&lt;50ms</p>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5">GPS Sync</p>
              </div>
            </div>
          </div>

          {/* Interactive Live Dashboard Mockup */}
          <div className={`flex-1 w-full max-w-[560px] lg:max-w-none relative transition-all duration-1000 delay-300 transform ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
            <div className="relative z-10 bg-slate-900 rounded-3xl p-4 sm:p-5 shadow-2xl border border-slate-800 text-white">
              {/* Fake Window Controls */}
              <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-slate-800 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500" />
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-[11px] font-mono text-slate-400 ml-2">hostelzify.app/owner/dashboard</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  <Radio className="w-3 h-3 animate-pulse" />
                  Live Sync Active
                </div>
              </div>

              {/* Top Dashboard Status Bar */}
              <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/60 mb-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Property</span>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-blue-400" />
                      Jai Hind Campus & Residencies
                    </h3>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    94.6% Occupancy
                  </span>
                </div>

                {/* Key Metrics Row */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-700/50">
                    <span className="text-[10px] text-slate-400">Total Residents</span>
                    <p className="font-bold text-slate-100 text-sm mt-0.5">142 Active</p>
                  </div>
                  <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-700/50">
                    <span className="text-[10px] text-slate-400">Fee Collections</span>
                    <p className="font-bold text-emerald-400 text-sm mt-0.5">₹4.85 Lakh</p>
                  </div>
                  <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-700/50">
                    <span className="text-[10px] text-slate-400">Curfew Violations</span>
                    <p className="font-bold text-slate-100 text-sm mt-0.5">0 Active</p>
                  </div>
                </div>
              </div>

              {/* Live OpenStreetMap Campus Radar Widget */}
              <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 relative overflow-hidden mb-3">
                <div className="flex items-center justify-between mb-2.5 text-xs">
                  <span className="font-bold text-slate-300 flex items-center gap-1.5">
                    <Navigation className="w-3.5 h-3.5 text-indigo-400" />
                    Student Geofence Radar (OpenStreetMap)
                  </span>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-emerald-400 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      138 Inside
                    </span>
                    <span className="text-amber-400">• 4 Outside</span>
                  </div>
                </div>

                {/* Visual Map Representation */}
                <div className="h-32 rounded-xl bg-slate-900/80 border border-slate-800 relative overflow-hidden flex items-center justify-center">
                  {/* Grid Lines */}
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:1.5rem_1.5rem] opacity-30" />

                  {/* Geofence Perimeter Polygon Representation */}
                  <div className="absolute w-44 h-24 rounded-2xl border-2 border-dashed border-blue-500/60 bg-blue-500/10 flex items-center justify-center">
                    <span className="text-[9px] font-mono text-blue-300 tracking-wider uppercase font-bold">Hostel Campus Perimeter</span>
                  </div>

                  {/* Hostel Marker */}
                  <div className="absolute z-20 flex flex-col items-center">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/50">
                      <Building2 className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  {/* Student Pin Inside 1 */}
                  <div className="absolute z-20 left-1/3 top-1/4 flex items-center gap-1 bg-emerald-950/80 border border-emerald-500/40 px-1.5 py-0.5 rounded-full shadow-md">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[9px] font-semibold text-emerald-200">Rohit (Inside)</span>
                  </div>

                  {/* Student Pin Inside 2 */}
                  <div className="absolute z-20 right-1/3 bottom-1/4 flex items-center gap-1 bg-emerald-950/80 border border-emerald-500/40 px-1.5 py-0.5 rounded-full shadow-md">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-[9px] font-semibold text-emerald-200">Sneha (Inside)</span>
                  </div>

                  {/* Student Pin Outside */}
                  <div className="absolute z-20 right-4 top-3 flex items-center gap-1 bg-amber-950/80 border border-amber-500/40 px-1.5 py-0.5 rounded-full shadow-md">
                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="text-[9px] font-semibold text-amber-200">Aryan (1.2km)</span>
                  </div>
                </div>
              </div>

              {/* Real-time Gate Log Ticker */}
              <div className="bg-slate-800/50 rounded-xl p-2.5 border border-slate-800 flex items-center justify-between text-[11px] text-slate-300">
                <div className="flex items-center gap-2">
                  <DoorOpen className="w-4 h-4 text-teal-400" />
                  <span>Gate 1: <strong className="text-white">Priya Patel</strong> verified via QR</span>
                </div>
                <span className="text-slate-500 font-mono text-[10px]">Just now</span>
              </div>
            </div>

            {/* Glowing Accent Orbs */}
            <div className="absolute -top-6 -right-6 w-32 h-32 bg-blue-500/20 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />
          </div>

        </div>
      </div>
    </section>
  );
}
