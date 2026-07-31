'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Menu, X, Building2 } from 'lucide-react';

export default function PublicNavbar() {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 10);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const navLinks = [
        { name: 'Home', href: '/' },
        { name: 'Marketplace', href: '/marketplace' },
        { name: 'For Owners', href: '/#features' },
    ];

    const isActive = (path: string) => pathname === path;

    return (
        <nav
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled
                    ? 'bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-100 py-3'
                    : 'bg-transparent py-5'
                }`}
        >
            <div className="max-w-7xl mx-auto px-6">
                <div className="flex items-center justify-between">

                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2 group">
                        <div className="p-2 bg-blue-600 rounded-lg group-hover:bg-blue-500 transition-colors shadow-sm shadow-blue-200">
                            <Building2 className="w-6 h-6 text-white" />
                        </div>
                        <span className={`text-xl font-bold tracking-tight transition-colors ${isScrolled ? 'text-slate-900' : 'text-slate-900'}`}>
                            Hostelzify
                        </span>
                    </Link>

                    {/* Desktop Nav */}
                    <div className="hidden md:flex items-center gap-8">
                        {navLinks.map((link) => (
                            <Link
                                key={link.name}
                                href={link.href}
                                className={`text-sm font-semibold transition-colors hover:text-blue-600 ${isActive(link.href) ? 'text-blue-600' : 'text-slate-600'
                                    }`}
                            >
                                {link.name}
                            </Link>
                        ))}
                    </div>

                    {/* Desktop Actions */}
                    <div className="hidden md:flex items-center gap-4">
                        <Link
                            href="/login"
                            className="text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors"
                        >
                            Log In
                        </Link>
                        <Link
                            href="/signup"
                            className="px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-200 hover:scale-105 active:scale-95"
                        >
                            Get Started
                        </Link>
                    </div>

                    {/* Mobile Menu Toggle */}
                    <button
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className="md:hidden p-2 text-slate-600 hover:text-slate-900 transition-colors"
                    >
                        {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu */}
            {isMobileMenuOpen && (
                <div className="md:hidden absolute top-full left-0 right-0 bg-white border-t border-gray-100 shadow-xl p-6 animate-in fade-in slide-in-from-top-4">
                    <div className="flex flex-col gap-4">
                        {navLinks.map((link) => (
                            <Link
                                key={link.name}
                                href={link.href}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={`text-base font-bold py-2 ${isActive(link.href) ? 'text-blue-600' : 'text-slate-600'
                                    }`}
                            >
                                {link.name}
                            </Link>
                        ))}
                        <div className="h-px bg-gray-100 my-2" />
                        <Link
                            href="/login"
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="text-center py-2 text-slate-600 font-semibold hover:text-blue-600"
                        >
                            Log In
                        </Link>
                        <Link
                            href="/signup"
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="text-center py-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-100"
                        >
                            Get Started
                        </Link>
                    </div>
                </div>
            )}
        </nav>
    );
}
