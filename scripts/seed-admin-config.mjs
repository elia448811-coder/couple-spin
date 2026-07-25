/**
 * Seeds config/app + admins/{uid} for test_host.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getFirestore, setDoc, getDoc } from 'firebase/firestore';

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

const DOMAIN = 'users.couplespin.app';
function usernameToEmail(username) {
  return `${Buffer.from(username.trim().toLowerCase(), 'utf8').toString('hex')}@${DOMAIN}`;
}

const config = {
  apiKey: process.env.VITE_FIREBASE_API_KEY?.trim(),
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN?.trim(),
  projectId: process.env.VITE_FIREBASE_PROJECT_ID?.trim(),
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET?.trim(),
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim(),
  appId: process.env.VITE_FIREBASE_APP_ID?.trim(),
};

const username = 'test_host';
const password = 'CoupleTest1!';
const email = usernameToEmail(username);

const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app);

const cred = await signInWithEmailAndPassword(auth, email, password);
console.log('signed in', cred.user.uid);

await setDoc(
  doc(db, 'admins', cred.user.uid),
  { uid: cred.user.uid, username, createdAtMs: Date.now() },
  { merge: true },
);
console.log('✓ admins/' + cred.user.uid);

const site = {
  registrationEnabled: true,
  adminUsernames: ['test_host'],
  welcomeTitle: 'ספין זוגי',
  welcomeSubtitle: 'התחברו עם שם משתמש וסיסמה כדי להתחיל',
  updatedAtMs: Date.now(),
  updatedBy: cred.user.uid,
};
await setDoc(doc(db, 'config', 'app'), site, { merge: true });
console.log('✓ config/app');

const check = await getDoc(doc(db, 'config', 'app'));
console.log('config:', check.data());

await signOut(auth);
console.log(JSON.stringify({ ok: true, adminUid: cred.user.uid }, null, 2));
process.exit(0);
