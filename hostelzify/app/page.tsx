'use client';

import AnnouncementMarquee from '../components/landing/AnnouncementMarquee';
import PublicNavbar from '../components/layout/PublicNavbar';
import PublicFooter from '../components/layout/PublicFooter';
import Hero from '../components/landing/Hero';
import Stats from '../components/landing/Stats';
import ModulesShowcase from '../components/landing/ModulesShowcase';
import ValueProps from '../components/landing/ValueProps';
import FeaturedHostels from '../components/marketplace/FeaturedHostels';
import Testimonials from '../components/landing/Testimonials';
import LandingFAQ from '../components/landing/LandingFAQ';
import CTA from '../components/landing/CTA';

export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-blue-100">
      {/* Sticky top bar: Marquee + Navbar stacked */}
      <div className="fixed top-0 left-0 right-0 z-50 flex flex-col">
        <AnnouncementMarquee />
        <PublicNavbar />
      </div>

      {/* Offset content for the fixed header height (marquee ~36px + nav ~72px) */}
      <div className="pt-[108px]">
        <main>
          <Hero />
          <Stats />
          <ModulesShowcase />

          {/* Featured Hostels — light card section */}
          <FeaturedHostels />

          <ValueProps />
          <Testimonials />
          <LandingFAQ />
          <CTA />
        </main>
      </div>

      <PublicFooter />
    </div>
  );
}
