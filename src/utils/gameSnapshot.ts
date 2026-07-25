import type { GameState } from '../types/game';

const SNAPSHOT_KEY = 'couple-spin-active-game';

export function saveSnapshot(game: GameState): void {
  if (game.screen !== 'game' || game.finishEventId) return;
  try {
    sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify(game));
    void import('./cloudSync').then(({ pushCloudSnapshot }) => pushCloudSnapshot(game));
  } catch {}
}

export function loadSnapshot(): GameState | null {
  try {
    const raw = sessionStorage.getItem(SNAPSHOT_KEY);
    const value: unknown = raw ? JSON.parse(raw) : null;
    return value && typeof value === 'object' ? (value as GameState) : null;
  } catch {
    return null;
  }
}

export function clearSnapshot(): void {
  try {
    sessionStorage.removeItem(SNAPSHOT_KEY);
  } catch {}
}
