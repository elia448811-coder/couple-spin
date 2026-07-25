import { getFirestoreDb, isFirebaseConfigured } from '../lib/firebase';
import { ensureAnonAuth } from './cloudSync';
import { loadSettings, saveSettings } from './storage';

export const USER_PROFILE_SCHEMA = 1;
export const MAX_DISPLAY_NAME_LEN = 32;

export type UserProfile = {
  uid: string;
  displayName: string;
  partnerDisplayName: string;
  avatar: string;
  createdAtMs: number;
  lastSeenMs: number;
  updatedAtMs: number;
  schemaVersion: number;
  lastRoomId: string | null;
  gamesPlayed: number;
};

const LOCAL_CACHE_KEY = 'couple-spin-user-profile';

function clampName(name: string, fallback: string): string {
  const trimmed = name.trim().slice(0, MAX_DISPLAY_NAME_LEN);
  return trimmed || fallback;
}

function defaultProfile(uid: string): UserProfile {
  const settings = loadSettings();
  const now = Date.now();
  return {
    uid,
    displayName: clampName(settings.playerOneName, 'שחקן 1'),
    partnerDisplayName: clampName(settings.playerTwoName, 'שחקן 2'),
    avatar: settings.playerOneAvatar || '💜',
    createdAtMs: now,
    lastSeenMs: now,
    updatedAtMs: now,
    schemaVersion: USER_PROFILE_SCHEMA,
    lastRoomId: null,
    gamesPlayed: 0,
  };
}

function parseProfile(uid: string, raw: Record<string, unknown> | undefined): UserProfile {
  const base = defaultProfile(uid);
  if (!raw) return base;
  return {
    uid,
    displayName: clampName(String(raw.displayName ?? base.displayName), base.displayName),
    partnerDisplayName: clampName(
      String(raw.partnerDisplayName ?? base.partnerDisplayName),
      base.partnerDisplayName,
    ),
    avatar: typeof raw.avatar === 'string' && raw.avatar ? raw.avatar.slice(0, 8) : base.avatar,
    createdAtMs: Number(raw.createdAtMs) || base.createdAtMs,
    lastSeenMs: Number(raw.lastSeenMs) || base.lastSeenMs,
    updatedAtMs: Number(raw.updatedAtMs) || base.updatedAtMs,
    schemaVersion: Number(raw.schemaVersion) || USER_PROFILE_SCHEMA,
    lastRoomId: typeof raw.lastRoomId === 'string' ? raw.lastRoomId : null,
    gamesPlayed: Math.max(0, Number(raw.gamesPlayed) || 0),
  };
}

function cacheLocal(profile: UserProfile): void {
  try {
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(profile));
  } catch {
    /* ignore */
  }
}

export function getCachedUserProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(LOCAL_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed.uid !== 'string') return null;
    return parseProfile(parsed.uid, parsed);
  } catch {
    return null;
  }
}

/** Create or refresh the durable user doc at users/{uid}. */
export async function ensureUserProfile(
  partial?: Partial<Pick<UserProfile, 'displayName' | 'partnerDisplayName' | 'avatar' | 'lastRoomId'>>,
): Promise<UserProfile | null> {
  if (!isFirebaseConfigured()) return null;
  const user = await ensureAnonAuth();
  const db = await getFirestoreDb();
  if (!user || !db) return null;

  const { doc, getDoc, serverTimestamp, setDoc } = await import('firebase/firestore');
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  const existing = snap.exists() ? parseProfile(user.uid, snap.data() as Record<string, unknown>) : null;
  const base = existing ?? defaultProfile(user.uid);
  const now = Date.now();

  const next: UserProfile = {
    ...base,
    displayName: clampName(partial?.displayName ?? base.displayName, base.displayName),
    partnerDisplayName: clampName(
      partial?.partnerDisplayName ?? base.partnerDisplayName,
      base.partnerDisplayName,
    ),
    avatar: partial?.avatar?.slice(0, 8) || base.avatar,
    lastRoomId: partial?.lastRoomId !== undefined ? partial.lastRoomId : base.lastRoomId,
    lastSeenMs: now,
    updatedAtMs: now,
    createdAtMs: existing?.createdAtMs ?? now,
    schemaVersion: USER_PROFILE_SCHEMA,
  };

  const payload: Record<string, unknown> = {
    ...next,
    updatedAt: serverTimestamp(),
  };
  if (!existing) payload.createdAt = serverTimestamp();
  await setDoc(ref, payload, { merge: true });

  // Keep legacy meta/profile in sync for older readers.
  await setDoc(
    doc(db, 'users', user.uid, 'meta', 'profile'),
    {
      displayName: next.displayName,
      partnerDisplayName: next.partnerDisplayName,
      avatar: next.avatar,
      lastSeenMs: next.lastSeenMs,
      updatedAtMs: next.updatedAtMs,
      lastRoomId: next.lastRoomId,
      gamesPlayed: next.gamesPlayed,
      schemaVersion: USER_PROFILE_SCHEMA,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  cacheLocal(next);
  return next;
}

export async function getUserProfile(): Promise<UserProfile | null> {
  if (!isFirebaseConfigured()) return getCachedUserProfile();
  const user = await ensureAnonAuth();
  const db = await getFirestoreDb();
  if (!user || !db) return getCachedUserProfile();

  const { doc, getDoc } = await import('firebase/firestore');
  const snap = await getDoc(doc(db, 'users', user.uid));
  if (!snap.exists()) {
    return ensureUserProfile();
  }
  const profile = parseProfile(user.uid, snap.data() as Record<string, unknown>);
  cacheLocal(profile);
  return profile;
}

export async function updateUserProfile(
  patch: Partial<Pick<UserProfile, 'displayName' | 'partnerDisplayName' | 'avatar' | 'lastRoomId'>>,
): Promise<UserProfile | null> {
  const next = await ensureUserProfile(patch);
  if (next && (patch.displayName != null || patch.partnerDisplayName != null)) {
    const settings = loadSettings();
    saveSettings({
      ...settings,
      playerOneName: next.displayName,
      playerTwoName: next.partnerDisplayName,
    });
  }
  return next;
}

export async function touchUserPresence(): Promise<void> {
  if (!isFirebaseConfigured()) return;
  const user = await ensureAnonAuth();
  const db = await getFirestoreDb();
  if (!user || !db) return;
  const { doc, serverTimestamp, setDoc } = await import('firebase/firestore');
  const now = Date.now();
  await setDoc(
    doc(db, 'users', user.uid),
    { lastSeenMs: now, updatedAtMs: now, updatedAt: serverTimestamp() },
    { merge: true },
  );
  const cached = getCachedUserProfile();
  if (cached && cached.uid === user.uid) {
    cacheLocal({ ...cached, lastSeenMs: now, updatedAtMs: now });
  }
}

export async function incrementGamesPlayed(): Promise<void> {
  const profile = await getUserProfile();
  if (!profile) return;
  const user = await ensureAnonAuth();
  const db = await getFirestoreDb();
  if (!user || !db) return;
  const { doc, increment, serverTimestamp, setDoc } = await import('firebase/firestore');
  const now = Date.now();
  await setDoc(
    doc(db, 'users', user.uid),
    {
      gamesPlayed: increment(1),
      lastSeenMs: now,
      updatedAtMs: now,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  cacheLocal({ ...profile, gamesPlayed: profile.gamesPlayed + 1, lastSeenMs: now, updatedAtMs: now });
}
