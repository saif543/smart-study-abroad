'use client';

import { useEffect, useState } from 'react';
import { StudentProfile } from '@/lib/types';

interface Props {
  profile: StudentProfile;
  onGoToProfile: () => void;
}

const KEY = 'smartstudy_profile_nudge_dismissed';

export default function ProfileNudge({ profile, onGoToProfile }: Props) {
  const [visible, setVisible] = useState(false);

  // What's missing from the profile
  const missing: string[] = [];
  if (!profile.cgpa)        missing.push('CGPA');
  if (!profile.budgetUsd)   missing.push('budget');
  if (!profile.ieltsScore && !profile.toeflScore) missing.push('English score');

  const incomplete = missing.length > 0;

  useEffect(() => {
    if (!incomplete) { setVisible(false); return; }
    const dismissed = sessionStorage.getItem(KEY) === '1';
    if (!dismissed) {
      // Show after 1s so it doesn't clobber initial render
      const t = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(t);
    }
  }, [incomplete]);

  const dismiss = () => {
    sessionStorage.setItem(KEY, '1');
    setVisible(false);
  };

  if (!visible || !incomplete) return null;

  return (
    <div className="fixed bottom-6 left-6 z-40 max-w-sm w-[calc(100%-3rem)] sm:w-auto scale-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-purple-100 overflow-hidden">
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-4 text-white relative">
          <button onClick={dismiss}
            className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xl">✨</span>
            <p className="text-sm font-bold">Complete your profile</p>
          </div>
        </div>
        <div className="p-4">
          <p className="text-sm text-slate-600 mb-3">
            Add your <span className="font-semibold text-slate-900">{missing.join(', ')}</span> so Find For Me can give you accurate matches and gap analysis.
          </p>
          <div className="flex gap-2">
            <button onClick={() => { dismiss(); onGoToProfile(); }}
              className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-bold shadow-md hover:shadow-lg transition">
              Update profile →
            </button>
            <button onClick={dismiss}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium transition">
              Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
