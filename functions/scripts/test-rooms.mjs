import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { initializeApp as initAdmin } from 'firebase-admin/app';
import { getFirestore as adminFirestore } from 'firebase-admin/firestore';
import { initializeApp } from 'firebase/app';
import { collection, connectFirestoreEmulator, doc, getDocFromServer, getDocs, getFirestore,
  limitToLast, orderBy, query, setDoc, setLogLevel, terminate, updateDoc, where } from 'firebase/firestore';

const host = process.env.FIRESTORE_EMULATOR_HOST || '';
assert.match(host, /^127\.0\.0\.1:\d+$/, 'Use a local Firestore emulator');
const projectId = 'demo-couple-spin';
const admin = adminFirestore(initAdmin({ projectId }));
const tag = randomUUID();
const roomId = 'room-' + tag;
const denied = operation => assert.rejects(operation, { code: 'permission-denied' });
setLogLevel('silent');
const clients = ['host', 'partner', 'outsider'].map(role => {
  const uid = role + '-' + tag;
  const db = getFirestore(initializeApp({ projectId, apiKey: 'demo' }, uid));
  connectFirestoreEmulator(db, '127.0.0.1', Number(host.split(':')[1]), {
    mockUserToken: { sub: uid, email: uid + '@example.invalid', firebase: { sign_in_provider: 'password' } },
  });
  return { db, uid, room: doc(db, 'rooms', roomId) };
});
const [owner, partner, outsider] = clients;
try {
  for (const { uid } of clients) await admin.doc('users/' + uid).set({ approved: true });
  const room = { hostUid: owner.uid, partnerUid: partner.uid, hostName: 'Host', partnerName: 'Partner',
    eveningTitle: 'Test', hostReady: false, partnerReady: false, version: 1, lastEventId: 'update',
    expiresAtMs: Date.now() + 60000, status: 'lobby' };
  await denied(setDoc(owner.room, room));
  await admin.doc('rooms/' + roomId).set(room);
  await admin.doc('rooms/' + roomId + '/gameEvents/update').set({ type: 'PLAYER_READY', version: 1 });
  await denied(getDocFromServer(outsider.room));
  await denied(getDocFromServer(doc(outsider.db, 'roomCodes', '12345678')));
  await denied(updateDoc(outsider.room, { partnerUid: outsider.uid }));
  assert.equal((await getDocFromServer(partner.room)).get('hostUid'), owner.uid);
  await updateDoc(partner.room, { partnerReady: true });
  await denied(setDoc(doc(partner.room, 'gameEvents', 'client-event'), { type: 'GAME_SNAPSHOT', version: 2 }));
  await denied(getDocs(collection(partner.room, 'gameEvents')));
  const events = await getDocs(query(collection(partner.room, 'gameEvents'), where('version', '>', 0),
    orderBy('version'), limitToLast(32)));
  assert.equal(events.size, 1);
  await denied(getDocFromServer(doc(partner.room, 'events', 'legacy')));
  const expiredId = roomId + '-expired';
  await admin.doc('rooms/' + expiredId).set({ ...room, expiresAtMs: 1 });
  await denied(getDocFromServer(doc(partner.db, 'rooms', expiredId)));
  console.log('Shared room rules passed for members, admission, events and expiry.');
} finally {
  await Promise.all(clients.map(({ db }) => terminate(db)));
  await admin.terminate();
}
