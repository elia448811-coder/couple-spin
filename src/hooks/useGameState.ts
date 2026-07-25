import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type {
  AppSettings,
  ContentMode,
  CoupleTask,
  GameFormat,
  GameMode,
  GameState,
  ScoringMode,
  Screen,
  TargetScore,
  TaskLevel,
} from '../types/game';
import { getEffectiveTarget, getSpinnerSegments } from '../types/game';
import { GAME_PRESETS, type GameEffect, type GamePreset } from '../utils/gameEvents';
import { emptyStats, gameReducer } from '../utils/gameReducer';
import { finishPayload } from '../utils/gameFinish';
import { pickEasierTask, pickHarderTask } from '../utils/taskSelection';
import { pickTaskWithFallback, spinPickOptions } from '../utils/pickTaskWithFallback';
import { clearSnapshot, loadSnapshot, saveSnapshot } from '../utils/gameSnapshot';
import { hasUndo, popUndo, pushUndo } from '../utils/undoStack';
import { isGuestMode, isTaskHidden, pruneHistory } from '../utils/privacy';
import {
  loadHistory,
  loadRecords,
  loadSettings,
  loadUnlockedAchievements,
  saveHistoryEntry,
  saveSettings,
  saveUnlockedAchievements,
  updateRecords,
} from '../utils/storage';
import { sounds, startBackgroundMusic, stopBackgroundMusic } from '../utils/sound';
import { useApplyTheme } from './useSpinWheel';

const processedFinishIds = new Set<string>();

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createInitialGameState(settings: AppSettings): GameState {
  return {
    screen: 'welcome',
    mode: settings.lastSelectedMode,
    level: settings.lastSelectedLevel,
    gameFormat: settings.lastGameFormat,
    scoringMode: settings.lastScoringMode,
    coupleTaskMode: settings.coupleTaskMode,
    contentMode: settings.lastContentMode,
    eveningName: '',
    playerOneName: isGuestMode() ? 'שחקן 1' : settings.playerOneName,
    playerTwoName: isGuestMode() ? 'שחקן 2' : settings.playerTwoName,
    currentPlayerIndex: 0,
    scores: [0, 0],
    cooperativeScore: 0,
    usedTaskIds: [],
    currentTask: null,
    isSpinning: false,
    wheelLanded: false,
    targetScore: settings.targetScore,
    customTargetScore: settings.customTargetScore,
    roundTarget: settings.roundCount,
    timeLimitSeconds: null,
    timeRemainingSeconds: null,
    timeDeadlineMs: null,
    finishEventId: null,
    stats: emptyStats(),
    winner: null,
    spinCategory: null,
    unlockedAchievements: loadUnlockedAchievements(),
    sessionNewAchievements: [],
    paused: false,
    uiBlocked: false,
    poolEmpty: false,
    lastAction: null,
  };
}

function runEffects(
  effects: GameEffect[],
  ctx: {
    soundEnabled: boolean;
    soundPack: AppSettings['soundPack'];
    vibrationEnabled: boolean;
    game: GameState;
    setSettings: Dispatch<SetStateAction<AppSettings>>;
  },
) {
  for (const effect of effects) {
    if (effect.type === 'sound' && ctx.soundEnabled) {
      if (effect.name === 'success') sounds.success(ctx.soundPack);
      else if (effect.name === 'skip') sounds.skip(ctx.soundPack);
      else if (effect.name === 'start') sounds.start(ctx.soundPack);
      else if (effect.name === 'spin') sounds.spin(ctx.soundPack);
    }
    if (effect.type === 'vibrate' && ctx.vibrationEnabled && navigator.vibrate) {
      navigator.vibrate(effect.pattern);
    }
    if (effect.type === 'persist_settings') {
      ctx.setSettings((prev) => {
        const next = { ...prev, ...effect.patch } as AppSettings;
        if (!isGuestMode()) saveSettings(next);
        return next;
      });
    }
    if (effect.type === 'persist_snapshot') saveSnapshot(ctx.game);
    if (effect.type === 'clear_snapshot') clearSnapshot();
    if (effect.type === 'persist_finish') {
      if (processedFinishIds.has(effect.finishEventId)) continue;
      processedFinishIds.add(effect.finishEventId);
      if (isGuestMode()) continue;
      const payload = finishPayload({ ...ctx.game, finishEventId: effect.finishEventId });
      if (payload.achievements.length) saveUnlockedAchievements(payload.achievements);
      saveHistoryEntry(payload.history);
      const pruned = pruneHistory(loadHistory(), 90);
      try {
        localStorage.setItem('couple-spin-history', JSON.stringify(pruned));
      } catch {
        /* ignore */
      }
      const records = loadRecords();
      updateRecords({
        totalGames: records.totalGames + 1,
        mostCompleted: Math.max(payload.stats.totalCompleted, records.mostCompleted),
        longestStreak: Math.max(payload.stats.maxStreak, records.longestStreak),
        totalTasks: records.totalTasks + payload.stats.totalCompleted,
      });
    }
  }
}

