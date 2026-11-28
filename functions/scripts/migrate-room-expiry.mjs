import { pathToFileURL } from 'node:url';
import { initializeApp } from 'firebase-admin/app';
import { FieldPath, getFirestore, Timestamp } from 'firebase-admin/firestore';

const integer = Number.isSafeInteger;
const uid = (v) => typeof v === 'string' && v.length > 0 && v.length <= 128;

function knownRecord(collection, doc) {
  const data = doc.data();
  switch (collection) {
    case 'rooms':
      return uid(data.hostUid) && ['waiting', 'lobby', 'playing', 'ended'].includes(data.status)
        && /^[0-9]{8}$/.test(data.displayCode ?? data.code ?? doc.id)
        && integer(data.createdAtMs) && integer(data.version);
    case 'roomCodes':
      return /^[0-9]{8}$/.test(doc.id) && data.displayCode === doc.id
        && uid(data.hostUid) && uid(data.roomId);
    case 'rateLimits':
      return integer(data.failedJoins) && integer(data.lockedUntilMs) && integer(data.updatedAtMs);
    case 'events':
      return uid(data.createdBy) && integer(data.version) && typeof data.type === 'string'
        && integer(data.createdAtMs);
  }
}

export async function migrateRoomExpiry(db, apply = false) {
  const counts = { inspected: 0, eligible: 0, updated: 0, skipped: 0 };
  const retiredAt = Date.now();
  for (const collection of ['rooms', 'roomCodes', 'rateLimits', 'events']) {
    const base = collection === 'events' ? db.collectionGroup('events') : db.collection(collection);
    const query = base.select('expiresAtMs','coupleSpinExpireAt','hostUid','status','displayCode','code','createdAtMs',
      'version','roomId','failedJoins','lockedUntilMs','updatedAtMs','createdBy','type')
      .orderBy(FieldPath.documentId()).limit(300);
    let cursor;
    for (;;) {
      const page = await (cursor ? query.startAfter(cursor) : query).get();
      if (page.empty) break;
      const batch = db.batch();
      let writes = 0;
      for (const doc of page.docs) {
        if (collection === 'events' && !/^rooms\/[^/]+\/events\/[^/]+$/.test(doc.ref.path)) continue;
        counts.inspected++;
        if (!knownRecord(collection, doc)) {
          counts.skipped++;
          continue;
        }
        const deadline = doc.get('expiresAtMs');
        const retired = collection === 'rateLimits' || collection === 'events';
        if (!retired && (!Number.isSafeInteger(deadline) || deadline <= 0 || deadline > 253402300799999)) {
          counts.skipped++;
          continue;
        }
        const current = doc.get('coupleSpinExpireAt');
        if (current instanceof Timestamp && (retired ? current.toMillis() <= retiredAt : current.toMillis() === deadline)) continue;
        counts.eligible++;
        if (apply) {
          batch.update(doc.ref, { coupleSpinExpireAt: Timestamp.fromMillis(retired ? retiredAt : deadline) },
            { lastUpdateTime: doc.updateTime });
          writes++;
        }
      }
      if (writes) {
        await batch.commit();
        counts.updated += writes;
      }
      cursor = page.docs.at(-1);
    }
  }
  return counts;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [projectId, mode] = process.argv.slice(2);
  if (!projectId || projectId.startsWith('-') || (mode && mode !== '--apply') || process.argv.length > 4) {
    throw new Error('Usage: node scripts/migrate-room-expiry.mjs PROJECT_ID [--apply]');
  }
  const db = getFirestore(initializeApp({ projectId }));
  console.log(JSON.stringify(await migrateRoomExpiry(db, mode === '--apply')));
}
