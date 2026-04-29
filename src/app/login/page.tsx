'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import GoogleButton from '@/components/GoogleButton';

export default function LoginPage() {
  const router = useRouter();
  const { login, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const onGoogle = async () => {
    setError(''); setGoogleBusy(true);
    const res = await loginWithGoogle();
    setGoogleBusy(false);
    if (!res.ok) { setError(res.error || 'Google sign-in failed'); return; }
    router.push('/dashboard');
  };
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setBusy(true);
    const res = await login(email, password);
    setBusy(false);
    if (!res.ok) { setError(res.error || 'Login failed'); return; }
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <div className="flex items-center justify-center gap-3 mb-2">
          <span className="text-3xl">🎓</span>
          <span className="text-xl font-bold gradient-text">SmartStudy</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 text-center mb-1">Welcome back</h1>
        <p className="text-slate-500 text-center mb-8 text-sm">Log in to your dashboard</p>

        <GoogleButton onClick={onGoogle} busy={googleBusy} />

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-xs text-slate-400">or continue with email</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none transition"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password" required value={password} onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none transition"
              placeholder="••••••••"
            />
          </div>
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
          <button type="submit" disabled={busy} className="w-full py-3 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium hover:shadow-lg transition disabled:opacity-60">
            {busy ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          New here?{' '}
          <Link href="/signup" className="text-purple-600 hover:underline font-medium">Create an account</Link>
        </p>
        <p className="text-center text-xs text-slate-400 mt-4">
          <Link href="/" className="hover:underline">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
