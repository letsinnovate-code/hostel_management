'use client';

import { useState, useEffect, useRef } from 'react';
import { Shield, Smartphone, Zap, Home, TrendingUp, Users } from 'lucide-react';

export default function ValueProps() {
    const [isVisible, setIsVisible] = useState(false);
    const sectionRef = useRef(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.unobserve(entry.target);
                }
            },
            { threshold: 0.1 }
        );

        if (sectionRef.current) {
            observer.observe(sectionRef.current);
        }

        return () => observer.disconnect();
    }, []);

    const features = [
        {
            icon: Shield,
            title: 'Verified Listings',
            desc: 'Every hostel is physically verified to ensure safety and quality standards.',
            for: 'students',
            color: 'blue'
        },
        {
            icon: Smartphone,
            title: 'Digital Booking',
            desc: 'Book your room, pay rent, and sign agreements completely online.',
            for: 'students',
            color: 'green'
        },
        {
            icon: Home,
            title: 'Smart Living',
            desc: 'Raise complaints, track attendance, and manage gate passes via app.',
            for: 'students',
            color: 'purple'
        },
        {
            icon: TrendingUp,
            title: 'Business Growth',
            desc: 'Fill vacancies faster with our marketplace and SEO-optimized listings.',
            for: 'owners',
            color: 'orange'
        },
        {
            icon: Zap,
            title: 'Automated Operations',
            desc: 'Auto-generate invoices, track payments, and manage staff effortlessly.',
            for: 'owners',
            color: 'red'
        },
        {
            icon: Users,
            title: 'Tenant Management',
            desc: 'Keep track of all student records, documents, and communications in one place.',
            for: 'owners',
            color: 'indigo'
        },
    ];

    return (
        <section
            ref={sectionRef}
            className="py-24 bg-white"
            id="features"
        >
            <div className="max-w-7xl mx-auto px-6">
                <div className="text-center mb-20 transition-all duration-700 transform flex flex-col items-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest mb-4">
                        Powerful Features
                    </div>
                    <h2 className="text-4xl lg:text-5xl font-black text-slate-900 mb-6 tracking-tight">
                        Built for Students & Property Owners
                    </h2>
                    <p className="text-lg text-slate-500 max-w-2xl mx-auto font-medium">
                        Everything you need to find the perfect stay or manage your hostel business efficiently.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                    {features.map((feature, index) => (
                        <div
                            key={index}
                            className={`bg-white p-10 rounded-[2.5rem] border border-gray-100 hover:border-blue-200 transition-all duration-700 shadow-sm hover:shadow-xl hover:-translate-y-2 group transform ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
                                }`}
                            style={{ transitionDelay: `${index * 100}ms` }}
                        >
                            <div className="w-16 h-16 rounded-[1.25rem] bg-gray-50 flex items-center justify-center mb-8 group-hover:bg-blue-600 transition-colors shadow-inner">
                                <feature.icon className="w-8 h-8 text-blue-600 group-hover:text-white transition-colors" />
                            </div>

                            <div className="mb-4">
                                <span className={`text-[10px] font-black uppercase tracking-[0.2em] border-b-2 pb-1 ${feature.for === 'students' ? 'text-blue-500 border-blue-100' : 'text-purple-500 border-purple-100'}`}>
                                    {feature.for} Side
                                </span>
                            </div>

                            <h3 className="text-2xl font-black text-slate-900 mb-4 tracking-tight">{feature.title}</h3>
                            <p className="text-slate-500 leading-relaxed font-medium">
                                {feature.desc}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
