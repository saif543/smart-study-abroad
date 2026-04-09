'use client';

import { useState } from 'react';

interface StudentProfile {
  gpa: string;
  ielts: string;
  gre: string;
  sat: string;
  budget: string;
  researchExp: string;
  preferredCountry: string;
  field: string;
  ecaLevel: string;
}

interface GapAnalysis {
  factor: string;
  status: 'strong' | 'meets' | 'below';
  detail: string;
}

interface UniversityMatch {
  university_name: string;
  country: string;
  category: string;
  admission_probability: number;
  qs_ranking: number | null;
  tuition_fee: number;
  min_gpa: number;
  ielts_requirement: number | null;
  acceptance_rate: number | null;
  scholarship_available: boolean;
  subject_match: boolean;
  gap_analysis: GapAnalysis[];
  is_preferred: number;
}

interface FeatureImportance {
  feature: string;
  importance: number;
}

interface Improvement {
  action: string;
  impact: string;
}

interface PredictionResult {
  ml_prediction: { ml_probability: number; confidence: string };
  recommendation: string;
  factors: Record<string, number>;
  universities: UniversityMatch[];
  total_matched: number;
  total_in_dataset: number;
  category_counts?: { safe: number; moderate: number; risky: number };
  improvements?: Improvement[];
  model_version?: string;
  profile: Record<string, unknown>;
}

interface AdmissionPredictorProps {
  onAIMessage: (message: string) => void;
}

