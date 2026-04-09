'use client';

import { useState, useEffect, useCallback } from 'react';

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
  { value: 'housing_oncampus_shared',  label: 'On-campus shared', icon: '🏫' },
  { value: 'housing_oncampus_single',  label: 'On-campus single', icon: '🏫' },
  { value: 'housing_offcampus_shared', label: 'Off-campus shared', icon: '🏠' },
  { value: 'housing_offcampus_single', label: 'Off-campus alone', icon: '🏠' },
];

const MEAL_OPTIONS = [
  { value: 'none',     label: 'Self-cook' },
  { value: 'basic',    label: 'Basic plan' },
  { value: 'standard', label: 'Standard plan' },
  { value: 'full',     label: 'Full plan' },
];

function parseTuition(raw: string): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[^0-9.]/g, '');
  return parseFloat(cleaned) || 0;
}

function fmt(n: number): string {
  return n.toLocaleString();
}

export default function CostCalculator({
  universityName,
  country,
  tuition,
  programDuration,
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

  const [selectedCountry, setSelectedCountry] = useState(countryKey);
  const [selectedCity, setSelectedCity]       = useState('default');
  const [housingType, setHousingType]         = useState('housing_oncampus_shared');
  const [mealPlan, setMealPlan]               = useState('none');
  const [programYears, setProgramYears]       = useState(parsedYears);
  const [includeExtras, setIncludeExtras]     = useState(true);
  const [result, setResult]                   = useState<CostResult | null>(null);
  const [loading, setLoading]                 = useState(false);
  const [tuitionInput, setTuitionInput]       = useState(String(parseTuition(tuition) || ''));

  const handleCalculate = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/cost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tuition_yearly:     parseTuition(tuitionInput),
          country:            selectedCountry,
          city:               selectedCity,
          housing_type:       housingType,
          meal_plan:          mealPlan,
          program_years:      programYears,
          include_uni_extras: includeExtras,
        }),
      });
      const data = await response.json();
      setResult(data);
    } catch {
      setResult({ error: 'Failed to calculate. Is backend running?' } as CostResult);
    } finally {
      setLoading(false);
    }
  }, [tuitionInput, selectedCountry, selectedCity, housingType, mealPlan, programYears, includeExtras]);

  useEffect(() => {
    if (parseTuition(tuition) > 0) handleCalculate();
  }, [tuition, handleCalculate]);

  useEffect(() => { setSelectedCity('default'); }, [selectedCountry]);

  const cities = CITY_MAP[selectedCountry] || [];
  const cur = result?.currency || '$';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-slate-100 px-5 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-800 truncate">Cost Breakdown</h2>
            <p className="text-xs text-slate-500 truncate">{universityName}</p>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors flex-shrink-0 ml-2">
            <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* Quick settings — compact row */}
          <div className="space-y-3">
            {/* Tuition + Duration row */}
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="block text-[11px] text-slate-400 mb-1">Annual Tuition</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">$</span>
                  <input type="number" value={tuitionInput}
                    onChange={e => setTuitionInput(e.target.value)}
                    placeholder="32000"
                    className="w-full pl-7 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-purple-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Years</label>
                <select value={programYears} onChange={e => setProgramYears(Number(e.target.value))}
                  className="w-full px-2 py-2 rounded-lg border border-slate-200 text-sm focus:border-purple-500 outline-none bg-white">
                  {[1, 1.5, 2, 3, 4, 5].map(y => (
                    <option key={y} value={y}>{y}yr</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Country + City row */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Country</label>
                <select value={selectedCountry} onChange={e => setSelectedCountry(e.target.value)}
                  className="w-full px-2 py-2 rounded-lg border border-slate-200 text-sm focus:border-purple-500 outline-none bg-white">
                  {Object.keys(CITY_MAP).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">City</label>
                <select value={selectedCity} onChange={e => setSelectedCity(e.target.value)}
                  className="w-full px-2 py-2 rounded-lg border border-slate-200 text-sm focus:border-purple-500 outline-none bg-white">
                  <option value="default">Average</option>
                  {cities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Housing — pill selector */}
            <div>
              <label className="block text-[11px] text-slate-400 mb-1.5">Housing</label>
              <div className="grid grid-cols-2 gap-1.5">
                {HOUSING_OPTIONS.map(o => (
                  <button key={o.value} type="button" onClick={() => setHousingType(o.value)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all text-left ${
                      housingType === o.value
                        ? 'bg-purple-100 text-purple-700 ring-1 ring-purple-300'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}>
                    {o.icon} {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Meal plan — pill selector */}
            <div>
              <label className="block text-[11px] text-slate-400 mb-1.5">Meal Plan</label>
              <div className="flex gap-1.5">
                {MEAL_OPTIONS.map(o => (
                  <button key={o.value} type="button" onClick={() => setMealPlan(o.value)}
                    className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      mealPlan === o.value
                        ? 'bg-purple-100 text-purple-700 ring-1 ring-purple-300'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Extras toggle + Calculate */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={includeExtras} onChange={e => setIncludeExtras(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-purple-500" />
                <span className="text-xs text-slate-500">Include uni fees</span>
              </label>
              <button onClick={handleCalculate} disabled={loading || !tuitionInput}
                className="px-5 py-2 rounded-lg bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50">
                {loading ? 'Calculating...' : 'Calculate'}
              </button>
            </div>
          </div>

          {/* Error */}
          {result?.error && (
            <div className="p-3 rounded-lg bg-red-50 text-red-600 text-xs">{result.error}</div>
          )}

          {/* Results */}
          {result && !result.error && (
            <div className="space-y-4 pt-1">

              {/* Big total card */}
              <div className="rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 p-5 text-white">
                <p className="text-xs text-slate-400 mb-1">Total Program Cost ({result.program_years} year{result.program_years !== 1 ? 's' : ''})</p>
                <p className="text-3xl font-bold tracking-tight">{cur}{fmt(result.totals.total_program_cost)}</p>
                <div className="flex gap-4 mt-3 pt-3 border-t border-white/10">
                  <div>
                    <p className="text-[10px] text-slate-400">Monthly</p>
                    <p className="text-sm font-semibold">{cur}{fmt(result.totals.monthly_recurring)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400">Year 1</p>
                    <p className="text-sm font-semibold">{cur}{fmt(result.totals.year_1_total)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400">Year 2+</p>
                    <p className="text-sm font-semibold">{cur}{fmt(result.totals.year_2_plus)}/yr</p>
                  </div>
                </div>
              </div>

              {/* Visual donut-style breakdown */}
              {(() => {
                const bd = result.breakdown;
                const total = result.totals.year_2_plus;
                const segments = [
                  { label: 'Tuition & Fees', value: bd.university_costs.yearly_total, color: 'bg-purple-500', dot: 'bg-purple-500' },
                  { label: 'Housing',         value: bd.housing.yearly_total,          color: 'bg-blue-500',   dot: 'bg-blue-500' },
                  { label: 'Meal Plan',        value: bd.meal_plan.yearly_total,        color: 'bg-amber-400',  dot: 'bg-amber-400' },
                  { label: 'Living Costs',     value: bd.living_costs.yearly_total,     color: 'bg-emerald-500', dot: 'bg-emerald-500' },
                ].filter(s => s.value > 0);

                return (
                  <div className="rounded-xl border border-slate-100 p-4">
                    {/* Stacked bar */}
                    <div className="flex h-3 rounded-full overflow-hidden mb-3">
                      {segments.map(s => (
                        <div key={s.label} className={`${s.color} transition-all`}
                          style={{ width: `${(s.value / total) * 100}%` }} />
                      ))}
                    </div>
                    {/* Legend */}
                    <div className="grid grid-cols-2 gap-2">
                      {segments.map(s => (
                        <div key={s.label} className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${s.dot} flex-shrink-0`} />
                          <span className="text-xs text-slate-500 flex-1 truncate">{s.label}</span>
                          <span className="text-xs font-semibold text-slate-700">{cur}{fmt(s.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Detailed breakdown — clean table style */}
              <div className="space-y-2">
                {/* University Costs */}
                <details className="group rounded-lg border border-slate-100 overflow-hidden">
                  <summary className="flex items-center justify-between px-4 py-2.5 bg-white hover:bg-slate-50 cursor-pointer transition-colors">
                    <span className="text-xs font-semibold text-slate-700">University Costs</span>
                    <span className="text-xs font-bold text-purple-600">{cur}{fmt(result.breakdown.university_costs.yearly_total)}/yr</span>
                  </summary>
                  <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 space-y-1.5">
                    {Object.entries(result.breakdown.university_costs.items).map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="text-[11px] text-slate-500 capitalize">{k.replace(/_/g, ' ')}</span>
                        <span className="text-[11px] font-medium text-slate-700">{cur}{fmt(v as number)}/yr</span>
                      </div>
                    ))}
                  </div>
                </details>

                {/* Housing */}
                <div className="flex items-center justify-between px-4 py-2.5 rounded-lg border border-slate-100 bg-white">
                  <div>
                    <span className="text-xs font-semibold text-slate-700">Housing</span>
                    <span className="text-[11px] text-slate-400 ml-1.5">({result.breakdown.housing.type})</span>
                  </div>
                  <span className="text-xs font-bold text-blue-600">{cur}{fmt(result.breakdown.housing.monthly)}/mo</span>
                </div>

                {/* Meal Plan */}
                {result.breakdown.meal_plan.monthly > 0 && (
                  <div className="flex items-center justify-between px-4 py-2.5 rounded-lg border border-slate-100 bg-white">
                    <div>
                      <span className="text-xs font-semibold text-slate-700">Meal Plan</span>
                      <span className="text-[11px] text-slate-400 ml-1.5">({result.breakdown.meal_plan.type})</span>
                    </div>
                    <span className="text-xs font-bold text-amber-600">{cur}{fmt(result.breakdown.meal_plan.monthly)}/mo</span>
                  </div>
                )}

                {/* Living Costs */}
                <details className="group rounded-lg border border-slate-100 overflow-hidden">
                  <summary className="flex items-center justify-between px-4 py-2.5 bg-white hover:bg-slate-50 cursor-pointer transition-colors">
                    <span className="text-xs font-semibold text-slate-700">Living Costs</span>
                    <span className="text-xs font-bold text-emerald-600">{cur}{fmt(result.breakdown.living_costs.monthly_total)}/mo</span>
                  </summary>
                  <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 space-y-1.5">
                    {Object.entries(result.breakdown.living_costs.items).map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="text-[11px] text-slate-500">{k}</span>
                        <span className="text-[11px] font-medium text-slate-700">{cur}{fmt(v as number)}/mo</span>
                      </div>
                    ))}
                  </div>
                </details>

                {/* One-time Costs */}
                <details className="group rounded-lg border border-slate-100 overflow-hidden">
                  <summary className="flex items-center justify-between px-4 py-2.5 bg-white hover:bg-slate-50 cursor-pointer transition-colors">
                    <span className="text-xs font-semibold text-slate-700">One-Time Costs <span className="text-slate-400 font-normal">(Year 1)</span></span>
                    <span className="text-xs font-bold text-orange-600">{cur}{fmt(result.breakdown.one_time_costs.total)}</span>
                  </summary>
                  <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 space-y-1.5">
                    {Object.entries(result.breakdown.one_time_costs.items).map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="text-[11px] text-slate-500">{k}</span>
                        <span className="text-[11px] font-medium text-slate-700">{cur}{fmt(v as number)}</span>
                      </div>
                    ))}
                  </div>
                </details>
              </div>

              {/* Visa info */}
              {result.visa_info?.type && (
                <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-blue-50 border border-blue-100">
                  <span className="text-blue-500 text-sm mt-0.5">i</span>
                  <div>
                    <p className="text-xs font-semibold text-blue-700">{result.visa_info.type}</p>
                    <p className="text-[11px] text-blue-600/70 mt-0.5">{result.visa_info.notes}</p>
                  </div>
                </div>
              )}

              <p className="text-[10px] text-slate-400 text-center">
                Estimates based on 2025-26 averages. Actual costs vary by lifestyle and location.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
