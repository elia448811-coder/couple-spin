import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const uid = 'tpbKWXtXWFapFC7Fd80Wd4IMqxC2'; // gitleaks:allow public Firebase account identifier
const email = 'elia448811@gmail.com';
const password = process.argv[2] || process.env.ADMIN_PASSWORD;
if (!password || password.length < 6) throw new Error('Supply ADMIN_PASSWORD from the project vault');
let options;
if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIREBASE_AUTH_EMULATOR_HOST)) {
    throw new Error('Use a loopback address for the Auth emulator');
  }
  options = { projectId: 'demo-couple-spin' };
} else {
  const path = resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS || 'service-account.local.json');
  if (existsSync(path)) {
    const account = JSON.parse(readFileSync(path, 'utf8'));
    options = { projectId: account.project_id, credential: cert(account) };
  } else if (process.env.GCLOUD_PROJECT) {
    options = { projectId: process.env.GCLOUD_PROJECT };
  } else {
    throw new Error('Set GCLOUD_PROJECT and application-default credentials, or supply a service account');
  }
}
const auth = getAuth(initializeApp(options));
const settings = { email, password, emailVerified: true };
try {
  await auth.updateUser(uid, settings);
} catch (error) {
  if (error.code !== 'auth/user-not-found') throw error;
  await auth.createUser({ uid, ...settings });
}
console.log('Administrator provisioned with the pinned UID.');
