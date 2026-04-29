'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile as fbUpdateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth } from './firebase';
import { User, UserData, EMPTY_PROFILE, StudentProfile, SavedUniversity, ChatMessage, CHAT_HISTORY_LIMIT } from './types';
import { getUserData, saveUserData } from './storage';

interface AuthContextValue {
  user: User | null;
  data: UserData;
  loading: boolean;
  signup: (name: string, email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateProfile: (profile: StudentProfile) => void;
  saveUniversity: (uni: Omit<SavedUniversity, 'id' | 'savedAt'>) => void;
  removeUniversity: (id: string) => void;
  updateUniversity: (id: string, patch: Partial<SavedUniversity>) => void;
  appendChatMessages: (msgs: ChatMessage[]) => void;
  clearChatHistory: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toUser(fb: FirebaseUser): User {
  return {
    uid: fb.uid,
    email: fb.email || '',
    name: fb.displayName || (fb.email ? fb.email.split('@')[0] : 'User'),
  };
}

function friendlyError(code: string): string {
  switch (code) {
    case 'auth/email-already-in-use': return 'Email already registered';
    case 'auth/invalid-email': return 'Invalid email address';
    case 'auth/weak-password': return 'Password too weak (min 6 chars)';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return 'Wrong email or password';
    case 'auth/network-request-failed': return 'Network error — check your connection';
    case 'auth/too-many-requests': return 'Too many attempts — try later';
    default: return code.replace('auth/', '').replace(/-/g, ' ');
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<UserData>({ profile: EMPTY_PROFILE, savedUniversities: [], chatHistory: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fb) => {
      if (fb) {
        const u = toUser(fb);
        setUser(u);
        const d = await getUserData(u.uid);
        setData(d);
      } else {
        setUser(null);
        setData({ profile: EMPTY_PROFILE, savedUniversities: [], chatHistory: [] });
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Optimistic local update + background persist
  const persist = useCallback((uid: string, next: UserData) => {
    setData(next);
    saveUserData(uid, next);
  }, []);

  const signup: AuthContextValue['signup'] = async (name, email, password) => {
    if (!name.trim()) return { ok: false, error: 'Name required' };
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      await fbUpdateProfile(cred.user, { displayName: name.trim() });
      const u = toUser(cred.user);
      const initial: UserData = { profile: EMPTY_PROFILE, savedUniversities: [], chatHistory: [] };
      await saveUserData(u.uid, initial);
      setUser(u);
      setData(initial);
      return { ok: true };
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code || 'unknown';
      return { ok: false, error: friendlyError(code) };
    }
  };

  const login: AuthContextValue['login'] = async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      return { ok: true };
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code || 'unknown';
      return { ok: false, error: friendlyError(code) };
    }
  };

  const loginWithGoogle: AuthContextValue['loginWithGoogle'] = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      // Initialize user data on first Google sign-in
      const existing = await getUserData(cred.user.uid);
      if (existing.savedUniversities.length === 0 && !existing.profile.cgpa) {
        await saveUserData(cred.user.uid, { profile: EMPTY_PROFILE, savedUniversities: [], chatHistory: [] });
      }
      return { ok: true };
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code || 'unknown';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return { ok: false, error: 'Sign-in cancelled' };
      }
      return { ok: false, error: friendlyError(code) };
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const updateProfile = (profile: StudentProfile) => {
    if (!user) return;
    persist(user.uid, { ...data, profile });
  };

  const saveUniversity: AuthContextValue['saveUniversity'] = (uni) => {
    if (!user) return;
    const existing = data.savedUniversities.find(s => s.university === uni.university && s.field === uni.field);
    if (existing) {
      // Refresh: keep id, savedAt, status fields; overwrite data fields
      const merged: SavedUniversity = {
        ...existing,
        ...uni,
        id: existing.id,
        savedAt: existing.savedAt,
        applicationStatus: existing.applicationStatus,
        scholarshipStatus: existing.scholarshipStatus,
      };
      persist(user.uid, {
        ...data,
        savedUniversities: data.savedUniversities.map(s => s.id === existing.id ? merged : s),
      });
      return;
    }
    const newUni: SavedUniversity = {
      ...uni,
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      savedAt: new Date().toISOString(),
    };
    persist(user.uid, { ...data, savedUniversities: [newUni, ...data.savedUniversities] });
  };

  const removeUniversity = (id: string) => {
    if (!user) return;
    persist(user.uid, { ...data, savedUniversities: data.savedUniversities.filter(u => u.id !== id) });
  };

  const updateUniversity: AuthContextValue['updateUniversity'] = (id, patch) => {
    if (!user) return;
    persist(user.uid, {
      ...data,
      savedUniversities: data.savedUniversities.map(u => u.id === id ? { ...u, ...patch } : u),
    });
  };

  const appendChatMessages: AuthContextValue['appendChatMessages'] = (msgs) => {
    if (!user || msgs.length === 0) return;
    const merged = [...(data.chatHistory || []), ...msgs].slice(-CHAT_HISTORY_LIMIT);
    persist(user.uid, { ...data, chatHistory: merged });
  };

  const clearChatHistory = () => {
    if (!user) return;
    persist(user.uid, { ...data, chatHistory: [] });
  };

  return (
    <AuthContext.Provider value={{ user, data, loading, signup, login, loginWithGoogle, logout, updateProfile, saveUniversity, removeUniversity, updateUniversity, appendChatMessages, clearChatHistory }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
