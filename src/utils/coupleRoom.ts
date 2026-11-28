import { accountLocal } from './accountStorage';
import type { GameState } from '../types/game';
import { isValidRemoteGameState } from '../../shared/game-state-schema.mjs';
import { isValidRoomEventPayload, MAX_PAYLOAD_BYTES } from '../../shared/room-event.mjs';
export { isValidRemoteGameState } from '../../shared/game-state-schema.mjs';
import { getFirebaseAuth, getFirestoreDb, isFirebaseConfigured } from '../lib/firebase';
import { captureError, captureEvent } from './monitoring';
import { checkJoinRateLimit, recordJoinFailure, resetJoinRateLimit } from './roomJoinRateLimit';
import { gameSyncData } from './gameSyncData';
import { gameApiPath } from './gameApi';

const ROOM_ID_KEY = 'couple-spin-room-id';
const ROOM_CODE_KEY = 'couple-spin-room-code';
const ROLE_KEY = 'couple-spin-room-role';

export const ROOM_TTL_MS = 2 * 60 * 60 * 1000;
export const PRESENCE_TIMEOUT_MS = 60_000;
export const HEARTBEAT_INTERVAL_MS = 25_000;
export const SNAPSHOT_EVERY_N_EVENTS = 5;
export const MAX_PLAYER_NAME_LEN = 32;
export const DISPLAY_CODE_LEN = 8;
export const MAX_EVENT_PAYLOAD_BYTES = MAX_PAYLOAD_BYTES;

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
  const auth = await getFirebaseAuth();
  if (!auth) return null;
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user || user.isAnonymous || !user.email) return null;
  return user;
}

/** Strip heavy / non-essential fields before pushing over the wire. */
export function sanitizeGameForSync(game: GameState): GameState {
  return gameSyncData({
    ...game,
    usedTaskIds: Array.isArray(game.usedTaskIds) ? game.usedTaskIds.slice(-200) : [],
    sessionNewAchievements: Array.isArray(game.sessionNewAchievements)
      ? game.sessionNewAchievements.slice(-20)
      : [],
    unlockedAchievements: Array.isArray(game.unlockedAchievements)
      ? game.unlockedAchievements.slice(-40)
      : [],
  });
}

function clampName(name: string, fallback: string): string {
  const trimmed = name.trim().slice(0, MAX_PLAYER_NAME_LEN);
  return trimmed || fallback;
}

