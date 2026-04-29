'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface CostItem { [key: string]: number }

interface CostBreakdown {
  university_costs: { items: CostItem; yearly_total: number };
  housing:          { type: string; monthly: number; yearly_total: number };
  meal_plan:        { type: string; monthly: number; yearly_total: number };
  living_costs:     { items: CostItem; monthly_total: number; yearly_total: number };
  one_time_costs:   { items: CostItem; total: number; note: string };
}

interface CostResult {
  currency: string;
  country: string;
  city: string;
  housing_type: string;
  meal_plan: string;
  program_years: number;
  breakdown: CostBreakdown;
  totals: {
    monthly_recurring: number;
    year_1_total: number;
    year_2_plus: number;
    total_program_cost: number;
  };
  visa_info: { type: string; notes: string };
  error?: string;
}

interface CostCalculatorProps {
  universityName: string;
  country: string;
  tuition: string;
  programDuration?: string;
  scholarships?: string;
  maxCoverage?: number;
  onClose: () => void;
}

const CITY_MAP: Record<string, string[]> = {
  USA:       ['Boston', 'New York', 'Los Angeles', 'Pittsburgh'],
  UK:        ['London', 'Manchester', 'Edinburgh'],
  Canada:    ['Toronto', 'Vancouver', 'Montreal'],
  Australia: ['Sydney', 'Melbourne', 'Brisbane'],
  Germany:   ['Munich', 'Berlin', 'Hamburg'],
};

const HOUSING_OPTIONS = [
  { value: 'housing_oncampus_shared',  label: 'On-campus shared' },
  { value: 'housing_oncampus_single',  label: 'On-campus single' },
  { value: 'housing_offcampus_shared', label: 'Off-campus shared' },
  { value: 'housing_offcampus_single', label: 'Off-campus alone' },
];

const MEAL_OPTIONS = [
  { value: 'none',     label: 'Self-cook' },
  { value: 'basic',    label: 'Basic' },
  { value: 'standard', label: 'Standard' },
  { value: 'full',     label: 'Full' },
];

function parseTuition(raw: string): number {
  if (!raw) return 0;
  return parseFloat(raw.replace(/[^0-9.]/g, '')) || 0;
}

function fmt(n: number): string {
  return n.toLocaleString();
}

