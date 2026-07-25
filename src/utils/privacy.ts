import type { GameHistoryEntry } from '../types/game';

const GUEST_KEY = 'couple-spin-guest';
const BOUNDARIES_KEY = 'couple-spin-boundaries';
const HIDDEN_TASKS_KEY = 'couple-spin-hidden-tasks';
const FAVORITES_KEY = 'couple-spin-favorites';
const DISCRETE_KEY = 'couple-spin-discrete';
const EXPORT_KEYS = [
  'couple-spin-settings',
  'couple-spin-history',
  'couple-spin-records',
  'couple-spin-achievements',
  'couple-spin-custom-content',
  GUEST_KEY,
  BOUNDARIES_KEY,
  HIDDEN_TASKS_KEY,
  FAVORITES_KEY,
  DISCRETE_KEY,
] as const;

export type ContentBoundary = 'touch' | 'photo' | 'outside' | 'intimate';
export type Boundaries = { playerOne: ContentBoundary[]; playerTwo: ContentBoundary[] };
const BOUNDARY_VALUES = new Set<ContentBoundary>(['touch', 'photo', 'outside', 'intimate']);

function getStorage(): Storage | null {
  return typeof window === 'undefined' ? null : window.localStorage;
}

function readJson(key: string): unknown {
  try {
    const raw = getStorage()?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readIds(key: string): string[] {
  const value = readJson(key);
  return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string' && id.length <= 128))] : [];
}

function writeJson(key: string, value: unknown): void {
  try {
    getStorage()?.setItem(key, JSON.stringify(value));
  } catch {
    // Privacy controls should remain safe when storage is unavailable.
  }
}

function boundaryList(value: unknown): ContentBoundary[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is ContentBoundary => typeof item === 'string' && BOUNDARY_VALUES.has(item as ContentBoundary)))]
    : [];
}

export function isGuestMode(): boolean {
  return getStorage()?.getItem(GUEST_KEY) === 'true';
}

export function setGuestMode(on: boolean): void {
  try {
    const storage = getStorage();
    if (on) storage?.setItem(GUEST_KEY, 'true');
    else storage?.removeItem(GUEST_KEY);
  } catch {}
}

export function loadBoundaries(): Boundaries {
  const value = readJson(BOUNDARIES_KEY);
  const data = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return { playerOne: boundaryList(data.playerOne), playerTwo: boundaryList(data.playerTwo) };
}

export function saveBoundaries(boundaries: Boundaries): void {
  writeJson(BOUNDARIES_KEY, {
    playerOne: boundaryList(boundaries.playerOne),
    playerTwo: boundaryList(boundaries.playerTwo),
  });
}

export function sharedBoundaries(boundaries: Boundaries = loadBoundaries()): ContentBoundary[] {
  const allowed = new Set(boundaryList(boundaries.playerTwo));
  return boundaryList(boundaries.playerOne).filter((boundary) => allowed.has(boundary));
}

/** Infer soft content tags from Hebrew/English keywords when tasks lack explicit tags. */
export function inferTaskBoundaries(text: string): ContentBoundary[] {
  const hay = text.toLowerCase();
  const found = new Set<ContentBoundary>();
  if (/מגע|חיבוק|נשיק|לגעת|touch|kiss|hug/.test(hay)) found.add('touch');
  if (/צילום|תמונ|סלפי|מצלמ|photo|selfie|camera/.test(hay)) found.add('photo');
  if (/בחוץ|החוצה|ברחוב|בפארק|פארק|מחוץ|outside|outdoors|public/.test(hay)) found.add('outside');
  if (/אינטימ|מיני|עירום|מיטה|intimate|sexy|nude|bedroom/.test(hay)) found.add('intimate');
  return [...found];
}

/** Keep only tasks that do not require boundaries outside the shared allow-list. */
export function taskAllowedByBoundaries(
  task: { description: string; title?: string; category?: string },
  shared: ContentBoundary[] = sharedBoundaries(),
): boolean {
  const bounds = loadBoundaries();
  const configured = bounds.playerOne.length > 0 || bounds.playerTwo.length > 0;
  if (!configured) return true;

  const required = inferTaskBoundaries(`${task.title ?? ''} ${task.description}`);
  if (task.category === 'spicy' && !shared.includes('intimate') && required.includes('intimate')) {
    return false;
  }
  return required.every((boundary) => shared.includes(boundary));
}

export function hideTaskForever(id: string): void {
  if (!id) return;
  writeJson(HIDDEN_TASKS_KEY, [...readIds(HIDDEN_TASKS_KEY), id]);
}

export function isTaskHidden(id: string): boolean {
  return readIds(HIDDEN_TASKS_KEY).includes(id);
}

export function toggleFavorite(id: string): boolean {
  if (!id) return false;
  const favorites = readIds(FAVORITES_KEY);
  const next = favorites.includes(id) ? favorites.filter((item) => item !== id) : [...favorites, id];
  writeJson(FAVORITES_KEY, next);
  return next.includes(id);
}

export function listFavorites(): string[] {
  return readIds(FAVORITES_KEY);
}

export function exportAllData(): object {
  const storage = getStorage();
  return Object.fromEntries(EXPORT_KEYS.flatMap((key) => {
    const value = storage?.getItem(key);
    return value === null || value === undefined ? [] : [[key, readJson(key)]];
  }));
}

export function importAllData(data: unknown): { ok: boolean; error?: string } {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, error: 'invalid_export' };
  try {
    const storage = getStorage();
    if (!storage) return { ok: false, error: 'storage_unavailable' };
    const source = data as Record<string, unknown>;
    for (const key of EXPORT_KEYS) {
      if (!(key in source)) continue;
      const value = source[key];
      if (value === undefined || typeof value === 'function') return { ok: false, error: 'invalid_value' };
      JSON.stringify(value);
      storage.setItem(key, JSON.stringify(value));
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'import_failed' };
  }
}

export function pruneHistory(entries: GameHistoryEntry[], maxDays = 90): GameHistoryEntry[] {
  const cutoff = Date.now() - Math.max(0, maxDays) * 86_400_000;
  return entries.filter((entry) => {
    const time = Date.parse(entry.date);
    return Number.isFinite(time) && time >= cutoff;
  });
}

export function isDiscreteMode(): boolean {
  return getStorage()?.getItem(DISCRETE_KEY) === 'true';
}

export function setDiscreteMode(on: boolean): void {
  try {
    const storage = getStorage();
    if (on) storage?.setItem(DISCRETE_KEY, 'true');
    else storage?.removeItem(DISCRETE_KEY);
  } catch {}
}
