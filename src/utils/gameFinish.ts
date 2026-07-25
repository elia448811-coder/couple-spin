import type { GameState, Screen } from '../types/game';
import { checkAchievements } from './achievements';

/** Pure — no I/O, no audio. Side effects run after commit via finishEventId. */
export function buildFinishedGame(prev: GameState, winner: GameState['winner']): GameState {
  const newAchievements = checkAchievements(prev.stats, prev, prev.unlockedAchievements);
  const finishEventId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `finish-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return {
    ...prev,
    winner,
    screen: 'end' as Screen,
    currentTask: null,
    isSpinning: false,
    wheelLanded: false,
    timeDeadlineMs: null,
    timeRemainingSeconds: null,
    finishEventId,
    unlockedAchievements: [...prev.unlockedAchievements, ...newAchievements],
    sessionNewAchievements: newAchievements,
  };
}

export function finishPayload(prev: GameState) {
  const durationMinutes = Math.max(1, Math.round((Date.now() - prev.stats.startTime) / 60000));
  const winnerName =
    prev.winner === 0 ? prev.playerOneName : prev.winner === 1 ? prev.playerTwoName : null;

  return {
    history: {
      id: prev.finishEventId || `${Date.now()}`,
      date: new Date().toISOString(),
      eveningName: prev.eveningName || 'ערב זוגי',
      mode: prev.mode,
      completed: prev.stats.totalCompleted,
      skipped: prev.stats.totalSkipped,
      winner: winnerName,
      durationMinutes,
    },
    achievements: prev.sessionNewAchievements,
    stats: prev.stats,
  };
}
