import { getFirebaseAuth, isFirebaseConfigured } from '../lib/firebase';

/** Sole permanent admin UID (Firebase Auth) — source of truth for privilege checks. */
export const SOLE_ADMIN_UID_DEFAULT = 'tpbKWXtXWFapFC7Fd80Wd4IMqxC2';

/** Kept for login UX — admin may sign in with this email; privilege is still UID-based. */
export const SOLE_ADMIN_EMAIL = 'elia448811@gmail.com';

export function getSoleAdminUid(): string {
  const fromEnv =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_ADMIN_UID
      ? String(import.meta.env.VITE_ADMIN_UID).trim()
      : '';
  return fromEnv || SOLE_ADMIN_UID_DEFAULT;
}

export function isSoleAdminUid(uid: string | null | undefined): boolean {
  return Boolean(uid && uid === getSoleAdminUid());
}

export function isSoleAdminEmail(email: string | null | undefined): boolean {
  return (email ?? '').trim().toLowerCase() === SOLE_ADMIN_EMAIL;
}

export async function getCurrentUid(): Promise<string | null> {
  if (!isFirebaseConfigured()) return null;
  const auth = await getFirebaseAuth();
  const user = auth?.currentUser;
  if (!user || user.isAnonymous) return null;
  return user.uid;
}

/** True only when Firebase Auth session UID matches the locked admin UID. */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const uid = await getCurrentUid();
  return isSoleAdminUid(uid);
}

/**
 * Call before every admin write. Relies on Auth UID from Firebase SDK
 * (cannot be spoofed — token verified by Firestore rules as well).
 */
export async function assertAdmin(): Promise<string> {
  const uid = await getCurrentUid();
  if (!isSoleAdminUid(uid)) {
    throw new Error('אין הרשאת מנהל — הבקשה נדחתה.');
  }
  return uid!;
}

export async function ensureAdminBootstrap(): Promise<boolean> {
  return isCurrentUserAdmin();
}
