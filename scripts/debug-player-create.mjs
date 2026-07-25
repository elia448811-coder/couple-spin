import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { doc, getDoc, getFirestore, setDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';

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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env) || process.env[key] === '') process.env[key] = value;
  }
}

loadEnvFile('.env.local');
const app = initializeApp({
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
});
const db = getFirestore(app);
const { user } = await signInAnonymously(getAuth(app));
const roomId = `debug-${Date.now()}`;
const now = Date.now();

await setDoc(doc(db, 'rooms', roomId), {
  roomId,
  displayCode: '111111',
  hostUid: user.uid,
  partnerUid: null,
  hostName: 't',
  partnerName: null,
  status: 'waiting',
  createdAtMs: now,
  updatedAtMs: now,
  expiresAtMs: now + 7_200_000,
  version: 0,
  eveningTitle: 't',
  lastEventId: null,
  updatedBy: user.uid,
  updatedAt: serverTimestamp(),
});

const roomSnap = await getDoc(doc(db, 'rooms', roomId));
console.log('room read ok:', roomSnap.exists());
console.log('hostUid:', roomSnap.data()?.hostUid);
console.log('auth uid:', user.uid);
console.log('match:', roomSnap.data()?.hostUid === user.uid);

try {
  await setDoc(doc(db, 'rooms', roomId, 'players', user.uid), { name: 't', ready: false });
  console.log('player create: OK');
} catch (e) {
  console.error('player create: FAIL', e.message);
}

await deleteDoc(doc(db, 'rooms', roomId)).catch(() => {});
