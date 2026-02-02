'use client';

import { useState } from 'react';

interface Requirements {
  degree: string;
  field: string;
  maxTuition: string;
  minGPA: string;
  englishTest: string;
  englishScore: string;
  country: string;
  preferScholarship: boolean;
}

// Updated interface to match RAG response
interface ScoreBreakdown {
  semantic_similarity: number;
  budget_fit: number;
  gpa_fit: number;
  field_match: number;
}

interface MatchedUniversity {
  name: string;
  country: string;
  match_score: number;
  tuition: string;
  field: string;
  degree: string;
  gpa_required: number;
  score_breakdown: ScoreBreakdown;
  reasons: string[];
  why_matched: string;
}

interface FindForMeTabProps {
  onAIMessage: (message: string) => void;
}

export default function FindForMeTab({ onAIMessage }: FindForMeTabProps) {
  const [requirements, setRequirements] = useState<Requirements>({
    degree: 'Master',
    field: '',
    maxTuition: '',
    minGPA: '',
    englishTest: 'TOEFL',
    englishScore: '',
    country: 'USA',
    preferScholarship: false,
  });
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<MatchedUniversity[]>([]);
  const [totalInDatabase, setTotalInDatabase] = useState(0);

  const handleChange = (field: keyof Requirements, value: string | boolean) => {
    setRequirements(prev => ({ ...prev, [field]: value }));
  };

  const handleFind = async () => {
    if (!requirements.field) {
      onAIMessage('Please enter your field of study');
      return;
    }

    setLoading(true);
    onAIMessage('RAG is searching your local database...');

    try {
      const response = await fetch('/api/findme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...requirements,
          top_k: 5  // Get top 5 matches
        }),
      });

      const data = await response.json();

      if (data.universities) {
        setResults(data.universities);
        setTotalInDatabase(data.total_in_database || 0);
        onAIMessage(`Found ${data.universities.length} best matches from ${data.total_in_database} universities! (RAG - Local Search)`);
      } else {
        onAIMessage(data.error || 'No universities found');
        setResults([]);
      }
    } catch (error) {
      onAIMessage(`Error: ${error}`);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const countries = [
    { code: 'USA', name: 'United States', flag: '🇺🇸' },
    { code: 'UK', name: 'United Kingdom', flag: '🇬🇧' },
    { code: 'Canada', name: 'Canada', flag: '🇨🇦' },
    { code: 'Australia', name: 'Australia', flag: '🇦🇺' },
    { code: 'Germany', name: 'Germany', flag: '🇩🇪' },
    { code: 'Any', name: 'Any Country', flag: '🌍' },
  ];

  // Get color for score
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'from-emerald-500 to-teal-500';
    if (score >= 75) return 'from-blue-500 to-indigo-500';
    if (score >= 60) return 'from-amber-500 to-orange-500';
    return 'from-slate-400 to-slate-500';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 90) return 'bg-emerald-500';
    if (score >= 75) return 'bg-blue-500';
    if (score >= 60) return 'bg-amber-500';
    return 'bg-slate-400';
  };

  return (
    <div className="space-y-8 slide-up">
      {/* Requirements Form Card */}
      <div className="relative overflow-hidden bg-white rounded-3xl shadow-xl border border-slate-100">
        {/* Decorative gradient bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500" />

        <div className="p-8">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center text-2xl shadow-lg">
              🎯
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Find Universities For Me</h2>
              <p className="text-slate-500">RAG-powered smart matching from your local database</p>
            </div>
          </div>

          {/* RAG Info Card */}
          <div className="mb-8 p-4 rounded-2xl bg-gradient-to-r from-cyan-50 via-purple-50 to-pink-50 border border-purple-100">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🚀</span>
              <div>
                <p className="font-semibold text-purple-700">Powered by RAG (Retrieval Augmented Generation)</p>
                <p className="text-slate-600 text-sm">
                  Searches 100 universities locally using AI embeddings. Fast, free, works offline!
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Row 1: Degree and Field */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center text-sm">📚</span>
                  Degree Level
                </label>
                <select
                  value={requirements.degree}
                  onChange={(e) => handleChange('degree', e.target.value)}
                  className="w-full px-5 py-4 rounded-2xl border-2 border-slate-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all outline-none bg-white text-slate-800 cursor-pointer"
                >
                  <option value="Bachelor">Bachelor&apos;s Degree</option>
                  <option value="Master">Master&apos;s Degree</option>
                  <option value="PhD">PhD / Doctorate</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-cyan-100 flex items-center justify-center text-sm">🎓</span>
                  Field of Study
                </label>
                <input
                  type="text"
                  value={requirements.field}
                  onChange={(e) => handleChange('field', e.target.value)}
                  placeholder="e.g., Computer Science, MBA"
                  className="w-full px-5 py-4 rounded-2xl border-2 border-slate-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all outline-none text-slate-800 placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Row 2: Budget and GPA */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-green-100 flex items-center justify-center text-sm">💰</span>
                  Maximum Tuition (per year)
                </label>
                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">$</span>
                  <input
                    type="text"
                    value={requirements.maxTuition}
                    onChange={(e) => handleChange('maxTuition', e.target.value)}
                    placeholder="50,000"
                    className="w-full pl-10 pr-5 py-4 rounded-2xl border-2 border-slate-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all outline-none text-slate-800 placeholder:text-slate-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center text-sm">📊</span>
                  Your GPA
                </label>
                <input
                  type="text"
                  value={requirements.minGPA}
                  onChange={(e) => handleChange('minGPA', e.target.value)}
                  placeholder="e.g., 3.5 out of 4.0"
                  className="w-full px-5 py-4 rounded-2xl border-2 border-slate-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all outline-none text-slate-800 placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Row 3: English Test and Score */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center text-sm">📝</span>
                  English Test
                </label>
                <select
                  value={requirements.englishTest}
                  onChange={(e) => {
                    handleChange('englishTest', e.target.value);
                    handleChange('englishScore', ''); // Reset score when test changes
                  }}
                  className="w-full px-5 py-4 rounded-2xl border-2 border-slate-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all outline-none bg-white text-slate-800 cursor-pointer"
                >
                  <option value="TOEFL">TOEFL iBT (0-120)</option>
                  <option value="IELTS">IELTS Academic (0-9)</option>
                  <option value="Duolingo">Duolingo English Test (10-160)</option>
                  <option value="None">No Test Yet</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 flex items-center justify-center text-sm">📈</span>
                  Your {requirements.englishTest === 'None' ? 'Score' : requirements.englishTest} Score
                </label>
                {requirements.englishTest === 'IELTS' ? (
                  <select
                    value={requirements.englishScore}
                    onChange={(e) => handleChange('englishScore', e.target.value)}
                    className="w-full px-5 py-4 rounded-2xl border-2 border-slate-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all outline-none bg-white text-slate-800 cursor-pointer"
                  >
                    <option value="">Select IELTS Band</option>
                    <option value="9.0">9.0 - Expert</option>
                    <option value="8.5">8.5</option>
                    <option value="8.0">8.0 - Very Good</option>
                    <option value="7.5">7.5</option>
                    <option value="7.0">7.0 - Good</option>
                    <option value="6.5">6.5</option>
                    <option value="6.0">6.0 - Competent</option>
                    <option value="5.5">5.5</option>
                    <option value="5.0">5.0 - Modest</option>
                    <option value="4.5">4.5</option>
                    <option value="4.0">4.0 - Limited</option>
                  </select>
                ) : requirements.englishTest === 'None' ? (
                  <div className="w-full px-5 py-4 rounded-2xl border-2 border-slate-200 bg-slate-50 text-slate-400">
                    No test selected
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="number"
                      value={requirements.englishScore}
                      onChange={(e) => handleChange('englishScore', e.target.value)}
                      placeholder={requirements.englishTest === 'TOEFL' ? '0-120' : '10-160'}
                      min={requirements.englishTest === 'TOEFL' ? 0 : 10}
                      max={requirements.englishTest === 'TOEFL' ? 120 : 160}
                      className="w-full px-5 py-4 rounded-2xl border-2 border-slate-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all outline-none text-slate-800 placeholder:text-slate-400"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                      {requirements.englishTest === 'TOEFL' ? '/ 120' : '/ 160'}
                    </span>
                  </div>
                )}
                {requirements.englishTest !== 'None' && requirements.englishTest !== 'IELTS' && (
                  <p className="mt-1 text-xs text-slate-500">
                    {requirements.englishTest === 'TOEFL'
                      ? 'Most universities require 80-100+'
                      : 'Most universities require 105-120+'}
                  </p>
                )}
              </div>
            </div>

            {/* Country Selection */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-rose-100 flex items-center justify-center text-sm">🌍</span>
                Preferred Country
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {countries.map((country) => (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => handleChange('country', country.code)}
                    className={`p-4 rounded-2xl border-2 transition-all flex items-center gap-3 ${
                      requirements.country === country.code
                        ? 'border-purple-500 bg-purple-50 shadow-lg shadow-purple-500/20'
                        : 'border-slate-200 hover:border-purple-300 hover:bg-purple-50/50'
                    }`}
                  >
                    <span className="text-2xl">{country.flag}</span>
                    <span className={`font-medium ${requirements.country === country.code ? 'text-purple-700' : 'text-slate-700'}`}>
                      {country.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Scholarship Preference */}
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={requirements.preferScholarship}
                  onChange={(e) => handleChange('preferScholarship', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-amber-400 peer-checked:to-yellow-500"></div>
              </label>
              <div>
                <span className="font-semibold text-slate-700 flex items-center gap-2">
                  <span>🎓</span> Prioritize Universities with Scholarships
                </span>
                <p className="text-sm text-slate-500">Find schools offering financial aid and scholarships</p>
              </div>
            </div>

            {/* Find Button */}
            <button
              onClick={handleFind}
              disabled={loading}
              className="w-full py-5 rounded-2xl bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 bg-[length:200%_100%] text-white font-bold text-lg shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 btn-shine"
            >
              {loading ? (
                <>
                  <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>RAG is Searching...</span>
                </>
              ) : (
                <>
                  <span className="text-xl">🎯</span>
                  <span>Find My Perfect Universities</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Results Section */}
      {results.length > 0 && (
        <div className="space-y-6 slide-up">
          {/* Results Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-xl shadow-lg">
                🎉
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">Best Matches Found!</h3>
                <p className="text-slate-500">
                  Top {results.length} from {totalInDatabase} universities (RAG Search)
                </p>
              </div>
            </div>
            <div className="px-4 py-2 rounded-full bg-emerald-100 text-emerald-700 text-sm font-medium">
              Local AI Search
            </div>
          </div>

          {/* University Cards */}
          <div className="grid gap-6">
            {results.map((uni, index) => (
              <div
                key={index}
                className="relative overflow-hidden bg-white rounded-3xl shadow-lg border border-slate-100 card-hover"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Rank Badge */}
                <div className="absolute top-4 left-4 w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-lg shadow-lg">
                  #{index + 1}
                </div>

                {/* Match Score Badge */}
                <div className={`absolute top-0 right-0 px-6 py-3 rounded-bl-2xl font-bold text-white bg-gradient-to-r ${getScoreColor(uni.match_score)}`}>
                  <div className="text-2xl">{uni.match_score}%</div>
                  <div className="text-xs opacity-90">Match</div>
                </div>

                <div className="p-6 pt-8">
                  {/* University Name & Location */}
                  <div className="flex items-center gap-3 mb-4 pl-12 pr-24">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center text-xl">
                      🏛️
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-slate-800">{uni.name}</h4>
                      <p className="text-slate-500">{uni.country} • {uni.field} • {uni.degree}</p>
                    </div>
                  </div>

                  {/* Score Breakdown - Visual Bars */}
                  {uni.score_breakdown && (
                    <div className="mb-6 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                      <p className="text-sm font-semibold text-slate-600 mb-3">Match Score Breakdown</p>
                      <div className="space-y-3">
                        {/* Semantic Similarity */}
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-slate-600">🧠 Meaning Match</span>
                            <span className="font-semibold text-purple-600">{uni.score_breakdown.semantic_similarity}%</span>
                          </div>
                          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                              style={{ width: `${uni.score_breakdown.semantic_similarity}%` }}
                            />
                          </div>
                        </div>
                        {/* Budget Fit */}
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-slate-600">💰 Budget Fit</span>
                            <span className="font-semibold text-emerald-600">{uni.score_breakdown.budget_fit}%</span>
                          </div>
                          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
                              style={{ width: `${uni.score_breakdown.budget_fit}%` }}
                            />
                          </div>
                        </div>
                        {/* GPA Fit */}
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-slate-600">📊 GPA Qualification</span>
                            <span className="font-semibold text-blue-600">{uni.score_breakdown.gpa_fit}%</span>
                          </div>
                          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
                              style={{ width: `${uni.score_breakdown.gpa_fit}%` }}
                            />
                          </div>
                        </div>
                        {/* Field Match */}
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-slate-600">🎯 Field Match</span>
                            <span className="font-semibold text-amber-600">{uni.score_breakdown.field_match}%</span>
                          </div>
                          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500"
                              style={{ width: `${uni.score_breakdown.field_match}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Quick Info Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100">
                      <div className="flex items-center gap-2 text-green-600 text-sm font-medium mb-1">
                        <span>💰</span> Tuition
                      </div>
                      <p className="font-bold text-slate-800">{uni.tuition}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100">
                      <div className="flex items-center gap-2 text-purple-600 text-sm font-medium mb-1">
                        <span>📊</span> GPA Required
                      </div>
                      <p className="font-bold text-slate-800">{uni.gpa_required || 'Contact school'}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100">
                      <div className="flex items-center gap-2 text-blue-600 text-sm font-medium mb-1">
                        <span>🎓</span> Program
                      </div>
                      <p className="font-bold text-slate-800">{uni.degree}</p>
                    </div>
                  </div>

                  {/* Reasons */}
                  {uni.reasons && uni.reasons.length > 0 && (
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-50 via-purple-50 to-pink-50 border border-purple-100">
                      <div className="flex items-start gap-3">
                        <span className="text-xl">✅</span>
                        <div>
                          <p className="font-semibold text-purple-700 mb-2">Why This University Matches</p>
                          <ul className="space-y-1">
                            {uni.reasons.map((reason, i) => (
                              <li key={i} className="text-slate-600 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                                {reason}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* How RAG Works Explanation */}
          <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-800 to-slate-900 text-white">
            <h4 className="text-lg font-bold mb-3 flex items-center gap-2">
              <span>🤖</span> How This Search Works (RAG Technology)
            </h4>
            <div className="grid md:grid-cols-4 gap-4 text-sm">
              <div className="p-3 rounded-xl bg-white/10">
                <div className="text-2xl mb-2">1️⃣</div>
                <p><strong>Your Input</strong> is converted to numbers (384-dimensional vector)</p>
              </div>
              <div className="p-3 rounded-xl bg-white/10">
                <div className="text-2xl mb-2">2️⃣</div>
                <p><strong>Vector Search</strong> finds universities with similar meaning</p>
              </div>
              <div className="p-3 rounded-xl bg-white/10">
                <div className="text-2xl mb-2">3️⃣</div>
                <p><strong>Criteria Check</strong> scores budget, GPA, and field match</p>
              </div>
              <div className="p-3 rounded-xl bg-white/10">
                <div className="text-2xl mb-2">4️⃣</div>
                <p><strong>Final Score</strong> = 40% semantic + 60% criteria</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
