import { getFirebaseAuth, isFirebaseConfigured } from '../lib/firebase';
import { ensureUserProfile } from './userProfile';

export type AuthResult = {
  ok: boolean;
  error?: string;
  uid?: string;
  email?: string | null;
};

function mapAuthError(error: unknown): string {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code: string }).code)
      : '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'האימייל כבר רשום — נסו להתחבר.';
    case 'auth/invalid-email':
      return 'כתובת אימייל לא תקינה.';
    case 'auth/weak-password':
      return 'הסיסמה חלשה מדי — לפחות 6 תווים.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'אימייל או סיסמה שגויים.';
    case 'auth/too-many-requests':
      return 'יותר מדי ניסיונות — המתינו ונסות שוב.';
    case 'auth/network-request-failed':
      return 'בעיית רשת — בדקו חיבור לאינטרנט.';
    case 'auth/operation-not-allowed':
      return 'התחברות באימייל לא מופעלת ב-Firebase. הפעילו Email/Password בקונסול.';
    case 'auth/credential-already-in-use':
      return 'האימייל מחובר כבר לחשבון אחר.';
    default:
      return error instanceof Error ? error.message : 'שגיאת התחברות.';
  }
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export async function getAuthUser() {
  if (!isFirebaseConfigured()) return null;
  const auth = await getFirebaseAuth();
  return auth?.currentUser ?? null;
}

export function subscribeAuth(listener: (user: { uid: string; email: string | null; isAnonymous: boolean } | null) => void): () => void {
  let unsub = () => {};
  void (async () => {
    const auth = await getFirebaseAuth();
    if (!auth) {
      listener(null);
      return;
    }
    const { onAuthStateChanged } = await import('firebase/auth');
    unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        listener(null);
        return;
      }
      listener({
        uid: user.uid,
        email: user.email,
        isAnonymous: user.isAnonymous,
      });
    });
  })();
  return () => unsub();
}

/** Register with email — links anonymous session when possible (keeps same uid). */
export async function registerWithEmail(
  email: string,
  password: string,
  displayName: string,
): Promise<AuthResult> {
  if (!isFirebaseConfigured()) return { ok: false, error: 'Firebase לא מוגדר.' };
  const trimmed = email.trim().toLowerCase();
  if (!isValidEmail(trimmed)) return { ok: false, error: 'כתובת אימייל לא תקינה.' };
  if (password.length < 6) return { ok: false, error: 'הסיסמה חייבת לפחות 6 תווים.' };

  try {
    const auth = await getFirebaseAuth();
    if (!auth) return { ok: false, error: 'Firebase לא זמין.' };

    const {
      createUserWithEmailAndPassword,
      EmailAuthProvider,
      linkWithCredential,
      updateProfile,
    } = await import('firebase/auth');

    let user = auth.currentUser;
    if (user?.isAnonymous) {
      const credential = EmailAuthProvider.credential(trimmed, password);
      const linked = await linkWithCredential(user, credential);
      user = linked.user;
    } else if (!user) {
      const created = await createUserWithEmailAndPassword(auth, trimmed, password);
      user = created.user;
    } else if (user.email) {
      return { ok: false, error: 'כבר מחוברים עם אימייל. התנתקו קודם או שמרו פרופיל.' };
    } else {
      const created = await createUserWithEmailAndPassword(auth, trimmed, password);
      user = created.user;
    }

    const name = displayName.trim().slice(0, 32) || trimmed.split('@')[0] || 'שחקן';
    await updateProfile(user, { displayName: name });
    await ensureUserProfile({ displayName: name });

    return { ok: true, uid: user.uid, email: user.email };
  } catch (error) {
    return { ok: false, error: mapAuthError(error) };
  }
}

export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  if (!isFirebaseConfigured()) return { ok: false, error: 'Firebase לא מוגדר.' };
  const trimmed = email.trim().toLowerCase();
  if (!isValidEmail(trimmed)) return { ok: false, error: 'כתובת אימייל לא תקינה.' };
  if (!password) return { ok: false, error: 'יש להזין סיסמה.' };

  try {
    const auth = await getFirebaseAuth();
    if (!auth) return { ok: false, error: 'Firebase לא זמין.' };
    const { signInWithEmailAndPassword } = await import('firebase/auth');
    const cred = await signInWithEmailAndPassword(auth, trimmed, password);
    await ensureUserProfile({
      displayName: cred.user.displayName || trimmed.split('@')[0] || 'שחקן',
    });
    return { ok: true, uid: cred.user.uid, email: cred.user.email };
  } catch (error) {
    return { ok: false, error: mapAuthError(error) };
  }
}

export async function signOutUser(): Promise<AuthResult> {
  try {
    const auth = await getFirebaseAuth();
    if (!auth) return { ok: true };
    const { signOut } = await import('firebase/auth');
    await signOut(auth);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mapAuthError(error) };
  }
}
