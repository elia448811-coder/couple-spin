import { getFirebaseAuth, isFirebaseConfigured } from '../lib/firebase';

/** Provisioned Firebase UID, shared with firestore.rules. */
export const SOLE_ADMIN_UID_DEFAULT = 'tpbKWXtXWFapFC7Fd80Wd4IMqxC2';

/** Login alias for the administrator. */
export const SOLE_ADMIN_EMAIL = 'elia448811@gmail.com';

export function getSoleAdminUid(): string {
  return SOLE_ADMIN_UID_DEFAULT;
}

export function isSoleAdminUid(uid: string | null | undefined): boolean {
  return Boolean(uid && uid === getSoleAdminUid());
}

export function isSoleAdminEmail(email: string | null | undefined): boolean {
  return (email ?? '').trim().toLowerCase() === SOLE_ADMIN_EMAIL;
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

export async function isCurrentUserAdmin(): Promise<boolean> {
  const id = await getCurrentAuthIdentity();
  if (!id) return false;
  return isSoleAdminUid(id.uid);
}

/**
 * Call before every admin write. Uses Firebase Auth session
 * (UID verified again by Firestore rules).
 */
export async function assertAdmin(): Promise<string> {
  const id = await getCurrentAuthIdentity();
  if (!id || !isSoleAdminUid(id.uid)) {
    throw new Error('אין הרשאת מנהל — הבקשה נדחתה.');
  }
  return id.uid;
}

export async function ensureAdminBootstrap(): Promise<boolean> {
  return isCurrentUserAdmin();
}
