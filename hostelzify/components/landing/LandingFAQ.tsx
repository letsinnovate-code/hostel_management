'use client';

import { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

const FAQS = [
  {
    q: 'Is Hostelzify free to use?',
    a: 'Yes! The core platform is completely free. Map services are powered by OpenStreetMap (100% free, no API keys needed). We offer optional premium tiers for large enterprise deployments with advanced analytics and white-labeling.',
  },
  {
    q: 'How does geo-fencing work?',
    a: 'You can draw a custom polygon perimeter directly on the OpenStreetMap canvas in the Geo-Fence module. The system then continuously evaluates each resident\'s GPS coordinates against this perimeter and raises alerts when a student moves outside the boundary.',
  },
  {
    q: 'Can I manage multiple hostels from one account?',
    a: 'Absolutely. Hostelzify is designed for multi-property operations. The Owner Console lets you switch between properties instantly, and all reports can span across your entire portfolio for consolidated insights.',
  },
  {
    q: 'How do students share their location?',
    a: 'Students use the Hostelzify mobile app or web portal, which requests one-time location permission. GPS coordinates are synced to the server periodically and visualized live on the Student Campus Map for wardens and owners.',
  },
  {
    q: 'What roles can I assign to staff?',
    a: 'The platform supports four staff roles: Owner (full access), Warden (resident management, complaints, violations), Security Guard (gate logs, access control), and Cleaner (task assignment). Each role has a scoped interface so staff only see what they need.',
  },
  {
    q: 'Does it support automated fee collection reminders?',
    a: 'Yes. The Finance module can be configured with billing cycles and due dates. The system automatically sends email/SMS reminders to students with pending dues and logs all payment activity in a tamper-proof ledger.',
  },
  {
    q: 'Can parents be notified about violations or curfew breaches?',
    a: 'Yes. When a violation is logged or a student is detected outside the geo-fence past curfew hours, the system can trigger automated notifications to the parent/guardian contact stored in the student\'s profile.',
  },
  {
    q: 'Is there data export functionality?',
    a: 'Yes. The Reports module supports export to CSV, Excel, and PDF formats for attendance records, financial statements, violation logs, gate activity, and maintenance history.',
  },
];

export default function LandingFAQ() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="py-24 bg-white" id="faq">
      <div className="max-w-3xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-bold mb-5">
            <HelpCircle className="w-4 h-4" />
            Frequently Asked Questions
          </div>
          <h2 className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight mb-4">
            Got questions?{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
              We have answers.
            </span>
          </h2>
          <p className="text-slate-500 text-base leading-relaxed font-medium">
            Everything you need to know about running your hostel with Hostelzify.
          </p>
        </div>

        {/* Accordion */}
        <div className="space-y-3">
          {FAQS.map((faq, idx) => (
            <div
              key={idx}
              className="border border-slate-200/80 rounded-2xl overflow-hidden transition-all duration-200 hover:border-blue-300/60"
            >
              <button
                onClick={() => setOpen(open === idx ? null : idx)}
                className="w-full text-left px-6 py-5 flex items-center justify-between gap-4 bg-white hover:bg-blue-50/40 transition-colors"
                aria-expanded={open === idx}
              >
                <span className="font-bold text-slate-900 text-sm leading-snug">
                  {faq.q}
                </span>
                <ChevronDown
                  className={`w-5 h-5 text-blue-600 shrink-0 transition-transform duration-300 ${
                    open === idx ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  open === idx ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <p className="px-6 pb-5 text-slate-600 text-sm leading-relaxed font-medium border-t border-slate-100 pt-4">
                  {faq.a}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
