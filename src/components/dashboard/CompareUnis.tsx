'use client';

import { SavedUniversity } from '@/lib/types';

interface Props {
  unis: [SavedUniversity, SavedUniversity];
  onClose: () => void;
}

interface Row {
  label: string;
  a: string | number | undefined;
  b: string | number | undefined;
  better?: 'a' | 'b' | 'same';
  unit?: string;
  format?: (v: string | number | undefined) => string;
}

function fmt(v: string | number | undefined, unit = ''): string {
  if (v === undefined || v === null || v === '' || v === 0 || v === '0') return '—';
  return `${v}${unit}`;
}

function cmpHigh(a?: number | string, b?: number | string): 'a' | 'b' | 'same' | undefined {
  const na = parseFloat(String(a)), nb = parseFloat(String(b));
  if (!isFinite(na) || !isFinite(nb) || na === 0 || nb === 0) return undefined;
  if (na > nb) return 'a';
  if (nb > na) return 'b';
  return 'same';
}
function cmpLow(a?: number | string, b?: number | string): 'a' | 'b' | 'same' | undefined {
  const r = cmpHigh(a, b);
  if (!r || r === 'same') return r;
  return r === 'a' ? 'b' : 'a';
}

export default function CompareUnis({ unis, onClose }: Props) {
  const [a, b] = unis;

  const rows: Row[] = [
    { label: '🏆 QS Rank',          a: a.qsRank,         b: b.qsRank,        better: cmpLow(a.qsRank, b.qsRank) },
    { label: '🌍 Country',          a: a.country,        b: b.country },
    { label: '📚 Field',            a: a.field,          b: b.field },
    { label: '🎯 Match Score',      a: a.matchScore,     b: b.matchScore,    better: cmpHigh(a.matchScore, b.matchScore), unit: '%' },
    { label: '💰 Tuition',          a: a.tuitionUsd ?? a.tuition, b: b.tuitionUsd ?? b.tuition, better: cmpLow(a.tuitionUsd, b.tuitionUsd), format: v => { const n = parseFloat(String(v ?? '').replace(/[^\d.]/g, '')); return isFinite(n) && n > 0 ? `$${n.toLocaleString()}` : (typeof v === 'string' && v ? v : '—'); } },
    { label: '🏠 Living Cost',      a: a.livingCost,     b: b.livingCost,    better: cmpLow(a.livingCost, b.livingCost), format: v => { const n = Number(v); return isFinite(n) && n > 0 ? `$${n.toLocaleString()}` : '—'; } },
    { label: '💵 Total Estimated',  a: a.totalCost,      b: b.totalCost,     better: cmpLow(a.totalCost, b.totalCost), format: v => { const n = Number(v); return isFinite(n) && n > 0 ? `$${n.toLocaleString()}` : '—'; } },
    { label: '📊 Min CGPA',         a: a.minCgpa,        b: b.minCgpa,       better: cmpLow(a.minCgpa, b.minCgpa) },
    { label: '🗣️ IELTS Required',   a: a.ieltsRequired,  b: b.ieltsRequired, better: cmpLow(a.ieltsRequired, b.ieltsRequired) },
    { label: '📝 TOEFL Required',   a: a.toeflRequired,  b: b.toeflRequired, better: cmpLow(a.toeflRequired, b.toeflRequired) },
    { label: '🍂 Fall Deadline',    a: a.deadlineFall,   b: b.deadlineFall },
    { label: '🌸 Spring Deadline',  a: a.deadlineSpring, b: b.deadlineSpring },
    { label: '🎓 Scholarships',     a: a.scholarships,   b: b.scholarships },
  ];

  // Verdict heuristic
  let aWins = 0, bWins = 0;
  rows.forEach(r => { if (r.better === 'a') aWins++; if (r.better === 'b') bWins++; });
  const verdict = aWins > bWins ? a.university : bWins > aWins ? b.university : null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 p-5 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-slate-900">⚖️ Side-by-side Comparison</h2>
            <p className="text-xs text-slate-500 mt-0.5">Green cell = better on that metric</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button>
        </div>

        {/* Uni headers */}
        <div className="grid grid-cols-3 border-b border-slate-200">
          <div className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">Metric</div>
          <div className="p-4 border-l border-slate-200 bg-purple-50/40">
            <p className="text-xs uppercase tracking-wide text-purple-500 font-semibold">University A</p>
            <p className="font-bold text-slate-900 text-sm mt-1">{a.university}</p>
          </div>
          <div className="p-4 border-l border-slate-200 bg-pink-50/40">
            <p className="text-xs uppercase tracking-wide text-pink-500 font-semibold">University B</p>
            <p className="font-bold text-slate-900 text-sm mt-1">{b.university}</p>
          </div>
        </div>

        {/* Rows */}
        <div>
          {rows.map((row, i) => {
            const av = row.format ? row.format(row.a) : fmt(row.a, row.unit);
            const bv = row.format ? row.format(row.b) : fmt(row.b, row.unit);
            return (
              <div key={i} className={`grid grid-cols-3 border-b border-slate-100 ${i % 2 === 0 ? 'bg-slate-50/40' : ''}`}>
                <div className="p-3 text-xs font-medium text-slate-600">{row.label}</div>
                <div className={`p-3 border-l border-slate-100 text-sm ${row.better === 'a' ? 'bg-green-50 font-semibold text-green-800' : 'text-slate-800'}`}>
                  {av} {row.better === 'a' && <span className="text-xs">✓</span>}
                </div>
                <div className={`p-3 border-l border-slate-100 text-sm ${row.better === 'b' ? 'bg-green-50 font-semibold text-green-800' : 'text-slate-800'}`}>
                  {bv} {row.better === 'b' && <span className="text-xs">✓</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Verdict */}
        <div className="p-5 bg-gradient-to-r from-purple-50 to-pink-50">
          {verdict ? (
            <p className="text-sm text-slate-700">
              <strong>📍 Quick verdict:</strong> <span className="font-bold gradient-text">{verdict}</span> wins on more metrics ({aWins} vs {bWins}). But always weigh based on what *you* prioritize.
            </p>
          ) : (
            <p className="text-sm text-slate-700">
              <strong>📍 It's a tie</strong> — both universities have similar strengths. Compare on what matters most to you (e.g. budget, fit, location).
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
