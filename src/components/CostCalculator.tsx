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

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
      onWheel={e => e.stopPropagation()}
      onTouchMove={e => e.stopPropagation()}>

      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 pt-5 pb-4 flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-800">{universityName}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{country} &middot; {tuition} tuition &middot; {programYears} year{programYears !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center flex-shrink-0 -mt-1">
            <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Customize lifestyle */}
        <div className="px-6 pb-4">
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="block text-[10px] text-slate-400 mb-1">City</label>
              <select value={selectedCity} onChange={e => setSelectedCity(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:border-purple-500 outline-none bg-white">
                <option value="default">Average</option>
                {cities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 mb-1">Housing</label>
              <select value={housingType} onChange={e => setHousingType(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:border-purple-500 outline-none bg-white">
                {HOUSING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 mb-1">Meals</label>
              <select value={mealPlan} onChange={e => setMealPlan(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:border-purple-500 outline-none bg-white">
                {MEAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 mb-1">Duration</label>
              <select value={programYears} onChange={e => setProgramYears(Number(e.target.value))}
                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:border-purple-500 outline-none bg-white">
                {[1, 1.5, 2, 3, 4, 5].map(y => <option key={y} value={y}>{y} yr</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="px-6 pb-6 flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
          </div>
        )}

        {/* Error */}
        {result?.error && !loading && (
          <div className="px-6 pb-6">
            <div className="p-3 rounded-lg bg-red-50 text-red-600 text-xs">{result.error}</div>
          </div>
        )}

        {/* Results */}
        {result && !result.error && !loading && (
          <div className="px-6 pb-6 space-y-4">

            {/* Total card */}
            <div className="rounded-xl bg-slate-900 p-5 text-white">
              <div className="flex items-baseline justify-between">
                <p className="text-[11px] text-slate-400">Total Program Cost</p>
                <p className="text-[11px] text-slate-400">{result.program_years} year{result.program_years !== 1 ? 's' : ''}</p>
              </div>
              <p className="text-3xl font-bold mt-1.5">{cur}{fmt(result.totals.total_program_cost)}</p>
              <div className="grid grid-cols-3 gap-4 mt-4 pt-3 border-t border-white/10">
                <div>
                  <p className="text-[10px] text-slate-400">Per Month</p>
                  <p className="text-sm font-semibold">{cur}{fmt(result.totals.monthly_recurring)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">Year 1</p>
                  <p className="text-sm font-semibold">{cur}{fmt(result.totals.year_1_total)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">Year 2+</p>
                  <p className="text-sm font-semibold">{cur}{fmt(result.totals.year_2_plus)}</p>
                </div>
              </div>
            </div>

            {/* Breakdown */}
            <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
              <div className="px-4 py-3 flex justify-between items-center">
                <span className="text-sm text-slate-700">Tuition & Fees</span>
                <span className="text-sm font-semibold text-slate-800">{cur}{fmt(result.breakdown.university_costs.yearly_total)}<span className="text-xs text-slate-400 font-normal">/yr</span></span>
              </div>
              <div className="px-4 py-3 flex justify-between items-center">
                <div>
                  <span className="text-sm text-slate-700">Housing</span>
                  <span className="text-xs text-slate-400 ml-1.5">{result.breakdown.housing.type}</span>
                </div>
                <span className="text-sm font-semibold text-slate-800">{cur}{fmt(result.breakdown.housing.monthly)}<span className="text-xs text-slate-400 font-normal">/mo</span></span>
              </div>
              {result.breakdown.meal_plan.monthly > 0 && (
                <div className="px-4 py-3 flex justify-between items-center">
                  <div>
                    <span className="text-sm text-slate-700">Meals</span>
                    <span className="text-xs text-slate-400 ml-1.5">{result.breakdown.meal_plan.type}</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-800">{cur}{fmt(result.breakdown.meal_plan.monthly)}<span className="text-xs text-slate-400 font-normal">/mo</span></span>
                </div>
              )}
              <div className="px-4 py-3 flex justify-between items-center">
                <span className="text-sm text-slate-700">Living Expenses</span>
                <span className="text-sm font-semibold text-slate-800">{cur}{fmt(result.breakdown.living_costs.monthly_total)}<span className="text-xs text-slate-400 font-normal">/mo</span></span>
              </div>
              <div className="px-4 py-3 flex justify-between items-center bg-slate-50">
                <span className="text-sm text-slate-700">One-Time Setup <span className="text-xs text-slate-400">(Year 1)</span></span>
                <span className="text-sm font-semibold text-slate-800">{cur}{fmt(result.breakdown.one_time_costs.total)}</span>
              </div>
            </div>

            {/* Scholarship info if available */}
            {scholarships && scholarships !== 'N/A' && (
              <div className="px-4 py-3 rounded-xl bg-purple-50 border border-purple-100">
                <p className="text-xs font-semibold text-purple-700">Scholarship Available</p>
                <p className="text-xs text-purple-600 mt-0.5">
                  {scholarships}
                  {maxCoverage && maxCoverage > 0 && ` — covers up to ${maxCoverage}%`}
                  {maxCoverage && maxCoverage > 0 && tuitionNum > 0 && (
                    <span className="font-semibold"> (saves up to {cur}{fmt(Math.round(tuitionNum * maxCoverage / 100))}/yr)</span>
                  )}
                </p>
              </div>
            )}

            {/* Visa */}
            {result.visa_info?.type && (
              <div className="px-4 py-2.5 rounded-xl bg-blue-50 border border-blue-100">
                <span className="text-xs font-medium text-blue-700">{result.visa_info.type}</span>
                <span className="text-xs text-blue-500 ml-1">{result.visa_info.notes}</span>
              </div>
            )}

            <p className="text-[10px] text-slate-400 text-center">Estimates based on 2025-26 averages</p>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
