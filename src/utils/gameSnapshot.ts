import { accountSession } from './accountStorage';
import type { GameState } from '../types/game';

const SNAPSHOT_KEY = 'couple-spin-active-game';

export function saveSnapshot(game: GameState): void {
  if (game.screen !== 'game' || game.finishEventId) return;
  try {
    accountSession.setItem(SNAPSHOT_KEY, JSON.stringify(game));
    void import('./cloudSync').then(({ pushCloudSnapshot }) => pushCloudSnapshot(game));
  } catch {}
}

export function loadSnapshot(): GameState | null {
  try {
    const raw = accountSession.getItem(SNAPSHOT_KEY);
    const value: unknown = raw ? JSON.parse(raw) : null;
    return value && typeof value === 'object' ? (value as GameState) : null;
  } catch {
    return null;
  }
}

export function clearSnapshot(): void {
  try {
    accountSession.removeItem(SNAPSHOT_KEY);
  } catch {}
}
