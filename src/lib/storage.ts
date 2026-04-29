import { ref, get, set } from 'firebase/database';
import { db } from './firebase';
import { UserData, EMPTY_PROFILE, migrateStatus, SavedUniversity, ChatMessage } from './types';

const userRef = (uid: string) => ref(db, `users/${uid}`);

export async function getUserData(uid: string): Promise<UserData> {
  try {
    const snap = await get(userRef(uid));
    if (!snap.exists()) return { profile: EMPTY_PROFILE, savedUniversities: [] };
    const v = snap.val() || {};
    const raw: SavedUniversity[] = Array.isArray(v.savedUniversities) ? v.savedUniversities : [];
    const migrated = raw.map(u => ({
      ...u,
      applicationStatus: migrateStatus(u.applicationStatus as string),
      scholarshipStatus: migrateStatus(u.scholarshipStatus as string),
    }));
    const chatHistory: ChatMessage[] = Array.isArray(v.chatHistory) ? v.chatHistory : [];
    return {
      profile: { ...EMPTY_PROFILE, ...(v.profile || {}) },
      savedUniversities: migrated,
      chatHistory,
    };
  } catch (e) {
    console.error('getUserData failed', e);
    return { profile: EMPTY_PROFILE, savedUniversities: [] };
  }
}

export async function saveUserData(uid: string, data: UserData): Promise<void> {
  try {
    await set(userRef(uid), data);
  } catch (e) {
    console.error('saveUserData failed', e);
  }
}
