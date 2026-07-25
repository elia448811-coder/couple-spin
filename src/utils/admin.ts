import { doc, getDoc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { getFirebaseAuth, getFirestoreDb, isFirebaseConfigured } from '../lib/firebase';
import { emailToUsername, normalizeUsername } from './userAuth';
import { fetchSiteConfig, saveSiteConfig } from './siteConfig';

export type AdminRecord = {
  uid: string;
  username: string;
  createdAtMs: number;
};

export async function isCurrentUserAdmin(): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;
  const auth = await getFirebaseAuth();
  const user = auth?.currentUser;
  if (!user || user.isAnonymous) return false;

  const db = await getFirestoreDb();
  if (!db) return false;

  const adminSnap = await getDoc(doc(db, 'admins', user.uid));
  if (adminSnap.exists()) return true;

  // Bootstrap: listed in config.adminUsernames
  const username = emailToUsername(user.email);
  if (!username) return false;
  const config = await fetchSiteConfig();
  return config.adminUsernames.includes(normalizeUsername(username));
}

export async function ensureAdminBootstrap(): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;
  const auth = await getFirebaseAuth();
  const user = auth?.currentUser;
  if (!user || user.isAnonymous) return false;
  const username = emailToUsername(user.email);
  if (!username) return false;

  const config = await fetchSiteConfig();
  if (!config.adminUsernames.includes(normalizeUsername(username))) return false;

  const db = await getFirestoreDb();
  if (!db) return false;
  const ref = doc(db, 'admins', user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      username: normalizeUsername(username),
      createdAtMs: Date.now(),
    });
  }
  // Ensure config doc exists
  if (!config.updatedAtMs) {
    await saveSiteConfig({}, user.uid);
  }
  return true;
}

export async function listAdmins(): Promise<AdminRecord[]> {
  const db = await getFirestoreDb();
  if (!db) return [];
  const snap = await getDocs(collection(db, 'admins'));
  return snap.docs.map((d) => {
    const raw = d.data();
    return {
      uid: d.id,
      username: String(raw.username ?? ''),
      createdAtMs: Number(raw.createdAtMs) || 0,
    };
  });
}

/** Add admin by username — must already have a users/{uid} or we only update config list.
 *  New admins get listed in config; they self-bootstrap admins/{uid} on next login. */
export async function addAdminUsername(username: string, updatedBy: string): Promise<{ ok: boolean; error?: string }> {
  const u = normalizeUsername(username);
  if (!u) return { ok: false, error: 'שם משתמש ריק.' };
  const config = await fetchSiteConfig();
  if (config.adminUsernames.includes(u)) return { ok: true };
  await saveSiteConfig({ adminUsernames: [...config.adminUsernames, u] }, updatedBy);
  return { ok: true };
}

export async function removeAdminUsername(
  username: string,
  updatedBy: string,
): Promise<{ ok: boolean; error?: string }> {
  const u = normalizeUsername(username);
  const config = await fetchSiteConfig();
  if (config.adminUsernames.length <= 1 && config.adminUsernames.includes(u)) {
    return { ok: false, error: 'חובה להשאיר לפחות מנהל אחד.' };
  }
  const next = config.adminUsernames.filter((x) => x !== u);
  await saveSiteConfig({ adminUsernames: next }, updatedBy);

  // Remove matching admins docs
  const admins = await listAdmins();
  for (const a of admins) {
    if (normalizeUsername(a.username) === u) {
      const db = await getFirestoreDb();
      if (db) await deleteDoc(doc(db, 'admins', a.uid));
    }
  }
  return { ok: true };
}