export default function AdmissionPredictor({ onAIMessage }: AdmissionPredictorProps) {
  const [profile, setProfile] = useState<StudentProfile>({
    gpa: '',
    ielts: '',
    gre: '',
    sat: '',
    budget: '',
    researchExp: '0',
    preferredCountry: 'USA',
    field: '',
    ecaLevel: '0',
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [featureImportances, setFeatureImportances] = useState<FeatureImportance[]>([]);
  const [expandedCard, setExpandedCard] = useState<number | null>(null);

  const handleChange = (field: keyof StudentProfile, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handlePredict = async () => {
    const gpa = parseFloat(profile.gpa);
    const ielts = parseFloat(profile.ielts);
    if (!gpa || !ielts || !profile.field) {
      onAIMessage('Please fill in GPA, IELTS score, and Field of Study');
      return;
    }

    setLoading(true);
    setResult(null);
    onAIMessage('Running ML admission prediction...');

    try {
      if (featureImportances.length === 0) {
        try {
          const impRes = await fetch('/api/predict/features');
          const impData = await impRes.json();
          if (impData.features) setFeatureImportances(impData.features);
        } catch { /* non-critical */ }
      }

      const response = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gpa: parseFloat(profile.gpa) || 0,
          ielts: parseFloat(profile.ielts) || 0,
          gre: parseFloat(profile.gre) || 0,
          sat: parseFloat(profile.sat) || 0,
          budget: parseFloat(profile.budget) || 0,
          research_exp: parseInt(profile.researchExp) || 0,
          preferred_country: profile.preferredCountry,
          field: profile.field,
          eca_level: parseInt(profile.ecaLevel) || 0,
          top_k: 10,
        }),
      });

      const data = await response.json();

      if (data.error) {
        onAIMessage(`Error: ${data.error}`);
        return;
      }

      setResult(data);
      const uniCount = data.universities?.length || 0;
      onAIMessage(`Found ${uniCount} matching universities from ${data.total_in_dataset} total. ML Score: ${data.ml_prediction?.ml_probability}%`);
    } catch (error) {
      onAIMessage(`Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryStyle = (category: string) => {
    switch (category) {
      case 'Safe': return { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' };
      case 'Moderate': return { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' };
      default: return { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' };
    }
  };

  const getProbColor = (prob: number) => {
    if (prob >= 85) return 'bg-emerald-500';
    if (prob >= 65) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getGapStyle = (status: string) => {
    if (status === 'strong') return { icon: '\u2713', bg: 'bg-emerald-100', text: 'text-emerald-700' };
    if (status === 'meets') return { icon: '=', bg: 'bg-blue-100', text: 'text-blue-700' };
    return { icon: '!', bg: 'bg-red-100', text: 'text-red-700' };
  };

  const countries = [
    { code: 'USA', name: 'USA', flag: '\ud83c\uddfa\ud83c\uddf8' },
    { code: 'United Kingdom', name: 'UK', flag: '\ud83c\uddec\ud83c\udde7' },
    { code: 'Canada', name: 'Canada', flag: '\ud83c\udde8\ud83c\udde6' },
    { code: 'Australia', name: 'Australia', flag: '\ud83c\udde6\ud83c\uddfa' },
    { code: 'Germany', name: 'Germany', flag: '\ud83c\udde9\ud83c\uddea' },
    { code: '', name: 'Any', flag: '\ud83c\udf0d' },
  ];

  const fields = [
    'Computer Science', 'Engineering', 'Business', 'Medicine', 'Arts',
    'Data Science', 'Finance', 'Mechanical Engineering',
    'Electrical Engineering', 'Civil Engineering', 'Nursing', 'Pharmacy',
    'Economics', 'Marketing', 'Management',
  ];

  return (
    <div className="space-y-6 slide-up">
      {/* Input Form */}
      <div className="relative overflow-hidden bg-white rounded-2xl shadow-lg border border-slate-100">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 to-cyan-500" />
        <div className="p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-teal-500 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">ML Admission Predictor</h2>
              <p className="text-slate-500 text-sm">GradientBoosting model predicts your university match score</p>
            </div>
          </div>

          <div className="space-y-7">
            {/* Row 1: Field, GPA, IELTS */}
            <div className="space-y-1 pb-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Academic Profile</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Field of Study <span className="text-red-400">*</span></label>
                <select
                  value={profile.field}
                  onChange={(e) => handleChange('field', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 transition-all outline-none bg-white text-slate-800 cursor-pointer"
                >
                  <option value="">Select field...</option>
                  {fields.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Your GPA <span className="text-red-400">*</span></label>
                <input
                  type="number" step="0.01" min="0" max="4.0"
                  value={profile.gpa}
                  onChange={(e) => handleChange('gpa', e.target.value)}
                  placeholder="e.g., 3.5 (out of 4.0)"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 transition-all outline-none text-slate-800 placeholder:text-slate-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">IELTS Score <span className="text-red-400">*</span></label>
                <select
                  value={profile.ielts}
                  onChange={(e) => handleChange('ielts', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 transition-all outline-none bg-white text-slate-800 cursor-pointer"
                >
                  <option value="">Select band...</option>
                  {['9.0', '8.5', '8.0', '7.5', '7.0', '6.5', '6.0', '5.5', '5.0'].map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 2: GRE, SAT */}
            <div className="space-y-1 pb-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Test Scores (optional)</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">GRE Score</label>
                <input
                  type="number" step="1" min="0" max="340"
                  value={profile.gre}
                  onChange={(e) => handleChange('gre', e.target.value)}
                  placeholder="e.g., 320 (or leave empty)"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 transition-all outline-none text-slate-800 placeholder:text-slate-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">SAT Score</label>
                <input
                  type="number" step="1" min="0" max="1600"
                  value={profile.sat}
                  onChange={(e) => handleChange('sat', e.target.value)}
                  placeholder="e.g., 1480 (or leave empty)"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 transition-all outline-none text-slate-800 placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Row 3: Research, ECA, Budget */}
            <div className="space-y-1 pb-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Profile & Budget</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Research Experience</label>
                <select
                  value={profile.researchExp}
                  onChange={(e) => handleChange('researchExp', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 transition-all outline-none bg-white text-slate-800 cursor-pointer"
                >
                  <option value="0">No</option>
                  <option value="1">Yes</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Extracurricular Level</label>
                <select
                  value={profile.ecaLevel}
                  onChange={(e) => handleChange('ecaLevel', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 transition-all outline-none bg-white text-slate-800 cursor-pointer"
                >
                  <option value="0">None (0)</option>
                  <option value="1">Low (1)</option>
                  <option value="2">Medium (2)</option>
                  <option value="3">Active (3)</option>
                  <option value="4">High (4)</option>
                  <option value="5">Exceptional (5)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Budget (USD/year)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
                  <input
                    type="number"
                    value={profile.budget}
                    onChange={(e) => handleChange('budget', e.target.value)}
                    placeholder="e.g., 50000"
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 transition-all outline-none text-slate-800 placeholder:text-slate-400"
                  />
                </div>
              </div>
            </div>

            {/* Preferred Country */}
            <div className="pt-2">
              <label className="block text-sm font-medium text-slate-600 mb-3">Preferred Country</label>
              <div className="flex flex-wrap gap-2">
                {countries.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => handleChange('preferredCountry', c.code)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      profile.preferredCountry === c.code
                        ? 'bg-teal-500 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {c.flag} {c.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Predict Button */}
            <button
              onClick={handlePredict}
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold text-base shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Predicting...
                </>
              ) : (
                'Predict Admission Chances'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-5">
          {/* ML Profile Summary */}
          <div className="relative overflow-hidden bg-white rounded-2xl shadow-lg border border-slate-100">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 to-cyan-500" />
            <div className="p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-5">Your Admission Profile</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Score Circle */}
                <div className="flex flex-col items-center justify-center">
                  {(() => {
                    const prob = result.ml_prediction.ml_probability;
                    const textColor = prob >= 85 ? 'text-emerald-600' : prob >= 65 ? 'text-amber-600' : 'text-red-600';
                    return (
                      <div className="relative">
                        <svg className="w-40 h-40 transform -rotate-90" viewBox="0 0 120 120">
                          <circle cx="60" cy="60" r="52" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                          <circle
                            cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="8"
                            strokeLinecap="round"
                            strokeDasharray={`${prob * 3.267} 326.7`}
                            className={textColor}
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className={`text-3xl font-bold ${textColor}`}>{prob}%</span>
                          <span className="text-xs text-slate-400">ML score</span>
                        </div>
                      </div>
                    );
                  })()}
                  <span className={`mt-3 px-3 py-1 rounded-full text-sm font-medium ${
                    result.ml_prediction.confidence === 'High' ? 'bg-emerald-100 text-emerald-700' :
                    result.ml_prediction.confidence === 'Medium' ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {result.ml_prediction.confidence} Confidence
                  </span>
                </div>

                {/* Recommendation + Profile */}
                <div>
                  <div className="bg-slate-50 rounded-xl p-4 mb-4">
                    <p className="text-sm font-semibold text-slate-700 mb-1">AI Recommendation</p>
                    <p className="text-sm text-slate-600">{result.recommendation}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {[
                      { label: 'GPA', value: profile.gpa },
                      { label: 'IELTS', value: profile.ielts },
                      { label: 'Field', value: profile.field },
                      { label: 'Research', value: profile.researchExp === '1' ? 'Yes' : 'No' },
                      { label: 'Budget', value: `$${parseInt(profile.budget || '0').toLocaleString()}` },
                      { label: 'GRE', value: profile.gre || 'N/A' },
                    ].map(item => (
                      <div key={item.label} className="flex justify-between py-1">
                        <span className="text-slate-400">{item.label}</span>
                        <span className="font-medium text-slate-700">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Category Overview */}
          {result.category_counts && (
            <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4">University Breakdown</h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Safe', count: result.category_counts.safe, color: 'bg-emerald-500', textColor: 'text-emerald-700', bgLight: 'bg-emerald-50' },
                  { label: 'Moderate', count: result.category_counts.moderate, color: 'bg-amber-500', textColor: 'text-amber-700', bgLight: 'bg-amber-50' },
                  { label: 'Risky', count: result.category_counts.risky, color: 'bg-red-500', textColor: 'text-red-700', bgLight: 'bg-red-50' },
                ].map(cat => (
                  <div key={cat.label} className={`rounded-xl p-3 text-center ${cat.bgLight}`}>
                    <span className={`text-2xl font-bold ${cat.textColor}`}>{cat.count}</span>
                    <p className="text-xs text-slate-500 mt-1">{cat.label}</p>
                    <div className={`h-1 rounded-full mt-2 ${cat.color}`} style={{ width: `${Math.min(100, (cat.count / result.total_in_dataset) * 100)}%`, margin: '0 auto' }} />
                  </div>
                ))}
              </div>
              {/* Stacked bar */}
              <div className="mt-4 h-3 rounded-full overflow-hidden flex bg-slate-100">
                {result.category_counts.safe > 0 && <div className="bg-emerald-500" style={{ width: `${(result.category_counts.safe / result.total_in_dataset) * 100}%` }} />}
                {result.category_counts.moderate > 0 && <div className="bg-amber-500" style={{ width: `${(result.category_counts.moderate / result.total_in_dataset) * 100}%` }} />}
                {result.category_counts.risky > 0 && <div className="bg-red-500" style={{ width: `${(result.category_counts.risky / result.total_in_dataset) * 100}%` }} />}
              </div>
              <p className="text-xs text-slate-400 mt-2 text-center">Out of {result.total_in_dataset} universities analyzed</p>
            </div>
          )}

          {/* Improvement Suggestions */}
          {result.improvements && result.improvements.length > 0 && (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-200 p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-3">How to Improve Your Chances</h3>
              <div className="space-y-3">
                {result.improvements.map((imp, i) => (
                  <div key={i} className="flex items-start gap-3 bg-white/70 rounded-xl p-3">
                    <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{imp.action}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{imp.impact}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Feature Importance Chart */}
          {featureImportances.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-1">What Matters Most</h3>
              <p className="text-sm text-slate-400 mb-5">Feature importance from the GradientBoosting model</p>
              <div className="space-y-3">
                {featureImportances.map((f) => (
                  <div key={f.feature} className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 w-28 flex-shrink-0 text-right">{f.feature.replace(/_/g, ' ')}</span>
                    <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all duration-700"
                        style={{ width: `${f.importance}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-slate-600 w-12">{f.importance}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* University Results */}
          {result.universities && result.universities.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-baseline gap-2">
                <h3 className="text-lg font-bold text-slate-800">Top University Recommendations</h3>
                <span className="text-sm text-slate-400">Ranked by match score</span>
              </div>

              <div className="space-y-4">
                {result.universities.map((uni, index) => {
                  const catStyle = getCategoryStyle(uni.category);
                  return (
                    <div key={index} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-shadow">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <span className="text-slate-400 font-semibold text-sm mt-0.5">#{index + 1}</span>
                          <div className="min-w-0">
                            <h4 className="text-base font-bold text-slate-800 truncate">{uni.university_name}</h4>
                            <p className="text-sm text-slate-500">
                              {uni.country}
                              {uni.is_preferred ? ' \u2b50' : ''}
                              {uni.qs_ranking ? ` \u00b7 QS #${uni.qs_ranking}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${catStyle.bg} ${catStyle.text} border ${catStyle.border}`}>
                            {uni.category}
                          </span>
                          <span className={`px-3 py-1 rounded-full text-sm font-bold text-white ${getProbColor(uni.admission_probability)}`}>
                            {uni.admission_probability}%
                          </span>
                        </div>
                      </div>

                      {/* Probability bar */}
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${getProbColor(uni.admission_probability)}`}
                          style={{ width: `${uni.admission_probability}%` }}
                        />
                      </div>

                      {/* Quick facts */}
                      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm mb-3">
                        {uni.tuition_fee > 0 && (
                          <span className="text-slate-600"><span className="text-slate-400">Tuition</span> ${uni.tuition_fee.toLocaleString()}/yr</span>
                        )}
                        {uni.min_gpa > 0 && (
                          <span className="text-slate-600"><span className="text-slate-400">Min GPA</span> {uni.min_gpa}</span>
                        )}
                        {uni.ielts_requirement && (
                          <span className="text-slate-600"><span className="text-slate-400">IELTS</span> {uni.ielts_requirement}</span>
                        )}
                        {uni.acceptance_rate && (
                          <span className="text-slate-600"><span className="text-slate-400">Accept</span> {uni.acceptance_rate}%</span>
                        )}
                        {uni.scholarship_available && (
                          <span className="text-teal-600 font-medium">Scholarship Available</span>
                        )}
                        {uni.subject_match && (
                          <span className="text-purple-600 font-medium">Field Match</span>
                        )}
                      </div>

                      {/* Expand toggle */}
                      <button
                        onClick={() => setExpandedCard(expandedCard === index ? null : index)}
                        className="text-sm text-teal-500 hover:text-teal-700 font-medium flex items-center gap-1 transition-colors"
                      >
                        {expandedCard === index ? 'Hide gap analysis' : 'View gap analysis'}
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className={`h-3.5 w-3.5 transition-transform duration-200 ${expandedCard === index ? 'rotate-180' : ''}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {/* Gap Analysis (expanded) */}
                      <div className={`overflow-hidden transition-all duration-300 ${expandedCard === index ? 'max-h-[500px] opacity-100 mt-4 pt-4 border-t border-slate-100' : 'max-h-0 opacity-0'}`}>
                        {uni.gap_analysis && uni.gap_analysis.length > 0 ? (
                          <div className="space-y-2">
                            {uni.gap_analysis.map((gap, gi) => {
                              const style = getGapStyle(gap.status);
                              return (
                                <div key={gi} className="flex items-center gap-2.5">
                                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${style.bg} ${style.text}`}>
                                    {style.icon}
                                  </span>
                                  <span className="text-sm text-slate-700">{gap.detail}</span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400">No detailed gap data available for this university.</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
