import { randomInt } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

const ROOM_TTL_MS = 2 * 60 * 60_000;
const CREATE_INTERVAL_MS = 30_000;
const JOIN_WINDOW_MS = 5 * 60_000;
const JOIN_ATTEMPTS = 10;
const ADMIN_UID = 'tpbKWXtXWFapFC7Fd80Wd4IMqxC2'; // gitleaks:allow public Firebase account identifier

const validRoomId = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value) && !/^__.*__$/.test(value);
const failure = (error) => ({ ok: false, error });
const success = (roomId) => ({ ok: true, roomId });
const bounded = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const exactKeys = (data, keys) => Object.keys(data).length === keys.length && keys.every((key) => Object.hasOwn(data, key));

async function isApproved(tx, db, auth) {
  if (auth.uid === ADMIN_UID) return true;
  const profile = (await tx.get(db.collection('users').doc(auth.uid))).data();
  return profile?.approved === true && (profile.banned ?? false) === false;
}

async function createRoom(db, auth, { name, title }) {
  const slotRef = db.collection('roomHostSlots').doc(auth.uid);
  const roomRef = db.collection('rooms').doc();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = String(randomInt(10_000_000, 100_000_000));
    const codeRef = db.collection('roomCodes').doc(code);
    const result = await db.runTransaction(async (tx) => {
      if (!await isApproved(tx, db, auth)) return failure('permission_denied');
      const slot = (await tx.get(slotRef)).data();
      const now = Date.now();
      if (slot?.roomId && slot.expiresAtMs > now) {
        const active = await tx.get(db.collection('rooms').doc(slot.roomId));
        if (active.exists && active.get('hostUid') === auth.uid && active.get('expiresAtMs') > now) {
          return success(active.id); // Retry or second tab resumes the same room.
        }
      }
      if (slot?.createdAtMs > now - CREATE_INTERVAL_MS) return failure('create_rate_limited');
      const [reservation, legacyRoom] = await tx.getAll(codeRef, db.collection('rooms').doc(code));
      if (reservation.data()?.expiresAtMs > now || legacyRoom.data()?.expiresAtMs > now) return failure('code_collision');
      const expiresAtMs = now + ROOM_TTL_MS;
      const coupleSpinExpireAt = Timestamp.fromMillis(expiresAtMs);
      tx.create(roomRef, {
        roomId: roomRef.id, hostUid: auth.uid, partnerUid: null, displayCode: code, code,
        hostName: name.trim(), partnerName: null, eveningTitle: title.trim(), status: 'waiting',
        createdAtMs: now, updatedAtMs: now, updatedAt: FieldValue.serverTimestamp(),
        updatedBy: auth.uid, expiresAtMs, coupleSpinExpireAt, version: 0, lastEventId: null,
        hostReady: false, partnerReady: false, hostLastSeenMs: now, partnerLastSeenMs: 0,
      });
      tx.set(codeRef, { roomId: roomRef.id, displayCode: code, hostUid: auth.uid, expiresAtMs, coupleSpinExpireAt });
      tx.set(slotRef, { roomId: roomRef.id, createdAtMs: now, expiresAtMs, coupleSpinExpireAt });
      return success(roomRef.id);
    });
    if (result.error !== 'code_collision') return result;
  }
  return failure('code_collision');
}

async function joinRoom(db, auth, { code, name }) {
  const bucketRef = db.collection('roomJoinBudgets').doc(auth.uid);
  return db.runTransaction(async (tx) => {
    if (!await isApproved(tx, db, auth)) return failure('permission_denied');
    const now = Date.now();
    const bucket = (await tx.get(bucketRef)).data();
    const activeWindow = bucket && bucket.resetAtMs > now;
    const attempts = activeWindow ? bucket.attempts : 0;
    if (attempts >= JOIN_ATTEMPTS) return failure('join_rate_limited');
    const resetAtMs = activeWindow ? bucket.resetAtMs : now + JOIN_WINDOW_MS;

    const reservation = (await tx.get(db.collection('roomCodes').doc(code))).data();
    // Old rooms used their display code as the document ID and had no reservation.
    const roomId = reservation ? reservation.roomId : code;
    const roomRef = validRoomId(roomId) && (!reservation || reservation.expiresAtMs > now)
      ? db.collection('rooms').doc(roomId) : null;
    const room = roomRef ? (await tx.get(roomRef)).data() : null;
    // Commit the charge even when the lookup fails. Throwing here would roll it back.
    tx.set(bucketRef, { attempts: attempts + 1, resetAtMs, coupleSpinExpireAt: Timestamp.fromMillis(resetAtMs) });
    if (!room || !Number.isSafeInteger(room.expiresAtMs) || room.expiresAtMs <= now ||
        !bounded(room.hostUid, 128) || (room.displayCode ?? room.code ?? roomId) !== code ||
        (reservation && room.hostUid !== reservation.hostUid)) {
      return failure('room_not_found');
    }
    if (room.hostUid === auth.uid || room.partnerUid === auth.uid) return success(roomId);
    if (room.partnerUid !== null || room.status !== 'waiting') return failure('room_full');
    tx.update(roomRef, {
      partnerUid: auth.uid, partnerName: name.trim(), partnerReady: false, partnerLastSeenMs: now,
      status: 'lobby', updatedBy: auth.uid, updatedAtMs: now, updatedAt: FieldValue.serverTimestamp(),
    });
    tx.delete(roomRef.collection('sync').doc('current'));
    return success(roomId);
  });
}

async function leaveRoom(db, auth, roomId) {
  const roomRef = db.collection('rooms').doc(roomId);
  return db.runTransaction(async (tx) => {
    const room = (await tx.get(roomRef)).data();
    if (!room || (room.hostUid !== auth.uid && room.partnerUid !== auth.uid)) return success(roomId);
    if (room.hostUid === auth.uid) {
      const codeRef = typeof room.displayCode === 'string' && /^[0-9]{8}$/.test(room.displayCode)
        ? db.collection('roomCodes').doc(room.displayCode) : null;
      const code = codeRef ? (await tx.get(codeRef)).data() : null;
      if (code?.roomId === roomId) tx.delete(codeRef);
      tx.delete(roomRef);
      // Keep the bounded host slot until expiry so rapid leave/create cannot bypass the cooldown.
    } else {
      tx.update(roomRef, {
        partnerUid: null, partnerName: null, partnerReady: false, partnerLastSeenMs: 0,
        status: 'waiting', updatedBy: auth.uid, updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp(),
      });
    }
    tx.delete(roomRef.collection('sync').doc('current'));
    return success(roomId);
  });
}

export async function roomAccess(db, auth, data) {
  if (!auth?.uid || !auth.token?.email || auth.token.firebase?.sign_in_provider === 'anonymous') {
    return failure('auth_failed');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return failure('invalid_request');
  switch (data.action) {
    case 'create':
      if (!exactKeys(data, ['action', 'name', 'title']) || !bounded(data.name, 32) || !bounded(data.title, 64)) {
        return failure('invalid_request');
      }
      return createRoom(db, auth, data);
    case 'join':
      if (!exactKeys(data, ['action', 'code', 'name']) || typeof data.code !== 'string' ||
          !/^[0-9]{8}$/.test(data.code) || !bounded(data.name, 32)) return failure('invalid_code');
      return joinRoom(db, auth, data);
    case 'leave':
      if (!exactKeys(data, ['action', 'roomId']) || !validRoomId(data.roomId)) return failure('invalid_request');
      return leaveRoom(db, auth, data.roomId);
    default:
      return failure('invalid_request');
  }
}
