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

if (!config.apiKey || !config.projectId) {
  console.error('Missing Firebase config');
  process.exit(2);
}

const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app);

const { user } = await signInAnonymously(auth);
const now = Date.now();
const ref = doc(db, 'users', user.uid);

try {
  await setDoc(ref, {
    uid: user.uid,
    displayName: 'בדיקה',
    partnerDisplayName: 'שותף',
    avatar: '💜',
    createdAtMs: now,
    lastSeenMs: now,
    updatedAtMs: now,
    schemaVersion: 1,
    lastRoomId: null,
    gamesPlayed: 0,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  });
  console.log('✓ create users/{uid}');

  await setDoc(ref, { lastSeenMs: Date.now(), updatedAtMs: Date.now() }, { merge: true });
  console.log('✓ touch presence');

  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data()?.displayName !== 'בדיקה') {
    throw new Error('profile read mismatch');
  }
  console.log('✓ read profile');
  console.log(JSON.stringify({ ok: true, uid: user.uid, projectId: config.projectId }, null, 2));
} catch (error) {
  console.error('✗ user profile test failed:', error instanceof Error ? error.message : error);
  process.exit(1);
} finally {
  try {
    await deleteDoc(ref);
  } catch {
    /* ignore — delete may be denied by rules */
  }
}
