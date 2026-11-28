import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { initializeApp as initializeAdmin } from 'firebase-admin/app';
import { getFirestore as adminFirestore, Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import { initializeApp } from 'firebase/app';
import { connectFirestoreEmulator, doc, getDocFromServer as getDoc, getDocs, getFirestore, collection, serverTimestamp,
  setDoc, setLogLevel, Timestamp, updateDoc, writeBatch, terminate } from 'firebase/firestore';
import { roomAccess } from '../rooms.mjs';
import { migrateRoomExpiry } from './migrate-room-expiry.mjs';

// Only the local Firestore emulator accepts these SDK mock identities.
const endpoint = process.env.FIRESTORE_EMULATOR_HOST ?? '';
if (!/^127\.0\.0\.1:\d+$/.test(endpoint)) throw new Error('Set FIRESTORE_EMULATOR_HOST to a loopback emulator');
const projectId = process.env.GCLOUD_PROJECT ?? 'demo-couple-spin';
if (!projectId.startsWith('demo-')) throw new Error('Use a demo project ID');
setLogLevel('silent');
const port = Number(endpoint.split(':')[1]);
const db = adminFirestore(initializeAdmin({ projectId }));
const clients = [];
const actor = (id) => {
  const uid = id + '-' + randomUUID();
  const token = { sub: uid, email: uid + '@test.invalid', firebase: { sign_in_provider: 'password' } };
  const client = getFirestore(initializeApp({ projectId, apiKey: 'demo', appId: uid }, uid));
  connectFirestoreEmulator(client, '127.0.0.1', port, { mockUserToken: token });
  clients.push(client);
  return { uid, token, client };
};
const host = actor('host'), partner = actor('partner'), outsider = actor('outsider');
const call = (user, data) => roomAccess(db, user, data);
const create = { action: 'create', name: 'Host', title: 'Game' };
const deny = (operation) => assert.rejects(operation, { code: 'permission-denied' });
try {
  assert.equal((await call(host, create)).error, 'permission_denied');
  await Promise.all([host, partner, outsider].map((u) => db.collection('users').doc(u.uid).set({ approved: true })));
  assert.equal((await call(host, { ...create, title: 'x'.repeat(65) })).error, 'invalid_request');
  assert.equal((await call(host, { ...create, extra: true })).error, 'invalid_request');
  const [first, duplicate] = await Promise.all([call(host, create), call(host, create)]);
  assert.ok(first.ok);
  assert.equal(first.roomId, duplicate.roomId);
  const roomId = first.roomId;
  const room = db.collection('rooms').doc(roomId);
  const initial = (await room.get()).data();
  const code = initial.displayCode;
  assert.equal(initial.coupleSpinExpireAt.toMillis(), initial.expiresAtMs);
  await deny(getDoc(doc(outsider.client, 'rooms', roomId)));
  await deny(getDocs(collection(outsider.client, 'rooms')));
  await deny(getDoc(doc(outsider.client, 'roomCodes', code)));
  await deny(setDoc(doc(host.client, 'rooms', 'direct-' + roomId), { ...initial, updatedAt: Timestamp.now(), coupleSpinExpireAt: Timestamp.fromMillis(initial.expiresAtMs) }));
  await deny(setDoc(doc(outsider.client, 'roomJoinBudgets', outsider.uid), { attempts: 0 }));
  await deny(updateDoc(doc(outsider.client, 'rooms', roomId), { partnerUid: outsider.uid }));
  const join = { action: 'join', code, name: 'Partner' };
  const legacyCode = '01234567';
  await db.collection('rooms').doc(legacyCode).set({ ...initial, roomId: legacyCode, displayCode: legacyCode });
  assert.equal((await call(partner, { ...join, code: legacyCode })).roomId, legacyCode);
  await call(host, { action: 'leave', roomId: legacyCode });
  const invalidCode = '09999999';
  await db.collection('roomCodes').doc(invalidCode).set({ roomId: '__invalid__', expiresAtMs: initial.expiresAtMs });
  assert.equal((await call(partner, { ...join, code: invalidCode })).error, 'room_not_found');
  for (let i = 0; i < 10; i++) {
    assert.equal((await call(outsider, { ...join, code: '00000000' })).error, 'room_not_found');
  }
  assert.equal((await call(outsider, join)).error, 'join_rate_limited');
  assert.equal((await call(partner, join)).roomId, roomId);
  assert.equal((await db.collection('roomJoinBudgets').doc(partner.uid).get()).get('attempts'), 3);
  assert.equal((await getDoc(doc(partner.client, 'rooms', roomId))).get('partnerUid'), partner.uid);
  for (const [who, ready] of [[host, 'hostReady'], [partner, 'partnerReady']]) {
    await updateDoc(doc(who.client, 'rooms', roomId), {
      [ready]: true, updatedBy: who.uid, updatedAt: serverTimestamp(), updatedAtMs: Date.now(),
    });
  }

  const sync = (who, version, type = 'GAME_SNAPSHOT', payload = '{"screen":"game"}', opts = {}) => {
    const b = writeBatch(who.client);
    b.set(doc(who.client, 'rooms', roomId, 'sync', 'current'), {
      version, type, payload, createdAt: serverTimestamp(), coupleSpinExpireAt: Timestamp.fromMillis(initial.expiresAtMs),
    });
    if (!opts.onlySnapshot) b.update(doc(who.client, 'rooms', roomId), {
      version, updatedAtMs: Date.now(), updatedAt: serverTimestamp(), updatedBy: who.uid,
      ...(type === 'GAME_STARTED' ? { status: 'playing' } : {}),
    });
    return b.commit();
  };
  await deny(sync(partner, 1));
  await deny(sync(host, 7));
  await deny(sync(host, 1, 'invalid'));
  await deny(sync(host, 1, 'GAME_SNAPSHOT', 'x'.repeat(120001)));
  await deny(sync(host, 1, 'GAME_SNAPSHOT', '{}', { onlySnapshot: true }));
  await deny(setDoc(doc(partner.client, 'rooms', roomId, 'events', 'legacy'), { version: 1 }));
  await sync(host, 1, 'GAME_STARTED', '');
  await sync(host, 2);
  assert.equal((await getDoc(doc(partner.client, 'rooms', roomId, 'sync', 'current'))).get('version'), 2);
  await room.update({ version: 2048 });
  await deny(sync(host, 2049));

  assert.ok((await call(partner, { action: 'leave', roomId })).ok);
  assert.equal((await room.collection('sync').doc('current').get()).exists, false);
  await deny(getDoc(doc(partner.client, 'rooms', roomId)));
  assert.ok((await call(partner, join)).ok);
  await room.update({ expiresAtMs: Date.now() - 600_000, version: 2 });
  await deny(sync(host, 3));
  await deny(getDoc(doc(partner.client, 'rooms', roomId)));
  assert.ok((await call(host, { action: 'leave', roomId })).ok);
  assert.equal((await room.get()).exists, false);
  assert.equal((await db.collection('roomCodes').doc(code).get()).exists, false);
  // Make the cooldown test independent of emulator latency.
  await db.collection('roomHostSlots').doc(host.uid).update({ createdAtMs: Date.now() });
  assert.equal((await call(host, create)).error, 'create_rate_limited');

  const legacy = db.collection('rooms').doc('legacy-' + randomUUID());
  const orphan = legacy.collection('events').doc('old');
  const unrelated = db.collection('other').doc(legacy.id).collection('events').doc('keep');
  const unrelatedRate = db.collection('rateLimits').doc(legacy.id);
  await unrelatedRate.set({ resets: 0 });
  await orphan.set({ version: 1, createdBy: host.uid, type: 'PLAYER_READY', createdAtMs: Date.now() });
  await unrelated.set({ version: 1 });
  await migrateRoomExpiry(db, false);
  assert.equal((await orphan.get()).get('coupleSpinExpireAt'), undefined);
  await migrateRoomExpiry(db, true);
  assert.ok((await orphan.get()).get('coupleSpinExpireAt') instanceof AdminTimestamp);
  assert.equal((await unrelated.get()).get('coupleSpinExpireAt'), undefined);
  assert.equal((await unrelatedRate.get()).get('coupleSpinExpireAt'), undefined);
  console.log('PASS room admission, quotas, authorized game sync, expiry and scoped migration');
} finally {
  await Promise.all(clients.map(terminate));
  await db.terminate();
}
