import { doc, getDoc, setDoc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { getFirestoreDb, isFirebaseConfigured } from '../lib/firebase';
import { assertAdmin } from './admin';

export type SiteConfig = {
  registrationEnabled: boolean;
  welcomeTitle: string;
  welcomeSubtitle: string;
  updatedAtMs: number;
  updatedBy: string | null;
};

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  registrationEnabled: true,
  welcomeTitle: 'ספין זוגי',
  welcomeSubtitle: 'התחברו עם שם משתמש וסיסמה כדי להתחיל',
  updatedAtMs: 0,
  updatedBy: null,
};

function parseConfig(raw: Record<string, unknown> | undefined): SiteConfig {
  if (!raw) return { ...DEFAULT_SITE_CONFIG };
  return {
    registrationEnabled: raw.registrationEnabled !== false,
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
  patch: Partial<Pick<SiteConfig, 'registrationEnabled' | 'welcomeTitle' | 'welcomeSubtitle'>>,
  updatedBy?: string,
): Promise<SiteConfig | null> {
  if (!isFirebaseConfigured()) return null;
  const adminUid = await assertAdmin();
  const db = await getFirestoreDb();
  if (!db) return null;
  const current = await fetchSiteConfig();
  const next: SiteConfig = {
    ...current,
    ...patch,
    welcomeTitle: (patch.welcomeTitle ?? current.welcomeTitle).trim().slice(0, 80) || DEFAULT_SITE_CONFIG.welcomeTitle,
    welcomeSubtitle:
      (patch.welcomeSubtitle ?? current.welcomeSubtitle).trim().slice(0, 200) || DEFAULT_SITE_CONFIG.welcomeSubtitle,
    updatedAtMs: Date.now(),
    updatedBy: updatedBy || adminUid,
  };
  await setDoc(doc(db, 'config', 'app'), next, { merge: true });
  return next;
}
