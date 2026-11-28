import { createRegisteredAccount } from './registration';
import { getFirebaseAuth, isFirebaseConfigured } from '../lib/firebase';
import { bindStorageAccount } from './accountStorage';
import { isSoleAdminEmail, isSoleAdminUid, SOLE_ADMIN_EMAIL } from './admin';
import { ensureUserProfile } from './userProfile';

/** Synthetic domain — Firebase Email/Password under the hood; users never see it. */
export const USERNAME_EMAIL_DOMAIN = 'users.couplespin.app';

export type AuthResult = {
  ok: boolean;
  error?: string;
  uid?: string;
  username?: string;
  email?: string | null;
};

export type AuthUserView = {
  uid: string;
  username: string | null;
  email: string | null;
  isAnonymous: boolean;
};

function mapAuthError(error: unknown): string {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code: string }).code)
      : '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'שם המשתמש כבר תפוס — נסו להתחבר או בחרו שם אחר.';
    case 'auth/invalid-email':
      return 'שם משתמש לא תקין.';
    case 'auth/weak-password':
      return 'הסיסמה חלשה מדי — לפחות 6 תווים.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'שם משתמש או סיסמה שגויים.';
    case 'auth/too-many-requests':
      return 'יותר מדי ניסיונות — המתינו ונסות שוב.';
    case 'auth/network-request-failed':
      return 'בעיית רשת — בדקו חיבור לאינטרנט.';
    case 'auth/operation-not-allowed':
      return 'התחברות לא מופעלת ב-Firebase. הפעילו Email/Password בקונסול.';
    case 'auth/credential-already-in-use':
      return 'שם המשתמש כבר מחובר לחשבון אחר.';
    default:
      return error instanceof Error ? error.message : 'שגיאת התחברות.';
  }
}

function toHex(value: string): string {
  return [...new TextEncoder().encode(value)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex: string): string | null {
  if (!hex || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) return null;
  try {
    const bytes = new Uint8Array(hex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Letters (any language), digits, underscore — 3–24 chars. */
export function isValidUsername(raw: string): boolean {
  const u = normalizeUsername(raw);
  return /^[\p{L}\p{N}_]{3,24}$/u.test(u);
}

export function usernameToEmail(username: string): string {
  const u = normalizeUsername(username);
  return `${toHex(u)}@${USERNAME_EMAIL_DOMAIN}`;
}

export function emailToUsername(email: string | null | undefined): string | null {
  if (!email) return null;
  const suffix = `@${USERNAME_EMAIL_DOMAIN}`;
  if (!email.toLowerCase().endsWith(suffix)) {
    // Legacy real-email accounts: show local part
    const at = email.indexOf('@');
    return at > 0 ? email.slice(0, at) : email;
  }
  return fromHex(email.slice(0, -suffix.length));
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export async function getAuthUser() {
  if (!isFirebaseConfigured()) return null;
  const auth = await getFirebaseAuth();
  return auth?.currentUser ?? null;
}

export function subscribeAuth(listener: (user: AuthUserView | null) => void): () => void {
  let unsub = () => {};
  let disposed = false;
  void (async () => {
    const auth = await getFirebaseAuth();
    if (!auth) {
      listener(null);
      return;
    }
    const { onAuthStateChanged } = await import('firebase/auth');
    if (disposed) return;
    unsub = onAuthStateChanged(auth, (user) => {
      if (!bindStorageAccount(user?.uid ?? null)) return;
      if (!user) {
        listener(null);
        return;
      }
      listener({
        uid: user.uid,
        username: emailToUsername(user.email) || user.displayName,
        email: user.email,
        isAnonymous: user.isAnonymous,
      });
    });
  })();
  return () => { disposed = true; unsub(); };
}

function resolveAuthEmail(identifier: string): { ok: true; email: string; label: string } | { ok: false; error: string } {
  const raw = identifier.trim();
  if (raw.includes('@')) {
    const email = raw.toLowerCase();
    if (!isValidEmail(email)) return { ok: false, error: 'כתובת אימייל לא תקינה.' };
    // Only the sole admin may use a real email; everyone else uses username.
    if (!isSoleAdminEmail(email)) {
      return { ok: false, error: 'התחברות באימייל שמורה למנהל המערכת. השתמשו בשם משתמש.' };
    }
    return { ok: true, email: SOLE_ADMIN_EMAIL, label: SOLE_ADMIN_EMAIL };
  }
  const userName = normalizeUsername(raw);
  if (!isValidUsername(userName)) {
    return { ok: false, error: 'שם משתמש: 3–24 תווים, אותיות/מספרים/_ בלבד.' };
  }
  return { ok: true, email: usernameToEmail(userName), label: userName };
}

/** Public registration accepts usernames only. */
export async function registerWithUsername(
  username: string,
  password: string,
  displayName?: string,
): Promise<AuthResult> {
  if (!isFirebaseConfigured()) return { ok: false, error: 'Firebase לא מוגדר.' };
  if (password.length < 6) return { ok: false, error: 'הסיסמה חייבת לפחות 6 תווים.' };

  if (!isValidUsername(username)) return { ok: false, error: 'שם משתמש: 3–24 תווים, אותיות/מספרים/_ בלבד.' };

  try {
    const auth = await getFirebaseAuth();
    if (!auth) return { ok: false, error: 'Firebase לא זמין.' };

    if (auth.currentUser && !auth.currentUser.isAnonymous) return { ok: false, error: 'כבר מחוברים. התנתקו קודם.' };
    await createRegisteredAccount({ username, password, displayName });
    return await signInWithUsername(username, password);
  } catch (error) {
    return { ok: false, error: mapAuthError(error) };
  }
}

export async function signInWithUsername(username: string, password: string): Promise<AuthResult> {
  if (!isFirebaseConfigured()) return { ok: false, error: 'Firebase לא מוגדר.' };
  if (!password) return { ok: false, error: 'יש להזין סיסמה.' };

  const resolved = resolveAuthEmail(username);
  if (!resolved.ok) return { ok: false, error: resolved.error };
  const { email, label } = resolved;

  try {
    const auth = await getFirebaseAuth();
    if (!auth) return { ok: false, error: 'Firebase לא זמין.' };
    const { signInWithEmailAndPassword, signOut } = await import('firebase/auth');
    const cred = await signInWithEmailAndPassword(auth, email, password);
    if (isSoleAdminEmail(email) && !isSoleAdminUid(cred.user.uid)) {
      await signOut(auth);
      return { ok: false, error: 'חשבון המנהל אינו תואם להגדרות המערכת.' };
    }
    await ensureUserProfile({
      displayName: cred.user.displayName || label,
      username: label,
    });
    return { ok: true, uid: cred.user.uid, username: label, email: cred.user.email };
  } catch (error) {
    return { ok: false, error: mapAuthError(error) };
  }
}

export async function signOutUser(): Promise<AuthResult> {
  try {
    const auth = await getFirebaseAuth();
    const { cancelCloudSync } = await import('./cloudSync');
    cancelCloudSync();
    if (!auth) { bindStorageAccount(null); return { ok: true }; }
    const { signOut } = await import('firebase/auth');
    await signOut(auth);
    bindStorageAccount(null);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mapAuthError(error) };
  }
}