function readStored(): StoredRoom | null {
  try {
    const roomId = accountLocal.getItem(ROOM_ID_KEY);
    const displayCode = accountLocal.getItem(ROOM_CODE_KEY);
    const role = accountLocal.getItem(ROLE_KEY);
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
  accountLocal.setItem(ROOM_ID_KEY, roomId);
  accountLocal.setItem(ROOM_CODE_KEY, displayCode);
  accountLocal.setItem(ROLE_KEY, role);
}

export function clearStoredRoom(): void {
  accountLocal.removeItem(ROOM_ID_KEY);
  accountLocal.removeItem(ROOM_CODE_KEY);
  accountLocal.removeItem(ROLE_KEY);
}

export function getStoredRoom(): StoredRoom | null {
  return readStored();
}

function isExpired(room: CoupleRoom): boolean {
  return Date.now() >= room.expiresAtMs;
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

type RoomCommandResult = { ok: boolean; roomId?: string; version?: number; error?: string };

async function roomCommand(
  user: NonNullable<Awaited<ReturnType<typeof ensureRoomAuth>>>,
  body: Record<string, unknown>,
): Promise<RoomCommandResult> {
  const response = await fetch(gameApiPath('rooms'), {
    method: 'POST', credentials: 'same-origin', redirect: 'error',
    headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json() as RoomCommandResult;
  if (!response.ok || result.ok !== true) return { ok: false, error: result.error };
  return result;
}

async function enterRoom(
  action: 'create' | 'join',
  name: string,
  fields: { eveningTitle: string } | { code: string },
): Promise<{ ok: boolean; room?: CoupleRoom; error?: string }> {
  if (!canUseRooms()) return { ok: false, error: 'firebase_not_configured' };
  try {
    const user = await ensureRoomAuth();
    const db = await getFirestoreDb();
    if (!user || !db) return { ok: false, error: 'auth_failed' };
    const result = await roomCommand(user, { action, name, ...fields });
    if (!result.ok || typeof result.roomId !== 'string') {
      if (action === 'join' && result.error === 'room_not_found') recordJoinFailure();
      return { ok: false, error: result.error ?? `${action}_failed` };
    }
    const { doc, getDocFromServer } = await import('firebase/firestore');
    const snap = await getDocFromServer(doc(db, 'rooms', result.roomId));
    if (!snap.exists()) return { ok: false, error: 'room_not_found' };
    const room = parseRoom(snap.id, snap.data());
    writeStored(room.roomId, room.displayCode, room.hostUid === user.uid ? 'host' : 'partner');
    if (action === 'join') resetJoinRateLimit();
    captureEvent(action === 'join' ? 'room_joined' : 'room_created', { roomId: room.roomId });
    void import('./userProfile').then((m) => m.ensureUserProfile({ displayName: name, lastRoomId: room.roomId }));
    return { ok: true, room };
  } catch (error) {
    captureError(error, { action: action === 'join' ? 'joinCoupleRoom' : 'createCoupleRoom' });
    return { ok: false, error: `${action}_failed` };
  }
}

export function createCoupleRoom(hostName: string, eveningTitle = 'ערב זוגי') {
  return enterRoom('create', clampName(hostName, 'שחקן 1'), { eveningTitle: eveningTitle.slice(0, 64) });
}

export async function joinCoupleRoom(code: string, partnerName: string) {
  if (!checkJoinRateLimit().allowed) return { ok: false, room: undefined, error: 'join_rate_limited' };
  const normalized = code.trim().replace(/[ -]/g, '');
  if (!/^[0-9]{8}$/.test(normalized)) return { ok: false, room: undefined, error: 'invalid_code' };
  return enterRoom('join', clampName(partnerName, 'שחקן 2'), { code: normalized });
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

  if (stored.role === 'host') {
    const result = await roomCommand(user, { action: 'close', roomId: stored.roomId });
    if (!result.ok && result.error !== 'room_not_found') throw new Error(result.error ?? 'sync_failed');
    clearStoredRoom();
    return;
  }
  const { doc, getDoc, serverTimestamp, setDoc } = await import('firebase/firestore');
  const roomRef = doc(db, 'rooms', stored.roomId);
  const snap = await getDoc(roomRef);
  if (snap.exists()) {
    const room = parseRoom(stored.roomId, snap.data() as Record<string, unknown>);
    if (room.partnerUid === user.uid) {
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
  // Readiness is already stored in the room. Updating it must not also race
  // both phones against the shared version used for game snapshots.
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
  eventId = crypto.randomUUID(),
): Promise<{ ok: boolean; version?: number; error?: string }> {
  if (!canUseRooms()) return { ok: false, error: 'firebase_not_configured' };
  try {
    const user = await ensureRoomAuth();
    if (!user) return { ok: false, error: 'auth_failed' };
    if (new TextEncoder().encode(JSON.stringify(payload)).length > MAX_EVENT_PAYLOAD_BYTES) {
      return { ok: false, error: 'sync_failed' };
    }
    const command = { action: 'event', roomId, eventId, type, payload };
    // A lost response may follow a committed transaction. Reuse the ID on retry.
    let result: RoomCommandResult;
    try { result = await roomCommand(user, command); }
    catch { result = await roomCommand(user, command); }
    return result.ok && Number.isSafeInteger(result.version) ? { ok: true, version: result.version }
      : { ok: false, error: result.error ?? 'sync_failed' };
  } catch {
    return { ok: false, error: 'sync_failed' };
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
  let cancelled = false;
  void (async () => {
    const db = await getFirestoreDb();
    if (cancelled) return;
    if (!db) {
      onRoom(null);
      return;
    }
    const { doc, onSnapshot } = await import('firebase/firestore');
    if (cancelled) return;
    unsubscribe = onSnapshot(doc(db, 'rooms', roomId), { includeMetadataChanges: true }, (snap) => {
      if (!snap.exists()) {
        // Transaction reads do not populate the cache. Wait for the server before
        // treating an initially empty cache as a deleted room.
        if (!snap.metadata.fromCache) onRoom(null);
        return;
      }
      const data = snap.data() as Record<string, unknown>;
      // A transaction can leave only its updated fields in the local cache.
      // That partial document has no expiry or identity until the server replies.
      if (typeof data.expiresAtMs !== 'number' || typeof data.hostUid !== 'string') return;
      const room = parseRoom(roomId, data);
      if (isExpired(room)) {
        onRoom(null);
        return;
      }
      onRoom({ ...room, displayCode: room.displayCode || displayCode, code: room.displayCode || displayCode });
    }, (error) => {
      if (cancelled) return;
      if (error.code === 'permission-denied') onRoom(null);
      else captureError(error, { action: 'subscribeCoupleRoom' });
    });
  })();
  return () => { cancelled = true; unsubscribe(); };
}

export function subscribeRoomEvents(
  roomId: string,
  fromVersion: number,
  onEvent: (event: RoomGameEvent) => void,
): () => void {
  if (!canUseRooms()) return () => {};
  let unsubscribe = () => {};
  let cancelled = false;
  void (async () => {
    const db = await getFirestoreDb();
    if (cancelled) return;
    if (!db) return;
    const { collection, limitToLast, onSnapshot, orderBy, query, where } = await import('firebase/firestore');
    if (cancelled) return;
    // Game snapshots are self-contained. On reconnect fetch the most recent window
    // after the consumed cursor, then keep listening as the window moves forward.
    const q = query(collection(db, 'rooms', roomId, 'gameEvents'), where('version', '>', fromVersion),
      orderBy('version', 'asc'), limitToLast(32));
    let lastSeen = fromVersion;
    unsubscribe = onSnapshot(q, (snap) => {
      for (const change of snap.docChanges()) {
        if (change.type !== 'added' && change.type !== 'modified') continue;
        const raw = change.doc.data() as Record<string, unknown>;
        if (typeof raw.version !== 'number' || !Number.isSafeInteger(raw.version) || raw.version <= lastSeen) continue;
        const version = raw.version;
        const event: RoomGameEvent = {
          id: change.doc.id,
          type: raw.type as RoomEventType,
          version,
          createdBy: raw.createdBy as string,
          createdAtMs: raw.createdAtMs as number,
          payload: raw.payload as Record<string, unknown>,
        };
        if (!isValidRoomEvent(event)) continue;
        lastSeen = version;
        onEvent(event);
      }
    }, (error) => {
      // Losing membership during leave/expiry closes the listener normally.
      if (!cancelled && error.code !== 'permission-denied') captureError(error, { action: 'subscribeRoomEvents' });
    });
  })();
  return () => { cancelled = true; unsubscribe(); };
}

export function partnerConnected(room: CoupleRoom | null): boolean {
  return Boolean(room?.partnerUid && room.partnerName);
}

export function isValidRoomEvent(event: RoomGameEvent): boolean {
  if (!event || typeof event.id !== 'string' || !event.id || typeof event.createdBy !== 'string' || !event.createdBy ||
      !Number.isSafeInteger(event.version) || event.version < 1 ||
      !Number.isSafeInteger(event.createdAtMs) || event.createdAtMs < 0 ||
      !event.payload || typeof event.payload !== 'object' || Array.isArray(event.payload)) return false;
  return isValidRoomEventPayload(event.type, event.payload);
}

export function extractGameFromEvent(event: RoomGameEvent): GameState | null {
  if (event.type !== 'GAME_SNAPSHOT' && event.type !== 'GAME_ENDED') return null;
  const state = event.payload?.gameState;
  if (!isValidRemoteGameState(state)) return null;
  return state;
}
