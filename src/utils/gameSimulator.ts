import type { AppSettings, ContentMode, GameMode, GameState, TaskCategory, TaskLevel } from '../types/game';
import { buildFinishedGame } from './gameFinish';
import { getDefaultRoundTarget, getEffectiveTarget, getTimeLimitForFormat } from '../types/game';
import { checkEndConditions } from './gameEnd';
import { pickTaskWithFallback } from './pickTaskWithFallback';

export function createTestGameState(
  overrides: Partial<GameState> = {},
  settings?: Partial<AppSettings>,
): GameState {
  const base: GameState = {
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
    targetScore: 10,
    customTargetScore: 12,
    roundTarget: 12,
    timeLimitSeconds: null,
    timeRemainingSeconds: null,
    timeDeadlineMs: null,
    finishEventId: null,
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
  };
  if (settings?.roundCount !== undefined) {
    base.roundTarget = getDefaultRoundTarget(base.gameFormat, settings.roundCount);
  }
  return { ...base, ...overrides };
}

export function advanceTurn(state: GameState): 0 | 1 {
  if (
    state.coupleTaskMode ||
    state.currentTask?.isCoupleTask ||
    state.currentTask?.kind === 'question'
  ) {
    return state.currentPlayerIndex;
  }
  return state.currentPlayerIndex === 0 ? 1 : 0;
}

export function simulatePick(
  state: GameState,
  advancedEnabled = true,
  preferredCategory: TaskCategory | null = null,
) {
  return pickTaskWithFallback(state.mode, state.level, state.usedTaskIds, advancedEnabled, {
    preferredCategory,
    coupleOnly: state.coupleTaskMode,
    contentMode: state.contentMode,
  });
}

export function simulateComplete(state: GameState): GameState {
  if (!state.currentTask) return state;

  const newScores = [...state.scores] as [number, number];
  let cooperativeScore = state.cooperativeScore;
  if (state.scoringMode === 'competitive') {
    newScores[state.currentPlayerIndex] += 1;
  } else if (state.scoringMode === 'cooperative') {
    cooperativeScore += 1;
  }

  const streak = state.stats.streak + 1;
  const stats = {
    ...state.stats,
    totalCompleted: state.stats.totalCompleted + 1,
    streak,
    maxStreak: Math.max(state.stats.maxStreak, streak),
    roundNumber: state.stats.roundNumber + 1,
  };

  const next: GameState = {
    ...state,
    scores: newScores,
    cooperativeScore,
    stats,
    usedTaskIds: [...state.usedTaskIds, state.currentTask.id],
    currentTask: null,
    currentPlayerIndex: advanceTurn(state),
  };

  const { end, winner } = checkEndConditions(next, next.scores, next.cooperativeScore, next.stats);
  if (!end) return next;

  return buildFinishedGame(
    next,
    winner ??
      (next.scoringMode === 'cooperative'
        ? 'tie'
        : next.scores[0] > next.scores[1]
          ? 0
          : next.scores[1] > next.scores[0]
            ? 1
            : 'tie'),
  );
}

export function simulateSkip(state: GameState): GameState {
  if (!state.currentTask) return state;

  const stats = {
    ...state.stats,
    totalSkipped: state.stats.totalSkipped + 1,
    streak: 0,
    roundNumber: state.stats.roundNumber + 1,
  };

  const next: GameState = {
    ...state,
    stats,
    usedTaskIds: [...state.usedTaskIds, state.currentTask.id],
    currentTask: null,
    currentPlayerIndex: advanceTurn(state),
  };

  const { end, winner } = checkEndConditions(next, next.scores, next.cooperativeScore, next.stats);
  if (!end) return next;

  return buildFinishedGame(
    next,
    winner ??
      (next.scoringMode === 'cooperative'
        ? 'tie'
        : next.scores[0] > next.scores[1]
          ? 0
          : next.scores[1] > next.scores[0]
            ? 1
            : 'tie'),
  );
}

export function simulateStartGame(state: GameState): GameState {
  const timeLimit = getTimeLimitForFormat(state.gameFormat);
  return {
    ...state,
    screen: 'game',
    currentPlayerIndex: 0,
    scores: [0, 0],
    cooperativeScore: 0,
    usedTaskIds: [],
    currentTask: null,
    isSpinning: false,
    wheelLanded: false,
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
    sessionNewAchievements: [],
    timeLimitSeconds: timeLimit,
    timeRemainingSeconds: timeLimit,
    timeDeadlineMs: timeLimit != null ? Date.now() + timeLimit * 1000 : null,
    finishEventId: null,
    roundTarget:
      state.gameFormat === 'rounds'
        ? state.roundTarget
        : getDefaultRoundTarget(state.gameFormat, state.roundTarget),
  };
}

export function getEffectiveTargetFor(state: GameState): number | null {
  return getEffectiveTarget(state);
}

export const ALL_MODES: GameMode[] = ['funny', 'romantic', 'challenge', 'calm', 'mixed', 'spicy'];
export const ALL_LEVELS: TaskLevel[] = ['easy', 'normal', 'advanced'];
export const ALL_CONTENT_MODES: ContentMode[] = ['tasks', 'questions', 'mixed'];
