'use client';

import { useState } from 'react';
import { SavedUniversity, AppStatus, STATUS_META, STATUS_ORDER } from '@/lib/types';

interface Props {
  unis: SavedUniversity[];
  onUpdate: (id: string, patch: Partial<SavedUniversity>) => void;
  onRemove: (id: string) => void;
}

function daysUntil(monthDay: string | undefined): number | null {
  if (!monthDay || monthDay === 'N/A') return null;
  const first = monthDay.split(/[-–]/)[0].trim();
  const today = new Date();
  const tryParse = (y: number) => {
    const d = new Date(`${first}, ${y}`);
    return isNaN(d.getTime()) ? null : d;
  };
  let d = tryParse(today.getFullYear());
  if (!d) return null;
  if (d.getTime() < today.getTime() - 86400000) d = tryParse(today.getFullYear() + 1);
  if (!d) return null;
  return Math.ceil((d.getTime() - today.getTime()) / 86400000);
}

export default function KanbanBoard({ unis, onUpdate, onRemove }: Props) {
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const grouped: Record<AppStatus, SavedUniversity[]> = {
    saved: [], planning: [], applying: [], submitted: [], decision: [],
  };
  unis.forEach(u => grouped[u.applicationStatus].push(u));

  const moveTo = (id: string, status: AppStatus) => onUpdate(id, { applicationStatus: status });

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-slate-900 mb-1">🏗️ Application Pipeline</h2>
        <p className="text-sm text-slate-500">Drag cards across stages, or use the arrow buttons</p>
      </div>

      {unis.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          No universities saved yet. Use Find For Me or Search to add some.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {STATUS_ORDER.map(stage => {
            const meta = STATUS_META[stage];
            const items = grouped[stage];
            return (
              <div key={stage}
                onDragOver={e => { e.preventDefault(); }}
                onDrop={() => { if (draggedId) { moveTo(draggedId, stage); setDraggedId(null); } }}
                className={`rounded-xl p-3 ${meta.bg} ring-1 ${meta.ring} min-h-[200px] flex flex-col`}>
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-xs font-bold uppercase tracking-wide ${meta.color}`}>
                    {meta.emoji} {meta.label}
                  </span>
                  <span className={`text-xs ${meta.color} font-bold`}>{items.length}</span>
                </div>
                <div className="space-y-2 flex-1">
                  {items.length === 0 && (
                    <p className={`text-[11px] ${meta.color} opacity-50 italic text-center py-4`}>Empty</p>
                  )}
                  {items.map(u => {
                    const idx = STATUS_ORDER.indexOf(stage);
                    const days = daysUntil(u.deadlineFall);
                    const overdue = days !== null && days < 0 && stage !== 'submitted' && stage !== 'decision';
                    return (
                      <div key={u.id}
                        draggable
                        onDragStart={() => setDraggedId(u.id)}
                        onDragEnd={() => setDraggedId(null)}
                        className={`bg-white rounded-lg p-3 shadow-sm border cursor-grab active:cursor-grabbing transition hover:shadow-md ${
                          overdue ? 'border-red-300' : 'border-slate-200'
                        }`}>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="text-xs font-semibold text-slate-900 leading-tight">{u.university}</h3>
                          <button onClick={() => onRemove(u.id)}
                            className="text-slate-300 hover:text-red-500 text-xs flex-shrink-0" title="Remove">✕</button>
                        </div>
                        <p className="text-[10px] text-slate-500 mb-2 truncate">{u.country}{u.qsRank ? ` · QS#${u.qsRank}` : ''}</p>
                        {days !== null && (
                          <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            overdue ? 'bg-red-100 text-red-700' :
                            days < 30 ? 'bg-orange-100 text-orange-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {overdue ? `⚠ ${Math.abs(days)}d overdue` : `${days}d left`}
                          </span>
                        )}
                        <div className="flex items-center justify-between gap-1 mt-2 pt-2 border-t border-slate-100">
                          <button onClick={() => idx > 0 && moveTo(u.id, STATUS_ORDER[idx - 1])}
                            disabled={idx === 0}
                            className="text-xs text-slate-400 hover:text-slate-700 disabled:opacity-20 disabled:cursor-not-allowed"
                            title="Move back">
                            ←
                          </button>
                          <button onClick={() => idx < STATUS_ORDER.length - 1 && moveTo(u.id, STATUS_ORDER[idx + 1])}
                            disabled={idx === STATUS_ORDER.length - 1}
                            className="text-xs text-slate-400 hover:text-slate-700 disabled:opacity-20 disabled:cursor-not-allowed"
                            title="Move forward">
                            →
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
