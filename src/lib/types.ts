export type ResearchExperience = 'none' | 'thesis' | 'lab' | 'industry';

export interface StudentProfile {
  cgpa: string;
  budgetUsd: string;
  preferredCountry: string;
  ieltsScore: string;
  toeflScore: string;
  greScore: string;
  researchInterest: string;
  researchExperience?: ResearchExperience;
  thesisCount?: number;        // 0, 1, or more (e.g., undergrad thesis = 1)
  publicationCount?: number;   // total published papers
}

export type AppStatus = 'saved' | 'planning' | 'applying' | 'submitted' | 'decision';

// Legacy 3-state codes (still in old user records). Migrated on load.
export type LegacyAppStatus = 'not_started' | 'in_progress' | 'submitted';

export interface SavedUniversity {
  id: string;
  university: string;
  country: string;
  qsRank?: number | string;
  field?: string;
  matchScore?: number;
  deadlineFall?: string;
  deadlineSpring?: string;
  scholarshipDeadline?: string;
  applicationStatus: AppStatus;
  scholarshipStatus: AppStatus;
  // Requirements (for gap analyzer + compare)
  minCgpa?: number | string;
  ieltsRequired?: number | string;
  toeflRequired?: number | string;
  greRequired?: number | string;
  tuition?: string;
  tuitionUsd?: number;
  livingCost?: number;
  totalCost?: number;
  scholarships?: string;
  notes?: string;
  savedAt: string;
}

export interface User {
  uid: string;
  email: string;
  name: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
  ts: number;
}

export interface UserData {
  profile: StudentProfile;
  savedUniversities: SavedUniversity[];
  chatHistory?: ChatMessage[];
}

export const CHAT_HISTORY_LIMIT = 50;

export const EMPTY_PROFILE: StudentProfile = {
  cgpa: '',
  budgetUsd: '',
  preferredCountry: '',
  ieltsScore: '',
  toeflScore: '',
  greScore: '',
  researchInterest: '',
  researchExperience: 'none',
  thesisCount: 0,
  publicationCount: 0,
};

export function migrateStatus(s: string): AppStatus {
  if (s === 'not_started') return 'saved';
  if (s === 'in_progress') return 'applying';
  if (s === 'submitted') return 'submitted';
  if (['saved', 'planning', 'applying', 'submitted', 'decision'].includes(s)) return s as AppStatus;
  return 'saved';
}

export const STATUS_META: Record<AppStatus, { label: string; color: string; bg: string; ring: string; emoji: string }> = {
  saved:     { label: 'Saved',     color: 'text-slate-700',  bg: 'bg-slate-100',  ring: 'ring-slate-200',   emoji: '⭐' },
  planning:  { label: 'Planning',  color: 'text-blue-700',   bg: 'bg-blue-100',   ring: 'ring-blue-200',    emoji: '📝' },
  applying:  { label: 'Applying',  color: 'text-amber-700',  bg: 'bg-amber-100',  ring: 'ring-amber-200',   emoji: '✏️' },
  submitted: { label: 'Submitted', color: 'text-purple-700', bg: 'bg-purple-100', ring: 'ring-purple-200',  emoji: '📤' },
  decision:  { label: 'Decision',  color: 'text-green-700',  bg: 'bg-green-100',  ring: 'ring-green-200',   emoji: '🎉' },
};

export const STATUS_ORDER: AppStatus[] = ['saved', 'planning', 'applying', 'submitted', 'decision'];
