import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { doc, getDoc, getFirestore, setDoc, serverTimestamp, updateDoc, deleteDoc } from 'firebase/firestore';

function loadEnvFile(name) {
  const path = resolve(process.cwd(), name);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(k in process.env) || process.env[k] === '') process.env[k] = v;
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
const roomId = `dbg-${Date.now()}`;
const now = Date.now();

await setDoc(doc(db, 'rooms', roomId), {
  roomId,
  displayCode: '999999',
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
  hostReady: false,
  hostLastSeenMs: now,
  partnerLastSeenMs: 0,
  updatedAt: serverTimestamp(),
});
console.log('create ok');

try {
  const snap = await getDoc(doc(db, 'rooms', roomId));
  console.log('read ok:', snap.exists(), snap.data()?.hostUid, user.uid);
} catch (e) {
  console.error('read fail:', e.message);
}

try {
  await updateDoc(doc(db, 'rooms', roomId), { hostReady: true });
  console.log('update ok');
} catch (e) {
  console.error('update fail:', e.message);
}

await deleteDoc(doc(db, 'rooms', roomId)).catch(() => {});
