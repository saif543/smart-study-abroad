'use client';

import { useState } from 'react';
import { SavedUniversity, StudentProfile, STATUS_META } from '@/lib/types';
import RequirementGapCard from './dashboard/RequirementGapCard';
import CompareUnis from './dashboard/CompareUnis';

interface Props {
  unis: SavedUniversity[];
  profile: StudentProfile;
  onRemove: (id: string) => void;
}

export default function SavedUniversities({ unis, profile, onRemove }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(unis[0]?.id || null);
  const [comparing, setComparing] = useState<[SavedUniversity, SavedUniversity] | null>(null);

  const toggleSelect = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) :
      prev.length >= 2 ? [prev[1], id] : [...prev, id]
    );
  };

  const startCompare = () => {
    const a = unis.find(u => u.id === selected[0]);
    const b = unis.find(u => u.id === selected[1]);
    if (a && b) setComparing([a, b]);
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h2 className="text-xl font-bold text-slate-900">⭐ My Shortlist</h2>
        {selected.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">{selected.length}/2 selected</span>
            <button
              onClick={startCompare}
              disabled={selected.length !== 2}
              className="text-xs px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md transition">
              ⚖️ Compare
            </button>
            <button onClick={() => setSelected([])} className="text-xs text-slate-400 hover:text-slate-600">Clear</button>
          </div>
        )}
      </div>
      <p className="text-sm text-slate-500 mb-5">
        {unis.length} saved · Tick 2 universities to compare side-by-side
      </p>

      {unis.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          No saved universities yet. Go to <strong>Find For Me</strong> and click ☆ Save on any card.
        </div>
      ) : (
        <div className="space-y-3">
          {unis.map(u => {
            const isExpanded = expanded === u.id;
            const isSelected = selected.includes(u.id);
            const status = STATUS_META[u.applicationStatus];
            return (
              <div key={u.id} className={`border rounded-xl transition ${
                isSelected ? 'border-purple-400 ring-2 ring-purple-100' : 'border-slate-200'
              }`}>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <label className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer">
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(u.id)}
                        className="mt-1 w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-400 cursor-pointer" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold text-slate-900 truncate">{u.university}</h3>
                          {u.qsRank && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">QS #{u.qsRank}</span>}
                          {typeof u.matchScore === 'number' && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{u.matchScore}% match</span>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded-full ${status.bg} ${status.color}`}>
                            {status.emoji} {status.label}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">{u.country}{u.field ? ` · ${u.field}` : ''}</p>
                      </div>
                    </label>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => setExpanded(isExpanded ? null : u.id)}
                        className="text-xs text-purple-600 hover:text-purple-800 px-2 py-1 rounded-md hover:bg-purple-50 transition">
                        {isExpanded ? 'Hide' : 'Gaps'}
                      </button>
                      <button onClick={() => onRemove(u.id)} className="text-slate-400 hover:text-red-500 px-2 py-1" title="Remove">
                        ✕
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <RequirementGapCard uni={u} profile={profile} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {comparing && <CompareUnis unis={comparing} onClose={() => setComparing(null)} />}
    </div>
  );
}
