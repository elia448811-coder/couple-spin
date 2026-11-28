import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { initializeApp as adminApp, deleteApp as deleteAdminApp } from 'firebase-admin/app';
import { getFirestore as adminDb } from 'firebase-admin/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  connectFirestoreEmulator, doc, getDocFromServer, getFirestore, serverTimestamp,
  setDoc, terminate, updateDoc, setLogLevel,
} from 'firebase/firestore';

const host = process.env.FIRESTORE_EMULATOR_HOST || '';
assert.match(host, /^127\.0\.0\.1:\d+$/, 'A local Firestore emulator is required');
const projectId = 'demo-couple-spin';
const trusted = adminApp({ projectId });
const database = adminDb(trusted);
const clients = [];
const run = randomUUID();
const uid = 'profile-' + run;
const staff = 'tpbKWXtXWFapFC7Fd80Wd4IMqxC2';
const email = 'elia448811@gmail.com';
setLogLevel('silent');

function client(sub, address) {
  const app = initializeApp({ projectId, apiKey: 'demo' }, sub);
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', Number(host.split(':')[1]), {
    mockUserToken: { sub, email: address, email_verified: false, firebase: { sign_in_provider: 'password' } },
  });
  clients.push({ app, db });
  return db;
}
const denied = operation => assert.rejects(operation, error => error.code === 'permission-denied');
const player = client(uid, email);
const administrator = client(staff, email);
const profile = doc(player, 'users', uid);
const profileData = { uid, displayName: 'Player', partnerDisplayName: 'Partner', lastSeenMs: 1,
  createdAtMs: 1, updatedAtMs: 1, schemaVersion: 1, approved: false, banned: false };
const config = doc(administrator, 'config', 'app');
const note = doc(player, 'adminUserNotes', uid);
const health = { ok: true, client: 'couple-spin', at: serverTimestamp(), schemaVersion: 1 };
const bundle = { payload: '{}', updatedAt: serverTimestamp(), updatedAtMs: 1 };

try {
  await setDoc(config, { registrationEnabled: false, updatedBy: staff });
  await denied(setDoc(doc(player, 'config', 'app'), { registrationEnabled: true, updatedBy: uid }));
  await denied(setDoc(profile, profileData));
  await updateDoc(config, { registrationEnabled: true });
  assert.equal((await getDocFromServer(profile)).exists(), false);
  await denied(setDoc(profile, { ...profileData, approved: true }));
  await denied(setDoc(profile, { ...profileData, extra: true }));
  await setDoc(profile, profileData);
  await updateDoc(profile, { displayName: 'Updated' });
  await denied(setDoc(doc(player, 'users', uid, 'other', 'arbitrary'), {}));
  await denied(setDoc(doc(player, 'users', uid, 'data', 'bundle'), bundle));
  await denied(setDoc(doc(player, 'users', uid, 'meta', 'health'), health));
  await denied(updateDoc(profile, { adminNote: 'private' }));
  await updateDoc(doc(administrator, 'users', uid), { approved: true });
  await setDoc(doc(player, 'users', uid, 'meta', 'health'), health);
  await setDoc(doc(player, 'users', uid, 'data', 'bundle'), bundle);
  await setDoc(doc(player, 'users', uid, 'data', 'activeGame'), bundle);
  await denied(setDoc(doc(player, 'users', uid, 'data', 'extra'), bundle));
  await denied(setDoc(doc(player, 'users', uid, 'data', 'bundle'), { ...bundle, extra: 1 }));
  await denied(setDoc(doc(player, 'users', uid, 'data', 'bundle'), { ...bundle, payload: 'א'.repeat(350001) }));
  await denied(setDoc(doc(player, 'users', staff, 'data', 'bundle'), bundle));
  await updateDoc(doc(administrator, 'users', uid), { banned: true });
  await denied(setDoc(doc(player, 'users', uid, 'data', 'bundle'), bundle));
  await denied(setDoc(note, { note: 'private' }));
  await database.doc('users/' + uid).update({ adminNote: 'legacy moderation note' });
  await denied(getDocFromServer(profile));

  const migrate = fileURLToPath(new URL('./migrate-admin-notes.mjs', import.meta.url));
  for (const args of [[], ['--apply'], ['--apply']]) {
    const step = spawnSync(process.execPath, [migrate, ...args], {
      encoding: 'utf8', env: { ...process.env, GCLOUD_PROJECT: projectId },
    });
    assert.equal(step.status, 0, step.stderr);
    if (!args.length) await denied(getDocFromServer(profile));
  }
  assert.equal((await getDocFromServer(profile)).data().adminNote, undefined);
  assert.equal((await getDocFromServer(doc(administrator, 'adminUserNotes', uid))).data().note, 'legacy moderation note');
  await denied(getDocFromServer(note));
  await denied(updateDoc(doc(administrator, 'users', uid), { adminNote: 'new moderation note' }));
  await setDoc(doc(administrator, 'adminUserNotes', uid), { note: 'updated moderation note' });
  console.log('Profile, approval, backup bounds, administrator authority and legacy note migration checks passed.');
} finally {
  for (const { app, db } of clients) { await terminate(db); await deleteApp(app); }
  await database.terminate();
  await deleteAdminApp(trusted);
}
