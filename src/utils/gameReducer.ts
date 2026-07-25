import type { GameFormat, GameState, ScoringMode, TargetScore } from '../types/game';
import { getDefaultRoundTarget, getTimeLimitForFormat } from '../types/game';
import { checkEndConditions } from './gameEnd';
import { buildFinishedGame } from './gameFinish';
import type { GameEffect, GameEvent } from './gameEvents';
import { isTaskHidden } from './privacy';

function emptyStats(): GameState['stats'] {
  return {
    totalCompleted: 0,
    totalSkipped: 0,
    streak: 0,
    maxStreak: 0,
    funniestTaskId: null,
    funniestTaskTitle: null,
    startTime: Date.now(),
    roundNumber: 0,
  };
}

function resolveScoringMode(format: GameFormat, mode: ScoringMode): ScoringMode {
  if (format === 'fun') return 'none';
  return mode;
}

function advanceTurn(prev: GameState): 0 | 1 {
  return prev.coupleTaskMode || prev.currentTask?.isCoupleTask || prev.currentTask?.kind === 'question'
    ? prev.currentPlayerIndex
    : prev.currentPlayerIndex === 0
      ? 1
      : 0;
}

function maybeFinish(
  prev: GameState,
  patch: Partial<GameState> & { stats: GameState['stats'] },
  finishEventId: string,
): { state: GameState; effects: GameEffect[] } {
  const next = { ...prev, ...patch, uiBlocked: false };
  const { end, winner } = checkEndConditions(next, next.scores, next.cooperativeScore, next.stats);
  if (!end) {
    return { state: next as GameState, effects: [{ type: 'persist_snapshot' }] };
  }
  const finalWinner =
    winner ??
    (next.scoringMode === 'cooperative'
      ? 'tie'
      : next.scores[0] > next.scores[1]
        ? 0
        : next.scores[1] > next.scores[0]
          ? 1
          : 'tie');
  const finished = {
    ...buildFinishedGame(next as GameState, finalWinner),
    finishEventId,
  };
  return {
    state: finished,
    effects: [
      { type: 'persist_finish', finishEventId },
      { type: 'clear_snapshot' },
    ],
  };
}

export type ReduceResult = { state: GameState; effects: GameEffect[] };

