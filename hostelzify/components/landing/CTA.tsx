'use client';

import Link from 'next/link';

export default function CTA() {
    return (
        <section className="py-24 px-6 bg-white">
            <div className="max-w-6xl mx-auto">
                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[3rem] p-12 lg:p-20 text-center relative overflow-hidden shadow-2xl shadow-blue-200">
                    {/* Decorative accents */}
                    <div className="absolute top-0 right-0 w-80 h-80 bg-white opacity-[0.05] rounded-full blur-[80px] transform translate-x-1/2 -translate-y-1/2" />
                    <div className="absolute bottom-0 left-0 w-80 h-80 bg-white opacity-[0.05] rounded-full blur-[80px] transform -translate-x-1/2 translate-y-1/2" />

                    <h2 className="text-4xl lg:text-6xl font-black text-white mb-8 relative z-10 tracking-tight leading-tight">
                        Elevate Your <br className="hidden md:block" /> Hostel Experience
                    </h2>
                    <p className="text-blue-100 text-xl mb-12 max-w-2xl mx-auto relative z-10 font-medium">
                        Join the community of 10,000+ students and property owners who trust Hostelzify every day.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-6 justify-center relative z-10">
                        <Link
                            href="/signup?role=student"
                            className="px-12 py-5 bg-white text-blue-600 rounded-2xl font-black text-lg hover:bg-gray-50 transition-all shadow-xl hover:-translate-y-1 active:scale-95"
                        >
                            Get Started
                        </Link>
                        <Link
                            href="/signup?role=owner"
                            className="px-12 py-5 bg-blue-800/40 text-white rounded-2xl font-black text-lg hover:bg-blue-800/60 transition-all border border-white/10 backdrop-blur-sm hover:-translate-y-1 active:scale-95"
                        >
                            List Your Property
                        </Link>
                    </div>
                </div>
            </div>
        </section>
    );
}
