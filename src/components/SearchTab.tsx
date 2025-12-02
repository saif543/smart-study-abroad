'use client';

import { useState } from 'react';

interface SearchResult {
  source: 'cache' | 'claude' | 'error';
  data?: Record<string, string>;
  descriptive?: string;
  data_year?: number;
  official_name?: string;
}

interface SearchTabProps {
  onAIMessage: (message: string) => void;
}

export default function SearchTab({ onAIMessage }: SearchTabProps) {
  const [university, setUniversity] = useState('');
  const [degree, setDegree] = useState<'Bachelor' | 'Master' | 'PhD'>('Master');
  const [field, setField] = useState('');
  const [question, setQuestion] = useState('');
  const [fetchAll, setFetchAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);

  const handleSearch = async () => {
    if (!university || !field) {
      onAIMessage('Please enter university name and field of study');
      return;
    }

    if (!fetchAll && !question) {
      onAIMessage('Please enter your question or check "Fetch ALL" box');
      return;
    }

    setLoading(true);
    onAIMessage(`Searching for ${university} - ${degree} in ${field}...`);

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          university,
          degree,
          field,
          question: fetchAll ? 'all' : question,
          fetchAll,
        }),
      });

      const data = await response.json();
      setResult(data);

      if (data.source === 'cache') {
        onAIMessage(`Found data from database (${data.data_year || 'N/A'})`);
      } else if (data.source === 'claude') {
        onAIMessage('Fresh data fetched from AI and stored in database');
      } else {
        onAIMessage(`Error: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      onAIMessage(`Error: ${error}`);
      setResult({ source: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    setLoading(true);
    onAIMessage('Fetching fresh data from AI...');

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          university,
          degree,
          field,
          fetchAll: true,
          forceRefresh: true,
        }),
      });

      const data = await response.json();
      setResult(data);
      onAIMessage('Data updated successfully!');
    } catch (error) {
      onAIMessage(`Error updating: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const dataIcons: Record<string, string> = {
    tuition_fees: '💰',
    deadline_spring: '🌸',
    deadline_summer: '☀️',
    deadline_fall: '🍂',
    english_requirements: '📝',
    gpa_requirement: '📊',
    test_requirements: '📈',
    scholarships: '🎓',
    program_duration: '⏱️',
    data_year: '📅',
  };

  return (
    <div className="space-y-8 slide-up">
      {/* Search Form Card */}
      <div className="relative overflow-hidden bg-white rounded-3xl shadow-xl border border-slate-100">
        {/* Decorative gradient bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500" />

        <div className="p-8">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-2xl shadow-lg">
              🔍
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800">University Search</h2>
              <p className="text-slate-500">Find detailed information about any university program</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* University Input */}
            <div className="group">
              <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center text-sm">🏛️</span>
                University Name
              </label>
              <input
                type="text"
                value={university}
                onChange={(e) => setUniversity(e.target.value)}
                placeholder="e.g., MIT, Harvard, Stanford"
                className="w-full px-5 py-4 rounded-2xl border-2 border-slate-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all outline-none text-slate-800 placeholder:text-slate-400 input-focus"
              />
            </div>

            {/* Degree and Field */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-pink-100 flex items-center justify-center text-sm">📚</span>
                  Degree Level
                </label>
                <select
                  value={degree}
                  onChange={(e) => setDegree(e.target.value as 'Bachelor' | 'Master' | 'PhD')}
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
                  value={field}
                  onChange={(e) => setField(e.target.value)}
                  placeholder="e.g., Computer Science, MBA"
                  className="w-full px-5 py-4 rounded-2xl border-2 border-slate-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all outline-none text-slate-800 placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Question Input */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center text-sm">❓</span>
                What do you want to know?
              </label>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g., tuition fees, admission requirements, application deadlines"
                rows={3}
                disabled={fetchAll}
                className="w-full px-5 py-4 rounded-2xl border-2 border-slate-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all outline-none text-slate-800 placeholder:text-slate-400 disabled:bg-slate-50 disabled:cursor-not-allowed resize-none"
              />
            </div>

            {/* Fetch All Toggle */}
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={fetchAll}
                  onChange={(e) => setFetchAll(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-purple-500 peer-checked:to-pink-500"></div>
              </label>
              <div>
                <span className="font-semibold text-slate-700">Fetch ALL 7 Data Points</span>
                <p className="text-sm text-slate-500">Get tuition, deadlines, requirements, scholarships & more</p>
              </div>
            </div>

            {/* Search Button */}
            <button
              onClick={handleSearch}
              disabled={loading}
              className="w-full py-5 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600 bg-[length:200%_100%] text-white font-bold text-lg shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 btn-shine"
            >
              {loading ? (
                <>
                  <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <span className="text-xl">🔍</span>
                  <span>Search University</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Results Card */}
      {result && result.source !== 'error' && (
        <div className="slide-up">
          <div className={`relative overflow-hidden rounded-3xl shadow-xl border-2 ${
            result.source === 'cache'
              ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200'
              : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200'
          }`}>
            {/* Status Badge */}
            <div className={`absolute top-6 right-6 px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 ${
              result.source === 'cache'
                ? 'bg-emerald-500 text-white'
                : 'bg-blue-500 text-white'
            }`}>
              {result.source === 'cache' ? (
                <><span>⚡</span> From Cache</>
              ) : (
                <><span>🌐</span> Fresh Data</>
              )}
            </div>

            <div className="p-8">
              {/* Header */}
              <div className="flex items-center gap-4 mb-6">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-lg ${
                  result.source === 'cache' ? 'bg-emerald-500' : 'bg-blue-500'
                }`}>
                  {result.source === 'cache' ? '⚡' : '🌐'}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800">
                    {result.official_name || university}
                  </h3>
                  {result.data_year && (
                    <p className="text-slate-500 flex items-center gap-2">
                      <span>📅</span> Data from {result.data_year}
                    </p>
                  )}
                </div>
              </div>

              {result.official_name && result.official_name.toLowerCase() !== university.toLowerCase() && (
                <div className="mb-6 p-4 bg-blue-100 rounded-2xl border border-blue-200 flex items-center gap-3">
                  <span className="text-2xl">💡</span>
                  <div>
                    <p className="font-semibold text-blue-800">Pro Tip</p>
                    <p className="text-blue-700 text-sm">Use &quot;{result.official_name}&quot; for faster future searches</p>
                  </div>
                </div>
              )}

              {result.descriptive && (
                <div className="mb-6 p-6 bg-white/60 rounded-2xl border border-slate-200">
                  <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <span>📖</span> Detailed Information
                  </h4>
                  <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {result.descriptive}
                  </div>
                </div>
              )}

              {result.data && (
                <div className="space-y-4">
                  <h4 className="font-bold text-slate-800 flex items-center gap-2">
                    <span>💾</span> Key Data Points
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(result.data).map(([key, value]) => {
                      if (key === 'data_year') return null;
                      return (
                        <div key={key} className="p-4 bg-white/80 rounded-2xl border border-slate-200 card-hover">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-2xl">{dataIcons[key] || '📌'}</span>
                            <span className="font-semibold text-slate-700 capitalize">
                              {key.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <p className="text-slate-800 bg-slate-100 p-3 rounded-xl text-sm font-mono">
                            {value || 'Not found'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {result.source === 'cache' && (
                <button
                  onClick={handleUpdate}
                  disabled={loading}
                  className="mt-6 px-8 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  <span>🔄</span> Refresh Data from AI
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
