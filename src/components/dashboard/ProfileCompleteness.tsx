'use client';

import { StudentProfile } from '@/lib/types';

interface Props {
  profile: StudentProfile;
}

const FIELDS: { key: keyof StudentProfile; label: string }[] = [
  { key: 'cgpa', label: 'CGPA' },
  { key: 'budgetUsd', label: 'Budget' },
  { key: 'preferredCountry', label: 'Preferred country' },
  { key: 'ieltsScore', label: 'IELTS' },
  { key: 'toeflScore', label: 'TOEFL' },
  { key: 'greScore', label: 'GRE' },
  { key: 'researchInterest', label: 'Research interest' },
];

export default function ProfileCompleteness({ profile }: Props) {
  const filled = FIELDS.filter(f => profile[f.key].trim()).length;
  const total = FIELDS.length;
  const pct = Math.round((filled / total) * 100);
  const missing = FIELDS.filter(f => !profile[f.key].trim()).map(f => f.label);

  const r = 42, c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div className="flex items-center gap-5">
      <div className="relative w-28 h-28 flex-shrink-0">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r={r} stroke="#e2e8f0" strokeWidth="8" fill="none" />
          <circle cx="50" cy="50" r={r} stroke="url(#grad)" strokeWidth="8" fill="none"
            strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
          <defs>
            <linearGradient id="grad" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center flex-col">
          <span className="text-2xl font-bold text-slate-900">{pct}%</span>
          <span className="text-[10px] text-slate-500 uppercase tracking-wide">complete</span>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-700 mb-1">Profile completeness</p>
        {missing.length === 0 ? (
          <p className="text-xs text-green-600">✓ All set! Better matches incoming.</p>
        ) : (
          <div>
            <p className="text-xs text-slate-500 mb-1.5">Add {missing.length} more for sharper matches:</p>
            <div className="flex flex-wrap gap-1.5">
              {missing.slice(0, 4).map(m => (
                <span key={m} className="text-[10px] px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                  + {m}
                </span>
              ))}
              {missing.length > 4 && (
                <span className="text-[10px] px-2 py-1 rounded-full bg-slate-100 text-slate-500">
                  +{missing.length - 4} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
