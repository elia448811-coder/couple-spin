import { accountLocal } from './accountStorage';
import type { GameState } from '../types/game';
import { ensureFirebaseApp, getFirestoreDb, isFirebaseConfigured } from '../lib/firebase';
import { ensureAnonAuth } from './cloudSync';
import { captureError, captureEvent } from './monitoring';
import { checkJoinRateLimit, recordJoinFailure, resetJoinRateLimit } from './roomJoinRateLimit';

const ROOM_ID_KEY = 'couple-spin-room-id';
const ROOM_CODE_KEY = 'couple-spin-room-code';
const ROLE_KEY = 'couple-spin-room-role';

export const PRESENCE_TIMEOUT_MS = 60_000;
export const HEARTBEAT_INTERVAL_MS = 25_000;
export const MAX_PLAYER_NAME_LEN = 32;
export const DISPLAY_CODE_LEN = 8;
export const MAX_EVENT_PAYLOAD_BYTES = 120_000;

export type RoomRole = 'host' | 'partner';
export type RoomStatus = 'waiting' | 'lobby' | 'playing' | 'ended';
export type RoomEventType = 'GAME_STARTED' | 'GAME_SNAPSHOT' | 'GAME_ENDED';

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
  return Date.now() > room.expiresAtMs;
}

function parseRoom(roomId: string, raw: Record<string, unknown>): CoupleRoom {
  const displayCode = String(raw.displayCode ?? raw.code ?? (/^[0-9]{8}$/.test(roomId) ? roomId : ''));
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

type AccessResult = { ok: boolean; roomId?: string; error?: string };

async function requestRoomAccess(data: Record<string, string>): Promise<AccessResult> {
  const app = await ensureFirebaseApp();
  if (!app) return { ok: false, error: 'firebase_not_configured' };
  if (!await ensureRoomAuth()) return { ok: false, error: 'auth_failed' };
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const call = httpsCallable<Record<string, string>, AccessResult>(getFunctions(app), 'coupleRoomAccess');
  return (await call(data)).data;
}

async function openRoom(data: Record<string, string>): Promise<{ ok: boolean; room?: CoupleRoom; error?: string }> {
  try {
    const result = await requestRoomAccess(data);
    if (!result.ok || !result.roomId) return { ok: false, error: result.error ?? 'sync_failed' };
    const user = await ensureRoomAuth();
    const db = await getFirestoreDb();
    if (!user || !db) return { ok: false, error: 'auth_failed' };
    const { doc, getDocFromServer } = await import('firebase/firestore');
    const snap = await getDocFromServer(doc(db, 'rooms', result.roomId));
    if (!snap.exists()) return { ok: false, error: 'room_not_found' };
    const room = parseRoom(snap.id, snap.data());
    if (room.hostUid !== user.uid && room.partnerUid !== user.uid) return { ok: false, error: 'permission_denied' };
    writeStored(room.roomId, room.displayCode, room.hostUid === user.uid ? 'host' : 'partner');
    captureEvent(data.action === 'create' ? 'room_created' : 'room_joined', { roomId: room.roomId });
    void import('./userProfile').then((m) => m.ensureUserProfile({ displayName: data.name, lastRoomId: room.roomId }));
    return { ok: true, room };
  } catch (error) {
    captureError(error, { action: data.action });
    return { ok: false, error: data.action === 'create' ? 'create_failed' : 'join_failed' };
  }
}

export async function createCoupleRoom(hostName: string, eveningTitle = 'ערב זוגי') {
  return openRoom({ action: 'create', name: clampName(hostName, 'שחקן 1'), title: eveningTitle.trim().slice(0, 64) || 'ערב זוגי' });
}

export async function joinCoupleRoom(code: string, partnerName: string) {
  const normalized = normalizeDisplayCode(code);
  if (normalized.length !== DISPLAY_CODE_LEN) return { ok: false, error: 'invalid_code' };
  if (!checkJoinRateLimit().allowed) return { ok: false, error: 'join_rate_limited' };
  const ipGuard = await assertJoinGuard();
  if (!ipGuard.ok) return { ok: false, error: 'join_rate_limited' };
  const result = await openRoom({ action: 'join', code: normalized, name: clampName(partnerName, 'שחקן 2') });
  if (result.ok) resetJoinRateLimit();
  else if (result.error === 'room_not_found' || result.error === 'room_full') recordJoinFailure();
  return result;
}

export async function leaveCoupleRoom(): Promise<void> {
  const stored = readStored();
  if (stored && canUseRooms()) {
    const result = await requestRoomAccess({ action: 'leave', roomId: stored.roomId });
    if (!result.ok && result.error !== 'auth_failed') throw new Error(result.error ?? 'sync_failed');
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
}

export async function sendPresenceHeartbeat(roomId: string): Promise<void> {
  const stored = readStored();
  const user = await ensureRoomAuth();
  if (!stored || !user) return;
  const now = Date.now();
  const patch =
    stored.role === 'host' ? { hostLastSeenMs: now } : { partnerLastSeenMs: now };
  await patchCoupleRoom(roomId, { ...patch, updatedBy: user.uid });
}

export async function appendRoomEvent(
  roomId: string,
  type: RoomEventType,
  payload = '',
): Promise<{ ok: boolean; version?: number; error?: string }> {
  const user = await ensureRoomAuth();
  const db = await getFirestoreDb();
  if (!user || !db) return { ok: false, error: 'auth_failed' };
  if (new TextEncoder().encode(payload).length > MAX_EVENT_PAYLOAD_BYTES) return { ok: false, error: 'sync_failed' };
  const { doc, runTransaction, serverTimestamp, Timestamp } = await import('firebase/firestore');
  const roomRef = doc(db, 'rooms', roomId);
  try {
    const version = await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) throw new Error('room_not_found');
      const room = parseRoom(roomId, snap.data());
      if (isExpired(room)) throw new Error('room_expired');
      if (room.hostUid !== user.uid || !room.partnerUid) throw new Error('permission_denied');
      if (type === 'GAME_STARTED' && !bothPlayersReady(room)) throw new Error('not_ready');
      const nextVersion = room.version + 1;
      if (nextVersion > 2048) throw new Error('room_event_limit');
      tx.set(doc(roomRef, 'sync', 'current'), {
        type, version: nextVersion, payload, createdAt: serverTimestamp(),
        coupleSpinExpireAt: Timestamp.fromMillis(room.expiresAtMs),
      });
      tx.update(roomRef, {
        version: nextVersion, updatedBy: user.uid, updatedAtMs: Date.now(), updatedAt: serverTimestamp(),
        ...(type === 'GAME_STARTED' ? { status: 'playing' } : {}),
        ...(type === 'GAME_ENDED' ? { status: 'ended' } : {}),
      });
      return nextVersion;
    });
    return { ok: true, version };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'sync_failed' };
  }
}

