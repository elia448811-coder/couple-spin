import { doc, getDoc, setDoc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { getFirestoreDb, isFirebaseConfigured } from '../lib/firebase';
import { emailToUsername } from './userAuth';

export type SiteConfig = {
  registrationEnabled: boolean;
  adminUsernames: string[];
  welcomeTitle: string;
  welcomeSubtitle: string;
  updatedAtMs: number;
  updatedBy: string | null;
};

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  registrationEnabled: true,
  adminUsernames: ['test_host'],
  welcomeTitle: 'ספין זוגי',
  welcomeSubtitle: 'התחברו עם שם משתמש וסיסמה כדי להתחיל',
  updatedAtMs: 0,
  updatedBy: null,
};

function parseConfig(raw: Record<string, unknown> | undefined): SiteConfig {
  if (!raw) return { ...DEFAULT_SITE_CONFIG };
  const admins = Array.isArray(raw.adminUsernames)
    ? raw.adminUsernames.filter((u): u is string => typeof u === 'string').map((u) => u.trim().toLowerCase())
    : DEFAULT_SITE_CONFIG.adminUsernames;
  return {
    registrationEnabled: raw.registrationEnabled !== false,
    adminUsernames: admins.length ? admins : DEFAULT_SITE_CONFIG.adminUsernames,
    welcomeTitle:
      typeof raw.welcomeTitle === 'string' && raw.welcomeTitle.trim()
        ? raw.welcomeTitle.trim().slice(0, 80)
        : DEFAULT_SITE_CONFIG.welcomeTitle,
    welcomeSubtitle:
      typeof raw.welcomeSubtitle === 'string' && raw.welcomeSubtitle.trim()
        ? raw.welcomeSubtitle.trim().slice(0, 200)
        : DEFAULT_SITE_CONFIG.welcomeSubtitle,
    updatedAtMs: Number(raw.updatedAtMs) || 0,
    updatedBy: typeof raw.updatedBy === 'string' ? raw.updatedBy : null,
  };
}

/** Public read — works before login (for registration toggle + welcome text). */
export async function fetchSiteConfig(): Promise<SiteConfig> {
  if (!isFirebaseConfigured()) return { ...DEFAULT_SITE_CONFIG };
  try {
    const db = await getFirestoreDb();
    if (!db) return { ...DEFAULT_SITE_CONFIG };
    const snap = await getDoc(doc(db, 'config', 'app'));
    if (!snap.exists()) return { ...DEFAULT_SITE_CONFIG };
    return parseConfig(snap.data() as Record<string, unknown>);
  } catch {
    return { ...DEFAULT_SITE_CONFIG };
  }
}

export function subscribeSiteConfig(listener: (config: SiteConfig) => void): () => void {
  let unsub: Unsubscribe = () => {};
  let cancelled = false;
  void (async () => {
    if (!isFirebaseConfigured()) {
      listener({ ...DEFAULT_SITE_CONFIG });
      return;
    }
    const db = await getFirestoreDb();
    if (!db || cancelled) {
      listener({ ...DEFAULT_SITE_CONFIG });
      return;
    }
    unsub = onSnapshot(
      doc(db, 'config', 'app'),
      (snap) => {
        listener(snap.exists() ? parseConfig(snap.data() as Record<string, unknown>) : { ...DEFAULT_SITE_CONFIG });
      },
      () => listener({ ...DEFAULT_SITE_CONFIG }),
    );
  })();
  return () => {
    cancelled = true;
    unsub();
  };
}

export async function saveSiteConfig(
  patch: Partial<Pick<SiteConfig, 'registrationEnabled' | 'adminUsernames' | 'welcomeTitle' | 'welcomeSubtitle'>>,
  updatedBy: string,
): Promise<SiteConfig | null> {
  if (!isFirebaseConfigured()) return null;
  const db = await getFirestoreDb();
  if (!db) return null;
  const current = await fetchSiteConfig();
  const next: SiteConfig = {
    ...current,
    ...patch,
    adminUsernames: (patch.adminUsernames ?? current.adminUsernames).map((u) => u.trim().toLowerCase()).filter(Boolean),
    welcomeTitle: (patch.welcomeTitle ?? current.welcomeTitle).trim().slice(0, 80) || DEFAULT_SITE_CONFIG.welcomeTitle,
    welcomeSubtitle:
      (patch.welcomeSubtitle ?? current.welcomeSubtitle).trim().slice(0, 200) || DEFAULT_SITE_CONFIG.welcomeSubtitle,
    updatedAtMs: Date.now(),
    updatedBy,
  };
  await setDoc(doc(db, 'config', 'app'), next, { merge: true });
  return next;
}

export function usernameFromAuthEmail(email: string | null | undefined): string | null {
  return emailToUsername(email);
}
