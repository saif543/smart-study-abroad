'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';

const NAV_LINKS = [
  { href: '#features',  label: 'Features' },
  { href: '#how',       label: 'How it works' },
  { href: '#stories',   label: 'Stories' },
  { href: '#about',     label: 'About' },
  { href: '#faq',       label: 'FAQ' },
];

export default function LandingNavbar() {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
      scrolled ? 'bg-white/80 backdrop-blur-lg shadow-sm border-b border-slate-100' : 'bg-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-white text-xl shadow-lg">🎓</div>
          <span className={`text-xl font-bold transition-colors ${scrolled ? 'gradient-text' : 'text-white'}`}>SmartStudy</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map(l => (
            <a key={l.href} href={l.href}
              className={`text-sm font-medium transition ${scrolled ? 'text-slate-600 hover:text-slate-900' : 'text-white/90 hover:text-white'}`}>
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <Link href="/dashboard"
              className="px-5 py-2 text-sm font-semibold rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg transition">
              Dashboard →
            </Link>
          ) : (
            <>
              <Link href="/login" className={`hidden sm:block px-4 py-2 text-sm font-medium transition ${scrolled ? 'text-slate-700 hover:text-slate-900' : 'text-white/90 hover:text-white'}`}>
                Log in
              </Link>
              <Link href="/signup"
                className="px-5 py-2 text-sm font-semibold rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg transition">
                Get started
              </Link>
            </>
          )}
          <button onClick={() => setOpen(o => !o)} className="md:hidden ml-1 p-2 rounded-lg hover:bg-slate-100">
            <svg className="w-6 h-6 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={open ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden bg-white border-t border-slate-100 px-4 py-4 space-y-2">
          {NAV_LINKS.map(l => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">
              {l.label}
            </a>
          ))}
        </div>
      )}
    </nav>
  );
}
