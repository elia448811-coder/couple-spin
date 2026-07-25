import { collection, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import { getFirebaseAuth, getFirestoreDb } from '../lib/firebase';
import { assertAdmin } from './admin';

export type AdminUserRow = {
  uid: string;
  displayName: string;
  partnerDisplayName: string;
  gamesPlayed: number;
  lastSeenMs: number;
  createdAtMs: number;
  lastRoomId: string | null;
  banned: boolean;
  adminNote: string;
};

function parseUser(uid: string, raw: Record<string, unknown>): AdminUserRow {
  return {
    uid,
    displayName: String(raw.displayName ?? ''),
    partnerDisplayName: String(raw.partnerDisplayName ?? ''),
    gamesPlayed: Math.max(0, Number(raw.gamesPlayed) || 0),
    lastSeenMs: Number(raw.lastSeenMs) || 0,
    createdAtMs: Number(raw.createdAtMs) || 0,
    lastRoomId: typeof raw.lastRoomId === 'string' ? raw.lastRoomId : null,
    banned: Boolean(raw.banned),
    adminNote: typeof raw.adminNote === 'string' ? raw.adminNote : '',
  };
}

export async function listAppUsers(max = 300): Promise<AdminUserRow[]> {
  await assertAdmin();
  const db = await getFirestoreDb();
  if (!db) return [];
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs
    .map((d) => parseUser(d.id, d.data() as Record<string, unknown>))
    .sort((a, b) => b.lastSeenMs - a.lastSeenMs)
    .slice(0, max);
}

export async function setUserBanned(uid: string, banned: boolean): Promise<void> {
  await assertAdmin();
  const db = await getFirestoreDb();
  if (!db) throw new Error('Firestore לא זמין');
  await updateDoc(doc(db, 'users', uid), {
    banned,
    updatedAtMs: Date.now(),
  });
}

export async function setUserAdminNote(uid: string, adminNote: string): Promise<void> {
  await assertAdmin();
  const db = await getFirestoreDb();
  if (!db) throw new Error('Firestore לא זמין');
  await updateDoc(doc(db, 'users', uid), {
    adminNote: adminNote.trim().slice(0, 200),
    updatedAtMs: Date.now(),
  });
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
