import { describe, expect, it } from 'vitest';
import type { GameState } from '../types/game';
import { getEffectiveTarget } from '../types/game';
import { checkEndConditions, getScoreTarget } from './gameEnd';
import { pickTaskWithFallback } from './pickTaskWithFallback';
import { filterTasks } from './taskSelection';

function baseState(overrides: Partial<GameState> = {}): GameState {
  return {
    screen: 'game',
    mode: 'mixed',
    level: 'normal',
    gameFormat: 'normal',
    scoringMode: 'competitive',
    coupleTaskMode: false,
    contentMode: 'mixed',
    eveningName: '',
    playerOneName: 'א',
    playerTwoName: 'ב',
    currentPlayerIndex: 0,
    scores: [0, 0],
    cooperativeScore: 0,
    usedTaskIds: [],
    currentTask: null,
    isSpinning: false,
    wheelLanded: false,
    targetScore: 5,
    customTargetScore: 12,
    roundTarget: 12,
    timeLimitSeconds: null,
    timeRemainingSeconds: null,
    timeDeadlineMs: null,
    finishEventId: null,
    paused: false,
    uiBlocked: false,
    poolEmpty: false,
    lastAction: null,
    stats: {
      totalCompleted: 0,
      totalSkipped: 0,
      streak: 0,
      maxStreak: 0,
      funniestTaskId: null,
      funniestTaskTitle: null,
      startTime: Date.now(),
      roundNumber: 0,
    },
    winner: null,
    spinCategory: null,
    unlockedAchievements: [],
    sessionNewAchievements: [],
    ...overrides,
  };
}

describe('getEffectiveTarget', () => {
  it('returns null for fun mode', () => {
    expect(getEffectiveTarget(baseState({ gameFormat: 'fun' }))).toBeNull();
  });

  it('returns round target for rounds mode', () => {
    expect(getEffectiveTarget(baseState({ gameFormat: 'rounds', roundTarget: 8 }))).toBe(8);
  });

  it('returns custom target', () => {
    expect(
      getEffectiveTarget(baseState({ targetScore: 'custom', customTargetScore: 7 })),
    ).toBe(7);
  });
});

describe('getScoreTarget', () => {
  it('returns null for rounds mode', () => {
    expect(getScoreTarget(baseState({ gameFormat: 'rounds' }))).toBeNull();
  });

  it('returns score target for normal mode', () => {
    expect(getScoreTarget(baseState({ targetScore: 10 }))).toBe(10);
  });
});

describe('checkEndConditions', () => {
  it('ends competitive game when score target reached', () => {
    const state = baseState({ targetScore: 5, gameFormat: 'normal' });
    const result = checkEndConditions(state, [5, 2], 0, state.stats);
    expect(result).toEqual({ end: true, winner: 0 });
  });

  it('does not end rounds mode early when score hits round count', () => {
    const state = baseState({
      gameFormat: 'rounds',
      roundTarget: 12,
      scoringMode: 'competitive',
      targetScore: 10,
    });
    const stats = { ...state.stats, roundNumber: 5 };
    const result = checkEndConditions(state, [12, 3], 0, stats);
    expect(result).toEqual({ end: false, winner: null });
  });

  it('ends rounds mode when round limit reached', () => {
    const state = baseState({
      gameFormat: 'rounds',
      roundTarget: 8,
      scoringMode: 'competitive',
    });
    const stats = { ...state.stats, roundNumber: 8 };
    const result = checkEndConditions(state, [6, 4], 0, stats);
    expect(result).toEqual({ end: true, winner: 0 });
  });

  it('ends cooperative game at shared target', () => {
    const state = baseState({
      scoringMode: 'cooperative',
      targetScore: 5,
    });
    const result = checkEndConditions(state, [0, 0], 5, state.stats);
    expect(result).toEqual({ end: true, winner: 'tie' });
  });

  it('ends no-scoring game when completed target reached', () => {
    const state = baseState({
      scoringMode: 'none',
      targetScore: 5,
      gameFormat: 'normal',
    });
    const stats = { ...state.stats, totalCompleted: 5 };
    const result = checkEndConditions(state, [0, 0], 0, stats);
    expect(result).toEqual({ end: true, winner: null });
  });

  it('ends rounds with cooperative scoring as tie', () => {
    const state = baseState({
      gameFormat: 'rounds',
      roundTarget: 4,
      scoringMode: 'cooperative',
    });
    const stats = { ...state.stats, roundNumber: 4 };
    const result = checkEndConditions(state, [2, 2], 4, stats);
    expect(result).toEqual({ end: true, winner: 'tie' });
  });
});

describe('pickTaskWithFallback', () => {
  it('never returns null', () => {
    const task = pickTaskWithFallback('mixed', 'normal', [], true, { coupleOnly: true });
    expect(task).toBeTruthy();
    expect(task.id).toBeTruthy();
  });

  it('avoids used tasks when possible', () => {
    const first = pickTaskWithFallback('funny', 'easy', [], true);
    const second = pickTaskWithFallback('funny', 'easy', [first.id], true);
    expect(second.id).not.toBe(first.id);
  });

  it('filters couple tasks when coupleOnly', () => {
    const tasks = filterTasks('mixed', 'normal', [], true, { coupleOnly: true });
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.every((t) => t.isCoupleTask)).toBe(true);
  });
});
