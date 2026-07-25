import { getFirebaseAuth, isFirebaseConfigured } from '../lib/firebase';

/** Locked admin UID (if this matches the Gmail account). */
export const SOLE_ADMIN_UID_DEFAULT = 'tpbKWXtXWFapFC7Fd80Wd4IMqxC2';

/** Locked admin email — also grants admin (Auth token email cannot be spoofed). */
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

export function isSoleAdminIdentity(uid: string | null | undefined, email: string | null | undefined): boolean {
  return isSoleAdminUid(uid) || isSoleAdminEmail(email);
}

export async function getCurrentAuthIdentity(): Promise<{ uid: string; email: string | null } | null> {
  if (!isFirebaseConfigured()) return null;
  const auth = await getFirebaseAuth();
  const user = auth?.currentUser;
  if (!user || user.isAnonymous) return null;
  return { uid: user.uid, email: user.email };
}

export async function getCurrentUid(): Promise<string | null> {
  const id = await getCurrentAuthIdentity();
  return id?.uid ?? null;
}

/** Admin if Auth UID or Auth email matches the locked sole admin. */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const id = await getCurrentAuthIdentity();
  if (!id) return false;
  return isSoleAdminIdentity(id.uid, id.email);
}

/**
 * Call before every admin write. Uses Firebase Auth session
 * (UID/email from token — verified again by Firestore rules).
 */
export async function assertAdmin(): Promise<string> {
  const id = await getCurrentAuthIdentity();
  if (!id || !isSoleAdminIdentity(id.uid, id.email)) {
    throw new Error('אין הרשאת מנהל — הבקשה נדחתה.');
  }
  return id.uid;
}

export async function ensureAdminBootstrap(): Promise<boolean> {
  return isCurrentUserAdmin();
}
