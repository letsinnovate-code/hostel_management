'use client';

import { useState, useEffect, useRef } from 'react';

export default function Stats() {
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

    const stats = [
        { label: 'Active Hostels', value: '500+' },
        { label: 'Happy Students', value: '10,000+' },
        { label: 'Cities Covered', value: '25+' },
        { label: 'Verified Reviews', value: '5,000+' },
    ];

    return (
        <section
            ref={sectionRef}
            className="py-16 bg-white border-y border-gray-100"
        >
            <div className="max-w-7xl mx-auto px-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-12">
                    {stats.map((stat, index) => (
                        <div
                            key={index}
                            className={`text-center transition-all duration-700 transform ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                                }`}
                            style={{ transitionDelay: `${index * 150}ms` }}
                        >
                            <p className="text-4xl lg:text-5xl font-black text-blue-600 mb-3 tracking-tight">
                                {stat.value}
                            </p>
                            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                                {stat.label}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
