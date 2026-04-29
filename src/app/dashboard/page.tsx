'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import ProfileForm from '@/components/ProfileForm';
import SavedUniversities from '@/components/SavedUniversities';
import DeadlineTracker from '@/components/DeadlineTracker';
import SearchTab from '@/components/SearchTab';
import FindForMeTab, { MatchedUniversity } from '@/components/FindForMeTab';
import AIChat from '@/components/AIChat';
import ProfileCompleteness from '@/components/dashboard/ProfileCompleteness';
import StatsCharts from '@/components/dashboard/StatsCharts';
import KanbanBoard from '@/components/dashboard/KanbanBoard';
import ProfileNudge from '@/components/dashboard/ProfileNudge';

type Tab = 'overview' | 'search' | 'findme' | 'list' | 'pipeline' | 'deadlines' | 'profile';

const NAV: { id: Tab; label: string; icon: string; group: 'main' | 'tools' | 'account' }[] = [
  { id: 'overview',  label: 'Overview',     icon: '🏠', group: 'main' },
  { id: 'list',      label: 'My Shortlist', icon: '⭐', group: 'main' },
  { id: 'pipeline',  label: 'Pipeline',     icon: '🏗️', group: 'main' },
  { id: 'deadlines', label: 'Deadlines',    icon: '📅', group: 'main' },
  { id: 'search',    label: 'Search',       icon: '🔍', group: 'tools' },
  { id: 'findme',    label: 'Find For Me',  icon: '🎯', group: 'tools' },
  { id: 'profile',   label: 'Profile',      icon: '👤', group: 'account' },
];

