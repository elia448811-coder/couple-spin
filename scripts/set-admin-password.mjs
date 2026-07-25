/**
 * Sets password for sole admin via Firebase Admin SDK.
 *
 * Requires a service account JSON (gitignored):
 *   1. Firebase Console → Project settings → Service accounts
 *   2. Generate new private key → save as service-account.local.json in project root
 *   3. npm run set:admin-password -- "NewPasswordHere"
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ADMIN_UID = 'tpbKWXtXWFapFC7Fd80Wd4IMqxC2';
const ADMIN_EMAIL = 'elia448811@gmail.com';
const password = (process.argv[2] || process.env.ADMIN_PASSWORD || '').trim();

if (!password || password.length < 6) {
  console.error('Usage: npm run set:admin-password -- "YourNewPassword"');
  process.exit(2);
}

const saPath = resolve(
  process.cwd(),
  process.env.GOOGLE_APPLICATION_CREDENTIALS || 'service-account.local.json',
);

if (!existsSync(saPath)) {
  console.error('Missing service account file:', saPath);
  console.error('Create it from Firebase Console → Project settings → Service accounts → Generate new private key');
  console.error('Save as: F:\\GAMED\\service-account.local.json');
  process.exit(2);
}

let admin;
try {
  admin = require('firebase-admin');
} catch {
  console.error('Installing firebase-admin...');
  const { execSync } = await import('node:child_process');
  execSync('npm install firebase-admin --no-save', { stdio: 'inherit' });
  admin = require('firebase-admin');
}

const sa = JSON.parse(readFileSync(saPath, 'utf8'));
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(sa),
  });
}

const user = await admin.auth().updateUser(ADMIN_UID, {
  email: ADMIN_EMAIL,
  password,
  emailVerified: true,
});

console.log(
  JSON.stringify(
    {
      ok: true,
      uid: user.uid,
      email: user.email,
      message: 'Password updated. Login on the site with this email + new password.',
    },
    null,
    2,
  ),
);
process.exit(0);