export function useGameState() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [game, setGame] = useState<GameState>(() => {
    const snap = loadSnapshot();
    return snap ?? createInitialGameState(loadSettings());
  });
  const [resumeAvailable] = useState(() => Boolean(loadSnapshot()));
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gameRef = useRef(game);
  gameRef.current = game;

  useApplyTheme(settings);

  const dispatch = useCallback(
    (event: Parameters<typeof gameReducer>[1]) => {
      setGame((prev) => {
        if (event.type === 'TASK_COMPLETED' || event.type === 'TASK_SKIPPED' || event.type === 'START_SPIN') {
          pushUndo(prev);
        }
        const { state, effects } = gameReducer(prev, event);
        queueMicrotask(() =>
          runEffects(effects, {
            soundEnabled: settings.soundEnabled,
            soundPack: settings.soundPack,
            vibrationEnabled: settings.vibrationEnabled,
            game: state,
            setSettings,
          }),
        );
        return state;
      });
    },
    [settings.soundEnabled, settings.soundPack, settings.vibrationEnabled],
  );

  useEffect(() => {
    if (settings.backgroundMusicEnabled) startBackgroundMusic(true);
    else stopBackgroundMusic();
    return () => stopBackgroundMusic();
  }, [settings.backgroundMusicEnabled]);

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (game.screen !== 'game' || game.timeDeadlineMs == null || game.currentTask || game.paused) return;

    const tick = () => {
      setGame((prev) => {
        if (prev.currentTask || prev.paused || prev.timeDeadlineMs == null || prev.screen === 'end') return prev;
        const remaining = Math.max(0, Math.ceil((prev.timeDeadlineMs - Date.now()) / 1000));
        if (remaining <= 0) {
          const { state, effects } = gameReducer(prev, { type: 'TIMER_EXPIRED', finishEventId: newId() });
          queueMicrotask(() =>
            runEffects(effects, {
              soundEnabled: settings.soundEnabled,
              soundPack: settings.soundPack,
              vibrationEnabled: settings.vibrationEnabled,
              game: state,
              setSettings,
            }),
          );
          return state;
        }
        if (remaining === prev.timeRemainingSeconds) return prev;
        return { ...prev, timeRemainingSeconds: remaining };
      });
    };

    tick();
    timerRef.current = setInterval(tick, 250);
    const onVis = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [game.screen, game.timeDeadlineMs, game.currentTask, game.paused, settings.soundEnabled, settings.soundPack, settings.vibrationEnabled]);

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      if (!isGuestMode()) saveSettings(next);
      return next;
    });
    if (partial.playerOneName !== undefined || partial.playerTwoName !== undefined) {
      dispatch({
        type: 'SET_PLAYER_NAMES',
        one: partial.playerOneName ?? gameRef.current.playerOneName,
        two: partial.playerTwoName ?? gameRef.current.playerTwoName,
      });
    }
  }, [dispatch]);

  const pickForSegment = useCallback(
    (prev: GameState, segmentLabel: string | null) => {
      const segment = getSpinnerSegments(prev.mode, prev.contentMode).find((s) => s.label === segmentLabel);
      const opts = {
        ...(segment ? spinPickOptions(segment) : { preferredCategory: null, preferredQuestionGroup: null }),
        coupleOnly: prev.coupleTaskMode,
        contentMode: prev.contentMode,
      };
      let task = pickTaskWithFallback(prev.mode, prev.level, prev.usedTaskIds, settings.advancedTasksEnabled, opts);
      let guard = 0;
      while (task && isTaskHidden(task.id) && guard < 20) {
        task = pickTaskWithFallback(
          prev.mode,
          prev.level,
          [...prev.usedTaskIds, task.id],
          settings.advancedTasksEnabled,
          opts,
        );
        guard += 1;
      }
      return task;
    },
    [settings.advancedTasksEnabled],
  );

  return {
    settings,
    game,
    resumeAvailable,
    presets: GAME_PRESETS,
    currentPlayerName: game.currentPlayerIndex === 0 ? game.playerOneName : game.playerTwoName,
    effectiveTarget: getEffectiveTarget(game),
    updateSettings,
    navigate: (screen: Screen) => dispatch({ type: 'NAVIGATE', screen }),
    setMode: (mode: GameMode) => dispatch({ type: 'SET_MODE', mode }),
    setLevel: (level: TaskLevel) => dispatch({ type: 'SET_LEVEL', level }),
    setGameFormat: (format: GameFormat) => dispatch({ type: 'SET_FORMAT', format }),
    setScoringMode: (scoring: ScoringMode) => dispatch({ type: 'SET_SCORING', scoring }),
    setCoupleTaskMode: (enabled: boolean) => dispatch({ type: 'SET_COUPLE_MODE', enabled }),
    setContentMode: (contentMode: ContentMode) => dispatch({ type: 'SET_CONTENT_MODE', contentMode }),
    setPlayerNames: (one: string, two: string) => dispatch({ type: 'SET_PLAYER_NAMES', one, two }),
    setEveningName: (name: string) => dispatch({ type: 'SET_EVENING_NAME', name }),
    setTargetScore: (target: TargetScore) => dispatch({ type: 'SET_TARGET', target }),
    setCustomTargetScore: (value: number) => dispatch({ type: 'SET_CUSTOM_TARGET', value }),
    setRoundCount: (value: number) => dispatch({ type: 'SET_ROUND_COUNT', value }),
    applyPreset: (preset: GamePreset) => dispatch({ type: 'APPLY_PRESET', preset }),
    confirmMatureAge: () => updateSettings({ matureAgeConfirmed: true }),
    goToDiceRoll: () => dispatch({ type: 'GO_DICE' }),
    startGame: (firstPlayer: 0 | 1 = 0) =>
      dispatch({ type: 'START_GAME', firstPlayer, roundCount: settings.roundCount }),
    startSpin: () => dispatch({ type: 'START_SPIN' }),
    handleSpinEnd: (segmentIndex: number) => {
      const prev = gameRef.current;
      const segments = getSpinnerSegments(prev.mode, prev.contentMode);
      const segment = segments[segmentIndex];
      const task = pickForSegment(prev, segment?.label ?? null);
      if (!task) {
        dispatch({ type: 'SET_POOL_EMPTY', empty: true });
        return;
      }
      dispatch({ type: 'SPIN_LANDED', task, label: segment.label });
    },
    completeTask: () => dispatch({ type: 'TASK_COMPLETED', finishEventId: newId() }),
    skipTask: () => dispatch({ type: 'TASK_SKIPPED', finishEventId: newId() }),
    replaceTask: () => {
      const prev = gameRef.current;
      if (!prev.currentTask) return;
      const next = pickForSegment(prev, prev.spinCategory);
      if (!next) {
        dispatch({ type: 'SET_POOL_EMPTY', empty: true });
        return;
      }
      dispatch({ type: 'TASK_REPLACED', usedId: prev.currentTask.id, next });
    },
    taskTooEasy: () => {
      const prev = gameRef.current;
      if (!prev.currentTask) return;
      const used = [...prev.usedTaskIds, prev.currentTask.id];
      const segment = getSpinnerSegments(prev.mode, prev.contentMode).find((s) => s.label === prev.spinCategory);
      const spinOpts = segment
        ? spinPickOptions(segment)
        : { preferredCategory: null, preferredQuestionGroup: null };
      const task =
        pickEasierTask(prev.mode, prev.level, used, settings.advancedTasksEnabled, {
          ...spinOpts,
          coupleOnly: prev.coupleTaskMode,
          contentMode: prev.contentMode,
        }) ?? pickForSegment({ ...prev, usedTaskIds: used }, prev.spinCategory);
      if (!task) return;
      dispatch({ type: 'TASK_REPLACED', usedId: prev.currentTask.id, next: task });
    },
    taskTooHard: () => {
      const prev = gameRef.current;
      if (!prev.currentTask) return;
      const used = [...prev.usedTaskIds, prev.currentTask.id];
      const segment = getSpinnerSegments(prev.mode, prev.contentMode).find((s) => s.label === prev.spinCategory);
      const spinOpts = segment
        ? spinPickOptions(segment)
        : { preferredCategory: null, preferredQuestionGroup: null };
      const task =
        pickHarderTask(prev.mode, prev.level, used, settings.advancedTasksEnabled, {
          ...spinOpts,
          coupleOnly: prev.coupleTaskMode,
          contentMode: prev.contentMode,
        }) ?? pickForSegment({ ...prev, usedTaskIds: used }, prev.spinCategory);
      if (!task) return;
      dispatch({ type: 'TASK_REPLACED', usedId: prev.currentTask.id, next: task });
    },
    markFunniest: (task: CoupleTask) => dispatch({ type: 'MARK_FUNNIEST', task }),
    endGame: () =>
      dispatch({
        type: 'GAME_FINISHED',
        finishEventId: newId(),
        winner:
          game.scoringMode === 'cooperative'
            ? 'tie'
            : game.scores[0] > game.scores[1]
              ? 0
              : game.scores[1] > game.scores[0]
                ? 1
                : 'tie',
      }),
    pauseGame: () => dispatch({ type: 'PAUSE' }),
    resumeGame: () => dispatch({ type: 'RESUME' }),
    undoLast: () => {
      if (!hasUndo()) return;
      const prev = popUndo();
      if (prev) dispatch({ type: 'RESTORE_SNAPSHOT', snapshot: prev });
    },
    restoreSnapshot: () => {
      const snap = loadSnapshot();
      if (snap) dispatch({ type: 'RESTORE_SNAPSHOT', snapshot: snap });
    },
    newGame: () =>
      dispatch({
        type: 'NEW_GAME',
        settingsNames: {
          one: settings.playerOneName,
          two: settings.playerTwoName,
          contentMode: settings.lastContentMode,
        },
      }),
    playAgain: () => dispatch({ type: 'PLAY_AGAIN' }),
    resetScores: () => dispatch({ type: 'RESET_SCORES' }),
    toggleSound: () => updateSettings({ soundEnabled: !settings.soundEnabled }),
    buildVersion: import.meta.env.VITE_BUILD_VERSION || '1.2.0',
  };
}
