'use client';

import { useState, useRef, useEffect } from 'react';
import CostCalculator from './CostCalculator';

interface Requirements {
  degree: string;
  field: string;
  maxTuition: string;
  minGPA: string;
  englishTest: string;
  englishScore: string;
  country: string;
  preferScholarship: boolean;
  freeText: string;
}

interface RequirementCheck {
  label: string;
  passed: boolean;
  yours: string;
  needs: string;
  tip?: string | null;
}

export interface MatchedUniversity {
  name: string;
  country: string;
  match_score: number;
  tuition: string;
  tuition_fees?: number;
  field: string;
  degree: string;
  gpa_required?: number;
  ielts: number;
  toefl: number;
  scholarships: string;
  deadline_fall: string;
  deadline_spring: string;
  test_requirements: string;
  program_duration: string;
  english_requirements: string;
  qs_ranking: string;
  acceptance_rate?: number;
  fit_label?: string;
  requirement_checks?: RequirementCheck[];
  living_cost: number;
  total_cost_estimated: number;
  max_coverage_percent: number;
  work_visa_available: number;
  research_weight: number;
  eca_weight: number;
  research_focus: string;
  programs_offered: string;
  score_breakdown?: Record<string, number>;
  reasons?: string[];
}

interface FindForMeTabProps {
  onAIMessage: (message: string) => void;
  onRAGResults?: (results: MatchedUniversity[]) => void;
}

