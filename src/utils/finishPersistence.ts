import type { GameState } from '../types/game';
import { finishPayload } from './gameFinish';
import { pruneHistory } from './privacy';
import {
  loadHistory,
  loadRecords,
  saveHistoryEntry,
  saveUnlockedAchievements,
  updateRecords,
} from './storage';

const PROCESSED_KEY = 'couple-spin-processed-finishes';
const MAX_PROCESSED = 200;

function readProcessed(): string[] {
  try {
    const raw = localStorage.getItem(PROCESSED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 128)
      : [];
  } catch {
    return [];
  }
}

function writeProcessed(ids: string[]): void {
  try {
    localStorage.setItem(PROCESSED_KEY, JSON.stringify(ids.slice(0, MAX_PROCESSED)));
  } catch {
    // ignore
  }
}

export function isFinishProcessed(finishEventId: string): boolean {
  return readProcessed().includes(finishEventId);
}

export function markFinishProcessed(finishEventId: string): void {
  if (!finishEventId) return;
  writeProcessed([finishEventId, ...readProcessed().filter((id) => id !== finishEventId)]);
}

export function loadProcessedFinishIds(): string[] {
  return readProcessed();
}

export function applyProcessedFinishIds(ids: string[]): void {
  writeProcessed([...new Set([...ids, ...readProcessed()])].slice(0, MAX_PROCESSED));
}

/** Atomic local finish side-effects with durable idempotency. */
export function persistGameFinish(game: GameState, finishEventId: string): boolean {
  if (!finishEventId || isFinishProcessed(finishEventId)) return false;
  const payload = finishPayload({ ...game, finishEventId });
  markFinishProcessed(finishEventId);
  if (payload.achievements.length) saveUnlockedAchievements(payload.achievements);
  saveHistoryEntry(payload.history);
  const pruned = pruneHistory(loadHistory(), 90);
  try {
    localStorage.setItem('couple-spin-history', JSON.stringify(pruned));
  } catch {
    return false;
  }
  const records = loadRecords();
  updateRecords({
    totalGames: records.totalGames + 1,
    mostCompleted: Math.max(payload.stats.totalCompleted, records.mostCompleted),
    longestStreak: Math.max(payload.stats.maxStreak, records.longestStreak),
    totalTasks: records.totalTasks + payload.stats.totalCompleted,
  });
  void import('./userProfile').then((m) => m.incrementGamesPlayed());
  return true;
}
