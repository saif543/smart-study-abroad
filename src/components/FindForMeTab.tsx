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

interface MatchedUniversity {
  name: string;
  match_score: number;
  tuition: string;
  deadline: string;
  requirements: string;
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

  const handleChange = (field: keyof Requirements, value: string | boolean) => {
    setRequirements(prev => ({ ...prev, [field]: value }));
  };

  const handleFind = async () => {
    if (!requirements.field) {
      onAIMessage('Please enter your field of study');
      return;
    }

    setLoading(true);
    onAIMessage('AI is searching for universities matching your requirements...');

    try {
      const response = await fetch('/api/findme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requirements),
      });

      const data = await response.json();

      if (data.universities) {
        setResults(data.universities);
        onAIMessage(`Found ${data.universities.length} universities matching your criteria!`);
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
              <p className="text-slate-500">Let AI match you with perfect universities</p>
            </div>
          </div>

          {/* Description Card */}
          <div className="mb-8 p-4 rounded-2xl bg-gradient-to-r from-cyan-50 via-purple-50 to-pink-50 border border-purple-100">
            <div className="flex items-center gap-3">
              <span className="text-2xl">✨</span>
              <p className="text-slate-600">
                Enter your academic profile and preferences, and our AI will find universities that match your criteria.
              </p>
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
                  onChange={(e) => handleChange('englishTest', e.target.value)}
                  className="w-full px-5 py-4 rounded-2xl border-2 border-slate-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all outline-none bg-white text-slate-800 cursor-pointer"
                >
                  <option value="TOEFL">TOEFL iBT</option>
                  <option value="IELTS">IELTS Academic</option>
                  <option value="Duolingo">Duolingo English Test</option>
                  <option value="None">No Test Yet</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 flex items-center justify-center text-sm">📈</span>
                  Your Score
                </label>
                <input
                  type="text"
                  value={requirements.englishScore}
                  onChange={(e) => handleChange('englishScore', e.target.value)}
                  placeholder={requirements.englishTest === 'IELTS' ? 'e.g., 7.0' : requirements.englishTest === 'TOEFL' ? 'e.g., 100' : 'e.g., 120'}
                  className="w-full px-5 py-4 rounded-2xl border-2 border-slate-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all outline-none text-slate-800 placeholder:text-slate-400"
                />
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
                  <span>AI is Finding Universities...</span>
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
                <h3 className="text-xl font-bold text-slate-800">Matched Universities</h3>
                <p className="text-slate-500">{results.length} universities found for you</p>
              </div>
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
                {/* Match Score Badge */}
                <div className={`absolute top-0 right-0 px-6 py-2 rounded-bl-2xl font-bold text-white ${
                  uni.match_score >= 90 ? 'bg-gradient-to-r from-emerald-500 to-teal-500' :
                  uni.match_score >= 75 ? 'bg-gradient-to-r from-blue-500 to-indigo-500' :
                  'bg-gradient-to-r from-amber-500 to-orange-500'
                }`}>
                  {uni.match_score}% Match
                </div>

                <div className="p-6">
                  {/* University Name */}
                  <div className="flex items-center gap-3 mb-4 pr-24">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center text-xl">
                      🏛️
                    </div>
                    <h4 className="text-xl font-bold text-slate-800">{uni.name}</h4>
                  </div>

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
                        <span>📅</span> Deadline
                      </div>
                      <p className="font-bold text-slate-800">{uni.deadline}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100">
                      <div className="flex items-center gap-2 text-blue-600 text-sm font-medium mb-1">
                        <span>📝</span> Requirements
                      </div>
                      <p className="font-bold text-slate-800">{uni.requirements}</p>
                    </div>
                  </div>

                  {/* Why Matched */}
                  {uni.why_matched && (
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-50 via-purple-50 to-pink-50 border border-purple-100">
                      <div className="flex items-start gap-3">
                        <span className="text-xl">✨</span>
                        <div>
                          <p className="font-semibold text-purple-700 mb-1">Why This University Matches</p>
                          <p className="text-slate-600">{uni.why_matched}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
