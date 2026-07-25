import { describe, expect, it, beforeEach } from 'vitest';
import { isFinishProcessed, markFinishProcessed, persistGameFinish } from './finishPersistence';
import { emptyStats } from './gameReducer';
import type { GameState } from '../types/game';

function game(overrides: Partial<GameState> = {}): GameState {
  return {
    screen: 'end',
    mode: 'funny',
    level: 'easy',
    gameFormat: 'normal',
    scoringMode: 'competitive',
    coupleTaskMode: false,
    contentMode: 'tasks',
    eveningName: '',
    playerOneName: 'א',
    playerTwoName: 'ב',
    currentPlayerIndex: 0,
    scores: [1, 0],
    cooperativeScore: 0,
    usedTaskIds: [],
    currentTask: null,
    isSpinning: false,
    wheelLanded: false,
    targetScore: 10,
    customTargetScore: 10,
    roundTarget: 10,
    timeLimitSeconds: null,
    timeRemainingSeconds: null,
    timeDeadlineMs: null,
    finishEventId: 'finish-1',
    stats: { ...emptyStats(), totalCompleted: 2, startTime: Date.now() - 60_000 },
    winner: 0,
    spinCategory: null,
    unlockedAchievements: [],
    sessionNewAchievements: [],
    paused: false,
    uiBlocked: false,
    poolEmpty: false,
    lastAction: null,
    ...overrides,
  };
}

describe('finishPersistence', () => {
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
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage } });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: localStorage });
    localStorage.clear();
  });

  it('is idempotent for the same finishEventId', () => {
    expect(persistGameFinish(game(), 'finish-1')).toBe(true);
    expect(persistGameFinish(game(), 'finish-1')).toBe(false);
    expect(isFinishProcessed('finish-1')).toBe(true);
  });

  it('marks processed ids', () => {
    markFinishProcessed('x');
    expect(isFinishProcessed('x')).toBe(true);
  });
});