export default function FindForMeTab({ onAIMessage, onRAGResults }: FindForMeTabProps) {
  const [requirements, setRequirements] = useState<Requirements>({
    degree: 'Master',
    field: '',
    maxTuition: '',
    minGPA: '',
    englishTest: 'TOEFL',
    englishScore: '',
    country: 'USA',
    preferScholarship: false,
    freeText: '',
  });
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<MatchedUniversity[]>([]);
  const [totalInDatabase, setTotalInDatabase] = useState(0);
  const [expandedCard, setExpandedCard] = useState<number | null>(null);
  const [chatMessages, setChatMessages] = useState<{id: string; text: string; sender: 'user' | 'ai'; timestamp: Date}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [costCard, setCostCard] = useState<MatchedUniversity | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleChatSend = async (messageText?: string) => {
    const text = messageText || chatInput.trim();
    if (!text || chatLoading) return;

    const userMsg = { id: Date.now().toString(), text, sender: 'user' as const, timestamp: new Date() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);

    const aiMsgId = (Date.now() + 1).toString();
    setChatMessages(prev => [...prev, { id: aiMsgId, text: '', sender: 'ai' as const, timestamp: new Date() }]);

    try {
      const history = chatMessages.map(m => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text,
      }));

      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history, rag_context: results }),
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.token) {
                accumulated += data.token;
                setChatMessages(prev =>
                  prev.map(m => m.id === aiMsgId ? { ...m, text: accumulated } : m)
                );
              }
              if (data.done) break;
              if (data.error) {
                accumulated += data.error;
                setChatMessages(prev =>
                  prev.map(m => m.id === aiMsgId ? { ...m, text: accumulated } : m)
                );
              }
            } catch { /* skip malformed SSE lines */ }
          }
        }
      }

      if (!accumulated) {
        setChatMessages(prev =>
          prev.map(m => m.id === aiMsgId ? { ...m, text: 'No response received. Is Ollama running?' } : m)
        );
      }
    } catch {
      setChatMessages(prev =>
        prev.map(m => m.id === aiMsgId ? { ...m, text: 'Failed to get a response. Is the backend running?' } : m)
      );
    } finally {
      setChatLoading(false);
    }
  };

  const handleChange = (field: keyof Requirements, value: string | boolean) => {
    setRequirements(prev => ({ ...prev, [field]: value }));
  };

  const handleFind = async () => {
    if (!requirements.field) {
      onAIMessage('Please enter your field of study');
      return;
    }

    setLoading(true);
    setChatMessages([]);
    setChatInput('');
    onAIMessage('Searching universities with RAG...');

    try {
      const response = await fetch('/api/findme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...requirements, top_k: 5 }),
      });

      const data = await response.json();

      if (data.universities && data.universities.length > 0) {
        setResults(data.universities);
        setTotalInDatabase(data.total_in_database || 0);
        onAIMessage(`Found ${data.universities.length} best matches from ${data.total_in_database} universities`);
        onRAGResults?.(data.universities);
      } else {
        onAIMessage(data.error || 'No universities found matching your criteria');
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
    { code: 'USA', name: 'USA', flag: '🇺🇸' },
    { code: 'UK', name: 'UK', flag: '🇬🇧' },
    { code: 'Canada', name: 'Canada', flag: '🇨🇦' },
    { code: 'Australia', name: 'Australia', flag: '🇦🇺' },
    { code: 'Germany', name: 'Germany', flag: '🇩🇪' },
    { code: 'Any', name: 'Any', flag: '🌍' },
  ];

  const getFitColor = (label: string) => {
    switch (label) {
      case 'Strong Fit': return { text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', ring: 'ring-emerald-500' };
      case 'Good Fit': return { text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', ring: 'ring-blue-500' };
      case 'Possible Fit': return { text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', ring: 'ring-amber-500' };
      default: return { text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', ring: 'ring-red-500' };
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-amber-600';
    return 'text-slate-500';
  };

  return (
    <div className="space-y-6 slide-up">
      {/* Search Form */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-5">Find Universities For Me</h2>

        <textarea
          value={requirements.freeText}
          onChange={(e) => handleChange('freeText', e.target.value)}
          placeholder="Describe what you're looking for (optional)..."
          rows={2}
          className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 outline-none text-sm text-slate-800 placeholder:text-slate-400 resize-none mb-5"
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Degree</label>
            <select value={requirements.degree} onChange={(e) => handleChange('degree', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white text-slate-800 focus:border-purple-500 outline-none">
              <option value="Master">Master&apos;s</option>
              <option value="PhD">PhD / Research</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Field of Study</label>
            <select value={requirements.field} onChange={(e) => handleChange('field', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white text-slate-800 focus:border-purple-500 outline-none">
              <option value="">Select a field...</option>
              <option value="Computer Science">Computer Science</option>
              <option value="Engineering">Engineering</option>
              <option value="Business">Business</option>
              <option value="Medicine">Medicine</option>
              <option value="Sciences">Sciences</option>
              <option value="Law">Law</option>
              <option value="Economics">Economics</option>
              <option value="Mathematics">Mathematics</option>
              <option value="Physics">Physics</option>
              <option value="Biology">Biology</option>
              <option value="Chemistry">Chemistry</option>
              <option value="Social Sciences">Social Sciences</option>
              <option value="Humanities">Humanities</option>
              <option value="Arts And Humanities">Arts &amp; Humanities</option>
              <option value="Education">Education</option>
              <option value="Environmental Science">Environmental Science</option>
              <option value="Public Health">Public Health</option>
              <option value="Architecture">Architecture</option>
              <option value="Agriculture">Agriculture</option>
              <option value="Informatics">Informatics</option>
              <option value="Biotech">Biotech</option>
              <option value="Robotics">Robotics</option>
              <option value="Management">Management</option>
              <option value="Design">Design</option>
              <option value="Journalism">Journalism</option>
              <option value="International Relations">International Relations</option>
              <option value="Public Policy">Public Policy</option>
              <option value="Materials Science">Materials Science</option>
              <option value="Marine Sciences">Marine Sciences</option>
              <option value="Film And Media">Film &amp; Media</option>
              <option value="Game Design">Game Design</option>
              <option value="Tourism">Tourism</option>
              <option value="Hotel Management">Hotel Management</option>
              <option value="Energy">Energy</option>
              <option value="Astronomy">Astronomy</option>
              <option value="Computing">Computing</option>
              <option value="Politics">Politics</option>
              <option value="Arts">Arts</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Your GPA</label>
            <input type="text" value={requirements.minGPA} onChange={(e) => handleChange('minGPA', e.target.value)}
              placeholder="e.g., 3.5"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:border-purple-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Max Budget ($/year)</label>
            <input type="text" value={requirements.maxTuition} onChange={(e) => handleChange('maxTuition', e.target.value)}
              placeholder="e.g., 50000"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:border-purple-500 outline-none" />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">English Test</label>
            <select value={requirements.englishTest} onChange={(e) => { handleChange('englishTest', e.target.value); handleChange('englishScore', ''); }}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white text-slate-800 focus:border-purple-500 outline-none">
              <option value="TOEFL">TOEFL</option>
              <option value="IELTS">IELTS</option>
              <option value="None">No Test</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Score</label>
            {requirements.englishTest === 'IELTS' ? (
              <select value={requirements.englishScore} onChange={(e) => handleChange('englishScore', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white text-slate-800 focus:border-purple-500 outline-none">
                <option value="">Select</option>
                {['9.0','8.5','8.0','7.5','7.0','6.5','6.0','5.5','5.0'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            ) : requirements.englishTest === 'None' ? (
              <div className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-400 text-sm">N/A</div>
            ) : (
              <input type="number" value={requirements.englishScore} onChange={(e) => handleChange('englishScore', e.target.value)}
                placeholder="0-120" min={0} max={120}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:border-purple-500 outline-none" />
            )}
          </div>
          <div className="col-span-2 flex items-end">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600">
              <input type="checkbox" checked={requirements.preferScholarship}
                onChange={(e) => handleChange('preferScholarship', e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-purple-500" />
              Prefer scholarships
            </label>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-5">
          {countries.map((c) => (
            <button key={c.code} type="button" onClick={() => handleChange('country', c.code)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                requirements.country === c.code
                  ? 'bg-purple-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>
              {c.flag} {c.name}
            </button>
          ))}
        </div>

        <button onClick={handleFind} disabled={loading}
          className="w-full py-3 rounded-xl bg-purple-600 text-white font-semibold text-sm hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? (
            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Searching...</>
          ) : 'Find Best Matches'}
        </button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-baseline gap-2 px-1">
            <h3 className="text-base font-bold text-slate-800">Top {results.length} Matches</h3>
            <span className="text-xs text-slate-400">from {totalInDatabase} universities</span>
          </div>

          {results.map((uni, index) => {
            const checks = uni.requirement_checks || [];
            const fitColor = getFitColor(uni.fit_label || 'Reach');
            const passedCount = checks.filter(c => c.passed).length;
            const isExpanded = expandedCard === index;

            return (
              <div key={index} className={`bg-white rounded-xl border overflow-hidden transition-all ${isExpanded ? 'border-slate-300 shadow-md' : 'border-slate-200'}`}>
                {/* Main card */}
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    {/* Match score circle */}
                    <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                      <div className={`w-12 h-12 rounded-full flex flex-col items-center justify-center ${getScoreColor(uni.match_score) === 'text-emerald-600' ? 'bg-emerald-50' : getScoreColor(uni.match_score) === 'text-blue-600' ? 'bg-blue-50' : getScoreColor(uni.match_score) === 'text-amber-600' ? 'bg-amber-50' : 'bg-slate-50'}`}>
                        <span className={`text-base font-bold leading-none ${getScoreColor(uni.match_score)}`}>{Math.round(uni.match_score)}</span>
                        <span className="text-[8px] text-slate-400 mt-0.5">match</span>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-slate-800 text-[15px] leading-tight">{uni.name}</h4>
                          <p className="text-xs text-slate-500 mt-0.5">{uni.field} &middot; {uni.country}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {uni.qs_ranking && (
                            <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">QS #{uni.qs_ranking}</span>
                          )}
                          {uni.fit_label && (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${fitColor.bg} ${fitColor.text} border ${fitColor.border}`}>
                              {uni.fit_label}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Key info row */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2.5 text-xs text-slate-600">
                        <span className="font-medium text-slate-700">{uni.tuition}</span>
                        {uni.scholarships && uni.scholarships !== 'N/A' && (
                          <span className="text-purple-600">Scholarships available</span>
                        )}
                        {Number(uni.work_visa_available) === 1 && (
                          <span className="text-emerald-600">Work visa</span>
                        )}
                      </div>

                      {/* Requirement checklist - compact */}
                      {checks.length > 0 && (
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
                          {checks.map((check, i) => (
                            <span key={i} className={`text-xs flex items-center gap-1 ${check.passed ? 'text-emerald-600' : 'text-red-500'}`}>
                              {check.passed ? (
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                              ) : (
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                              )}
                              <span className="font-medium">{check.label}</span>
                              <span className="text-slate-400 font-normal">({check.yours} / {check.needs})</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action row */}
                  <div className="flex items-center gap-3 mt-4 pt-3 border-t border-slate-100">
                    <button onClick={() => setExpandedCard(isExpanded ? null : index)}
                      className="text-xs text-purple-600 hover:text-purple-800 font-medium transition-colors">
                      {isExpanded ? 'Hide details' : 'View details'}
                    </button>
                    <button onClick={() => setCostCard(uni)}
                      className="text-xs text-emerald-600 hover:text-emerald-800 font-medium transition-colors">
                      Cost breakdown
                    </button>
                    <div className="ml-auto text-[10px] text-slate-400">
                      {passedCount}/{checks.length} requirements met
                    </div>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-5 space-y-5">

                    {/* Gap tips - only show if there are failures */}
                    {checks.some(c => !c.passed && c.tip) && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">What to improve</p>
                        {checks.filter(c => !c.passed && c.tip).map((check, i) => (
                          <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-100">
                            <svg className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                            <span className="text-xs text-amber-800">{check.tip}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* University details - clean table */}
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">University Details</p>
                      <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
                        {[
                          { label: 'Tuition', value: uni.tuition },
                          { label: 'GPA Required', value: uni.gpa_required && Number(uni.gpa_required) > 0 ? String(uni.gpa_required) : null },
                          { label: 'English', value: uni.english_requirements || null },
                          { label: 'Scholarships', value: uni.scholarships && uni.scholarships !== 'N/A' ? uni.scholarships : null },
                          { label: 'Max Coverage', value: uni.max_coverage_percent ? `Up to ${uni.max_coverage_percent}%` : null },
                          { label: 'Program Duration', value: uni.program_duration || null },
                          { label: 'Work Visa', value: Number(uni.work_visa_available) === 1 ? 'Available' : null },
                          { label: 'Research Focus', value: uni.research_focus && uni.research_focus !== 'N/A' ? uni.research_focus : null },
                          { label: 'Fall Deadline', value: uni.deadline_fall && uni.deadline_fall !== 'N/A' ? uni.deadline_fall : null },
                          { label: 'Spring Deadline', value: uni.deadline_spring && uni.deadline_spring !== 'N/A' ? uni.deadline_spring : null },
                        ].filter(item => item.value).map(item => (
                          <div key={item.label} className="flex items-center justify-between px-4 py-2">
                            <span className="text-xs text-slate-500">{item.label}</span>
                            <span className="text-xs font-medium text-slate-800 text-right max-w-[60%]">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Match reasons */}
                    {uni.reasons && uni.reasons.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Why this match</p>
                        <ul className="space-y-1">
                          {uni.reasons.map((reason, i) => (
                            <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                              <span className="text-purple-400 mt-0.5">&#8226;</span>
                              {reason}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Chat section */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 mt-4">
            <h4 className="text-sm font-bold text-slate-800 mb-3">Ask About Your Results</h4>

            {chatMessages.length === 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {[
                  `Why ${results[0]?.name}?`,
                  'Compare top 3',
                  'Which is best for me?',
                  'How can I improve my chances?',
                  'Which has best scholarships?',
                ].map((chip) => (
                  <button key={chip} onClick={() => handleChatSend(chip)}
                    className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium hover:bg-slate-200 transition-colors">
                    {chip}
                  </button>
                ))}
              </div>
            )}

            {chatMessages.length > 0 && (
              <div className="mb-4 max-h-[400px] overflow-y-auto space-y-3 rounded-lg bg-slate-50 p-4">
                {chatMessages.map((msg) => {
                  const isStreaming = chatLoading && msg.sender === 'ai' && msg === chatMessages[chatMessages.length - 1];
                  const isEmpty = !msg.text;
                  return (
                    <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm whitespace-pre-wrap ${
                        msg.sender === 'user'
                          ? 'bg-purple-500 text-white'
                          : 'bg-white border border-slate-200 text-slate-700'
                      }`}>
                        {msg.sender === 'ai' && isStreaming && isEmpty ? (
                          <span className="flex gap-1 items-center py-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                          </span>
                        ) : (
                          <>
                            {msg.text}
                            {isStreaming && !isEmpty && (
                              <span className="inline-block w-0.5 h-4 bg-purple-500 ml-0.5 align-text-bottom animate-pulse" />
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>
            )}

            <div className="flex gap-2 items-end">
              <textarea
                value={chatInput}
                onChange={(e) => {
                  setChatInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleChatSend();
                    (e.target as HTMLTextAreaElement).style.height = 'auto';
                  }
                }}
                placeholder="Ask anything..."
                disabled={chatLoading}
                rows={1}
                className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:border-purple-500 outline-none disabled:opacity-50 resize-none overflow-hidden"
                style={{ minHeight: '38px' }}
              />
              <button onClick={() => {
                handleChatSend();
                const ta = document.querySelector('.flex.gap-2.items-end textarea') as HTMLTextAreaElement;
                if (ta) ta.style.height = 'auto';
              }}
                disabled={chatLoading || !chatInput.trim()}
                className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 flex-shrink-0"
                style={{ height: '38px' }}>
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cost Calculator Modal */}
      {costCard && (
        <CostCalculator
          universityName={costCard.name}
          country={costCard.country}
          tuition={costCard.tuition}
          programDuration={costCard.program_duration}
          scholarships={costCard.scholarships}
          maxCoverage={costCard.max_coverage_percent}
          onClose={() => setCostCard(null)}
        />
      )}
    </div>
  );
}
