import { accountLocal, storageUid } from './accountStorage';
import { getFirebaseAuth, getFirestoreDb, isFirebaseConfigured } from '../lib/firebase';
import type { CustomContentItem } from './customContent';
import { loadCustomContent } from './customContent';
import { loadProcessedFinishIds, applyProcessedFinishIds } from './finishPersistence';
import {
  isDiscreteMode,
  isGuestMode,
  loadBoundaries,
  type Boundaries,
} from './privacy';
import {
  loadHistory,
  loadRecords,
  loadSettings,
  loadUnlockedAchievements,
  saveSettings,
  saveUnlockedAchievements,
  sanitizeSettings,
} from './storage';
import type { AppSettings, GameHistoryEntry, GameState, LocalRecords } from '../types/game';

export const SCHEMA_VERSION = 2;
const CONSENT_KEY = 'couple-spin-cloud-consent-v1';
const MAX_BACKUP_BYTES = 700_000;
const OUTBOX_KEY = 'couple-spin-cloud-outbox';
const WATERMARK_KEY = 'couple-spin-cloud-updated-at';
const HIDDEN_KEY = 'couple-spin-hidden-tasks';
const FAVORITES_KEY = 'couple-spin-favorites';
const DISCRETE_KEY = 'couple-spin-discrete';
const CUSTOM_KEY = 'couple-spin-custom-content';
const BOUNDARIES_KEY = 'couple-spin-boundaries';

export type CloudStatus =
  | { state: 'disabled'; reason: 'not_configured' | 'guest' | 'local' }
  | { state: 'ok'; uid: string; projectId: string | null }
  | { state: 'error'; message: string };

export type SyncState = {
  status: 'idle' | 'syncing' | 'pending' | 'error';
  lastSyncMs: number | null;
  lastError: string | null;
};

export type CloudBundle = {
  updatedAtMs: number;
  schemaVersion: number;
  settings: AppSettings;
  history: GameHistoryEntry[];
  records: LocalRecords;
  achievements: string[];
  boundaries: Boundaries;
  hiddenTasks: string[];
  favorites: string[];
  discrete: boolean;
  customContent: CustomContentItem[];
  processedFinishIds: string[];
};

type SyncListener = (state: SyncState) => void;

let syncState: SyncState = { status: 'idle', lastSyncMs: null, lastError: null };
const listeners = new Set<SyncListener>();
let pushTimer: ReturnType<typeof setTimeout> | null = null;

function emitSync(patch: Partial<SyncState>): void {
  syncState = { ...syncState, ...patch };
  listeners.forEach((fn) => fn(syncState));
}

export function subscribeSyncState(listener: SyncListener): () => void {
  listeners.add(listener);
  listener(syncState);
  return () => listeners.delete(listener);
}

export function getSyncState(): SyncState {
  return syncState;
}

let syncGeneration = 0;

export function hasCloudConsent(): boolean {
  try {
    return Boolean(storageUid()) && accountLocal.getItem(CONSENT_KEY) === '1';
  } catch {
    return false;
  }
}

export function cancelCloudSync(): void {
  syncGeneration++;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = null;
  clearOutbox();
  emitSync({ status: 'idle', lastSyncMs: null, lastError: null });
}

export function setCloudConsent(enabled: boolean): void {
  cancelCloudSync();
  if (enabled && storageUid() && !isGuestMode()) accountLocal.setItem(CONSENT_KEY, '1');
  else accountLocal.removeItem(CONSENT_KEY);
}

export function canSync(): boolean {
  return isFirebaseConfigured() && hasCloudConsent() && !isGuestMode();
}

async function syncTarget() {
  const uid = storageUid();
  const generation = syncGeneration;
  if (!uid || !canSync()) return null;
  const auth = await getFirebaseAuth();
  const current = () => auth?.currentUser?.uid === uid && !auth.currentUser.isAnonymous
    && storageUid() === uid && generation === syncGeneration && canSync();
  if (!current()) return null;
  const db = await getFirestoreDb();
  return db && current() ? { uid, db, current } : null;
}

