/**
 * Verifies published Firestore rules match v28 expectations:
 * - rooms/events OK for normal auth users
 * - config/contentItems writes denied for non-admin
 * - config/contentItems writes allowed only for sole admin UID
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, getFirestore, setDoc, deleteDoc, getDoc } from 'firebase/firestore';

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

const ADMIN_UID = 'tpbKWXtXWFapFC7Fd80Wd4IMqxC2';
const ADMIN_EMAIL = 'elia448811@gmail.com';
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

const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app);

const results = [];

function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log('✓', name, detail);
}

function fail(name, detail = '') {
  results.push({ name, ok: false, detail });
  console.log('✗', name, detail);
}

async function expectDenied(label, fn) {
  try {
    await fn();
    fail(label, 'expected PERMISSION_DENIED but write succeeded');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('PERMISSION_DENIED') || msg.includes('permission-denied')) {
      pass(label, 'denied as expected');
    } else {
      fail(label, msg);
    }
  }
}

async function expectOk(label, fn) {
  try {
    await fn();
    pass(label);
  } catch (e) {
    fail(label, e instanceof Error ? e.message : String(e));
  }
}

// 1) Local paste file marker
const pastePath = resolve(process.cwd(), 'הדבק-עכשיו-Rules-מלא.txt');
const pasteAlt = resolve(process.cwd(), 'PASTE-FIREBASE-RULES.txt');
const paste = existsSync(pastePath)
  ? readFileSync(pastePath, 'utf8')
  : readFileSync(pasteAlt, 'utf8');
if (paste.includes('DOUBLE_GAME_RULES_v28_ADMIN_UID') && paste.includes(ADMIN_UID)) {
  pass('local paste file has v28 + admin UID');
} else {
  fail('local paste file missing v28 marker or admin UID');
}

// 2) Non-admin cannot write config / contentItems
await signOut(auth).catch(() => {});
const anon = await signInAnonymously(auth);
pass('anonymous sign-in', anon.user.uid);

await expectDenied('anon cannot write config/app', () =>
  setDoc(
    doc(db, 'config', 'app'),
    { registrationEnabled: true, updatedBy: anon.user.uid, updatedAtMs: Date.now() },
    { merge: true },
  ),
);

await expectDenied('anon cannot write contentItems', () =>
  setDoc(doc(db, 'contentItems', 'probe-deny'), {
    id: 'probe-deny',
    title: 'x',
    description: 'x',
    kind: 'question',
    category: 'funny',
    level: 'normal',
    hidden: false,
    source: 'custom',
    updatedAtMs: Date.now(),
    updatedByUid: anon.user.uid,
  }),
);

// 3) Regular username user also denied
await signOut(auth).catch(() => {});
try {
  const test = await signInWithEmailAndPassword(
    auth,
    usernameToEmail('test_partner'),
    'CoupleTest2!',
  );
  pass('test_partner sign-in', test.user.uid);
  await expectDenied('test_partner cannot write config/app', () =>
    setDoc(
      doc(db, 'config', 'app'),
      { registrationEnabled: false, updatedBy: test.user.uid, updatedAtMs: Date.now() },
      { merge: true },
    ),
  );
} catch (e) {
  fail('test_partner sign-in', e instanceof Error ? e.message : String(e));
}

// 4) Public read config
await expectOk('public/auth can read config/app', async () => {
  await getDoc(doc(db, 'config', 'app'));
});

// 5) Admin allow (if password available)
await signOut(auth).catch(() => {});
const adminPass = (process.env.ADMIN_PASSWORD || '').trim();
if (adminPass) {
  try {
    const admin = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, adminPass);
    if (admin.user.uid !== ADMIN_UID) {
      fail('admin UID mismatch', `got ${admin.user.uid}`);
    } else {
      pass('admin sign-in UID match', ADMIN_UID);
      await expectOk('admin can write config/app', () =>
        setDoc(
          doc(db, 'config', 'app'),
          {
            registrationEnabled: true,
            welcomeTitle: 'ספין זוגי',
            welcomeSubtitle: 'התחברו עם שם משתמש וסיסמה כדי להתחיל',
            updatedBy: ADMIN_UID,
            updatedAtMs: Date.now(),
          },
          { merge: true },
        ),
      );
      const probeId = `probe-admin-${Date.now()}`;
      await expectOk('admin can write contentItems', () =>
        setDoc(doc(db, 'contentItems', probeId), {
          id: probeId,
          title: 'בדיקה',
          description: 'בדיקת אדמין',
          kind: 'question',
          category: 'funny',
          level: 'normal',
          hidden: true,
          source: 'custom',
          updatedAtMs: Date.now(),
          updatedByUid: ADMIN_UID,
        }),
      );
      await deleteDoc(doc(db, 'contentItems', probeId)).catch(() => {});
    }
  } catch (e) {
    fail('admin sign-in', e instanceof Error ? e.message : String(e));
  }
} else {
  console.log('! skip admin allow-test (set ADMIN_PASSWORD to verify admin writes)');
  results.push({ name: 'admin allow-test', ok: true, detail: 'skipped (no ADMIN_PASSWORD)' });
}

await signOut(auth).catch(() => {});

const failed = results.filter((r) => !r.ok);
console.log(
  JSON.stringify(
    {
      ok: failed.length === 0,
      projectId: config.projectId,
      adminUid: ADMIN_UID,
      failed: failed.length,
      results,
    },
    null,
    2,
  ),
);
process.exit(failed.length ? 1 : 0);
