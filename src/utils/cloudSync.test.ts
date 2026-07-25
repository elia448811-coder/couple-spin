import { describe, expect, it } from 'vitest';
import { mergeBundles, mergeHistory, mergeRecords } from './cloudSync';
import type { CloudBundle } from './cloudSync';
import { DEFAULT_SETTINGS, type GameHistoryEntry } from '../types/game';

function baseBundle(overrides: Partial<CloudBundle> = {}): CloudBundle {
  return {
    updatedAtMs: 1000,
    schemaVersion: 2,
    settings: DEFAULT_SETTINGS,
    history: [],
    records: { mostCompleted: 0, longestStreak: 0, totalGames: 0, totalTasks: 0 },
    achievements: [],
    boundaries: { playerOne: [], playerTwo: [] },
    hiddenTasks: [],
    favorites: [],
    discrete: false,
    customContent: [],
    processedFinishIds: [],
    ...overrides,
  };
}

describe('cloudSync merge', () => {
  it('dedupes history by id keeping newest date', () => {
    const a: GameHistoryEntry = {
      id: 'h1',
      date: '2026-01-01T00:00:00.000Z',
      eveningName: 'a',
      mode: 'funny',
      completed: 1,
      skipped: 0,
      winner: null,
      durationMinutes: 5,
    };
    const b = { ...a, date: '2026-02-01T00:00:00.000Z', completed: 3 };
    const merged = mergeHistory([a], [b]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.completed).toBe(3);
  });

  it('merges records by max values', () => {
    const merged = mergeRecords(
      { mostCompleted: 5, longestStreak: 2, totalGames: 1, totalTasks: 10 },
      { mostCompleted: 3, longestStreak: 4, totalGames: 2, totalTasks: 8 },
    );
    expect(merged.mostCompleted).toBe(5);
    expect(merged.longestStreak).toBe(4);
    expect(merged.totalGames).toBe(2);
  });

  it('unions achievements and finish ids', () => {
    const local = baseBundle({ achievements: ['a'], processedFinishIds: ['f1'], updatedAtMs: 2000 });
    const remote = baseBundle({ achievements: ['b'], processedFinishIds: ['f2'], updatedAtMs: 1000 });
    const merged = mergeBundles(local, remote);
    expect(merged.achievements.sort()).toEqual(['a', 'b']);
    expect(merged.processedFinishIds.sort()).toEqual(['f1', 'f2']);
  });
});