function encodeBackup(value: CloudBundle | GameState): string {
  const payload = JSON.stringify(value);
  if (new TextEncoder().encode(payload).length > MAX_BACKUP_BYTES) throw new Error('backup_too_large');
  return payload;
}

function decodeBackup(data: Record<string, unknown>): Record<string, unknown> {
  // Pre-envelope backups stored their fields directly on the document.
  if (!('payload' in data)) return data;
  if (typeof data.payload !== 'string' || data.payload.length > MAX_BACKUP_BYTES) throw new Error('invalid_backup');
  const decoded: unknown = JSON.parse(data.payload);
  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) throw new Error('invalid_backup');
  return decoded as Record<string, unknown>;
}

function readIds(key: string): string[] {
  try {
    const raw = accountLocal.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? [...new Set(parsed.filter((id): id is string => typeof id === 'string' && id.length <= 128))]
      : [];
  } catch {
    return [];
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    accountLocal.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function readLocalCloudWatermark(): number {
  const raw = accountLocal.getItem(WATERMARK_KEY);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? n : 0;
}

export function markLocalCloudWatermark(ms = Date.now()): void {
  try {
    accountLocal.setItem(WATERMARK_KEY, String(ms));
  } catch {
    // ignore
  }
}

export function localBundle(): CloudBundle {
  return {
    updatedAtMs: Date.now(),
    schemaVersion: SCHEMA_VERSION,
    settings: loadSettings(),
    history: loadHistory(),
    records: loadRecords(),
    achievements: loadUnlockedAchievements(),
    boundaries: loadBoundaries(),
    hiddenTasks: readIds(HIDDEN_KEY),
    favorites: readIds(FAVORITES_KEY),
    discrete: isDiscreteMode(),
    customContent: loadCustomContent(),
    processedFinishIds: loadProcessedFinishIds(),
  };
}

export function mergeHistory(a: GameHistoryEntry[], b: GameHistoryEntry[]): GameHistoryEntry[] {
  const map = new Map<string, GameHistoryEntry>();
  for (const entry of [...a, ...b]) {
    const prev = map.get(entry.id);
    if (!prev || Date.parse(entry.date) >= Date.parse(prev.date)) map.set(entry.id, entry);
  }
  return [...map.values()]
    .sort((x, y) => Date.parse(y.date) - Date.parse(x.date))
    .slice(0, 20);
}

export function mergeRecords(a: LocalRecords, b: LocalRecords): LocalRecords {
  return {
    mostCompleted: Math.max(a.mostCompleted, b.mostCompleted),
    longestStreak: Math.max(a.longestStreak, b.longestStreak),
    totalGames: Math.max(a.totalGames, b.totalGames),
    totalTasks: Math.max(a.totalTasks, b.totalTasks),
  };
}

export function mergeBundles(local: CloudBundle, remote: CloudBundle): CloudBundle {
  const newerFirst = local.updatedAtMs >= remote.updatedAtMs ? local : remote;
  const older = local.updatedAtMs >= remote.updatedAtMs ? remote : local;
  return {
    updatedAtMs: Math.max(local.updatedAtMs, remote.updatedAtMs),
    schemaVersion: SCHEMA_VERSION,
    settings: newerFirst.settings,
    history: mergeHistory(local.history, remote.history),
    records: mergeRecords(local.records, remote.records),
    achievements: [...new Set([...local.achievements, ...remote.achievements])],
    boundaries: newerFirst.boundaries.playerOne.length || newerFirst.boundaries.playerTwo.length
      ? newerFirst.boundaries
      : older.boundaries,
    hiddenTasks: [...new Set([...local.hiddenTasks, ...remote.hiddenTasks])],
    favorites: [...new Set([...local.favorites, ...remote.favorites])],
    discrete: newerFirst.discrete,
    customContent:
      local.customContent.length >= remote.customContent.length ? local.customContent : remote.customContent,
    processedFinishIds: [...new Set([...local.processedFinishIds, ...remote.processedFinishIds])].slice(0, 200),
  };
}

export function applyCloudBundle(bundle: CloudBundle): void {
  saveSettings(bundle.settings);
  saveUnlockedAchievements(bundle.achievements);
  applyProcessedFinishIds(bundle.processedFinishIds);
  writeJson('couple-spin-history', bundle.history);
  writeJson('couple-spin-records', bundle.records);
  writeJson(BOUNDARIES_KEY, bundle.boundaries);
  writeJson(HIDDEN_KEY, bundle.hiddenTasks);
  writeJson(FAVORITES_KEY, bundle.favorites);
  writeJson(DISCRETE_KEY, bundle.discrete);
  writeJson(CUSTOM_KEY, bundle.customContent);
  markLocalCloudWatermark(bundle.updatedAtMs);
}

function parseRemoteBundle(raw: Partial<CloudBundle>): CloudBundle {
  return {
    updatedAtMs: typeof raw.updatedAtMs === 'number' ? raw.updatedAtMs : 0,
    schemaVersion: typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 1,
    settings: sanitizeSettings(raw.settings),
    history: Array.isArray(raw.history) ? (raw.history as GameHistoryEntry[]) : [],
    records: (raw.records as LocalRecords) ?? loadRecords(),
    achievements: Array.isArray(raw.achievements)
      ? raw.achievements.filter((id): id is string => typeof id === 'string')
      : [],
    boundaries: raw.boundaries ?? loadBoundaries(),
    hiddenTasks: Array.isArray(raw.hiddenTasks) ? raw.hiddenTasks.filter((id) => typeof id === 'string') : [],
    favorites: Array.isArray(raw.favorites) ? raw.favorites.filter((id) => typeof id === 'string') : [],
    discrete: Boolean(raw.discrete),
    customContent: Array.isArray(raw.customContent) ? (raw.customContent as CustomContentItem[]) : [],
    processedFinishIds: Array.isArray(raw.processedFinishIds)
      ? raw.processedFinishIds.filter((id) => typeof id === 'string')
      : [],
  };
}

/** Anonymous auth for rooms — works even in guest mode (local privacy ≠ no Firebase Auth). */
export async function ensureAnonAuth() {
  if (!isFirebaseConfigured()) return null;
  const auth = await getFirebaseAuth();
  if (!auth) return null;
  if (auth.currentUser) return auth.currentUser;
  const { signInAnonymously } = await import('firebase/auth');
  const cred = await signInAnonymously(auth);
  return cred.user;
}

export async function pingFirestore(): Promise<CloudStatus> {
  if (!isFirebaseConfigured()) return { state: 'disabled', reason: 'not_configured' };
  if (isGuestMode()) return { state: 'disabled', reason: 'guest' };
  const target = await syncTarget();
  if (!target) return { state: 'disabled', reason: 'local' };
  try {
    const { doc, getDoc, serverTimestamp, setDoc } = await import('firebase/firestore');
    if (!target.current()) return { state: 'disabled', reason: 'local' };
    const ref = doc(target.db, 'users', target.uid, 'meta', 'health');
    await setDoc(ref, { ok: true, at: serverTimestamp(), schemaVersion: SCHEMA_VERSION, client: 'couple-spin' });
    const snap = await getDoc(ref);
    if (!target.current()) return { state: 'disabled', reason: 'local' };
    if (!snap.exists()) return { state: 'error', message: 'health_missing' };
    return { state: 'ok', uid: target.uid, projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim() || null };
  } catch (error) {
    return { state: 'error', message: error instanceof Error ? error.message : 'ping_failed' };
  }
}

function queueOutbox(): void {
  try {
    accountLocal.setItem(OUTBOX_KEY, '1');
    emitSync({ status: 'pending' });
  } catch {
    // ignore
  }
}

function clearOutbox(): void {
  try {
    accountLocal.removeItem(OUTBOX_KEY);
  } catch {
    // ignore
  }
}

function hasOutbox(): boolean {
  return accountLocal.getItem(OUTBOX_KEY) === '1';
}

export async function pushUserData(): Promise<{ ok: boolean; error?: string }> {
  const target = await syncTarget();
  if (!target) return { ok: false, error: 'sync_disabled' };
  emitSync({ status: 'syncing', lastError: null });
  try {
    const { doc, getDoc, serverTimestamp, setDoc } = await import('firebase/firestore');
    const ref = doc(target.db, 'users', target.uid, 'data', 'bundle');
    const existing = await getDoc(ref);
    if (!target.current()) return { ok: false, error: 'sync_disabled' };
    const bundle = localBundle();
    const merged = existing.exists() ? mergeBundles(bundle, parseRemoteBundle(decodeBackup(existing.data()))) : bundle;
    merged.updatedAtMs = Date.now();
    await setDoc(ref, { payload: encodeBackup(merged), updatedAtMs: merged.updatedAtMs, updatedAt: serverTimestamp() });
    if (!target.current()) return { ok: false, error: 'sync_disabled' };
    applyCloudBundle(merged);
    clearOutbox();
    emitSync({ status: 'idle', lastSyncMs: Date.now(), lastError: null });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'push_failed';
    if (target.current()) {
      queueOutbox();
      emitSync({ status: 'error', lastError: message });
    }
    return { ok: false, error: message };
  }
}

export async function pullUserData(): Promise<{ ok: boolean; bundle?: CloudBundle; error?: string }> {
  const target = await syncTarget();
  if (!target) return { ok: false, error: 'sync_disabled' };
  emitSync({ status: 'syncing', lastError: null });
  try {
    const { doc, getDoc } = await import('firebase/firestore');
    const snap = await getDoc(doc(target.db, 'users', target.uid, 'data', 'bundle'));
    if (!target.current()) return { ok: false, error: 'sync_disabled' };
    if (!snap.exists()) {
      emitSync({ status: 'idle', lastSyncMs: Date.now() });
      return { ok: true };
    }
    const remote = parseRemoteBundle(decodeBackup(snap.data()));
    const local = { ...localBundle(), updatedAtMs: readLocalCloudWatermark() };
    const merged = mergeBundles(local, remote);
    if (local.updatedAtMs > remote.updatedAtMs) {
      const result = await pushUserData();
      if (!result.ok || !target.current()) return { ok: false, error: result.error ?? 'sync_disabled' };
      return { ok: true, bundle: localBundle() };
    }
    applyCloudBundle(merged);
    emitSync({ status: 'idle', lastSyncMs: Date.now(), lastError: null });
    return { ok: true, bundle: merged };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'pull_failed';
    if (target.current()) emitSync({ status: 'error', lastError: message });
    return { ok: false, error: message };
  }
}

export async function syncCloudOnStartup(): Promise<boolean> {
  if (!canSync()) return false;
  const result = await pullUserData();
  if (canSync() && hasOutbox()) await pushUserData();
  return result.ok;
}

export function scheduleCloudPush(delayMs = 800): void {
  if (!canSync()) return;
  queueOutbox();
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void pushUserData();
  }, delayMs);
}

