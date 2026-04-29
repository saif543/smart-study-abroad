'use client';

interface Props {
  onClick: () => void;
  busy?: boolean;
  label?: string;
}

export default function GoogleButton({ onClick, busy, label = 'Continue with Google' }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="w-full py-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium flex items-center justify-center gap-3 transition disabled:opacity-60"
    >
      <svg className="w-5 h-5" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.6 6.5 29.6 4.5 24 4.5 12.7 4.5 3.5 13.7 3.5 25S12.7 45.5 24 45.5 44.5 36.3 44.5 25c0-1.5-.2-3-.5-4.5z"/>
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.6 6.5 29.6 4.5 24 4.5 16 4.5 9.1 9 6.3 14.7z"/>
        <path fill="#4CAF50" d="M24 45.5c5.5 0 10.4-2.1 14.1-5.5l-6.5-5.5c-2 1.5-4.6 2.5-7.6 2.5-5.3 0-9.7-3.4-11.3-8l-6.5 5C9 41 16 45.5 24 45.5z"/>
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.5 5.5c-.5.4 7.2-5.2 7.2-14 0-1.5-.2-3-.4-4.5z"/>
      </svg>
      {busy ? 'Signing in...' : label}
    </button>
  );
}