export async function pushRoomGameState(roomId: string, game: GameState): Promise<void> {
  const state = sanitizeGameForSync(game);
  await appendRoomEvent(roomId, state.screen === 'end' ? 'GAME_ENDED' : 'GAME_SNAPSHOT', JSON.stringify(state));
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
  let active = true;
  let unsubscribe = () => {};
  void (async () => {
    const db = await getFirestoreDb();
    if (!db || !active) return;
    const { doc, onSnapshot } = await import('firebase/firestore');
    if (!active) return;
    unsubscribe = onSnapshot(doc(db, 'rooms', roomId), { includeMetadataChanges: true }, (snap) => {
      if (snap.metadata.fromCache) return;
      if (!snap.exists()) return onRoom(null);
      const room = parseRoom(roomId, snap.data());
      onRoom(isExpired(room) ? null : { ...room, displayCode: room.displayCode || displayCode });
    }, () => onRoom(null));
  })();
  return () => { active = false; unsubscribe(); };
}

export function readSyncedGame(raw: Record<string, unknown>, fromVersion: number): { game: GameState; version: number } | null {
  if (raw.type !== 'GAME_SNAPSHOT' && raw.type !== 'GAME_ENDED') return null;
  if (typeof raw.version !== 'number' || !Number.isInteger(raw.version) || raw.version <= fromVersion || raw.version > 2048) return null;
  if (typeof raw.payload !== 'string' || new TextEncoder().encode(raw.payload).length > MAX_EVENT_PAYLOAD_BYTES) return null;
  try {
    const game: unknown = JSON.parse(raw.payload);
    return isValidRemoteGameState(game) ? { game, version: raw.version } : null;
  } catch {
    return null;
  }
}

export function subscribeRoomGame(roomId: string, onGame: (game: GameState | null, version: number) => void): () => void {
  let active = true;
  let unsubscribe = () => {};
  void (async () => {
    const db = await getFirestoreDb();
    if (!db || !active) return;
    const { doc, onSnapshot } = await import('firebase/firestore');
    if (!active) return;
    let lastSeen = 0;
    unsubscribe = onSnapshot(doc(db, 'rooms', roomId, 'sync', 'current'), { includeMetadataChanges: true }, (snap) => {
      if (snap.metadata.fromCache || snap.metadata.hasPendingWrites) return;
      if (!snap.exists()) return onGame(null, 0);
      const state = readSyncedGame(snap.data(), lastSeen);
      if (!state) return;
      lastSeen = state.version;
      onGame(state.game, state.version);
    }, () => onGame(null, 0));
  })();
  return () => { active = false; unsubscribe(); };
}

export function partnerConnected(room: CoupleRoom | null): boolean {
  return Boolean(room?.partnerUid && room.partnerName);
}

const VALID_SCREENS = new Set([
  'welcome',
  'tutorial',
  'setup',
  'mode-select',
  'level-select',
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
