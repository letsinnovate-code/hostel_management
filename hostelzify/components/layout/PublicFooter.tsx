'use client';

import Link from 'next/link';
import { Building2, Mail, Phone, MapPin, Facebook, Twitter, Instagram, Linkedin } from 'lucide-react';

export default function PublicFooter() {
    return (
        <footer className="bg-white text-slate-600 py-16 border-t border-gray-100">
            <div className="max-w-7xl mx-auto px-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">

                    {/* Brand */}
                    <div>
                        <Link href="/" className="flex items-center gap-2 mb-6 group">
                            <div className="p-2 bg-blue-600 rounded-lg group-hover:bg-blue-500 transition-colors shadow-sm shadow-blue-100">
                                <Building2 className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-xl font-bold text-slate-900">Hostelzify</span>
                        </Link>
                        <p className="text-sm leading-relaxed mb-6 text-slate-500">
                            The complete solution for modern hostel management. Simplify operations,
                            enhance student experience, and grow your business with data-driven insights.
                        </p>
                        <div className="flex gap-4">
                            <SocialIcon Icon={Facebook} href="#" />
                            <SocialIcon Icon={Twitter} href="#" />
                            <SocialIcon Icon={Instagram} href="#" />
                            <SocialIcon Icon={Linkedin} href="#" />
                        </div>
                    </div>

                    {/* Product */}
                    <div>
                        <h3 className="text-slate-900 font-bold mb-6">Product</h3>
                        <ul className="space-y-4 text-sm">
                            <li><Link href="/marketplace" className="hover:text-blue-600 transition-colors font-medium">Marketplace</Link></li>
                            <li><Link href="/#features" className="hover:text-blue-600 transition-colors font-medium">Features</Link></li>
                            <li><Link href="/register" className="hover:text-blue-600 transition-colors font-medium">Get Started Free</Link></li>
                            <li><Link href="/login" className="hover:text-blue-600 transition-colors font-medium">Portal Sign In</Link></li>
                        </ul>
                    </div>

                    {/* Company */}
                    <div>
                        <h3 className="text-slate-900 font-bold mb-6">Company</h3>
                        <ul className="space-y-4 text-sm">
                            <li><Link href="/#features" className="hover:text-blue-600 transition-colors font-medium">About Platform</Link></li>
                            <li><a href="mailto:careers@hostelzify.com" className="hover:text-blue-600 transition-colors font-medium">Careers</a></li>
                            <li><a href="mailto:support@hostelzify.com" className="hover:text-blue-600 transition-colors font-medium">Help & Support</a></li>
                            <li><Link href="/marketplace" className="hover:text-blue-600 transition-colors font-medium">Find Hostels</Link></li>
                        </ul>
                    </div>

                    {/* Contact */}
                    <div>
                        <h3 className="text-slate-900 font-bold mb-6">Contact Us</h3>
                        <ul className="space-y-4 text-sm">
                            <li className="flex items-start gap-3">
                                <MapPin className="w-5 h-5 text-blue-600 flex-shrink-0" />
                                <span>123 Innovation Drive, Tech City, TC 90210</span>
                            </li>
                            <li className="flex items-center gap-3">
                                <Phone className="w-5 h-5 text-blue-600 flex-shrink-0" />
                                <span>+91 987 654 3210</span>
                            </li>
                            <li className="flex items-center gap-3">
                                <Mail className="w-5 h-5 text-blue-600 flex-shrink-0" />
                                <a href="mailto:support@hostelzify.com" className="hover:underline">support@hostelzify.com</a>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="pt-8 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-400">
                    <p>© {new Date().getFullYear()} Hostelzify. All rights reserved.</p>
                    <div className="flex gap-6">
                        <Link href="/#features" className="hover:text-slate-900 transition-colors">Privacy Policy</Link>
                        <Link href="/#features" className="hover:text-slate-900 transition-colors">Terms of Service</Link>
                        <Link href="/#features" className="hover:text-slate-900 transition-colors">Security Architecture</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}

function SocialIcon({ Icon, href }: { Icon: any, href: string }) {
    return (
        <a
            href={href}
            className="p-2.5 bg-gray-50 rounded-xl hover:bg-blue-600 hover:text-white transition-all text-slate-400 group border border-gray-100"
        >
            <Icon className="w-4.5 h-4.5 group-hover:scale-110 transition-transform" />
        </a>
    );
}