export default function DashboardPage() {
  const router = useRouter();
  const { user, data, loading, logout, updateProfile, removeUniversity, updateUniversity } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [aiMessages, setAiMessages] = useState<string[]>([]);
  const [ragResults, setRagResults] = useState<MatchedUniversity[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  useEffect(() => {
    const handler = () => setTab('profile');
    window.addEventListener('go-to-profile', handler);
    return () => window.removeEventListener('go-to-profile', handler);
  }, []);

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Loading...</div>;
  }

  const submitted = data.savedUniversities.filter(u => u.applicationStatus === 'submitted' || u.applicationStatus === 'decision').length;
  const inProgress = data.savedUniversities.filter(u => u.applicationStatus === 'planning' || u.applicationStatus === 'applying').length;
  const saved = data.savedUniversities.length;

  const nextDeadline = (() => {
    const today = new Date();
    let best: { uni: string; days: number } | null = null;
    for (const u of data.savedUniversities) {
      if (!u.deadlineFall || u.deadlineFall === 'N/A') continue;
      const first = u.deadlineFall.split(/[-–]/)[0].trim();
      const d = new Date(`${first}, ${today.getFullYear()}`);
      if (isNaN(d.getTime())) continue;
      const diff = Math.ceil((d.getTime() - today.getTime()) / 86400000);
      const days = diff < 0 ? Math.ceil((new Date(`${first}, ${today.getFullYear() + 1}`).getTime() - today.getTime()) / 86400000) : diff;
      if (!best || days < best.days) best = { uni: u.university, days };
    }
    return best;
  })();

  const currentNav = NAV.find(n => n.id === tab);

  const NavGroup = ({ group, label }: { group: 'main' | 'tools' | 'account'; label: string }) => (
    <div className="mb-6">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-3 mb-2">{label}</p>
      <div className="space-y-0.5">
        {NAV.filter(n => n.group === group).map(n => (
          <button
            key={n.id}
            onClick={() => { setTab(n.id); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
              tab === n.id
                ? 'bg-gradient-to-r from-purple-500/10 to-pink-500/10 text-purple-700 border border-purple-200/50'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="text-lg">{n.icon}</span>
            <span>{n.label}</span>
            {tab === n.id && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-purple-500" />}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* SIDEBAR */}
      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-white border-r border-slate-200 flex flex-col z-40 transform transition-transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="h-16 px-5 flex items-center border-b border-slate-100">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-lg shadow-lg shadow-purple-500/30">🎓</div>
            <span className="font-bold gradient-text text-lg">SmartStudy</span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <NavGroup group="main"    label="Workspace" />
          <NavGroup group="tools"   label="Discover" />
          <NavGroup group="account" label="Account" />
        </nav>

        {/* User card */}
        <div className="p-3 border-t border-slate-100">
          <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white flex items-center justify-center font-semibold text-sm shadow-md">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{user.name}</p>
              <p className="text-xs text-slate-400 truncate">{user.email}</p>
            </div>
            <button
              onClick={async () => { await logout(); router.push('/'); }}
              title="Log out"
              className="p-2 rounded-lg hover:bg-slate-200 text-slate-500"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-black/40 z-30 lg:hidden" />
      )}

      {/* MAIN */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="h-16 bg-white/80 backdrop-blur border-b border-slate-200 sticky top-0 z-20 flex items-center px-4 lg:px-8 gap-4">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-slate-100">
            <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div>
            <p className="text-xs text-slate-400 font-medium">SmartStudy / {currentNav?.label}</p>
            <h1 className="text-base font-semibold text-slate-800">{currentNav?.label}</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setTab('search')}
              className="hidden md:flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm text-slate-600 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
              </svg>
              <span>Quick search</span>
              <kbd className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-white border border-slate-200">⌘K</kbd>
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 px-4 lg:px-8 py-6 lg:py-8 max-w-[1400px] w-full mx-auto">
          {/* Greeting card — only on overview */}
          {tab === 'overview' && (
            <>
              <div className="mb-6 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-500 font-medium">Welcome back</p>
                  <h2 className="text-3xl font-bold text-slate-900 mt-0.5">
                    Hello, {user.name.split(' ')[0]} 👋
                  </h2>
                  <p className="text-sm text-slate-500 mt-2">
                    {saved === 0
                      ? 'Start by adding universities from Search or Find For Me.'
                      : nextDeadline
                        ? <>Next deadline · <span className="font-semibold text-slate-700">{nextDeadline.uni}</span> in <span className="font-semibold text-orange-600">{nextDeadline.days} days</span></>
                        : `Tracking ${saved} ${saved === 1 ? 'university' : 'universities'} on your shortlist`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setTab('findme')}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold shadow-lg shadow-purple-500/20 hover:shadow-xl transition">
                    🎯 Find matches
                  </button>
                  <button onClick={() => setTab('search')}
                    className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:border-slate-300 transition">
                    🔍 Search
                  </button>
                </div>
              </div>

              {/* KPI cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[
                  { v: saved, l: 'Saved',       icon: '⭐', tint: 'from-purple-500 to-pink-500' },
                  { v: inProgress, l: 'In progress',  icon: '⚡', tint: 'from-amber-500 to-orange-500' },
                  { v: submitted, l: 'Submitted',     icon: '📤', tint: 'from-emerald-500 to-teal-500' },
                  { v: nextDeadline ? `${nextDeadline.days}d` : '—', l: 'Next deadline', icon: '⏰', tint: 'from-blue-500 to-cyan-500' },
                ].map((k, i) => (
                  <div key={i} className="bg-white rounded-2xl p-5 border border-slate-100 hover:border-slate-200 transition">
                    <div className="flex items-start justify-between mb-3">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${k.tint} flex items-center justify-center text-white text-lg shadow-md`}>
                        {k.icon}
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-slate-900 leading-none">{k.v}</p>
                    <p className="text-xs text-slate-500 font-medium mt-2">{k.l}</p>
                  </div>
                ))}
              </div>

              {/* Two column: profile + charts */}
              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="font-semibold text-slate-900">Application overview</h3>
                    <button onClick={() => setTab('list')} className="text-xs font-semibold text-purple-600 hover:text-purple-700">View all →</button>
                  </div>
                  <StatsCharts unis={data.savedUniversities} />
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 p-6">
                  <h3 className="font-semibold text-slate-900 mb-4">Your profile</h3>
                  <ProfileCompleteness profile={data.profile} />
                </div>
              </div>
            </>
          )}

          {tab === 'search'    && <SearchTab onAIMessage={(m) => setAiMessages(p => [...p, m])} />}
          {tab === 'findme'    && <FindForMeTab onAIMessage={(m) => setAiMessages(p => [...p, m])} onRAGResults={setRagResults} />}
          {tab === 'list'      && <SavedUniversities unis={data.savedUniversities} profile={data.profile} onRemove={removeUniversity} />}
          {tab === 'pipeline'  && <KanbanBoard unis={data.savedUniversities} onUpdate={updateUniversity} onRemove={removeUniversity} />}
          {tab === 'deadlines' && <DeadlineTracker unis={data.savedUniversities} onUpdate={updateUniversity} />}
          {tab === 'profile'   && <ProfileForm initial={data.profile} onSave={updateProfile} />}
        </main>
      </div>

      <AIChat systemMessages={aiMessages} ragResults={ragResults} />
      <ProfileNudge profile={data.profile} onGoToProfile={() => setTab('profile')} />
    </div>
  );
}
