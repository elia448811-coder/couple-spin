import { describe, expect, it } from 'vitest';
import type { CoupleTask, GameState } from '../types/game';
import { emptyStats, gameReducer } from './gameReducer';

const task: CoupleTask = {
  id: 't1',
  title: 'משימה',
  description: 'תיאור',
  category: 'funny',
  level: 'easy',
  kind: 'task',
};

function baseGame(overrides: Partial<GameState> = {}): GameState {
  return {
    screen: 'game',
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
    scores: [0, 0],
    cooperativeScore: 0,
    usedTaskIds: [],
    currentTask: task,
    isSpinning: false,
    wheelLanded: true,
    targetScore: 10,
    customTargetScore: 10,
    roundTarget: 10,
    timeLimitSeconds: 60,
    timeRemainingSeconds: 10,
    timeDeadlineMs: Date.now() + 10_000,
    finishEventId: null,
    stats: emptyStats(),
    winner: null,
    spinCategory: 'funny',
    unlockedAchievements: [],
    sessionNewAchievements: [],
    paused: false,
    uiBlocked: false,
    poolEmpty: false,
    lastAction: null,
    ...overrides,
  };
}

describe('gameReducer', () => {
  it('ignores duplicate finish events', () => {
    const first = gameReducer(baseGame(), { type: 'GAME_FINISHED', winner: 0, finishEventId: 'fin-1' });
    expect(first.state.screen).toBe('end');
    expect(first.state.finishEventId).toBe('fin-1');

    const second = gameReducer(first.state, { type: 'TIMER_EXPIRED', finishEventId: 'fin-2' });
    expect(second.state.finishEventId).toBe('fin-1');
    expect(second.effects).toEqual([]);
  });

  it('timer and manual finish race — first wins', () => {
    const state = baseGame({ currentTask: null });
    const byTimer = gameReducer(state, { type: 'TIMER_EXPIRED', finishEventId: 'timer' });
    const byUser = gameReducer(byTimer.state, { type: 'GAME_FINISHED', winner: 'tie', finishEventId: 'user' });
    expect(byTimer.state.screen).toBe('end');
    expect(byUser.state.finishEventId).toBe('timer');
  });

  it('blocks complete while uiBlocked', () => {
    const result = gameReducer(baseGame({ uiBlocked: true }), {
      type: 'TASK_COMPLETED',
      finishEventId: 'x',
    });
    expect(result.state.stats.totalCompleted).toBe(0);
    expect(result.state.currentTask).toEqual(task);
  });

  it('completes task and advances turn', () => {
    const result = gameReducer(baseGame(), { type: 'TASK_COMPLETED', finishEventId: 'c1' });
    expect(result.state.currentTask).toBeNull();
    expect(result.state.scores[0]).toBe(1);
    expect(result.state.currentPlayerIndex).toBe(1);
    expect(result.state.stats.tasksPresented).toBe(1);
  });

  it('pause only works on game screen', () => {
    const paused = gameReducer(baseGame(), { type: 'PAUSE' });
    expect(paused.state.paused).toBe(true);
    const ignored = gameReducer(baseGame({ screen: 'welcome' }), { type: 'PAUSE' });
    expect(ignored.state.paused).toBe(false);
  });

  it('start spin blocked when paused', () => {
    const result = gameReducer(baseGame({ paused: true, currentTask: null }), { type: 'START_SPIN' });
    expect(result.state.isSpinning).toBe(false);
  });
});
