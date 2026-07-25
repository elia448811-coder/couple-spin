/**
 * Creates two stable test users (username + password) and saves credentials
 * to test-users.local.json (gitignored).
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';

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

function toHex(value) {
  return Buffer.from(value, 'utf8').toString('hex');
}

function usernameToEmail(username) {
  return `${toHex(username.trim().toLowerCase())}@${DOMAIN}`;
}

const USERS = [
  {
    username: 'test_host',
    password: 'CoupleTest1!',
    displayName: 'מארח בדיקה',
    role: 'host',
  },
  {
    username: 'test_partner',
    password: 'CoupleTest2!',
    displayName: 'שותף בדיקה',
    role: 'partner',
  },
];

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
const outPath = resolve(process.cwd(), 'test-users.local.json');
const results = [];

for (const u of USERS) {
  const email = usernameToEmail(u.username);
  await signOut(auth).catch(() => {});
  try {
    const created = await createUserWithEmailAndPassword(auth, email, u.password);
    await updateProfile(created.user, { displayName: u.displayName });
    console.log('✓ created', u.username, created.user.uid);
    results.push({ ...u, email, uid: created.user.uid, status: 'created' });
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : '';
    if (code === 'auth/email-already-in-use') {
      const signed = await signInWithEmailAndPassword(auth, email, u.password);
      console.log('✓ exists (login ok)', u.username, signed.user.uid);
      results.push({ ...u, email, uid: signed.user.uid, status: 'existing' });
    } else {
      console.error('✗', u.username, code || (error instanceof Error ? error.message : error));
      process.exit(1);
    }
  }
}

await signOut(auth).catch(() => {});

const payload = {
  projectId: config.projectId,
  updatedAt: new Date().toISOString(),
  note: 'Local only — do not commit. Login in app with username + password (not email).',
  users: results.map(({ username, password, displayName, role, uid, status }) => ({
    username,
    password,
    displayName,
    role,
    uid,
    status,
  })),
};

writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
console.log('✓ saved', outPath);
console.log(JSON.stringify(payload, null, 2));
process.exit(0);
