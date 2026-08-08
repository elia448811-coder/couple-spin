import { describe, expect, it } from 'vitest';
import { filterTasks } from './taskSelection';
import { pickTaskWithFallback } from './pickTaskWithFallback';
import {
  ALL_CONTENT_MODES,
  ALL_LEVELS,
  ALL_MODES,
  advanceTurn,
  createTestGameState,
  simulateComplete,
  simulatePick,
  simulateSkip,
  simulateStartGame,
} from './gameSimulator';

describe('advanceTurn', () => {
  it('keeps turn for couple tasks', () => {
    const state = createTestGameState({
      currentPlayerIndex: 0,
      currentTask: {
        id: 't1',
        title: 't',
        description: 'd',
        category: 'romantic',
        level: 'easy',
        isCoupleTask: true,
      },
    });
    expect(advanceTurn(state)).toBe(0);
  });

  it('keeps turn for questions', () => {
    const state = createTestGameState({
      currentPlayerIndex: 1,
      currentTask: {
        id: 'q-001',
        title: 'שאלה',
        description: 'מה שלומך?',
        category: 'romantic',
        level: 'normal',
        kind: 'question',
      },
    });
    expect(advanceTurn(state)).toBe(1);
  });

  it('alternates for solo tasks', () => {
    const state = createTestGameState({
      currentPlayerIndex: 0,
      currentTask: {
        id: 't1',
        title: 't',
        description: 'd',
        category: 'funny',
        level: 'easy',
        isCoupleTask: false,
      },
    });
    expect(advanceTurn(state)).toBe(1);
  });
});

describe('content mode filtering', () => {
  for (const mode of ALL_CONTENT_MODES) {
    it(`pickTaskWithFallback works for ${mode}`, () => {
      const task = pickTaskWithFallback('mixed', 'normal', [], true, { contentMode: mode });
      expect(task).toBeTruthy();
      if (mode === 'tasks') expect(task.kind).not.toBe('question');
      if (mode === 'questions') expect(task.kind).toBe('question');
    });
  }

  it('tasks mode never returns questions', () => {
    const pool = filterTasks('mixed', 'normal', [], true, { contentMode: 'tasks' });
    expect(pool.every((t) => t.kind !== 'question')).toBe(true);
    expect(pool.length).toBeGreaterThan(0);
  });

  it('meet100 group picks only from challenge 100', () => {
    const pool = filterTasks('mixed', 'advanced', [], true, {
      contentMode: 'questions',
      preferredQuestionGroup: 'meet100',
    });
    expect(pool.length).toBe(100);
    expect(pool.every((t) => t.questionGroup === 'meet100')).toBe(true);
  });

  it('questions mode never returns tasks', () => {
    const pool = filterTasks('mixed', 'advanced', [], true, { contentMode: 'questions' });
    expect(pool.every((t) => t.kind === 'question')).toBe(true);
    expect(pool.length).toBe(412);
  });
});

describe('game flow simulation', () => {
  it('competitive game ends at target score', () => {
    let state = simulateStartGame(
      createTestGameState({
        targetScore: 'custom',
        customTargetScore: 3,
        gameFormat: 'normal',
        scoringMode: 'competitive',
      }),
    );

    for (let i = 0; i < 5 && state.screen !== 'end'; i++) {
      const task = simulatePick(state);
      state = { ...state, currentTask: task };
      state = simulateComplete(state);
    }

    expect(state.screen).toBe('end');
    expect(state.winner === 0 || state.winner === 1 || state.winner === 'tie').toBe(true);
    if (state.winner === 0 || state.winner === 1) {
      expect(state.scores[state.winner]).toBeGreaterThanOrEqual(state.scores[1 - state.winner]);
    }
  });

  it('rounds mode ends after round count not early score', () => {
    let state = simulateStartGame(
      createTestGameState({
        gameFormat: 'rounds',
        roundTarget: 4,
        scoringMode: 'competitive',
        targetScore: 10,
      }),
    );

    for (let i = 0; i < 3; i++) {
      state = { ...state, currentTask: simulatePick(state) };
      state = simulateComplete(state);
      expect(state.screen).toBe('game');
    }

    state = { ...state, currentTask: simulatePick(state) };
    state = simulateComplete(state);
    expect(state.screen).toBe('end');
    expect(state.stats.roundNumber).toBe(4);
  });

  it('skip increments round and can end rounds mode', () => {
    let state = simulateStartGame(
      createTestGameState({ gameFormat: 'rounds', roundTarget: 2, scoringMode: 'none' }),
    );

    state = { ...state, currentTask: simulatePick(state) };
    state = simulateSkip(state);
    expect(state.screen).toBe('game');

    state = { ...state, currentTask: simulatePick(state) };
    state = simulateSkip(state);
    expect(state.screen).toBe('end');
  });

  it('cooperative mode ends at shared target', () => {
    let state = simulateStartGame(
      createTestGameState({
        targetScore: 'custom',
        customTargetScore: 3,
        scoringMode: 'cooperative',
        cooperativeScore: 0,
      }),
    );

    for (let i = 0; i < 3; i++) {
      state = { ...state, currentTask: simulatePick(state) };
      state = simulateComplete(state);
    }

    expect(state.screen).toBe('end');
    expect(state.winner).toBe('tie');
    expect(state.cooperativeScore).toBe(3);
  });

  it('all mode/level/content combinations can pick content', () => {
    for (const mode of ALL_MODES) {
      for (const level of ALL_LEVELS) {
        for (const contentMode of ALL_CONTENT_MODES) {
          const task = pickTaskWithFallback(mode, level, [], true, { contentMode });
          expect(task?.id).toBeTruthy();
        }
      }
    }
  });

  it('spicy mode returns only mature content', () => {
    const task = pickTaskWithFallback('spicy', 'normal', [], true, { contentMode: 'mixed' });
    expect(task.category).toBe('spicy');
    const pool = filterTasks('spicy', 'advanced', [], true, { contentMode: 'mixed' });
    expect(pool.length).toBe(150);
    expect(pool.every((t) => t.category === 'spicy')).toBe(true);
  });
});
