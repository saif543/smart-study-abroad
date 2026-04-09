'use client';

import { useState } from 'react';

interface SearchResult {
  source: 'cache' | 'claude' | 'error';
  data?: Record<string, string>;
  descriptive?: string;
  data_year?: number;
  official_name?: string;
  key_data?: string;
  query_type?: string;
}

interface SearchTabProps {
  onAIMessage: (message: string) => void;
}

// Data field options with icons and labels
const dataFields = [
  { key: 'tuition_fees', label: 'Tuition Fees', icon: '💰' },
  { key: 'deadline_fall', label: 'Fall Deadline', icon: '🍂' },
  { key: 'deadline_spring', label: 'Spring Deadline', icon: '🌸' },
  { key: 'deadline_summer', label: 'Summer Deadline', icon: '☀️' },
  { key: 'english_requirements', label: 'IELTS/TOEFL', icon: '📝' },
  { key: 'gpa_requirement', label: 'GPA', icon: '📊' },
  { key: 'test_requirements', label: 'GRE/GMAT', icon: '📈' },
  { key: 'scholarships', label: 'Scholarships', icon: '🎓' },
  { key: 'program_duration', label: 'Duration', icon: '⏱️' },
];

export default function SearchTab({ onAIMessage }: SearchTabProps) {
  const [university, setUniversity] = useState('');
  const [degree, setDegree] = useState<'Bachelor' | 'Master' | 'PhD'>('Master');
  const [field, setField] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Selected data fields to display
  const [selectedFields, setSelectedFields] = useState<Record<string, boolean>>({
    tuition_fees: true,
    deadline_fall: true,
    deadline_spring: true,
    deadline_summer: true,
    english_requirements: true,
    gpa_requirement: true,
    test_requirements: true,
    scholarships: true,
    program_duration: true,
  });

  // Toggle individual field
  const toggleField = (key: string) => {
    setSelectedFields(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Select all / Deselect all
  const toggleAllFields = (selectAll: boolean) => {
    const newState: Record<string, boolean> = {};
    dataFields.forEach(f => { newState[f.key] = selectAll; });
    setSelectedFields(newState);
  };

  // Check if at least one field is selected
  const hasSelectedFields = Object.values(selectedFields).some(v => v);

  const handleSearch = async () => {
    if (!university || !field) {
      onAIMessage('Please enter university name and field of study');
      return;
    }

    if (!hasSelectedFields) {
      onAIMessage('Please select at least one data field');
      return;
    }

    setLoading(true);
    setShowDetails(false);
    onAIMessage(`Searching for ${university} - ${degree} in ${field}...`);

    try {
      // Always fetch all 7 data points, filter display based on selectedFields
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          university,
          degree,
          field,
          question: 'all',
          fetchAll: true,
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
    setShowDetails(false);
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

            {/* Data Fields Selection - 7 Checkboxes */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100">
              <div className="flex items-center justify-between mb-4">
                <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center text-sm">📋</span>
                  Select Data to Display
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => toggleAllFields(true)}
                    className="px-3 py-1 text-xs font-semibold bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleAllFields(false)}
                    className="px-3 py-1 text-xs font-semibold bg-slate-300 text-slate-700 rounded-lg hover:bg-slate-400 transition-colors"
                  >
                    None
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {dataFields.map((item) => (
                  <label
                    key={item.key}
                    className={`flex items-center gap-2 p-3 rounded-xl cursor-pointer transition-all ${
                      selectedFields[item.key]
                        ? 'bg-purple-500 text-white shadow-md'
                        : 'bg-white text-slate-700 hover:bg-purple-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedFields[item.key]}
                      onChange={() => toggleField(item.key)}
                      className="sr-only"
                    />
                    <span className="text-lg">{item.icon}</span>
                    <span className="text-xs font-medium">{item.label}</span>
                  </label>
                ))}
              </div>

              <p className="text-xs text-slate-500 mt-3 text-center">
                AI fetches all data & stores in database, shows only your selected items
              </p>
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

              {/* Key Data Points - Shown First */}
              {result.data && (
                <div className="space-y-4 mb-6">
                  <h4 className="font-bold text-slate-800 flex items-center gap-2">
                    <span>💾</span> Key Data Points
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(result.data).map(([key, value]) => {
                      if (key === 'data_year' || !value || !selectedFields[key]) return null;
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

              {/* Expandable Detailed Information */}
              {result.descriptive && (
                <div className="mb-6">
                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="w-full p-4 bg-white/60 rounded-2xl border border-slate-200 hover:bg-white/80 transition-all flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">📖</span>
                      <span className="font-bold text-slate-800">Detailed Information & Sources</span>
                    </div>
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white transition-transform duration-300 ${showDetails ? 'rotate-180' : ''}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {/* Collapsible Content */}
                  <div className={`overflow-hidden transition-all duration-500 ease-in-out ${showDetails ? 'max-h-[3000px] opacity-100 mt-4' : 'max-h-0 opacity-0'}`}>
                    <div className="p-6 bg-white/60 rounded-2xl border border-slate-200">
                      <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap leading-relaxed">
                        {result.descriptive}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-4">
                {result.source === 'cache' && (
                  <button
                    onClick={handleUpdate}
                    disabled={loading}
                    className="px-8 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    <span>🔄</span> Refresh Data from AI
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
