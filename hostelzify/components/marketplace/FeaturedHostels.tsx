'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { API_BASE_URL } from '../../constants/config';
import HostelCard from './HostelCard';

export default function FeaturedHostels() {
    const [hostels, setHostels] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadFeaturedHostels();
    }, []);

    const loadFeaturedHostels = async () => {
        try {
            const apiUrl = API_BASE_URL.replace('/api', '') || 'http://localhost:4000';
            const response = await fetch(`${apiUrl}/api/public/hostels`);
            if (response.ok) {
                const data = await response.json();
                const allHostels = data.data || [];
                // Sort by occupancy or random, for now just take first 3 verified or random
                setHostels(allHostels.slice(0, 3));
            }
        } catch (error) {
            console.error('Failed to load featured hostels:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return null; // Or a skeleton
    if (hostels.length === 0) return null;

    return (
        <section className="py-20 bg-gray-50">
            <div className="max-w-7xl mx-auto px-6">
                <div className="flex justify-between items-end mb-10">
                    <div>
                        <h2 className="text-3xl font-bold text-gray-900">Featured Hostels</h2>
                        <p className="mt-2 text-gray-600">Top-rated accommodations selected for you</p>
                    </div>
                    <Link href="/marketplace" className="hidden sm:flex items-center gap-2 text-blue-600 font-medium hover:text-blue-700 group">
                        View All Hostels <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {hostels.map(hostel => (
                        <HostelCard key={hostel._id || hostel.id} hostel={hostel} />
                    ))}
                </div>

                <div className="mt-10 text-center sm:hidden">
                    <Link href="/marketplace" className="inline-flex items-center gap-2 text-blue-600 font-medium hover:text-blue-700">
                        View All Hostels <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            </div>
        </section>
    );
}
