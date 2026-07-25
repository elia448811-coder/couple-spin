import { describe, expect, it } from 'vitest';
import { buildFinishedGame, finishPayload } from './gameFinish';
import { createTestGameState } from './gameSimulator';

describe('gameFinish', () => {
  it('builds pure end state with finishEventId', () => {
    const prev = createTestGameState({
      screen: 'game',
      scores: [3, 1],
      stats: {
        totalCompleted: 4,
        totalSkipped: 1,
        streak: 2,
        maxStreak: 2,
        funniestTaskId: null,
        funniestTaskTitle: null,
        startTime: Date.now() - 120000,
        roundNumber: 5,
      },
    });
    const next = buildFinishedGame(prev, 0);
    expect(next.screen).toBe('end');
    expect(next.winner).toBe(0);
    expect(next.finishEventId).toBeTruthy();
    expect(next.currentTask).toBeNull();
    expect(next.timeDeadlineMs).toBeNull();
  });

  it('finishPayload is idempotent by finishEventId', () => {
    const finished = buildFinishedGame(createTestGameState({ scores: [2, 2] }), 'tie');
    const a = finishPayload(finished);
    const b = finishPayload(finished);
    expect(a.history.id).toBe(b.history.id);
    expect(a.history.id).toBe(finished.finishEventId);
  });
});
