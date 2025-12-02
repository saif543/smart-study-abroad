'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import SearchTab from '@/components/SearchTab';
import FindForMeTab from '@/components/FindForMeTab';
import AIChat from '@/components/AIChat';

export default function Home() {
  const [currentTool, setCurrentTool] = useState<'search' | 'findme'>('search');
  const [aiMessages, setAiMessages] = useState<string[]>([]);

  const handleAIMessage = (message: string) => {
    setAiMessages(prev => [...prev, message]);
  };

  return (
    <div className="min-h-screen bg-slate-50 overflow-x-hidden">
      {/* Animated Background Blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-300 opacity-30 blob float" />
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-blue-300 opacity-30 blob float-delayed" />
        <div className="absolute -bottom-40 right-1/3 w-72 h-72 bg-pink-300 opacity-30 blob float" />
      </div>

      <Navbar currentTool={currentTool} onToolChange={setCurrentTool} />

      {/* Hero Section */}
      <section className="relative pt-20 pb-32 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white shadow-lg mb-8 slide-up">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-slate-600">AI-Powered University Search</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold text-slate-900 mb-6 slide-up">
            Find Your Dream
            <span className="block gradient-text">University Abroad</span>
          </h1>

          <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-12 slide-up">
            Let AI analyze thousands of programs to find the perfect match for your academic journey.
          </p>

          <div className="flex flex-wrap justify-center gap-8 mb-16 slide-up">
            <div className="text-center">
              <div className="text-4xl font-bold gradient-text">500+</div>
              <div className="text-slate-500 text-sm">Universities</div>
            </div>
            <div className="w-px bg-slate-200 hidden sm:block" />
            <div className="text-center">
              <div className="text-4xl font-bold gradient-text">50+</div>
              <div className="text-slate-500 text-sm">Countries</div>
            </div>
            <div className="w-px bg-slate-200 hidden sm:block" />
            <div className="text-center">
              <div className="text-4xl font-bold gradient-text">10K+</div>
              <div className="text-slate-500 text-sm">Programs</div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto slide-up">
            <button
              onClick={() => setCurrentTool('search')}
              className={`p-8 rounded-2xl text-left transition-all card-hover ${
                currentTool === 'search'
                  ? 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-2xl shadow-purple-500/25'
                  : 'bg-white text-slate-800 shadow-lg hover:shadow-xl'
              }`}
            >
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl mb-4 ${
                currentTool === 'search' ? 'bg-white/20' : 'bg-purple-100'
              }`}>
                🔍
              </div>
              <h3 className="text-xl font-bold mb-2">Search University</h3>
              <p className={currentTool === 'search' ? 'text-white/80' : 'text-slate-500'}>
                Search by name and get detailed program info.
              </p>
            </button>

            <button
              onClick={() => setCurrentTool('findme')}
              className={`p-8 rounded-2xl text-left transition-all card-hover ${
                currentTool === 'findme'
                  ? 'bg-gradient-to-br from-pink-500 to-rose-600 text-white shadow-2xl shadow-pink-500/25'
                  : 'bg-white text-slate-800 shadow-lg hover:shadow-xl'
              }`}
            >
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl mb-4 ${
                currentTool === 'findme' ? 'bg-white/20' : 'bg-pink-100'
              }`}>
                🎯
              </div>
              <h3 className="text-xl font-bold mb-2">Find For Me</h3>
              <p className={currentTool === 'findme' ? 'text-white/80' : 'text-slate-500'}>
                Let AI find universities matching your profile.
              </p>
            </button>
          </div>
        </div>
      </section>

      <section className="relative px-4 pb-20">
        <div className="max-w-4xl mx-auto">
          <div className="scale-in">
            {currentTool === 'search' ? (
              <SearchTab onAIMessage={handleAIMessage} />
            ) : (
              <FindForMeTab onAIMessage={handleAIMessage} />
            )}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-4">Why Choose SmartStudy?</h2>
          <p className="text-slate-500 text-center mb-12">Our AI-powered platform makes university search easy.</p>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6 card-hover rounded-2xl">
              <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">⚡</div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Instant Results</h3>
              <p className="text-slate-500">Smart caching for fast responses.</p>
            </div>
            <div className="text-center p-6 card-hover rounded-2xl">
              <div className="w-16 h-16 bg-pink-100 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">🤖</div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">AI-Powered</h3>
              <p className="text-slate-500">Advanced AI finds best matches.</p>
            </div>
            <div className="text-center p-6 card-hover rounded-2xl">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">💾</div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Smart Database</h3>
              <p className="text-slate-500">Accurate, up-to-date information.</p>
            </div>
          </div>
        </div>
      </section>

      <AIChat systemMessages={aiMessages} />

      <footer className="bg-slate-900 text-white py-12">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="text-3xl">🎓</span>
            <span className="text-xl font-bold">SmartStudy Abroad</span>
          </div>
          <p className="text-slate-400 text-sm">AI-Powered University Search Platform</p>
        </div>
      </footer>
    </div>
  );
}
