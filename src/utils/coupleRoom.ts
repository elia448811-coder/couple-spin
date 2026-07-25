import type { GameState } from '../types/game';
import { getFirestoreDb, isFirebaseConfigured } from '../lib/firebase';
import { ensureAnonAuth } from './cloudSync';
import { captureError, captureEvent } from './monitoring';
import { checkJoinRateLimit, recordJoinFailure, resetJoinRateLimit } from './roomJoinRateLimit';

const ROOM_ID_KEY = 'couple-spin-room-id';
const ROOM_CODE_KEY = 'couple-spin-room-code';
const ROLE_KEY = 'couple-spin-room-role';

export const ROOM_TTL_MS = 2 * 60 * 60 * 1000;
export const PRESENCE_TIMEOUT_MS = 60_000;
export const HEARTBEAT_INTERVAL_MS = 25_000;
export const SNAPSHOT_EVERY_N_EVENTS = 5;
export const MAX_PLAYER_NAME_LEN = 32;
export const DISPLAY_CODE_LEN = 8;
export const MAX_EVENT_PAYLOAD_BYTES = 120_000;

export type RoomRole = 'host' | 'partner';
export type RoomStatus = 'waiting' | 'lobby' | 'playing' | 'ended';
export type RoomEventType =
  | 'PLAYER_READY'
  | 'GAME_STARTED'
  | 'GAME_SNAPSHOT'
  | 'GAME_ENDED'
  | 'TURN_CHANGED';

export type RoomPlayer = {
  uid: string;
  name: string;
  role: RoomRole;
  ready: boolean;
  lastSeenMs: number;
};

export type CoupleRoom = {
  roomId: string;
  displayCode: string;
  /** @deprecated use displayCode */
  code: string;
  hostUid: string;
  partnerUid: string | null;
  hostName: string;
  partnerName: string | null;
  status: RoomStatus;
  createdAtMs: number;
  updatedAtMs: number;
  expiresAtMs: number;
  version: number;
  eveningTitle: string;
  lastEventId: string | null;
  updatedBy: string | null;
  hostReady: boolean;
  partnerReady: boolean;
  hostLastSeenMs: number;
  partnerLastSeenMs: number;
};

export type RoomGameEvent = {
  id: string;
  type: RoomEventType;
  version: number;
  createdBy: string;
  createdAtMs: number;
  payload: Record<string, unknown>;
};

export type StoredRoom = { roomId: string; displayCode: string; role: RoomRole };

function canUseRooms(): boolean {
  return isFirebaseConfigured();
}

/** Rooms require a real (non-anonymous) signed-in account. */
async function ensureRoomAuth() {
  const user = await ensureAnonAuth();
  if (!user || user.isAnonymous || !user.email) return null;
  return user;
}

