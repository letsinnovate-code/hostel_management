'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, Search, Building2, Sparkles } from 'lucide-react';

export default function Hero() {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        setIsVisible(true);
    }, []);

    return (
        <section className="relative pt-32 pb-24 lg:pt-48 lg:pb-40 overflow-hidden bg-white">
            {/* Background Decor */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-50 rounded-full blur-[100px] opacity-60" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-50 rounded-full blur-[100px] opacity-60" />

                {/* Subtle Grid */}
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03]" />
            </div>

            <div className="max-w-7xl mx-auto px-6">
                <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-24">

                    {/* Text Content */}
                    <div className={`flex-1 text-center lg:text-left transition-all duration-1000 transform ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-sm font-bold mb-8 shadow-sm">
                            <Sparkles className="w-4 h-4 text-blue-500 animate-pulse" />
                            <span>India's Most Trusted Hostel Platform</span>
                        </div>

                        <h1 className="text-5xl lg:text-7xl font-extrabold text-slate-900 tracking-tight leading-[1.1] mb-8">
                            Discover Your <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Perfect Stay</span>
                        </h1>

                        <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-medium">
                            Hostelzify brings you verified hostels with modern amenities.
                            Book your home away from home in just three easy clicks.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center gap-5 justify-center lg:justify-start">
                            <Link
                                href="/marketplace"
                                className="w-full sm:w-auto px-10 py-4.5 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-xl shadow-blue-100 group hover:-translate-y-1"
                            >
                                <Search className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                Find Hostels
                            </Link>
                            <Link
                                href="/signup?role=owner"
                                className="w-full sm:w-auto px-10 py-4.5 bg-white border border-gray-200 text-slate-900 rounded-2xl font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-2 shadow-sm hover:-translate-y-1"
                            >
                                <Building2 className="w-5 h-5 text-gray-400" />
                                List Property
                            </Link>
                        </div>

                        {/* Trust Badges */}
                        <div className={`mt-12 flex items-center justify-center lg:justify-start gap-10 text-xs text-slate-400 uppercase tracking-[0.2em] font-bold transition-all duration-1000 delay-500 transform ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
                            <div className="flex flex-col items-center lg:items-start gap-1">
                                <span className="text-slate-900 text-sm">10k+</span>
                                <span>Students</span>
                            </div>
                            <div className="w-px h-8 bg-gray-100" />
                            <div className="flex flex-col items-center lg:items-start gap-1">
                                <span className="text-slate-900 text-sm">500+</span>
                                <span>Hostels</span>
                            </div>
                            <div className="w-px h-8 bg-gray-100" />
                            <div className="flex flex-col items-center lg:items-start gap-1">
                                <span className="text-slate-900 text-sm">25+</span>
                                <span>Cities</span>
                            </div>
                        </div>
                    </div>

                    {/* Hero Image/Visual */}
                    <div className={`flex-1 w-full max-w-[550px] lg:max-w-none relative transition-all duration-1000 delay-300 transform ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
                        <div className="relative z-10 bg-white rounded-[2.5rem] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.08)] border border-gray-100 rotate-2 hover:rotate-0 transition-transform duration-700">
                            <div className="bg-gray-50 rounded-[2rem] overflow-hidden border border-gray-100 aspect-[4/3] relative group">
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 z-0" />

                                {/* Decorative Mockup Elements */}
                                <div className="relative z-10 p-8 flex flex-col h-full">
                                    <div className="flex items-center gap-3 mb-10">
                                        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
                                            <Building2 className="w-5 h-5 text-white" />
                                        </div>
                                        <div className="h-4 w-32 bg-gray-200 rounded-full" />
                                    </div>

                                    <div className="grid grid-cols-2 gap-5 mb-6">
                                        <div className="h-40 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
                                            <div className="h-24 bg-gray-50 rounded-lg" />
                                            <div className="h-3 w-3/4 bg-gray-100 rounded-full" />
                                        </div>
                                        <div className="h-40 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
                                            <div className="h-24 bg-gray-50 rounded-lg" />
                                            <div className="h-3 w-3/4 bg-gray-100 rounded-full" />
                                        </div>
                                    </div>

                                    <div className="mt-auto h-24 bg-blue-600 rounded-2xl shadow-xl shadow-blue-100 flex items-center justify-center">
                                        <span className="text-white font-bold tracking-wide">Find Your Room</span>
                                    </div>
                                </div>
                            </div>

                            {/* Overlays */}
                            <div className="absolute -top-6 -right-6 bg-white p-4 rounded-2xl shadow-xl border border-gray-50 flex items-center gap-3 animate-bounce shadow-blue-100/50">
                                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                                    <Sparkles className="w-5 h-5 text-green-600" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-900 leading-none">Verified</p>
                                    <p className="text-[10px] text-slate-400 mt-1">100% Secure</p>
                                </div>
                            </div>
                        </div>

                        {/* Soft decorative spheres */}
                        <div className="absolute -top-12 -left-12 w-32 h-32 bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" />
                        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-purple-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse delay-500" />
                    </div>

                </div>
            </div>
        </section>
    );
}
