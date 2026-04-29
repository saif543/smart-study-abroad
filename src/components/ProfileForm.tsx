'use client';

import { useState, useEffect } from 'react';
import { StudentProfile, ResearchExperience } from '@/lib/types';

interface Props {
  initial: StudentProfile;
  onSave: (p: StudentProfile) => void;
}

const EXPERIENCE_OPTIONS: { value: ResearchExperience; label: string; hint: string }[] = [
  { value: 'none',     label: 'None',                 hint: "I haven't done formal research yet" },
  { value: 'thesis',   label: 'Undergrad thesis',     hint: 'Final-year thesis or capstone project' },
  { value: 'lab',      label: 'Lab / RA experience',  hint: 'Worked in a research lab or as RA' },
  { value: 'industry', label: 'Industry R&D',         hint: 'R&D role at a company' },
];

export default function ProfileForm({ initial, onSave }: Props) {
  const [profile, setProfile] = useState<StudentProfile>(initial);
  const [saved, setSaved] = useState(false);
  const [showResearch, setShowResearch] = useState(true);

  useEffect(() => { setProfile(initial); }, [initial]);

  const update = <K extends keyof StudentProfile>(k: K, v: StudentProfile[K]) =>
    setProfile(p => ({ ...p, [k]: v }));

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(profile);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const thesisCount = profile.thesisCount || 0;
  const pubCount = profile.publicationCount || 0;
  const expSet = profile.researchExperience && profile.researchExperience !== 'none';
  const hasResearch = expSet || thesisCount > 0 || pubCount > 0;

  return (
    <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">👤 Personal Profile</h2>
          <p className="text-sm text-slate-500">Used for match scoring across the app</p>
        </div>
        {saved && <span className="text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full">✓ Saved</span>}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">CGPA (out of 4.0)</label>
          <input type="text" value={profile.cgpa} onChange={e => update('cgpa', e.target.value)} placeholder="3.5"
            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none transition text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Budget (USD/year)</label>
          <input type="text" value={profile.budgetUsd} onChange={e => update('budgetUsd', e.target.value)} placeholder="30000"
            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none transition text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">IELTS</label>
          <input type="text" value={profile.ieltsScore} onChange={e => update('ieltsScore', e.target.value)} placeholder="7.5"
            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none transition text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">TOEFL</label>
          <input type="text" value={profile.toeflScore} onChange={e => update('toeflScore', e.target.value)} placeholder="100"
            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none transition text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">GRE</label>
          <input type="text" value={profile.greScore} onChange={e => update('greScore', e.target.value)} placeholder="320"
            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none transition text-sm" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Research Interest</label>
          <textarea value={profile.researchInterest} onChange={e => update('researchInterest', e.target.value)}
            placeholder="e.g. Machine Learning, NLP, Computer Vision" rows={2}
            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none transition text-sm resize-none" />
        </div>
      </div>

      {/* Research & Publications */}
      <div className="mt-8 rounded-2xl border-2 border-purple-100 bg-gradient-to-br from-purple-50/50 to-pink-50/30 p-5">
        <button type="button" onClick={() => setShowResearch(s => !s)}
          className="w-full flex items-center justify-between text-left group">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-white flex items-center justify-center text-xl shadow-lg shadow-purple-500/30">🔬</div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Research & Thesis
                {hasResearch && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-600 text-white font-bold">
                  {pubCount > 0 ? `${pubCount} paper${pubCount > 1 ? 's' : ''}` : thesisCount > 0 ? '✓ thesis' : '✓ added'}
                </span>}
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">Just counts — used to boost matches at research-heavy unis (CMU, MIT, ETH, TUM…)</p>
            </div>
          </div>
          <span className="text-purple-400 group-hover:text-purple-600 transition text-lg">{showResearch ? '▴' : '▾'}</span>
        </button>

        {showResearch && (
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Research experience level</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {EXPERIENCE_OPTIONS.map(opt => {
                  const active = (profile.researchExperience || 'none') === opt.value;
                  return (
                    <button key={opt.value} type="button"
                      onClick={() => update('researchExperience', opt.value)}
                      title={opt.hint}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border transition text-left ${
                        active ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}>
                      <div className="font-semibold">{opt.label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">{opt.hint}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">📄 Thesis count</label>
                <input type="number" min={0} max={10} value={thesisCount}
                  onChange={e => update('thesisCount', Math.max(0, parseInt(e.target.value || '0', 10)))}
                  placeholder="0"
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none transition text-sm" />
                <p className="text-[11px] text-slate-500 mt-1">Undergrad thesis = 1, capstone projects, master's thesis, etc.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">📚 Published papers</label>
                <input type="number" min={0} max={50} value={pubCount}
                  onChange={e => update('publicationCount', Math.max(0, parseInt(e.target.value || '0', 10)))}
                  placeholder="0"
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none transition text-sm" />
                <p className="text-[11px] text-slate-500 mt-1">Journal, conference, or workshop papers (any role)</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <button type="submit" className="mt-6 px-6 py-2.5 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium hover:shadow-lg transition">
        Save Profile
      </button>
    </form>
  );
}
