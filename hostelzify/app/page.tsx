'use client';

import PublicNavbar from '../components/layout/PublicNavbar';
import PublicFooter from '../components/layout/PublicFooter';
import Hero from '../components/landing/Hero';
import Stats from '../components/landing/Stats';
import ValueProps from '../components/landing/ValueProps';
import FeaturedHostels from '../components/marketplace/FeaturedHostels';
import Testimonials from '../components/landing/Testimonials';
import CTA from '../components/landing/CTA';

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-blue-100">
      <PublicNavbar />

      <main>
        <Hero />
        <Stats />

        {/* Featured Hostels Section */}
        {/* We reuse the component but might need to adjust its text color if it assumes light mode */}
        {/* FeaturedHostels uses bg-gray-50 and text-gray-900. Perfect for breaking the dark theme. */}
        <FeaturedHostels />

        <ValueProps />
        <Testimonials />
        <CTA />
      </main>

      <PublicFooter />
    </div>
  );
}
