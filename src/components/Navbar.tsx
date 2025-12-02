'use client';

import { useState, useRef, useEffect } from 'react';

interface NavbarProps {
  currentTool: 'search' | 'findme';
  onToolChange: (tool: 'search' | 'findme') => void;
}

export default function Navbar({ currentTool, onToolChange }: NavbarProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const tools = [
    { id: 'search' as const, name: 'Search University', icon: '🔍' },
    { id: 'findme' as const, name: 'Find For Me', icon: '🎯' },
  ];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? 'bg-white/80 backdrop-blur-lg shadow-lg' : 'bg-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-white text-xl shadow-lg">
              🎓
            </div>
            <span className="text-xl font-bold gradient-text hidden sm:block">
              SmartStudy
            </span>
          </div>

          {/* Tools Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className={`flex items-center space-x-2 px-5 py-2.5 rounded-full transition-all ${
                scrolled
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                  : 'bg-white/90 hover:bg-white text-slate-800 shadow-lg'
              }`}
            >
              <span className="font-medium">
                {tools.find(t => t.id === currentTool)?.icon} {tools.find(t => t.id === currentTool)?.name}
              </span>
              <svg
                className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 mt-3 w-64 rounded-2xl bg-white shadow-2xl border border-slate-100 py-3 scale-in overflow-hidden">
                <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Switch Tool
                </div>
                {tools.map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => {
                      onToolChange(tool.id);
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-3 flex items-center space-x-3 transition-colors ${
                      currentTool === tool.id
                        ? 'bg-gradient-to-r from-purple-50 to-pink-50 border-l-4 border-purple-500'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-2xl">{tool.icon}</span>
                    <div>
                      <span className="text-slate-800 font-medium block">{tool.name}</span>
                      <span className="text-slate-400 text-xs">
                        {tool.id === 'search' ? 'Search by name' : 'AI recommendations'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
