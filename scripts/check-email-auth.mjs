import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  deleteUser,
  signOut,
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
const email = `test.${Date.now()}@example.com`;
const password = 'TestPass123!';

console.log('Project:', config.projectId);
console.log('Trying Email/Password with', email);

try {
  const created = await createUserWithEmailAndPassword(auth, email, password);
  console.log('✓ register OK', created.user.uid);
  await signOut(auth);
  const signed = await signInWithEmailAndPassword(auth, email, password);
  console.log('✓ login OK', signed.user.uid);
  try {
    await deleteUser(signed.user);
    console.log('✓ cleanup user deleted');
  } catch {
    console.log('! cleanup: could not delete test user (ok for manual cleanup)');
  }
  console.log(JSON.stringify({ ok: true, emailAuth: true }, null, 2));
  process.exit(0);
} catch (error) {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : '';
  console.error('✗ Email auth failed:', code || (error instanceof Error ? error.message : error));
  if (code === 'auth/operation-not-allowed') {
    console.error('\n→ Enable Email/Password in Firebase Console:');
    console.error('  Authentication → Sign-in method → Email/Password → Enable → Save');
    console.error('  https://console.firebase.google.com/project/double-game-dd845/authentication/providers');
  }
  process.exit(1);
}
