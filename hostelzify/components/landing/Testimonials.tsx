'use client';

import { useState, useEffect, useRef } from 'react';
import { Star, Quote } from 'lucide-react';

export default function Testimonials() {
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

    const testimonials = [
        {
            name: 'Rohan Sharma',
            role: 'Student, Delhi University',
            content: "Finding a hostel was always a nightmare until I found Hostelzify. The verified listings gave me peace of mind, and the booking process was seamless.",
            rating: 5,
        },
        {
            name: 'Priya Patel',
            role: 'Property Owner',
            content: "Since listing on Hostelzify, my occupancy has increased by 40%. The management dashboard makes tracking rent and complaints incredibly easy.",
            rating: 5,
        },
        {
            name: 'Amanda David',
            role: 'Management Consultant',
            content: "The attention to detail in the platform is amazing. It's the most polished hostel management tool I've seen in the market.",
            rating: 5,
        },
    ];

    return (
        <section ref={sectionRef} className="py-24 bg-gray-50 border-y border-gray-100">
            <div className="max-w-7xl mx-auto px-6">
                <div className="text-center mb-20 transition-all duration-700 transform flex flex-col items-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest mb-4">
                        Voice of Community
                    </div>
                    <h2 className="text-4xl lg:text-5xl font-black text-slate-900 mb-6 tracking-tight text-center">
                        Trusted by Students & Owners
                    </h2>
                    <p className="text-lg text-slate-500 max-w-2xl mx-auto font-medium">
                        Join thousands of happy users who have transformed their hostel experience.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                    {testimonials.map((testimonial, index) => (
                        <div
                            key={index}
                            className={`bg-white p-10 rounded-[2.5rem] border border-gray-100 relative hover:border-blue-200 transition-all duration-700 group shadow-sm hover:shadow-xl transform ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'
                                }`}
                            style={{ transitionDelay: `${index * 200}ms` }}
                        >
                            <Quote className="absolute top-10 right-10 w-12 h-12 text-blue-50 group-hover:text-blue-100 transition-colors fill-current" />

                            <div className="flex gap-1 mb-8">
                                {[...Array(testimonial.rating)].map((_, i) => (
                                    <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                                ))}
                            </div>

                            <p className="text-lg text-slate-600 italic mb-8 leading-relaxed font-medium">
                                "{testimonial.content}"
                            </p>

                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center font-black text-blue-600">
                                    {testimonial.name.charAt(0)}
                                </div>
                                <div>
                                    <h4 className="font-black text-slate-900 tracking-tight">{testimonial.name}</h4>
                                    <p className="text-sm text-slate-400 font-bold">{testimonial.role}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
