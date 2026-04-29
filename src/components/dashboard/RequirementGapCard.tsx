'use client';

import { SavedUniversity, StudentProfile } from '@/lib/types';

interface Props {
  uni: SavedUniversity;
  profile: StudentProfile;
}

interface Check {
  label: string;
  yours: string;
  needs: string;
  passed: boolean | null; // null = unknown / no requirement to compare
  tip?: string;
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[^\d.]/g, ''));
  return isFinite(n) ? n : 0;
}

function buildChecks(uni: SavedUniversity, profile: StudentProfile): Check[] {
  const out: Check[] = [];

  // CGPA
  const yourCgpa = num(profile.cgpa);
  const needCgpa = num(uni.minCgpa);
  if (needCgpa > 0) {
    out.push({
      label: 'CGPA',
      yours: yourCgpa ? yourCgpa.toFixed(2) : '—',
      needs: needCgpa.toFixed(2),
      passed: yourCgpa >= needCgpa,
      tip: yourCgpa && yourCgpa < needCgpa ? `Boost to ${needCgpa.toFixed(2)} via advanced courses` : undefined,
    });
  }

  // IELTS
  const yourIelts = num(profile.ieltsScore);
  const needIelts = num(uni.ieltsRequired);
  if (needIelts > 0) {
    out.push({
      label: 'IELTS',
      yours: yourIelts ? String(yourIelts) : '—',
      needs: String(needIelts),
      passed: yourIelts >= needIelts,
      tip: yourIelts && yourIelts < needIelts ? `Need +${(needIelts - yourIelts).toFixed(1)} band — retake speaking/writing` : undefined,
    });
  }

  // TOEFL
  const yourToefl = num(profile.toeflScore);
  const needToefl = num(uni.toeflRequired);
  if (needToefl > 0 && yourToefl > 0) {
    out.push({
      label: 'TOEFL',
      yours: String(yourToefl),
      needs: String(needToefl),
      passed: yourToefl >= needToefl,
    });
  }

  // Budget vs tuition
  const yourBudget = num(profile.budgetUsd);
  const tuition = num(uni.tuitionUsd);
  if (tuition > 0) {
    out.push({
      label: 'Budget',
      yours: yourBudget ? `$${yourBudget.toLocaleString()}` : '—',
      needs: `$${tuition.toLocaleString()}`,
      passed: yourBudget > 0 ? yourBudget >= tuition : null,
      tip: yourBudget > 0 && yourBudget < tuition ? `Gap of $${(tuition - yourBudget).toLocaleString()} — look at scholarships` : undefined,
    });
  }

  // Country preference
  if (profile.preferredCountry && profile.preferredCountry.trim()) {
    const want = profile.preferredCountry.trim().toLowerCase();
    const got = (uni.country || '').toLowerCase();
    out.push({
      label: 'Country',
      yours: profile.preferredCountry,
      needs: uni.country,
      passed: got.includes(want) || want.includes(got),
    });
  }

  return out;
}

export default function RequirementGapCard({ uni, profile }: Props) {
  const checks = buildChecks(uni, profile);
  if (checks.length === 0) {
    return (
      <p className="text-xs text-slate-400 italic px-1">
        Add CGPA, IELTS, and budget to your profile to see gap analysis.
      </p>
    );
  }
  const passed = checks.filter(c => c.passed === true).length;
  const total = checks.filter(c => c.passed !== null).length;
  const tips = checks.filter(c => c.tip && c.passed === false);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Requirement gaps</p>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          passed === total ? 'bg-green-100 text-green-700' :
          passed >= total / 2 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
        }`}>
          {passed}/{total} met
        </span>
      </div>
      <div className="grid sm:grid-cols-2 gap-1.5">
        {checks.map(c => (
          <div key={c.label} className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs ${
            c.passed === true ? 'bg-green-50 border-green-100' :
            c.passed === false ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'
          }`}>
            <div className="min-w-0">
              <span className="block text-[10px] uppercase tracking-wide text-slate-400">{c.label}</span>
              <span className="text-slate-700">
                <span className={c.passed === false ? 'text-red-600 font-medium' : 'text-slate-700'}>{c.yours}</span>
                <span className="text-slate-400"> / needs {c.needs}</span>
              </span>
            </div>
            <span className="text-base flex-shrink-0">
              {c.passed === true ? '✅' : c.passed === false ? '❌' : '➖'}
            </span>
          </div>
        ))}
      </div>
      {tips.length > 0 && (
        <div className="pt-1 space-y-1">
          {tips.map((t, i) => (
            <p key={i} className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1.5">
              💡 <strong>{t.label}:</strong> {t.tip}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