function newRoomId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `room-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function randomDisplayCode(): string {
  const min = 10 ** (DISPLAY_CODE_LEN - 1);
  const range = 9 * min;
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return String(min + (buf[0]! % range));
  }
  return String(min + Math.floor(Math.random() * range));
}

function normalizeDisplayCode(code: string): string {
  return code.replace(/\D/g, '').slice(0, DISPLAY_CODE_LEN);
}

async function assertJoinGuard(): Promise<{ ok: boolean; error?: string }> {
  if (typeof fetch === 'undefined') return { ok: true };
  try {
    const res = await fetch('/api/join-guard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: '{}',
    });
    if (res.status === 429) return { ok: false, error: 'join_rate_limited' };
    // Missing API in local/static hosts → continue; other layers still apply.
    return { ok: true };
  } catch {
    return { ok: true };
  }
}

/** Strip heavy / non-essential fields before pushing over the wire. */
export function sanitizeGameForSync(game: GameState): GameState {
  return {
    ...game,
    usedTaskIds: Array.isArray(game.usedTaskIds) ? game.usedTaskIds.slice(-200) : [],
    sessionNewAchievements: Array.isArray(game.sessionNewAchievements)
      ? game.sessionNewAchievements.slice(-20)
      : [],
    unlockedAchievements: Array.isArray(game.unlockedAchievements)
      ? game.unlockedAchievements.slice(-40)
      : [],
  };
}

function clampName(name: string, fallback: string): string {
  const trimmed = name.trim().slice(0, MAX_PLAYER_NAME_LEN);
  return trimmed || fallback;
}

export const SERVER_JOIN_MAX_FAILURES = 10;
export const SERVER_JOIN_LOCKOUT_MS = 5 * 60_000;

async function checkServerJoinRateLimit(uid: string): Promise<{ allowed: boolean; error?: string }> {
  const db = await getFirestoreDb();
  if (!db) return { allowed: true };
  const { doc, getDoc } = await import('firebase/firestore');
  const ref = doc(db, 'rateLimits', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { allowed: true };
  const data = snap.data() as Record<string, unknown>;
  const lockedUntilMs = Number(data.lockedUntilMs) || 0;
  if (lockedUntilMs > Date.now()) return { allowed: false, error: 'join_rate_limited' };
  return { allowed: true };
}

async function recordServerJoinFailure(uid: string): Promise<void> {
  const db = await getFirestoreDb();
  if (!db) return;
  const { doc, getDoc, setDoc, serverTimestamp } = await import('firebase/firestore');
  const ref = doc(db, 'rateLimits', uid);
  const snap = await getDoc(ref);
  const prev = snap.exists() ? (snap.data() as Record<string, unknown>) : {};
  const failures = Number(prev.failedJoins) || 0;
  const lockedUntilMs = Number(prev.lockedUntilMs) || 0;
  if (lockedUntilMs > Date.now()) return;

  // Rules only allow: +1 failure, OR lockout after >=9 failures, OR clear expired lock.
  if (failures + 1 >= SERVER_JOIN_MAX_FAILURES) {
    await setDoc(
      ref,
      {
        failedJoins: 0,
        lockedUntilMs: Date.now() + SERVER_JOIN_LOCKOUT_MS,
        updatedAtMs: Date.now(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    return;
  }

  await setDoc(
    ref,
    {
      failedJoins: failures + 1,
      lockedUntilMs,
      updatedAtMs: Date.now(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/** Clear lockout only after it expired — never allow arbitrary client reset. */
async function clearExpiredServerJoinLock(uid: string): Promise<void> {
  const db = await getFirestoreDb();
  if (!db) return;
  const { doc, getDoc, setDoc, serverTimestamp } = await import('firebase/firestore');
  const ref = doc(db, 'rateLimits', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data() as Record<string, unknown>;
  const lockedUntilMs = Number(data.lockedUntilMs) || 0;
  if (lockedUntilMs <= 0 || lockedUntilMs > Date.now()) return;
  await setDoc(
    ref,
    { failedJoins: 0, lockedUntilMs: 0, updatedAtMs: Date.now(), updatedAt: serverTimestamp() },
    { merge: true },
  );
}

function readStored(): StoredRoom | null {
  try {
    const roomId = localStorage.getItem(ROOM_ID_KEY);
    const displayCode = localStorage.getItem(ROOM_CODE_KEY);
    const role = localStorage.getItem(ROLE_KEY);
    if (!displayCode || (role !== 'host' && role !== 'partner')) return null;
    return {
      roomId: roomId ?? displayCode,
      displayCode,
      role,
    };
  } catch {
    return null;
  }
}

function writeStored(roomId: string, displayCode: string, role: RoomRole): void {
  localStorage.setItem(ROOM_ID_KEY, roomId);
  localStorage.setItem(ROOM_CODE_KEY, displayCode);
  localStorage.setItem(ROLE_KEY, role);
}

export function clearStoredRoom(): void {
  localStorage.removeItem(ROOM_ID_KEY);
  localStorage.removeItem(ROOM_CODE_KEY);
  localStorage.removeItem(ROLE_KEY);
}

export function getStoredRoom(): StoredRoom | null {
  return readStored();
}

function isExpired(room: CoupleRoom): boolean {
  return Date.now() > room.expiresAtMs;
}

function parseRoom(roomId: string, raw: Record<string, unknown>): CoupleRoom {
  const displayCode = String(raw.displayCode ?? raw.code ?? '');
  return {
    roomId,
    displayCode,
    code: displayCode,
    hostUid: String(raw.hostUid ?? ''),
    partnerUid: typeof raw.partnerUid === 'string' ? raw.partnerUid : null,
    hostName: String(raw.hostName ?? 'שחקן 1'),
    partnerName: typeof raw.partnerName === 'string' ? raw.partnerName : null,
    status: (['waiting', 'lobby', 'playing', 'ended'].includes(String(raw.status))
      ? raw.status
      : 'waiting') as RoomStatus,
    createdAtMs: Number(raw.createdAtMs) || 0,
    updatedAtMs: Number(raw.updatedAtMs) || 0,
    expiresAtMs: Number(raw.expiresAtMs) || 0,
    version: Number(raw.version) || 0,
    eveningTitle: String(raw.eveningTitle ?? 'ערב זוגי'),
    lastEventId: typeof raw.lastEventId === 'string' ? raw.lastEventId : null,
    updatedBy: typeof raw.updatedBy === 'string' ? raw.updatedBy : null,
    hostReady: Boolean(raw.hostReady),
    partnerReady: Boolean(raw.partnerReady),
    hostLastSeenMs: Number(raw.hostLastSeenMs) || Number(raw.updatedAtMs) || 0,
    partnerLastSeenMs: Number(raw.partnerLastSeenMs) || 0,
  };
}

export function playersFromRoom(room: CoupleRoom): RoomPlayer[] {
  const players: RoomPlayer[] = [
    {
      uid: room.hostUid,
      name: room.hostName,
      role: 'host',
      ready: room.hostReady,
      lastSeenMs: room.hostLastSeenMs,
    },
  ];
  if (room.partnerUid) {
    players.push({
      uid: room.partnerUid,
      name: room.partnerName ?? 'שחקן 2',
      role: 'partner',
      ready: room.partnerReady,
      lastSeenMs: room.partnerLastSeenMs,
    });
  }
  return players;
}

export function isPlayerOnline(player: RoomPlayer, now = Date.now()): boolean {
  return now - player.lastSeenMs < PRESENCE_TIMEOUT_MS;
}

export function presenceLabel(player: RoomPlayer, now = Date.now()): string {
  if (isPlayerOnline(player, now)) {
    return player.ready ? 'מוכן/ה' : 'מחובר/ת, עדיין לא מוכן/ה';
  }
  return 'לא מחובר/ת';
}

export function bothPlayersReady(room: CoupleRoom | null): boolean {
  if (!room?.partnerUid) return false;
  return room.hostReady && room.partnerReady;
}

async function resolveRoomIdByDisplayCode(displayCode: string): Promise<string | null> {
  const db = await getFirestoreDb();
  if (!db) return null;
  const { doc, getDoc } = await import('firebase/firestore');
  const codeSnap = await getDoc(doc(db, 'roomCodes', displayCode));
  if (codeSnap.exists()) {
    const data = codeSnap.data() as Record<string, unknown>;
    if (typeof data.roomId === 'string') return data.roomId;
  }
  const legacySnap = await getDoc(doc(db, 'rooms', displayCode));
  if (legacySnap.exists()) return displayCode;
  return null;
}

export async function createCoupleRoom(hostName: string, eveningTitle = 'ערב זוגי'): Promise<{
  ok: boolean;
  room?: CoupleRoom;
  error?: string;
}> {
  if (!canUseRooms()) return { ok: false, error: 'firebase_not_configured' };
  const user = await ensureRoomAuth();
  const db = await getFirestoreDb();
  if (!user || !db) return { ok: false, error: 'auth_failed' };

  const { doc, getDoc, serverTimestamp, writeBatch } = await import('firebase/firestore');
  const roomId = newRoomId();
  const now = Date.now();

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const displayCode = randomDisplayCode();
    const codeRef = doc(db, 'roomCodes', displayCode);
    const existingCode = await getDoc(codeRef);
    if (existingCode.exists()) continue;

    const room: CoupleRoom = {
      roomId,
      displayCode,
      code: displayCode,
      hostUid: user.uid,
      partnerUid: null,
      hostName: clampName(hostName, 'שחקן 1'),
      partnerName: null,
      status: 'waiting',
      createdAtMs: now,
      updatedAtMs: now,
      expiresAtMs: now + ROOM_TTL_MS,
      version: 0,
      eveningTitle: eveningTitle.slice(0, 64),
      lastEventId: null,
      updatedBy: user.uid,
      hostReady: false,
      partnerReady: false,
      hostLastSeenMs: now,
      partnerLastSeenMs: 0,
    };

    const batch = writeBatch(db);
    batch.set(doc(db, 'rooms', roomId), { ...room, updatedAt: serverTimestamp() });
    batch.set(codeRef, {
      roomId,
      displayCode,
      expiresAtMs: room.expiresAtMs,
      createdAtMs: now,
      hostUid: user.uid,
    });
    await batch.commit();

    writeStored(roomId, displayCode, 'host');
    captureEvent('room_created', { roomId });
    void import('./userProfile').then((m) =>
      m.ensureUserProfile({ displayName: clampName(hostName, 'שחקן 1'), lastRoomId: roomId }),
    );
    return { ok: true, room };
  }
  captureError(new Error('code_collision'), { action: 'createCoupleRoom' });
  return { ok: false, error: 'code_collision' };
}

export async function joinCoupleRoom(
  code: string,
  partnerName: string,
): Promise<{ ok: boolean; room?: CoupleRoom; error?: string }> {
  if (!canUseRooms()) return { ok: false, error: 'firebase_not_configured' };

  const rate = checkJoinRateLimit();
  if (!rate.allowed) return { ok: false, error: 'join_rate_limited' };

  const ipGuard = await assertJoinGuard();
  if (!ipGuard.ok) return { ok: false, error: ipGuard.error ?? 'join_rate_limited' };

  const user = await ensureRoomAuth();
  const db = await getFirestoreDb();
  if (!user || !db) return { ok: false, error: 'auth_failed' };

  await clearExpiredServerJoinLock(user.uid);
  const serverRate = await checkServerJoinRateLimit(user.uid);
  if (!serverRate.allowed) return { ok: false, error: serverRate.error ?? 'join_rate_limited' };

  const normalized = normalizeDisplayCode(code);
  if (normalized.length !== DISPLAY_CODE_LEN) return { ok: false, error: 'invalid_code' };

  const roomId = await resolveRoomIdByDisplayCode(normalized);
  if (!roomId) {
    recordJoinFailure();
    await recordServerJoinFailure(user.uid);
    return { ok: false, error: 'room_not_found' };
  }

  const { doc, runTransaction, serverTimestamp } = await import('firebase/firestore');
  const roomRef = doc(db, 'rooms', roomId);

  try {
    const joined = await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) throw new Error('room_not_found');
      const current = parseRoom(roomId, snap.data() as Record<string, unknown>);
      if (isExpired(current)) throw new Error('room_expired');
      if (current.hostUid === user.uid) return current;
      if (current.partnerUid === user.uid) return current;
      if (current.partnerUid) throw new Error('room_full');
      if (current.status !== 'waiting') throw new Error('room_full');

      const updated: CoupleRoom = {
        ...current,
        partnerUid: user.uid,
        partnerName: clampName(partnerName, 'שחקן 2'),
        status: 'lobby',
        updatedAtMs: Date.now(),
        updatedBy: user.uid,
      };
      tx.update(roomRef, {
        partnerUid: updated.partnerUid,
        partnerName: updated.partnerName,
        status: updated.status,
        partnerReady: false,
        partnerLastSeenMs: Date.now(),
        updatedAtMs: updated.updatedAtMs,
        updatedBy: updated.updatedBy,
        updatedAt: serverTimestamp(),
      });
      return { ...updated, partnerReady: false, partnerLastSeenMs: Date.now() };
    });

    resetJoinRateLimit();
    writeStored(roomId, joined.displayCode || normalized, joined.hostUid === user.uid ? 'host' : 'partner');
    captureEvent('room_joined', { roomId });
    void import('./userProfile').then((m) =>
      m.ensureUserProfile({
        displayName: clampName(partnerName, 'שחקן 2'),
        lastRoomId: roomId,
      }),
    );
    return { ok: true, room: joined };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'join_failed';
    if (msg === 'room_not_found' || msg === 'room_expired' || msg === 'room_full') {
      recordJoinFailure();
      await recordServerJoinFailure(user.uid);
    }
    captureError(err, { action: 'joinCoupleRoom' });
    return { ok: false, error: msg };
  }
}

export async function leaveCoupleRoom(): Promise<void> {
  const stored = readStored();
  if (!stored || !canUseRooms()) {
    clearStoredRoom();
    return;
  }
  const user = await ensureRoomAuth();
  const db = await getFirestoreDb();
  if (!user || !db) {
    clearStoredRoom();
    return;
  }

  const { doc, getDoc, deleteDoc, serverTimestamp, setDoc } = await import('firebase/firestore');
  const roomRef = doc(db, 'rooms', stored.roomId);
  const snap = await getDoc(roomRef);
  if (snap.exists()) {
    const room = parseRoom(stored.roomId, snap.data() as Record<string, unknown>);
    if (room.hostUid === user.uid) {
      await deleteDoc(doc(db, 'roomCodes', room.displayCode));
      await deleteDoc(roomRef);
    } else if (room.partnerUid === user.uid) {
      await setDoc(
        roomRef,
        {
          partnerUid: null,
          partnerName: null,
          partnerReady: false,
          partnerLastSeenMs: 0,
          status: 'waiting',
          updatedAtMs: Date.now(),
          updatedBy: user.uid,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    }
  }
  clearStoredRoom();
}

async function patchCoupleRoom(roomId: string, patch: Partial<CoupleRoom>): Promise<void> {
  if (!canUseRooms()) return;
  const db = await getFirestoreDb();
  if (!db) return;
  const { doc, serverTimestamp, setDoc } = await import('firebase/firestore');
  await setDoc(
    doc(db, 'rooms', roomId),
    { ...patch, updatedAtMs: Date.now(), updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function setPlayerReady(roomId: string, ready: boolean): Promise<void> {
  const user = await ensureRoomAuth();
  const stored = readStored();
  if (!user || !stored) return;
  const now = Date.now();
  const patch =
    stored.role === 'host'
      ? { hostReady: ready, hostLastSeenMs: now, updatedBy: user.uid }
      : { partnerReady: ready, partnerLastSeenMs: now, updatedBy: user.uid };
  await patchCoupleRoom(roomId, patch);
  await appendRoomEvent(roomId, 'PLAYER_READY', { ready });
}

export async function sendPresenceHeartbeat(roomId: string): Promise<void> {
  const stored = readStored();
  if (!stored) return;
  const now = Date.now();
  const patch =
    stored.role === 'host' ? { hostLastSeenMs: now } : { partnerLastSeenMs: now };
  await patchCoupleRoom(roomId, patch);
}

export async function appendRoomEvent(
  roomId: string,
  type: RoomEventType,
  payload: Record<string, unknown> = {},
): Promise<{ ok: boolean; version?: number; error?: string }> {
  if (!canUseRooms()) return { ok: false, error: 'firebase_not_configured' };
  const user = await ensureRoomAuth();
  const db = await getFirestoreDb();
  if (!user || !db) return { ok: false, error: 'auth_failed' };

  const payloadJson = JSON.stringify(payload);
  if (payloadJson.length > MAX_EVENT_PAYLOAD_BYTES) {
    return { ok: false, error: 'sync_failed' };
  }

  const { doc, runTransaction, serverTimestamp } = await import('firebase/firestore');
  const roomRef = doc(db, 'rooms', roomId);
  const eventId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `evt-${Date.now()}`;

  try {
    const version = await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) throw new Error('room_not_found');
      const room = parseRoom(roomId, snap.data() as Record<string, unknown>);
      if (isExpired(room)) throw new Error('room_expired');
      const isMember = room.hostUid === user.uid || room.partnerUid === user.uid;
      if (!isMember) throw new Error('permission_denied');
      if (type === 'GAME_STARTED') {
        if (!room.partnerUid || !room.hostReady || !room.partnerReady) {
          throw new Error('not_ready');
        }
      }

      const nextVersion = room.version + 1;
      const eventRef = doc(db, 'rooms', roomId, 'events', eventId);
      tx.set(eventRef, {
        type,
        version: nextVersion,
        createdBy: user.uid,
        createdAtMs: Date.now(),
        payload,
        createdAt: serverTimestamp(),
      });
      tx.update(roomRef, {
        version: nextVersion,
        lastEventId: eventId,
        updatedBy: user.uid,
        updatedAtMs: Date.now(),
        updatedAt: serverTimestamp(),
        ...(type === 'GAME_STARTED' ? { status: 'playing' } : {}),
        ...(type === 'GAME_ENDED' ? { status: 'ended' } : {}),
      });
      return nextVersion;
    });
    return { ok: true, version };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'sync_failed';
    return { ok: false, error: msg };
  }
}

export async function pushRoomGameState(roomId: string, game: GameState): Promise<void> {
  const slim = sanitizeGameForSync(game);
  await appendRoomEvent(roomId, slim.screen === 'end' ? 'GAME_ENDED' : 'GAME_SNAPSHOT', {
    gameState: slim,
    screen: slim.screen,
    sparkStreak: slim.stats.streak,
  });
}

export function subscribeCoupleRoom(
  roomId: string,
  displayCode: string,
  onRoom: (room: CoupleRoom | null) => void,
): () => void {
  if (!canUseRooms()) {
    onRoom(null);
    return () => {};
  }
  let unsubscribe = () => {};
  void (async () => {
    const db = await getFirestoreDb();
    if (!db) {
      onRoom(null);
      return;
    }
    const { doc, onSnapshot } = await import('firebase/firestore');
    unsubscribe = onSnapshot(doc(db, 'rooms', roomId), (snap) => {
      if (!snap.exists()) {
        onRoom(null);
        return;
      }
      const room = parseRoom(roomId, snap.data() as Record<string, unknown>);
      if (isExpired(room)) {
        onRoom(null);
        return;
      }
      onRoom({ ...room, displayCode: room.displayCode || displayCode, code: room.displayCode || displayCode });
    });
  })();
  return () => unsubscribe();
}

export function subscribeRoomEvents(
  roomId: string,
  fromVersion: number,
  onEvent: (event: RoomGameEvent) => void,
): () => void {
  if (!canUseRooms()) return () => {};
  let unsubscribe = () => {};
  void (async () => {
    const db = await getFirestoreDb();
    if (!db) return;
    const { collection, onSnapshot, orderBy, query } = await import('firebase/firestore');
    const q = query(collection(db, 'rooms', roomId, 'events'), orderBy('version', 'asc'));
    let lastSeen = fromVersion;
    unsubscribe = onSnapshot(q, (snap) => {
      for (const change of snap.docChanges()) {
        if (change.type !== 'added' && change.type !== 'modified') continue;
        const raw = change.doc.data() as Record<string, unknown>;
        const version = Number(raw.version) || 0;
        if (version <= lastSeen) continue;
        lastSeen = version;
        onEvent({
          id: change.doc.id,
          type: raw.type as RoomEventType,
          version,
          createdBy: String(raw.createdBy ?? ''),
          createdAtMs: Number(raw.createdAtMs) || 0,
          payload: (raw.payload as Record<string, unknown>) ?? {},
        });
      }
    });
  })();
  return () => unsubscribe();
}

export function partnerConnected(room: CoupleRoom | null): boolean {
  return Boolean(room?.partnerUid && room.partnerName);
}

const VALID_SCREENS = new Set([
  'welcome',
  'tutorial',
  'setup',
  'dice-roll',
  'game',
  'end',
  'settings',
]);

/** Lightweight schema guard before applying a remote snapshot. */
export function isValidRemoteGameState(value: unknown): value is GameState {
  if (!value || typeof value !== 'object') return false;
  const g = value as Record<string, unknown>;
  if (typeof g.screen !== 'string' || !VALID_SCREENS.has(g.screen)) return false;
  if (!Array.isArray(g.scores) || g.scores.length !== 2) return false;
  if (typeof g.scores[0] !== 'number' || typeof g.scores[1] !== 'number') return false;
  if (typeof g.playerOneName !== 'string' || typeof g.playerTwoName !== 'string') return false;
  if (g.currentPlayerIndex !== 0 && g.currentPlayerIndex !== 1) return false;
  if (!Array.isArray(g.usedTaskIds)) return false;
  if (!g.stats || typeof g.stats !== 'object') return false;
  return true;
}

export function extractGameFromEvent(event: RoomGameEvent): GameState | null {
  if (event.type !== 'GAME_SNAPSHOT' && event.type !== 'GAME_ENDED') return null;
  const state = event.payload.gameState;
  if (!isValidRemoteGameState(state)) return null;
  return state;
}