export function gameReducer(state: GameState, event: GameEvent): ReduceResult {
  switch (event.type) {
    case 'NAVIGATE':
      return { state: { ...state, screen: event.screen, uiBlocked: false }, effects: [] };

    case 'SET_MODE':
      return {
        state: {
          ...state,
          mode: event.mode,
          ...(event.mode === 'spicy'
            ? { gameFormat: 'fun' as GameFormat, scoringMode: 'none' as ScoringMode, targetScore: 'free' as TargetScore }
            : {}),
        },
        effects: [{ type: 'persist_settings', patch: { lastSelectedMode: event.mode } }],
      };

    case 'SET_LEVEL':
      return {
        state: { ...state, level: event.level },
        effects: [{ type: 'persist_settings', patch: { lastSelectedLevel: event.level } }],
      };

    case 'SET_FORMAT':
      return {
        state: {
          ...state,
          gameFormat: event.format,
          scoringMode: resolveScoringMode(event.format, state.scoringMode),
        },
        effects: [{ type: 'persist_settings', patch: { lastGameFormat: event.format } }],
      };

    case 'SET_SCORING':
      return {
        state: { ...state, scoringMode: event.scoring },
        effects: [{ type: 'persist_settings', patch: { lastScoringMode: event.scoring } }],
      };

    case 'SET_COUPLE_MODE':
      return {
        state: { ...state, coupleTaskMode: event.enabled },
        effects: [{ type: 'persist_settings', patch: { coupleTaskMode: event.enabled } }],
      };

    case 'SET_CONTENT_MODE':
      return {
        state: { ...state, contentMode: event.contentMode },
        effects: [{ type: 'persist_settings', patch: { lastContentMode: event.contentMode } }],
      };

    case 'SET_PLAYER_NAMES':
      return {
        state: { ...state, playerOneName: event.one, playerTwoName: event.two },
        effects: [{ type: 'persist_settings', patch: { playerOneName: event.one, playerTwoName: event.two } }],
      };

    case 'SET_EVENING_NAME':
      return { state: { ...state, eveningName: event.name }, effects: [] };

    case 'SET_TARGET':
      return {
        state: { ...state, targetScore: event.target },
        effects: [{ type: 'persist_settings', patch: { targetScore: event.target } }],
      };

    case 'SET_CUSTOM_TARGET': {
      const val = Math.min(30, Math.max(3, event.value));
      return {
        state: { ...state, customTargetScore: val, targetScore: 'custom' },
        effects: [{ type: 'persist_settings', patch: { customTargetScore: val, targetScore: 'custom' } }],
      };
    }

    case 'SET_ROUND_COUNT':
      return {
        state: { ...state, roundTarget: event.value },
        effects: [{ type: 'persist_settings', patch: { roundCount: event.value } }],
      };

    case 'APPLY_PRESET': {
      const p = event.preset;
      return {
        state: {
          ...state,
          mode: p.mode,
          contentMode: p.contentMode,
          gameFormat: p.gameFormat,
          level: p.level,
          scoringMode: p.scoringMode,
          targetScore: p.targetScore,
        },
        effects: [
          {
            type: 'persist_settings',
            patch: {
              lastSelectedMode: p.mode,
              lastContentMode: p.contentMode,
              lastGameFormat: p.gameFormat,
              lastSelectedLevel: p.level,
              lastScoringMode: p.scoringMode,
              targetScore: p.targetScore,
            },
          },
        ],
      };
    }

    case 'GO_DICE':
      return { state: { ...state, screen: 'dice-roll' }, effects: [] };

    case 'START_GAME': {
      const timeLimit = getTimeLimitForFormat(state.gameFormat);
      return {
        state: {
          ...state,
          screen: 'game',
          paused: false,
          uiBlocked: false,
          poolEmpty: false,
          currentPlayerIndex: event.firstPlayer,
          scores: [0, 0],
          cooperativeScore: 0,
          usedTaskIds: [],
          currentTask: null,
          isSpinning: false,
          wheelLanded: false,
          stats: emptyStats(),
          winner: null,
          spinCategory: null,
          sessionNewAchievements: [],
          finishEventId: null,
          lastAction: null,
          timeLimitSeconds: timeLimit,
          timeRemainingSeconds: timeLimit,
          timeDeadlineMs: timeLimit != null ? Date.now() + timeLimit * 1000 : null,
          scoringMode: resolveScoringMode(state.gameFormat, state.scoringMode),
          roundTarget:
            state.gameFormat === 'rounds'
              ? event.roundCount
              : getDefaultRoundTarget(state.gameFormat, event.roundCount),
        },
        effects: [{ type: 'sound', name: 'start' }, { type: 'clear_snapshot' }],
      };
    }

    case 'START_SPIN':
      if (state.uiBlocked || state.paused || state.isSpinning || state.currentTask) {
        return { state, effects: [] };
      }
      return {
        state: { ...state, isSpinning: true, currentTask: null, wheelLanded: false, uiBlocked: true, poolEmpty: false },
        effects: [{ type: 'sound', name: 'spin' }],
      };

    case 'SPIN_LANDED': {
      if (isTaskHidden(event.task.id)) {
        return { state: { ...state, isSpinning: false, wheelLanded: true, uiBlocked: false, poolEmpty: true }, effects: [] };
      }
      return {
        state: {
          ...state,
          isSpinning: false,
          wheelLanded: true,
          currentTask: event.task,
          spinCategory: event.label,
          uiBlocked: false,
          poolEmpty: false,
        },
        effects: [{ type: 'vibrate', pattern: [30, 20, 50] }, { type: 'persist_snapshot' }],
      };
    }

    case 'TASK_COMPLETED': {
      if (!state.currentTask || state.uiBlocked || state.screen === 'end') return { state, effects: [] };
      const newScores = [...state.scores] as [number, number];
      let cooperativeScore = state.cooperativeScore;
      if (state.scoringMode === 'competitive') newScores[state.currentPlayerIndex] += 1;
      else if (state.scoringMode === 'cooperative') cooperativeScore += 1;
      const streak = state.stats.streak + 1;
      const stats = {
        ...state.stats,
        totalCompleted: state.stats.totalCompleted + 1,
        streak,
        maxStreak: Math.max(state.stats.maxStreak, streak),
        roundNumber: state.stats.roundNumber + 1,
        tasksPresented: (state.stats.tasksPresented ?? state.stats.roundNumber) + 1,
      };
      const result = maybeFinish(
        state,
        {
          scores: newScores,
          cooperativeScore,
          stats,
          usedTaskIds: [...state.usedTaskIds, state.currentTask.id],
          currentTask: null,
          currentPlayerIndex: advanceTurn(state),
          lastAction: 'complete',
        },
        event.finishEventId,
      );
      if (result.state.screen !== 'end') {
        result.effects.unshift({ type: 'sound', name: 'success' });
      }
      return result;
    }

    case 'TASK_SKIPPED': {
      if (!state.currentTask || state.screen === 'end') return { state, effects: [] };
      const stats = {
        ...state.stats,
        totalSkipped: state.stats.totalSkipped + 1,
        streak: 0,
        roundNumber: state.stats.roundNumber + 1,
        tasksPresented: (state.stats.tasksPresented ?? state.stats.roundNumber) + 1,
      };
      const result = maybeFinish(
        state,
        {
          usedTaskIds: [...state.usedTaskIds, state.currentTask.id],
          currentTask: null,
          stats,
          currentPlayerIndex: advanceTurn(state),
          lastAction: 'skip',
        },
        event.finishEventId,
      );
      result.effects.unshift({ type: 'sound', name: 'skip' });
      return result;
    }

    case 'TASK_REPLACED':
      return {
        state: {
          ...state,
          usedTaskIds: [...state.usedTaskIds, event.usedId],
          currentTask: event.next,
          lastAction: 'replace',
        },
        effects: [{ type: 'persist_snapshot' }],
      };

    case 'MARK_FUNNIEST':
      return {
        state: {
          ...state,
          stats: {
            ...state.stats,
            funniestTaskId: event.task.id,
            funniestTaskTitle: event.task.description,
          },
        },
        effects: [],
      };

    case 'TIMER_EXPIRED':
    case 'GAME_FINISHED': {
      if (state.screen === 'end' || state.finishEventId) return { state, effects: [] };
      const winner =
        event.type === 'GAME_FINISHED'
          ? event.winner
          : state.scoringMode === 'cooperative'
            ? 'tie'
            : state.scores[0] > state.scores[1]
              ? 0
              : state.scores[1] > state.scores[0]
                ? 1
                : 'tie';
      const finished = { ...buildFinishedGame(state, winner), finishEventId: event.finishEventId };
      return {
        state: finished,
        effects: [
          { type: 'persist_finish', finishEventId: event.finishEventId },
          { type: 'clear_snapshot' },
        ],
      };
    }

    case 'PAUSE':
      if (state.screen !== 'game') return { state, effects: [] };
      return { state: { ...state, paused: true }, effects: [{ type: 'persist_snapshot' }] };

    case 'RESUME':
      return { state: { ...state, paused: false }, effects: [] };

    case 'UNDO_LAST':
      return { state, effects: [] }; // handled in hook via undo stack

    case 'RESTORE_SNAPSHOT':
      return { state: { ...event.snapshot, paused: false, uiBlocked: false }, effects: [] };

    case 'NEW_GAME':
      return {
        state: {
          ...state,
          screen: 'welcome',
          playerOneName: event.settingsNames.one,
          playerTwoName: event.settingsNames.two,
          contentMode: event.settingsNames.contentMode,
          scores: [0, 0],
          cooperativeScore: 0,
          usedTaskIds: [],
          currentTask: null,
          isSpinning: false,
          wheelLanded: false,
          stats: emptyStats(),
          winner: null,
          finishEventId: null,
          timeDeadlineMs: null,
          timeRemainingSeconds: null,
          timeLimitSeconds: null,
          paused: false,
          uiBlocked: false,
          poolEmpty: false,
          lastAction: null,
          sessionNewAchievements: [],
        },
        effects: [{ type: 'clear_snapshot' }],
      };

    case 'PLAY_AGAIN':
      return {
        state: {
          ...state,
          screen: 'dice-roll',
          scores: [0, 0],
          cooperativeScore: 0,
          usedTaskIds: [],
          currentTask: null,
          isSpinning: false,
          wheelLanded: false,
          stats: emptyStats(),
          winner: null,
          spinCategory: null,
          sessionNewAchievements: [],
          finishEventId: null,
          timeLimitSeconds: null,
          timeRemainingSeconds: null,
          timeDeadlineMs: null,
          paused: false,
          uiBlocked: false,
          poolEmpty: false,
          lastAction: null,
        },
        effects: [{ type: 'clear_snapshot' }],
      };

    case 'RESET_SCORES':
      return {
        state: {
          ...state,
          scores: [0, 0],
          cooperativeScore: 0,
          stats: emptyStats(),
          currentPlayerIndex: 0,
          usedTaskIds: [],
          currentTask: null,
          winner: null,
        },
        effects: [],
      };

    case 'SET_TIMER_REMAINING':
      return { state: { ...state, timeRemainingSeconds: event.seconds }, effects: [] };

    case 'BLOCK_UI':
      return { state: { ...state, uiBlocked: event.blocked }, effects: [] };

    case 'SET_POOL_EMPTY':
      return { state: { ...state, poolEmpty: event.empty, uiBlocked: false, isSpinning: false }, effects: [] };

    default:
      return { state, effects: [] };
  }
}

export { emptyStats, resolveScoringMode };
