/**
 * Seeds config only after authenticating the independently provisioned admin UID.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, getFirestore, setDoc } from 'firebase/firestore';

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

const ADMIN_EMAIL = 'elia448811@gmail.com';
const password = (process.env.ADMIN_PASSWORD || process.argv[2] || '').trim();

if (!password || password.length < 6) {
  console.error('Usage: ADMIN_PASSWORD=yourpass npm run ensure:sole-admin');
  console.error('   or: npm run ensure:sole-admin -- YourPass123');
  process.exit(2);
}

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

const signed = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, password);
const uid = signed.user.uid;
if (uid !== 'tpbKWXtXWFapFC7Fd80Wd4IMqxC2') {
  await signOut(auth);
  throw new Error('The signed-in account does not match the provisioned administrator UID');
}

await setDoc(
  doc(db, 'config', 'app'),
  {
    registrationEnabled: true,
    welcomeTitle: 'ספין זוגי',
    welcomeSubtitle: 'התחברו עם שם משתמש וסיסמה כדי להתחיל',
    updatedAtMs: Date.now(),
    updatedBy: uid,
  },
  { merge: true },
);
console.log('✓ config/app');

await signOut(auth);
console.log(JSON.stringify({ ok: true, email: ADMIN_EMAIL, uid }, null, 2));
process.exit(0);
