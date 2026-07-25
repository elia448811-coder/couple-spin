/**
 * Verifies Firebase web config + Anonymous Auth + Firestore write/read.
 * Loads VITE_FIREBASE_* from .env / .env.local / process.env.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { doc, getDoc, getFirestore, setDoc, serverTimestamp } from 'firebase/firestore';

function loadEnvFile(name) {
  const path = resolve(process.cwd(), name);
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8');
  for (const line of text.split(/\r?\n/)) {
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

const keys = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];

const missing = keys.filter((key) => !String(process.env[key] || '').trim());
if (missing.length) {
  console.error('Firebase not configured. Missing:', missing.join(', '));
  console.error('Add values to .env.local (see .env.example) then re-run: npm run check:firebase');
  process.exit(2);
}

const config = {
  apiKey: process.env.VITE_FIREBASE_API_KEY.trim(),
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN.trim(),
  projectId: process.env.VITE_FIREBASE_PROJECT_ID.trim(),
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET.trim(),
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID.trim(),
  appId: process.env.VITE_FIREBASE_APP_ID.trim(),
};

try {
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const { user } = await signInAnonymously(auth);
  const ref = doc(db, 'users', user.uid, 'meta', 'health');
  await setDoc(
    ref,
    { ok: true, at: serverTimestamp(), source: 'check-firebase', schemaVersion: 1 },
    { merge: true },
  );
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('health document missing after write');
  console.log(
    JSON.stringify(
      {
        ok: true,
        projectId: config.projectId,
        uid: user.uid,
        health: snap.data(),
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error('Firebase connection failed:', error instanceof Error ? error.message : error);
  console.error(
    'Ensure Anonymous Auth is enabled and Firestore rules allow users/{uid}/** for authenticated users.',
  );
  process.exit(1);
}
