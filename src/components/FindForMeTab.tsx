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
  // ML fields
  researchExp: string;
  ecaLevel: string;
  gre: string;
  sat: string;
}

export interface MatchedUniversity {
  name: string;
  country: string;
  match_score: number;  // ML admission probability (0-100)
  tuition: string;
  field: string;
  degree: string;
  ielts: number;
  toefl: number;
  scholarships: string;
  deadline_fall: string;
  deadline_spring: string;
  test_requirements: string;
  program_duration: string;
  english_requirements: string;
  qs_ranking: string;
  living_cost: number;
  total_cost_estimated: number;
  max_coverage_percent: number;
  work_visa_available: number;
  research_weight: number;
  eca_weight: number;
  research_focus: string;
  programs_offered: string;
  [key: string]: unknown;
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
    researchExp: '0',
    ecaLevel: '0',
    gre: '',
    sat: '',
  });
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<MatchedUniversity[]>([]);
  const [totalInDatabase, setTotalInDatabase] = useState(0);
  const [expandedCard, setExpandedCard] = useState<number | null>(null);
  const [chatMessages, setChatMessages] = useState<{id: string; text: string; sender: 'user' | 'ai'; timestamp: Date}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [chatContext, setChatContext] = useState<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [costCard, setCostCard] = useState<MatchedUniversity | null>(null);
  const [mlBase, setMlBase] = useState<{ probability: number; confidence: string; recommendation: string } | null>(null);
  const [categoryCounts, setCategoryCounts] = useState<{ safe: number; moderate: number; risky: number } | null>(null);
  const [improvements, setImprovements] = useState<{ action: string; impact: string }[]>([]);

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

    // Create a placeholder AI message that we'll stream into
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
        body: JSON.stringify({
          message: text,
          history,
          rag_context: chatContext || results,
        }),
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
                // Update the AI message in-place with accumulated text
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

      // If no text was streamed, show fallback
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
    onAIMessage('ML scoring all universities + RAG enriching details...');

    try {
      // Single call: ML scores all 232 universities → RAG enriches top results
      const response = await fetch('/api/findme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...requirements,
          top_k: 5
        }),
      });

      const data = await response.json();

      if (data.universities) {
        setResults(data.universities);
        setTotalInDatabase(data.total_in_database || 0);
        setChatContext(data.chat_context || data.universities);
        setCategoryCounts(data.category_counts || null);
        setImprovements(data.improvements || []);

        // Set ML base prediction
        if (data.ml_prediction) {
          setMlBase({
            probability: data.ml_prediction.ml_probability || 0,
            confidence: data.ml_prediction.confidence || '',
            recommendation: data.recommendation || '',
          });
        } else {
          setMlBase(null);
        }

        const cc = data.category_counts;
        const countMsg = cc ? ` (Safe: ${cc.safe}, Moderate: ${cc.moderate}, Risky: ${cc.risky})` : '';
        onAIMessage(`ML ranked ${data.total_in_database} universities${countMsg} — showing top ${data.universities.length} with RAG details`);
        onRAGResults?.(data.universities);
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
    { code: 'USA', name: 'USA', flag: '🇺🇸' },
    { code: 'UK', name: 'UK', flag: '🇬🇧' },
    { code: 'Canada', name: 'Canada', flag: '🇨🇦' },
    { code: 'Australia', name: 'Australia', flag: '🇦🇺' },
    { code: 'Germany', name: 'Germany', flag: '🇩🇪' },
    { code: 'Any', name: 'Any', flag: '🌍' },
  ];

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-amber-600';
    return 'text-slate-500';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 60) return 'bg-blue-500';
    if (score >= 40) return 'bg-amber-500';
    return 'bg-slate-400';
  };

  const getCategoryColor = (cat: string) => {
    if (cat === 'Safe') return 'bg-emerald-100 text-emerald-700';
    if (cat === 'Moderate') return 'bg-amber-100 text-amber-700';
    return 'bg-red-100 text-red-700';
  };

  const getScoreRing = (score: number) => {
    if (score >= 80) return 'ring-emerald-200 bg-emerald-50';
    if (score >= 60) return 'ring-blue-200 bg-blue-50';
    if (score >= 40) return 'ring-amber-200 bg-amber-50';
    return 'ring-slate-200 bg-slate-50';
  };

  return (
    <div className="space-y-6 slide-up">
      {/* Search Form */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-5">Find Universities For Me</h2>

        {/* Optional free text */}
        <textarea
          value={requirements.freeText}
          onChange={(e) => handleChange('freeText', e.target.value)}
          placeholder="Describe what you're looking for (optional)..."
          rows={2}
          className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 outline-none text-sm text-slate-800 placeholder:text-slate-400 resize-none mb-5"
        />

        {/* Main inputs - 2 rows */}
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

        {/* ML profile fields */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Research Experience</label>
            <select value={requirements.researchExp} onChange={(e) => handleChange('researchExp', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white text-slate-800 focus:border-purple-500 outline-none">
              <option value="0">No</option>
              <option value="1">Yes</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Extracurricular Level</label>
            <select value={requirements.ecaLevel} onChange={(e) => handleChange('ecaLevel', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white text-slate-800 focus:border-purple-500 outline-none">
              <option value="0">0 - None</option>
              <option value="1">1 - Minimal</option>
              <option value="2">2 - Some</option>
              <option value="3">3 - Active</option>
              <option value="4">4 - Strong</option>
              <option value="5">5 - Exceptional</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">GRE Score (optional)</label>
            <input type="number" value={requirements.gre} onChange={(e) => handleChange('gre', e.target.value)}
              placeholder="0-340" min={0} max={340}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:border-purple-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">SAT Score (optional)</label>
            <input type="number" value={requirements.sat} onChange={(e) => handleChange('sat', e.target.value)}
              placeholder="0-1600" min={0} max={1600}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:border-purple-500 outline-none" />
          </div>
        </div>

        {/* Country pills */}
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

        {/* Search button */}
        <button onClick={handleFind} disabled={loading}
          className="w-full py-3 rounded-xl bg-purple-600 text-white font-semibold text-sm hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? (
            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> ML Scoring + RAG Enriching...</>
          ) : 'Find Best Matches (ML + RAG)'}
        </button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-baseline gap-2 px-1">
            <h3 className="text-base font-bold text-slate-800">Top {results.length} Matches</h3>
            <span className="text-xs text-slate-400">from {totalInDatabase} universities</span>
          </div>

          {/* ML Profile Summary + Category Breakdown */}
          {mlBase && mlBase.probability > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">ML Profile Strength</p>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-slate-800">Overall Admission Chance</span>
                    <span className={`text-sm font-bold ${getScoreColor(mlBase.probability)}`}>{Math.round(mlBase.probability)}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${getScoreBg(mlBase.probability)}`} style={{ width: `${mlBase.probability}%` }} />
                  </div>
                  <p className="text-xs text-slate-500 mt-2">{mlBase.recommendation}</p>
                </div>
              </div>

              {/* Category counts */}
              {categoryCounts && (
                <div className="flex gap-3 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-xs text-slate-600">Safe: <strong>{categoryCounts.safe}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-xs text-slate-600">Moderate: <strong>{categoryCounts.moderate}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-xs text-slate-600">Risky: <strong>{categoryCounts.risky}</strong></span>
                  </div>
                </div>
              )}

              {/* Improvement suggestions */}
              {improvements.length > 0 && (
                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  <span className="text-[11px] text-slate-500 font-medium">Improvement Tips</span>
                  {improvements.map((imp, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <span className="text-blue-500 text-xs mt-0.5">+</span>
                      <span className="text-[11px] text-slate-600"><strong>{imp.action}</strong> — {imp.impact}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {results.map((uni, index) => {
            const gaps = (uni as Record<string, unknown>).gap_analysis as { factor: string; status: string; detail: string }[] || [];
            const category = (uni as Record<string, unknown>).category as string || '';
            return (
            <div key={index} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {/* Main card */}
              <div className="p-5">
                <div className="flex items-start gap-4">
                  {/* ML admission score */}
                  <div className={`w-14 h-14 rounded-full ring-2 flex-shrink-0 flex flex-col items-center justify-center ${getScoreRing(uni.match_score)}`}>
                    <span className={`text-lg font-bold leading-none ${getScoreColor(uni.match_score)}`}>{Math.round(uni.match_score)}</span>
                    <span className="text-[9px] text-slate-400">%</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-slate-800 text-[15px] leading-tight">{uni.name}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">{uni.field} &middot; {uni.degree} &middot; {uni.country}</p>
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        {category && (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${getCategoryColor(category)}`}>{category}</span>
                        )}
                        {uni.qs_ranking && (
                          <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">QS #{uni.qs_ranking}</span>
                        )}
                        {Boolean((uni as Record<string, unknown>).rag_enriched) && (
                          <span className="text-[10px] font-medium text-blue-500 bg-blue-50 px-2 py-0.5 rounded">RAG</span>
                        )}
                      </div>
                    </div>

                    {/* Key stats */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs">
                      <span className="text-slate-700 font-medium">{uni.tuition}</span>
                      {(uni as Record<string, unknown>).acceptance_rate != null && Number((uni as Record<string, unknown>).acceptance_rate) > 0 && (
                        <span className="text-slate-600">{String((uni as Record<string, unknown>).acceptance_rate)}% acceptance</span>
                      )}
                      {(uni as Record<string, unknown>).min_gpa != null && Number((uni as Record<string, unknown>).min_gpa) > 0 && (
                        <span className="text-slate-600">GPA {String((uni as Record<string, unknown>).min_gpa)}</span>
                      )}
                      {uni.ielts > 0 && (
                        <span className="text-slate-600">IELTS {uni.ielts}</span>
                      )}
                      {Number(uni.work_visa_available) === 1 && (
                        <span className="text-emerald-600 font-medium">Work Visa</span>
                      )}
                      {(uni as Record<string, unknown>).is_preferred === 1 && (
                        <span className="text-purple-600 font-medium">Preferred Country</span>
                      )}
                    </div>

                    {/* Gap analysis tags */}
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {gaps.filter(g => g.status === 'strong').slice(0, 2).map((gap, i) => (
                        <span key={`s-${i}`} className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 text-[11px] font-medium">
                          {gap.detail}
                        </span>
                      ))}
                      {gaps.filter(g => g.status === 'below').map((gap, i) => (
                        <span key={`b-${i}`} className="px-2 py-0.5 rounded bg-red-50 text-red-600 text-[11px] font-medium">
                          {gap.detail}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-3 mt-4 pt-3 border-t border-slate-100">
                  <button onClick={() => setExpandedCard(expandedCard === index ? null : index)}
                    className="text-xs text-purple-600 hover:text-purple-800 font-medium transition-colors">
                    {expandedCard === index ? 'Hide details' : 'View details'}
                  </button>
                  <button onClick={() => setCostCard(uni)}
                    className="text-xs text-emerald-600 hover:text-emerald-800 font-medium transition-colors">
                    Cost breakdown
                  </button>
                </div>
              </div>

              {/* Expanded section */}
              {expandedCard === index && (
                <div className="border-t border-slate-100 bg-slate-50 p-5 space-y-5">
                  {/* Admission Analysis (ML) */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">ML Admission Analysis</p>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-600">Admission Probability</span>
                        <span className={`text-sm font-bold ${getScoreColor(uni.match_score)}`}>{Math.round(uni.match_score)}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-600">Category</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${getCategoryColor(category)}`}>{category}</span>
                      </div>
                      {gaps.length > 0 && (
                        <div className="space-y-1.5 pt-2 border-t border-slate-200">
                          <span className="text-[11px] text-slate-500">Gap Analysis</span>
                          {gaps.map((gap, i) => (
                            <div key={i} className="flex items-start gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0 ${
                                gap.status === 'strong' ? 'bg-emerald-500' : gap.status === 'meets' ? 'bg-blue-500' : 'bg-red-500'
                              }`} />
                              <span className="text-[11px] text-slate-600">{gap.detail}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* University details (RAG enriched) */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                      University Details {(uni as Record<string, unknown>).rag_enriched ? '(RAG Enriched)' : ''}
                    </p>
                    <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
                      {[
                        { label: 'Tuition', value: uni.tuition },
                        { label: 'Living Cost', value: uni.living_cost ? `$${Number(uni.living_cost).toLocaleString()}/yr` : null },
                        { label: 'Total Cost', value: uni.total_cost_estimated ? `$${Number(uni.total_cost_estimated).toLocaleString()}/yr` : null },
                        { label: 'GPA Required', value: (uni as Record<string, unknown>).min_gpa ? String((uni as Record<string, unknown>).min_gpa) : null },
                        { label: 'Acceptance Rate', value: (uni as Record<string, unknown>).acceptance_rate ? `${(uni as Record<string, unknown>).acceptance_rate}%` : null },
                        { label: 'English', value: uni.english_requirements || null },
                        { label: 'Test Requirements', value: uni.test_requirements || null },
                        { label: 'Scholarships', value: uni.scholarships || null },
                        { label: 'Max Coverage', value: uni.max_coverage_percent ? `Up to ${uni.max_coverage_percent}%` : null },
                        { label: 'Program Duration', value: uni.program_duration || null },
                        { label: 'Work Visa', value: Number(uni.work_visa_available) === 1 ? 'Available' : Number(uni.work_visa_available) === 0 ? 'Not Available' : null },
                        { label: 'Research Focus', value: uni.research_focus || null },
                        { label: 'Fall Deadline', value: uni.deadline_fall || null },
                        { label: 'Spring Deadline', value: uni.deadline_spring || null },
                      ].filter(item => item.value).map(item => (
                        <div key={item.label} className="flex items-center justify-between px-4 py-2.5">
                          <span className="text-xs text-slate-500">{item.label}</span>
                          <span className="text-xs font-medium text-slate-800 text-right max-w-[60%]">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
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
                  'Suggest universities not shown',
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
                          /* Typing dots while waiting for first token */
                          <span className="flex gap-1 items-center py-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                          </span>
                        ) : (
                          /* Message text + blinking cursor while streaming */
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
                  // Auto-grow: reset height then set to scrollHeight
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleChatSend();
                    // Reset height after send
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
                // Find and reset textarea height
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
          onClose={() => setCostCard(null)}
        />
      )}
    </div>
  );
}
