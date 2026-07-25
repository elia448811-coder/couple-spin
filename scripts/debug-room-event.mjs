import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  doc,
  getFirestore,
  setDoc,
  serverTimestamp,
  writeBatch,
  runTransaction,
  deleteDoc,
} from 'firebase/firestore';

function loadEnvFile(name) {
  const path = resolve(process.cwd(), name);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env) || process.env[key] === '') process.env[key] = value;
  }
}

loadEnvFile('.env');
loadEnvFile('.env.local');

const config = {
  apiKey: process.env.VITE_FIREBASE_API_KEY?.trim(),
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN?.trim(),
  projectId: process.env.VITE_FIREBASE_PROJECT_ID?.trim(),
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET?.trim(),
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim(),
  appId: process.env.VITE_FIREBASE_APP_ID?.trim(),
};

const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app);
const { user } = await signInAnonymously(auth);
const roomId = `test-${Date.now()}`;
const displayCode = String(10_000_000 + Math.floor(Math.random() * 90_000_000));
const now = Date.now();
const expiresAtMs = now + 2 * 60 * 60 * 1000;

const batch = writeBatch(db);
batch.set(doc(db, 'rooms', roomId), {
  roomId,
  displayCode,
  hostUid: user.uid,
  partnerUid: null,
  hostName: 'בדיקה',
  partnerName: null,
  status: 'waiting',
  createdAtMs: now,
  updatedAtMs: now,
  expiresAtMs,
  version: 0,
  eveningTitle: 'בדיקה',
  lastEventId: null,
  updatedBy: user.uid,
  hostReady: false,
  partnerReady: false,
  hostLastSeenMs: now,
  partnerLastSeenMs: 0,
  updatedAt: serverTimestamp(),
});
batch.set(doc(db, 'roomCodes', displayCode), {
  roomId,
  displayCode,
  expiresAtMs,
  hostUid: user.uid,
  createdAtMs: now,
});
await batch.commit();
console.log('created', { roomId, uid: user.uid });

try {
  await setDoc(doc(db, 'rooms', roomId, 'events', 'e1'), {
    type: 'PLAYER_READY',
    version: 1,
    createdBy: user.uid,
    createdAtMs: Date.now(),
    payload: { ready: true },
  });
  console.log('✓ event alone OK');
} catch (e) {
  console.log('✗ event alone FAIL:', e instanceof Error ? e.message : e);
}

try {
  await runTransaction(db, async (tx) => {
    const roomRef = doc(db, 'rooms', roomId);
    const snap = await tx.get(roomRef);
    const version = Number(snap.data()?.version) || 0;
    tx.set(doc(db, 'rooms', roomId, 'events', 'e2'), {
      type: 'PLAYER_READY',
      version: version + 1,
      createdBy: user.uid,
      createdAtMs: Date.now(),
      payload: { ready: true },
    });
    tx.update(roomRef, {
      version: version + 1,
      lastEventId: 'e2',
      updatedBy: user.uid,
      updatedAtMs: Date.now(),
    });
  });
  console.log('✓ transaction OK');
} catch (e) {
  console.log('✗ transaction FAIL:', e instanceof Error ? e.message : e);
}

try {
  await deleteDoc(doc(db, 'roomCodes', displayCode));
  await deleteDoc(doc(db, 'rooms', roomId));
} catch {
  /* ignore */
}
