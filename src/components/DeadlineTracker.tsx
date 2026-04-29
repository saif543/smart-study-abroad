'use client';

import { SavedUniversity, AppStatus, STATUS_META, STATUS_ORDER } from '@/lib/types';

interface Props {
  unis: SavedUniversity[];
  onUpdate: (id: string, patch: Partial<SavedUniversity>) => void;
}

function daysUntil(monthDay: string | undefined): number | null {
  if (!monthDay || monthDay === 'N/A') return null;
  const first = monthDay.split(/[-–]/)[0].trim();
  const today = new Date();
  const yr = today.getFullYear();
  const tryParse = (y: number) => {
    const d = new Date(`${first}, ${y}`);
    return isNaN(d.getTime()) ? null : d;
  };
  let d = tryParse(yr);
  if (!d) return null;
  if (d.getTime() < today.getTime() - 86400000) d = tryParse(yr + 1);
  if (!d) return null;
  return Math.ceil((d.getTime() - today.getTime()) / 86400000);
}

function formatDate(monthDay: string | undefined): string {
  if (!monthDay || monthDay === 'N/A') return '—';
  return monthDay.split(/[-–]/)[0].trim();
}

interface Bucket {
  key: string;
  label: string;
  emoji: string;
  desc: string;
  color: string;
  bg: string;
  border: string;
}

const BUCKETS: Bucket[] = [
  { key: 'overdue',  label: 'Overdue',     emoji: '🚨', desc: 'Past deadline',     color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200' },
  { key: 'urgent',   label: 'This week',   emoji: '⚡', desc: 'Next 7 days',       color: 'text-orange-700',  bg: 'bg-orange-50',  border: 'border-orange-200' },
  { key: 'soon',     label: 'Coming up',   emoji: '📅', desc: '8 – 30 days',       color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  { key: 'later',    label: 'Plenty of time', emoji: '🌱', desc: '30+ days',       color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  { key: 'nodate',   label: 'No date',     emoji: '❓', desc: 'Add a deadline',    color: 'text-slate-700',   bg: 'bg-slate-50',   border: 'border-slate-200' },
];

function bucketize(days: number | null): string {
  if (days === null) return 'nodate';
  if (days < 0) return 'overdue';
  if (days <= 7) return 'urgent';
  if (days <= 30) return 'soon';
  return 'later';
}

export default function DeadlineTracker({ unis, onUpdate }: Props) {
  const items = unis
    .map(u => ({ uni: u, days: daysUntil(u.deadlineFall), bucket: bucketize(daysUntil(u.deadlineFall)) }))
    .sort((a, b) => {
      if (a.days === null) return 1;
      if (b.days === null) return -1;
      return a.days - b.days;
    });

  // Counts per bucket
  const byBucket: Record<string, typeof items> = {};
  for (const b of BUCKETS) byBucket[b.key] = [];
  items.forEach(it => byBucket[it.bucket].push(it));

  const next = items.find(i => i.days !== null && i.days >= 0);

  if (unis.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
        <div className="text-5xl mb-3">📅</div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">No deadlines yet</h3>
        <p className="text-sm text-slate-500">Save universities from Find For Me — your deadlines will land here automatically.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HERO — next deadline highlight */}
      {next && (
        <div className="rounded-3xl bg-gradient-to-br from-purple-600 via-pink-500 to-rose-500 p-8 text-white shadow-2xl shadow-purple-500/20 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-widest text-white/70 font-bold">⏰ Your next deadline</p>
              <h2 className="text-3xl md:text-4xl font-black mt-2">{next.uni.university}</h2>
              <p className="text-white/80 mt-1">{next.uni.country} · Fall {formatDate(next.uni.deadlineFall)}</p>
            </div>
            <div className="text-center md:text-right">
              <p className="text-6xl md:text-7xl font-black leading-none">{next.days}</p>
              <p className="text-sm font-semibold text-white/80 uppercase tracking-wide mt-1">days left</p>
            </div>
          </div>
        </div>
      )}

      {/* Bucket summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {BUCKETS.map(b => {
          const count = byBucket[b.key].length;
          if (count === 0 && b.key === 'overdue') return null;
          return (
            <div key={b.key} className={`p-4 rounded-2xl border ${b.bg} ${b.border}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{b.emoji}</span>
                <p className={`text-xs font-bold uppercase tracking-wide ${b.color}`}>{b.label}</p>
              </div>
              <p className="text-3xl font-black text-slate-900">{count}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{b.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Timeline grouped by bucket */}
      <div className="space-y-5">
        {BUCKETS.map(b => {
          const list = byBucket[b.key];
          if (list.length === 0) return null;
          return (
            <div key={b.key} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className={`px-5 py-3 ${b.bg} border-b ${b.border} flex items-center gap-2`}>
                <span className="text-lg">{b.emoji}</span>
                <h3 className={`font-bold text-sm ${b.color}`}>{b.label}</h3>
                <span className="text-xs text-slate-500">· {list.length} {list.length === 1 ? 'university' : 'universities'}</span>
              </div>
              <div className="divide-y divide-slate-100">
                {list.map(({ uni, days }) => (
                  <div key={uni.id} className="p-4 flex flex-col md:flex-row md:items-center gap-4 hover:bg-slate-50/50 transition">
                    {/* Days badge */}
                    <div className={`shrink-0 w-16 h-16 rounded-2xl ${b.bg} border-2 ${b.border} flex flex-col items-center justify-center`}>
                      <p className={`text-2xl font-black leading-none ${b.color}`}>
                        {days === null ? '?' : Math.abs(days)}
                      </p>
                      <p className={`text-[9px] uppercase tracking-wide font-bold ${b.color} mt-0.5`}>
                        {days === null ? 'no date' : days < 0 ? 'days ago' : 'days'}
                      </p>
                    </div>

                    {/* Uni info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-slate-900 truncate">{uni.university}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {uni.country}
                        {uni.field && <> · {uni.field}</>}
                        {uni.qsRank && <> · QS #{uni.qsRank}</>}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-slate-600 mt-2">
                        <span className="flex items-center gap-1">
                          <span className="text-slate-400">Fall:</span>
                          <span className="font-medium">{formatDate(uni.deadlineFall)}</span>
                        </span>
                        {uni.deadlineSpring && uni.deadlineSpring !== 'N/A' && (
                          <span className="flex items-center gap-1">
                            <span className="text-slate-400">Spring:</span>
                            <span className="font-medium">{formatDate(uni.deadlineSpring)}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Status pickers */}
                    <div className="grid grid-cols-2 gap-2 md:gap-2 shrink-0">
                      <div>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-1">Application</p>
                        <select
                          value={uni.applicationStatus}
                          onChange={e => onUpdate(uni.id, { applicationStatus: e.target.value as AppStatus })}
                          className={`text-xs rounded-lg px-2.5 py-1.5 border-0 font-bold w-full ${STATUS_META[uni.applicationStatus].bg} ${STATUS_META[uni.applicationStatus].color}`}>
                          {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_META[s].emoji} {STATUS_META[s].label}</option>)}
                        </select>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-1">Scholarship</p>
                        <select
                          value={uni.scholarshipStatus}
                          onChange={e => onUpdate(uni.id, { scholarshipStatus: e.target.value as AppStatus })}
                          className={`text-xs rounded-lg px-2.5 py-1.5 border-0 font-bold w-full ${STATUS_META[uni.scholarshipStatus].bg} ${STATUS_META[uni.scholarshipStatus].color}`}>
                          {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_META[s].emoji} {STATUS_META[s].label}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