export default function CostCalculator({
  universityName,
  country,
  tuition,
  programDuration,
  scholarships,
  maxCoverage,
  onClose,
}: CostCalculatorProps) {
  const countryKey = (() => {
    const map: Record<string, string> = {
      'united states': 'USA', 'usa': 'USA', 'us': 'USA',
      'united kingdom': 'UK', 'uk': 'UK', 'england': 'UK',
      'canada': 'Canada', 'australia': 'Australia', 'germany': 'Germany',
    };
    return map[country?.toLowerCase()] || 'USA';
  })();

  const parsedYears = (() => {
    if (!programDuration) return 2;
    const m = programDuration.match(/(\d+)/);
    return m ? parseInt(m[1]) : 2;
  })();

  const cities = CITY_MAP[countryKey] || [];

  const [selectedCity, setSelectedCity]   = useState('default');
  const [housingType, setHousingType]     = useState('housing_oncampus_shared');
  const [mealPlan, setMealPlan]           = useState('none');
  const [programYears, setProgramYears]   = useState(parsedYears);
  const [result, setResult]               = useState<CostResult | null>(null);
  const [loading, setLoading]             = useState(false);
  const [mounted, setMounted]             = useState(false);

  // Lock body scroll
  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleCalculate = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/cost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tuition_yearly:     parseTuition(tuition),
          country:            countryKey,
          city:               selectedCity,
          housing_type:       housingType,
          meal_plan:          mealPlan,
          program_years:      programYears,
          include_uni_extras: true,
        }),
      });
      setResult(await response.json());
    } catch {
      setResult({ error: 'Failed to calculate. Is backend running?' } as CostResult);
    } finally {
      setLoading(false);
    }
  }, [tuition, countryKey, selectedCity, housingType, mealPlan, programYears]);

  // Auto-calculate on open and when options change
  useEffect(() => {
    if (mounted) handleCalculate();
  }, [mounted, handleCalculate]);

  const cur = result?.currency || '$';
  const tuitionNum = parseTuition(tuition);

  if (!mounted) return null;

  const total = result?.totals?.total_program_cost || 0;
  const tuitionTotal = (result?.breakdown?.university_costs?.yearly_total || 0) * (result?.program_years || 1);
  const housingTotal = (result?.breakdown?.housing?.yearly_total || 0) * (result?.program_years || 1);
  const mealTotal = (result?.breakdown?.meal_plan?.yearly_total || 0) * (result?.program_years || 1);
  const livingTotal = (result?.breakdown?.living_costs?.yearly_total || 0) * (result?.program_years || 1);
  const oneTime = result?.breakdown?.one_time_costs?.total || 0;

  const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;

  const lines = [
    { label: 'Tuition & Fees',  emoji: '🎓', total: tuitionTotal,  monthly: result?.breakdown?.university_costs?.yearly_total ? Math.round(result.breakdown.university_costs.yearly_total / 12) : 0, sub: 'Paid to the university', tint: 'bg-purple-500' },
    { label: 'Housing',         emoji: '🏠', total: housingTotal,  monthly: result?.breakdown?.housing?.monthly || 0, sub: result?.breakdown?.housing?.type || '', tint: 'bg-pink-500' },
    { label: 'Meals & food',    emoji: '🍽️', total: mealTotal,     monthly: result?.breakdown?.meal_plan?.monthly || 0, sub: result?.breakdown?.meal_plan?.type || 'Self-cook', tint: 'bg-amber-500' },
    { label: 'Living expenses', emoji: '🚌', total: livingTotal,   monthly: result?.breakdown?.living_costs?.monthly_total || 0, sub: 'Transport, utilities, misc.', tint: 'bg-blue-500' },
    { label: 'Setup (one-time)', emoji: '✈️', total: oneTime,       monthly: 0, sub: 'Visa, flight, deposit (Year 1 only)', tint: 'bg-emerald-500' },
  ].filter(l => l.total > 0);

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
      onWheel={e => e.stopPropagation()}
      onTouchMove={e => e.stopPropagation()}>

      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-6 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-purple-600 font-bold">💵 Cost calculator</p>
            <h2 className="text-lg font-bold text-slate-900 truncate mt-0.5">{universityName}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{country} · {programYears} year{programYears !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClose}
            className="shrink-0 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition">
            <svg className="h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">

          {/* Customize */}
          <div>
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3">Customize your lifestyle</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 font-medium">City</label>
                <select value={selectedCity} onChange={e => setSelectedCity(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-purple-500 outline-none bg-white">
                  <option value="default">Average</option>
                  {cities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 font-medium">Housing</label>
                <select value={housingType} onChange={e => setHousingType(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-purple-500 outline-none bg-white">
                  {HOUSING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 font-medium">Meals</label>
                <select value={mealPlan} onChange={e => setMealPlan(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-purple-500 outline-none bg-white">
                  {MEAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 font-medium">Duration</label>
                <select value={programYears} onChange={e => setProgramYears(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-purple-500 outline-none bg-white">
                  {[1, 1.5, 2, 3, 4, 5].map(y => <option key={y} value={y}>{y} year{y !== 1 ? 's' : ''}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
            </div>
          )}

          {result?.error && !loading && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-100 text-red-700 text-sm">{result.error}</div>
          )}

          {result && !result.error && !loading && (
            <>
              {/* Total card — hero number */}
              <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-7 text-white relative overflow-hidden">
                <div className="absolute -top-20 -right-20 w-60 h-60 bg-purple-500/30 rounded-full blur-3xl" />
                <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-pink-500/20 rounded-full blur-3xl" />
                <div className="relative">
                  <p className="text-xs uppercase tracking-widest text-white/60 font-bold">Total cost · {result.program_years} year{result.program_years !== 1 ? 's' : ''}</p>
                  <p className="text-5xl font-black mt-2">{cur}{fmt(total)}</p>
                  <p className="text-sm text-white/70 mt-2">≈ {cur}{fmt(Math.round(total / (result.program_years * 12)))} per month over {result.program_years * 12} months</p>

                  <div className="grid grid-cols-3 gap-3 mt-6">
                    <div className="bg-white/10 backdrop-blur rounded-xl p-3 border border-white/10">
                      <p className="text-[10px] uppercase tracking-wider text-white/60 font-bold">Year 1</p>
                      <p className="text-lg font-bold mt-0.5">{cur}{fmt(result.totals.year_1_total)}</p>
                      <p className="text-[10px] text-white/50">incl. setup</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur rounded-xl p-3 border border-white/10">
                      <p className="text-[10px] uppercase tracking-wider text-white/60 font-bold">Year 2+</p>
                      <p className="text-lg font-bold mt-0.5">{cur}{fmt(result.totals.year_2_plus)}</p>
                      <p className="text-[10px] text-white/50">per year</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur rounded-xl p-3 border border-white/10">
                      <p className="text-[10px] uppercase tracking-wider text-white/60 font-bold">Monthly</p>
                      <p className="text-lg font-bold mt-0.5">{cur}{fmt(result.totals.monthly_recurring)}</p>
                      <p className="text-[10px] text-white/50">recurring</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Breakdown — visual */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">Where your money goes</p>
                  <span className="text-xs text-slate-400">over {result.program_years} year{result.program_years !== 1 ? 's' : ''}</span>
                </div>

                {/* Stacked horizontal bar */}
                <div className="h-3 rounded-full overflow-hidden flex bg-slate-100 mb-4">
                  {lines.map((l, i) => (
                    <div key={i} className={l.tint} style={{ width: `${pct(l.total)}%` }} title={`${l.label}: ${pct(l.total)}%`} />
                  ))}
                </div>

                <div className="space-y-2">
                  {lines.map((l, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                      <div className={`w-12 h-12 rounded-xl ${l.tint} text-white flex items-center justify-center text-xl shrink-0`}>{l.emoji}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2 flex-wrap">
                          <p className="text-sm font-bold text-slate-900">{l.label}</p>
                          <p className="text-base font-bold text-slate-900">{cur}{fmt(l.total)}</p>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <p className="text-xs text-slate-500 truncate">{l.sub}</p>
                          <p className="text-xs text-slate-500 shrink-0">
                            {l.monthly > 0 && <>{cur}{fmt(l.monthly)}/mo · </>}
                            {pct(l.total)}%
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Scholarship */}
              {scholarships && scholarships !== 'N/A' && (
                <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center text-lg shrink-0">💰</div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-emerald-900">Scholarships available</p>
                      <p className="text-xs text-emerald-700 mt-1">{scholarships}</p>
                      {maxCoverage && maxCoverage > 0 && tuitionNum > 0 && (
                        <p className="text-sm font-bold text-emerald-900 mt-2">
                          Could save up to <span className="text-lg">{cur}{fmt(Math.round(tuitionNum * maxCoverage / 100 * (result.program_years || 1)))}</span>
                          <span className="text-xs font-medium text-emerald-700 ml-1">({maxCoverage}% of tuition over {result.program_years} yr)</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Visa */}
              {result.visa_info?.type && (
                <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-500 text-white flex items-center justify-center text-base shrink-0">🛂</div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-blue-900">{result.visa_info.type}</p>
                    <p className="text-xs text-blue-700 mt-0.5">{result.visa_info.notes}</p>
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-400 text-center pt-2">Estimates based on 2025–26 averages. Actual costs vary.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
