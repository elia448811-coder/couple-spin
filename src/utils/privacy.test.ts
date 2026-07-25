import { beforeEach, describe, expect, it } from 'vitest';
import {
  inferTaskBoundaries,
  pruneHistory,
  taskAllowedByBoundaries,
  type Boundaries,
} from './privacy';

describe('privacy helpers', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    const localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => store.clear(),
    };
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { localStorage },
    });
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: localStorage,
    });
  });

  it('infers boundaries from task wording', () => {
    expect(inferTaskBoundaries('צאו החוצה לפארק')).toContain('outside');
    expect(inferTaskBoundaries('צלמו סלפי יחד')).toContain('photo');
  });

  it('does not filter when boundaries are not configured', () => {
    expect(
      taskAllowedByBoundaries({ description: 'חיבוק חם', title: 'מגע', category: 'romantic' }),
    ).toBe(true);
  });

  it('filters by shared intersection when configured', () => {
    const bounds: Boundaries = { playerOne: ['touch'], playerTwo: ['photo'] };
    localStorage.setItem('couple-spin-boundaries', JSON.stringify(bounds));
    expect(taskAllowedByBoundaries({ description: 'חיבוק חם', title: 'מגע' })).toBe(false);
    expect(taskAllowedByBoundaries({ description: 'ספרו בדיחה', title: 'צחוק' })).toBe(true);
  });

  it('prunes old history entries', () => {
    const old = { id: '1', date: '2020-01-01T00:00:00.000Z', eveningName: '', mode: 'funny' as const, completed: 1, skipped: 0, winner: null, durationMinutes: 1 };
    const recent = { ...old, id: '2', date: new Date().toISOString() };
    expect(pruneHistory([old, recent], 90)).toEqual([recent]);
  });
});
