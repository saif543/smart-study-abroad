'use client';

import { useState, useRef, useEffect } from 'react';
import CostCalculator from './CostCalculator';
import { useAuth } from '@/lib/auth';

type ResearchLevel = 'none' | 'thesis' | '1pub' | '2pub';

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
  research: ResearchLevel;
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
  admit_bucket?: 'Safe' | 'Target' | 'Reach';
  admit_chance?: number;
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
  const { user, data: userData, saveUniversity } = useAuth();
  const isSaved = (uni: MatchedUniversity) =>
    userData.savedUniversities.some(s => s.university === uni.name && s.field === uni.field);
  const handleSaveUni = (uni: MatchedUniversity) => {
    if (!user) { onAIMessage('Log in to save universities to your dashboard'); return; }
    saveUniversity({
      university: uni.name,
      country: uni.country,
      qsRank: uni.qs_ranking,
      field: uni.field,
      matchScore: uni.match_score,
      deadlineFall: uni.deadline_fall,
      deadlineSpring: uni.deadline_spring,
      applicationStatus: 'saved',
      scholarshipStatus: 'saved',
      minCgpa: uni.gpa_required,
      ieltsRequired: uni.ielts,
      toeflRequired: uni.toefl,
      greRequired: uni.test_requirements,
      tuition: uni.tuition,
      tuitionUsd: uni.tuition_fees,
      livingCost: uni.living_cost,
      totalCost: uni.total_cost_estimated,
      scholarships: uni.scholarships,
    });
  };
  const profileToCountryCode = (c: string): string => {
    const s = (c || '').toLowerCase();
    if (!s) return 'USA';
    if (s.includes('united states') || s === 'usa' || s === 'us' || s === 'america') return 'USA';
    if (s.includes('united kingdom') || s === 'uk' || s.includes('britain') || s.includes('england')) return 'UK';
    if (s.includes('canada')) return 'Canada';
    if (s.includes('australia')) return 'Australia';
    if (s.includes('germany')) return 'Germany';
    return 'Any';
  };

  const profileToResearchLevel = (): ResearchLevel => {
    const p = userData?.profile;
    const pubs = p?.publicationCount || 0;
    const thes = p?.thesisCount || 0;
    if (pubs >= 2) return '2pub';
    if (pubs >= 1) return '1pub';
    if (thes >= 1) return 'thesis';
    return 'none';
  };

  const buildFromProfile = (): Requirements => {
    const p = userData?.profile;
    const hasIelts = p?.ieltsScore && p.ieltsScore.trim();
    const hasToefl = p?.toeflScore && p.toeflScore.trim();
    return {
      degree: 'Master',
      field: '',
      maxTuition: p?.budgetUsd || '',
      minGPA: p?.cgpa || '',
      englishTest: hasIelts ? 'IELTS' : hasToefl ? 'TOEFL' : 'TOEFL',
      englishScore: hasIelts ? p!.ieltsScore : hasToefl ? p!.toeflScore : '',
      country: profileToCountryCode(p?.preferredCountry || ''),
      preferScholarship: false,
      freeText: '',
      research: profileToResearchLevel(),
    };
  };

  const [requirements, setRequirements] = useState<Requirements>(() => buildFromProfile());
  const [prefilled, setPrefilled] = useState(true);
  // Re-sync once when profile finishes loading (auth resolves async)
  useEffect(() => {
    if (prefilled) setRequirements(prev => ({ ...buildFromProfile(), field: prev.field, freeText: prev.freeText }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData?.profile?.cgpa, userData?.profile?.budgetUsd, userData?.profile?.ieltsScore, userData?.profile?.toeflScore, userData?.profile?.preferredCountry, userData?.profile?.thesisCount, userData?.profile?.publicationCount]);
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
    if (['minGPA', 'maxTuition', 'englishTest', 'englishScore', 'country', 'research'].includes(field)) {
      setPrefilled(false);
    }
  };

  const resetToProfile = () => {
    setRequirements(prev => ({ ...buildFromProfile(), field: prev.field, freeText: prev.freeText }));
    setPrefilled(true);
  };

  const profileHas = {
    cgpa: !!userData?.profile?.cgpa,
    budget: !!userData?.profile?.budgetUsd,
    english: !!(userData?.profile?.ieltsScore || userData?.profile?.toeflScore),
    country: !!userData?.profile?.preferredCountry,
  };
  const profileFilledCount = Object.values(profileHas).filter(Boolean).length;
  const pubCount = userData?.profile?.publicationCount || 0;
  const thesisCount = userData?.profile?.thesisCount || 0;

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
      // Convert single Research dropdown to counts the backend expects
      const r = requirements.research;
      const thesis_count = r === 'none' ? 0 : 1;
      const publication_count = r === '2pub' ? 2 : r === '1pub' ? 1 : 0;
      const studentResearch = {
        experience: r === 'none' ? 'none' : (userData?.profile?.researchExperience || 'thesis'),
        thesis_count,
        publication_count,
      };

      const response = await fetch('/api/findme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...requirements, top_k: 5, student_research: studentResearch }),
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800">Find Universities For Me</h2>
          {(pubCount > 0 || thesisCount > 0) && (
            <span className="text-xs px-2 py-1 rounded-full bg-purple-50 text-purple-700 font-medium border border-purple-100">
              🔬 Research boost active ({thesisCount > 0 && `${thesisCount} thesis`}{thesisCount > 0 && pubCount > 0 && ', '}{pubCount > 0 && `${pubCount} pub${pubCount > 1 ? 's' : ''}`})
            </span>
          )}
        </div>

        {/* Profile sync banner */}
        {user && profileFilledCount > 0 && (
          <div className={`mb-4 px-4 py-3 rounded-xl border text-sm flex items-center justify-between gap-3 ${
            prefilled ? 'bg-purple-50 border-purple-100 text-purple-800' : 'bg-amber-50 border-amber-100 text-amber-800'
          }`}>
            <div className="flex items-center gap-2 min-w-0">
              <span>{prefilled ? '✨' : '✏️'}</span>
              <span className="truncate">
                {prefilled
                  ? <>Using your profile ({profileFilledCount}/4 fields). Edit anything below to customize.</>
                  : <>Customized — fields differ from your profile.</>}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!prefilled && (
                <button type="button" onClick={resetToProfile}
                  className="px-3 py-1 rounded-md bg-white border border-amber-200 text-xs font-medium hover:bg-amber-100">
                  ↺ Reset to profile
                </button>
              )}
              <a href="/dashboard" onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('go-to-profile')); }}
                className="text-xs underline opacity-80 hover:opacity-100">Edit profile</a>
            </div>
          </div>
        )}
        {user && profileFilledCount === 0 && (
          <div className="mb-4 px-4 py-3 rounded-xl border border-blue-100 bg-blue-50 text-sm text-blue-800">
            💡 Fill out your <a href="/dashboard" onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('go-to-profile')); }} className="underline font-medium">profile</a> once and these fields will auto-fill.
          </div>
        )}

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
          <div>
            <label className="block text-xs text-slate-500 mb-1 flex items-center gap-1">
              🔬 Research output
              <span className="text-[10px] text-purple-500 font-medium">boosts match</span>
            </label>
            <select value={requirements.research} onChange={(e) => handleChange('research', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white text-slate-800 focus:border-purple-500 outline-none">
              <option value="none">None</option>
              <option value="thesis">Undergrad thesis</option>
              <option value="1pub">1 published paper</option>
              <option value="2pub">2+ published papers</option>
            </select>
          </div>
          <div className="flex items-end">
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
            const score = Math.round(uni.match_score);
            const scoreRing =
              score >= 80 ? 'from-emerald-500 to-teal-500' :
              score >= 60 ? 'from-blue-500 to-cyan-500' :
              score >= 40 ? 'from-amber-500 to-orange-500' :
              'from-slate-400 to-slate-500';

            return (
              <div key={index} className={`bg-white rounded-2xl border overflow-hidden transition-all ${isExpanded ? 'border-purple-200 shadow-xl' : 'border-slate-200 hover:border-slate-300 hover:shadow-md'}`}>
                <div className="p-6">
                  {/* Top: Score · Title · Fit */}
                  <div className="flex items-start gap-5">
                    {/* Big match score */}
                    <div className={`shrink-0 w-20 h-20 rounded-2xl bg-gradient-to-br ${scoreRing} text-white flex flex-col items-center justify-center shadow-lg`}>
                      <span className="text-3xl font-black leading-none">{score}</span>
                      <span className="text-[10px] uppercase tracking-wider opacity-90 mt-1">Match</span>
                    </div>

                    {/* Name + meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <h4 className="font-bold text-slate-900 text-xl leading-tight">{uni.name}</h4>
                          <p className="text-sm text-slate-500 mt-1">
                            {uni.field} · {uni.country}
                            {uni.qs_ranking && <> · <span className="font-medium text-slate-600">QS #{uni.qs_ranking}</span></>}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {uni.admit_bucket && (
                            <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${
                              uni.admit_bucket === 'Safe' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              uni.admit_bucket === 'Target' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {uni.admit_bucket === 'Safe' ? '✓ Safe' : uni.admit_bucket === 'Target' ? '🎯 Target' : '⚡ Reach'}
                              {uni.admit_chance !== undefined && <span className="ml-1 opacity-80">· {uni.admit_chance}%</span>}
                            </span>
                          )}
                          {uni.fit_label && (
                            <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${fitColor.bg} ${fitColor.text} border ${fitColor.border}`}>
                              {uni.fit_label}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Quick facts row */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                        <div className="bg-slate-50 rounded-xl p-3">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">Tuition</p>
                          <p className="text-sm font-bold text-slate-900 mt-0.5 truncate">{uni.tuition || '—'}</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">Min GPA</p>
                          <p className="text-sm font-bold text-slate-900 mt-0.5">{uni.gpa_required && Number(uni.gpa_required) > 0 ? String(uni.gpa_required) : '—'}</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">Deadline</p>
                          <p className="text-sm font-bold text-slate-900 mt-0.5 truncate">{uni.deadline_fall && uni.deadline_fall !== 'N/A' ? uni.deadline_fall : '—'}</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">Duration</p>
                          <p className="text-sm font-bold text-slate-900 mt-0.5 truncate">{uni.program_duration || '—'}</p>
                        </div>
                      </div>

                      {/* Perks row */}
                      {(uni.scholarships && uni.scholarships !== 'N/A' || Number(uni.work_visa_available) === 1) && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {uni.scholarships && uni.scholarships !== 'N/A' && (
                            <span className="text-xs font-medium text-purple-700 bg-purple-50 border border-purple-100 px-2.5 py-1 rounded-full">💰 Scholarships</span>
                          )}
                          {Number(uni.work_visa_available) === 1 && (
                            <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">✓ Work visa</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Requirement checklist row */}
                  {checks.length > 0 && (
                    <div className="mt-5 pt-5 border-t border-slate-100">
                      <div className="flex items-center justify-between mb-2.5">
                        <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">Your fit</p>
                        <span className="text-xs font-bold text-slate-700">{passedCount}/{checks.length} requirements met</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {checks.map((check, i) => (
                          <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${check.passed ? 'bg-emerald-50 border border-emerald-100' : 'bg-rose-50 border border-rose-100'}`}>
                            <span className={`text-base ${check.passed ? 'text-emerald-600' : 'text-rose-500'}`}>{check.passed ? '✓' : '✕'}</span>
                            <div className="min-w-0">
                              <p className={`text-xs font-semibold truncate ${check.passed ? 'text-emerald-800' : 'text-rose-800'}`}>{check.label}</p>
                              <p className="text-[11px] text-slate-500">You: {check.yours} · Needs: {check.needs}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action row */}
                  <div className="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-slate-100">
                    <button onClick={() => handleSaveUni(uni)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-2 ${
                        isSaved(uni)
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                          : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md shadow-purple-500/30 hover:shadow-lg'
                      }`}>
                      {isSaved(uni) ? '✓ Saved · Refresh' : '☆ Save to shortlist'}
                    </button>
                    <button onClick={() => setCostCard(uni)}
                      className="px-4 py-2 rounded-xl text-sm font-semibold bg-white border border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition flex items-center gap-2">
                      💵 Cost breakdown
                    </button>
                    <button onClick={() => setExpandedCard(isExpanded ? null : index)}
                      className="px-4 py-2 rounded-xl text-sm font-semibold bg-white border border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition ml-auto flex items-center gap-2">
                      {isExpanded ? 'Hide details ↑' : 'More details ↓'}
                    </button>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-gradient-to-br from-slate-50 to-purple-50/30 p-6 space-y-5">

                    {checks.some(c => !c.passed && c.tip) && (
                      <div>
                        <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3">💡 What to improve</p>
                        <div className="space-y-2">
                          {checks.filter(c => !c.passed && c.tip).map((check, i) => (
                            <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-xl bg-white border border-amber-200 shadow-sm">
                              <span className="text-amber-500 text-lg">⚠️</span>
                              <div>
                                <p className="text-sm font-semibold text-slate-800">{check.label}</p>
                                <p className="text-sm text-slate-600 mt-0.5">{check.tip}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3">University details</p>
                      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
                        {[
                          { label: 'Tuition', value: uni.tuition },
                          { label: 'GPA required', value: uni.gpa_required && Number(uni.gpa_required) > 0 ? String(uni.gpa_required) : null },
                          { label: 'English', value: uni.english_requirements || null },
                          { label: 'Scholarships', value: uni.scholarships && uni.scholarships !== 'N/A' ? uni.scholarships : null },
                          { label: 'Max coverage', value: uni.max_coverage_percent ? `Up to ${uni.max_coverage_percent}%` : null },
                          { label: 'Program duration', value: uni.program_duration || null },
                          { label: 'Work visa', value: Number(uni.work_visa_available) === 1 ? 'Available' : null },
                          { label: 'Research focus', value: uni.research_focus && uni.research_focus !== 'N/A' ? uni.research_focus : null },
                          { label: 'Fall deadline', value: uni.deadline_fall && uni.deadline_fall !== 'N/A' ? uni.deadline_fall : null },
                          { label: 'Spring deadline', value: uni.deadline_spring && uni.deadline_spring !== 'N/A' ? uni.deadline_spring : null },
                        ].filter(item => item.value).map(item => (
                          <div key={item.label} className="flex items-center justify-between px-4 py-3">
                            <span className="text-sm text-slate-500">{item.label}</span>
                            <span className="text-sm font-semibold text-slate-800 text-right max-w-[60%]">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {uni.reasons && uni.reasons.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3">🎯 Why this match</p>
                        <ul className="space-y-2">
                          {uni.reasons.map((reason, i) => (
                            <li key={i} className="text-sm text-slate-700 flex items-start gap-2 bg-white px-4 py-2.5 rounded-xl border border-slate-100">
                              <span className="text-purple-500 mt-0.5">▸</span>
                              <span>{reason}</span>
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