export async function pushCloudSnapshot(game: GameState): Promise<void> {
  if (game.screen !== 'game' || game.finishEventId) return;
  const target = await syncTarget();
  if (!target) return;
  try {
    const { doc, serverTimestamp, setDoc } = await import('firebase/firestore');
    if (!target.current()) return;
    await setDoc(doc(target.db, 'users', target.uid, 'data', 'activeGame'), {
      payload: encodeBackup(game), updatedAtMs: Date.now(), updatedAt: serverTimestamp(),
    });
  } catch {
    if (target.current()) queueOutbox();
  }
}

export async function pullCloudSnapshot(): Promise<GameState | null> {
  const target = await syncTarget();
  if (!target) return null;
  try {
    const { doc, getDoc } = await import('firebase/firestore');
    const snap = await getDoc(doc(target.db, 'users', target.uid, 'data', 'activeGame'));
    if (!snap.exists() || !target.current()) return null;
    const data = snap.data();
    const game = ('payload' in data ? decodeBackup(data) : data.game) as GameState | undefined;
    return game?.screen === 'game' ? game : null;
  } catch {
    return null;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    if (hasOutbox()) void pushUserData();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && hasOutbox()) void pushUserData();
  });
}

/** @deprecated use applyCloudBundle via pullUserData */
export function applyCloudBundleIfNewer(bundle: CloudBundle, localUpdatedAtMs: number): boolean {
  if (!bundle.updatedAtMs || bundle.updatedAtMs <= localUpdatedAtMs) return false;
  applyCloudBundle(bundle);
  return true;
}
