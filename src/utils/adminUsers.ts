import { collection, deleteField, doc, getDoc, getDocs, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { getFirebaseAuth, getFirestoreDb, isFirebaseConfigured, readFirebaseWebConfig } from '../lib/firebase';
import { assertAdmin, isSoleAdminUid } from './admin';
import { isValidUsername, normalizeUsername, usernameToEmail } from './userAuth';

function assertNotSoleAdminTarget(uid: string, action: string): void {
  if (isSoleAdminUid(uid)) {
    throw new Error(`לא ניתן לבצע ${action} על חשבון מנהל המערכת.`);
  }
}

export type AdminUserRow = {
  uid: string;
  username: string;
  displayName: string;
  partnerDisplayName: string;
  gamesPlayed: number;
  lastSeenMs: number;
  createdAtMs: number;
  lastRoomId: string | null;
  banned: boolean;
  approved: boolean;
  pending: boolean;
  adminNote: string;
};

export function hasAccountApproval(profile: { approved?: unknown } | undefined): boolean {
  return profile?.approved === true;
}

function parseUser(uid: string, raw: Record<string, unknown>, privateNote?: string): AdminUserRow {
  const approved = hasAccountApproval(raw);
  return {
    uid,
    username: typeof raw.username === 'string' ? raw.username : '',
    displayName: String(raw.displayName ?? ''),
    partnerDisplayName: String(raw.partnerDisplayName ?? ''),
    gamesPlayed: Math.max(0, Number(raw.gamesPlayed) || 0),
    lastSeenMs: Number(raw.lastSeenMs) || 0,
    createdAtMs: Number(raw.createdAtMs) || 0,
    lastRoomId: typeof raw.lastRoomId === 'string' ? raw.lastRoomId : null,
    banned: Boolean(raw.banned),
    approved,
    pending: !approved && !raw.banned,
    adminNote: privateNote ?? (typeof raw.adminNote === 'string' ? raw.adminNote : ''),
  };
}

export async function listAppUsers(max = 500): Promise<AdminUserRow[]> {
  await assertAdmin();
  const db = await getFirestoreDb();
  if (!db) return [];
  const [snap, notes] = await Promise.all([
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'adminUserNotes')),
  ]);
  const byUid = new Map(notes.docs.map(d => [d.id, String(d.data().note ?? '')]));
  return snap.docs
    .map((d) => parseUser(d.id, d.data(), byUid.get(d.id)))
    .sort((a, b) => {
      if (a.pending !== b.pending) return a.pending ? -1 : 1;
      return b.lastSeenMs - a.lastSeenMs;
    })
    .slice(0, max);
}

export async function setUserBanned(uid: string, banned: boolean): Promise<void> {
  await assertAdmin();
  if (banned) assertNotSoleAdminTarget(uid, 'חסימה');
  const db = await getFirestoreDb();
  if (!db) throw new Error('Firestore לא זמין');
  await updateDoc(doc(db, 'users', uid), {
    banned,
    updatedAtMs: Date.now(),
  });
}

export async function setUserApproved(uid: string, approved: boolean): Promise<void> {
  await assertAdmin();
  if (!approved) assertNotSoleAdminTarget(uid, 'ביטול אישור');
  const db = await getFirestoreDb();
  if (!db) throw new Error('Firestore לא זמין');
  const patch: Record<string, unknown> = {
    approved,
    updatedAtMs: Date.now(),
  };
  if (approved) patch.banned = false;
  await updateDoc(doc(db, 'users', uid), patch);
}

export async function setUserAdminNote(uid: string, adminNote: string): Promise<void> {
  await assertAdmin();
  const db = await getFirestoreDb();
  if (!db) throw new Error('Firestore לא זמין');
  const batch = writeBatch(db);
  batch.set(doc(db, 'adminUserNotes', uid), { note: adminNote.trim().slice(0, 200) });
  batch.update(doc(db, 'users', uid), { adminNote: deleteField(), updatedAtMs: Date.now() });
  await batch.commit();
}

export async function isCurrentUserBanned(): Promise<boolean> {
  const auth = await getFirebaseAuth();
  const user = auth?.currentUser;
  if (!user || user.isAnonymous) return false;
  const db = await getFirestoreDb();
  if (!db) return false;
  const snap = await getDoc(doc(db, 'users', user.uid));
  return Boolean(snap.exists() && (snap.data() as { banned?: boolean }).banned);
}

/** Legacy profiles without an approval are reviewed through the same admin queue. */
export async function isCurrentUserPendingApproval(): Promise<boolean> {
  const auth = await getFirebaseAuth();
  const user = auth?.currentUser;
  if (!user || user.isAnonymous) return false;
  if (isSoleAdminUid(user.uid)) return false;
  const db = await getFirestoreDb();
  if (!db) return true;
  const snap = await getDoc(doc(db, 'users', user.uid));
  return !hasAccountApproval(snap.data());
}

/**
 * Create Auth user + approved profile without signing out the admin session
 * (secondary Firebase app).
 */
export async function createAppUserByAdmin(input: {
  username: string;
  password: string;
  displayName?: string;
  approved?: boolean;
}): Promise<{ uid: string; username: string }> {
  await assertAdmin();
  if (!isFirebaseConfigured()) throw new Error('Firebase לא מוגדר');
  const username = normalizeUsername(input.username);
  if (!isValidUsername(username)) {
    throw new Error('שם משתמש: 3–24 תווים, אותיות/מספרים/_ בלבד.');
  }
  if (input.password.length < 6) throw new Error('הסיסמה חייבת לפחות 6 תווים.');

  const config = readFirebaseWebConfig();
  if (!config) throw new Error('Firebase לא מוגדר');

  const { initializeApp, deleteApp } = await import('firebase/app');
  const { createUserWithEmailAndPassword, getAuth, signOut, updateProfile } = await import('firebase/auth');

  const secondary = initializeApp(config, `admin-create-${Date.now()}`);
  try {
    const secondaryAuth = getAuth(secondary);
    const email = usernameToEmail(username);
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, input.password);
    const name = (input.displayName?.trim() || username).slice(0, 32);
    await updateProfile(cred.user, { displayName: name });

    const db = await getFirestoreDb();
    if (!db) throw new Error('Firestore לא זמין');
    const now = Date.now();
    const approved = input.approved !== false;
    await setDoc(doc(db, 'users', cred.user.uid), {
      uid: cred.user.uid,
      username,
      displayName: name,
      partnerDisplayName: 'שחקן 2',
      avatar: '💜',
      createdAtMs: now,
      lastSeenMs: now,
      updatedAtMs: now,
      schemaVersion: 1,
      lastRoomId: null,
      gamesPlayed: 0,
      approved,
      banned: false,
    });

    await signOut(secondaryAuth);
    return { uid: cred.user.uid, username };
  } finally {
    await deleteApp(secondary).catch(() => undefined);
  }
}
