import { getFirebaseAuth, isFirebaseConfigured } from '../lib/firebase';

/** Sole permanent admin — cannot be changed or shared via UI/config. */
export const SOLE_ADMIN_EMAIL = 'elia448811@gmail.com';

export function isSoleAdminEmail(email: string | null | undefined): boolean {
  return (email ?? '').trim().toLowerCase() === SOLE_ADMIN_EMAIL;
}

export function isCurrentUserAdminSync(email: string | null | undefined): boolean {
  return isSoleAdminEmail(email);
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;
  const auth = await getFirebaseAuth();
  const user = auth?.currentUser;
  if (!user || user.isAnonymous) return false;
  return isSoleAdminEmail(user.email);
}

/** No multi-admin bootstrap — kept as no-op for call sites. */
export async function ensureAdminBootstrap(): Promise<boolean> {
  return isCurrentUserAdmin();
}
