import { initializeApp } from 'firebase-admin/app';
import { FieldPath, FieldValue, getFirestore } from 'firebase-admin/firestore';

// Use application-default credentials or the local Firestore emulator.
// No note contents or account identifiers are logged.
const projectId = process.env.GCLOUD_PROJECT;
if (!projectId) throw new Error('Specify the target Firebase project with GCLOUD_PROJECT');
const apply = process.argv.includes('--apply');
const db = getFirestore(initializeApp({ projectId }));
const users = db.collection('users').orderBy(FieldPath.documentId()).limit(200);
let cursor;
let candidates = 0, migrated = 0, conflicts = 0;
while (true) {
  const page = await (cursor ? users.startAfter(cursor) : users).get();
  if (page.empty) break;
  for (const row of page.docs) {
    if (!Object.hasOwn(row.data(), 'adminNote')) continue;
    candidates++;
    const outcome = await db.runTransaction(async tx => {
      const target = db.collection('adminUserNotes').doc(row.id);
      const [fresh, privateDoc] = await tx.getAll(row.ref, target);
      const note = fresh.get('adminNote');
      if (note === undefined) return 'skipped';
      if (fresh.get('uid') !== row.id || typeof fresh.get('displayName') !== 'string' ||
          typeof note !== 'string' || [...note].length > 200 ||
          (note && privateDoc.exists && privateDoc.get('note') !== note)) return 'conflict';
      if (!apply) return 'dry-run';
      if (note && !privateDoc.exists) tx.create(target, { note });
      tx.update(row.ref, { adminNote: FieldValue.delete() });
      return 'migrated';
    });
    if (outcome === 'migrated') migrated++;
    if (outcome === 'conflict') conflicts++;
  }
  cursor = page.docs.at(-1);
}
console.log(JSON.stringify({ projectId, apply, candidates, migrated, conflicts }));
if (conflicts) process.exitCode = 1;
