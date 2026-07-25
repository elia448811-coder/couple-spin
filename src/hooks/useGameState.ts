import { useCallback, useEffect, useRef, useState } from 'react';
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
import {
  getDefaultRoundTarget,
  getEffectiveTarget,
  getSpinnerSegments,
  getTimeLimitForFormat,
} from '../types/game';
import { checkEndConditions } from '../utils/gameEnd';
import { buildFinishedGame, finishPayload } from '../utils/gameFinish';
import { pickEasierTask, pickHarderTask } from '../utils/taskSelection';
import { pickTaskWithFallback, spinPickOptions } from '../utils/pickTaskWithFallback';
import {
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

/** Survives StrictMode remount — finish persistence runs once per event id */
const processedFinishIds = new Set<string>();

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
    playerOneName: settings.playerOneName,
    playerTwoName: settings.playerTwoName,
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
  };
}

function resolveScoringMode(format: GameFormat, mode: ScoringMode): ScoringMode {
  if (format === 'fun') return 'none';
  return mode;
}

export function useGameState() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [game, setGame] = useState<GameState>(() => createInitialGameState(loadSettings()));
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useApplyTheme(settings);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (settings.backgroundMusicEnabled) startBackgroundMusic(true);
    else stopBackgroundMusic();
    return () => stopBackgroundMusic();
  }, [settings.backgroundMusicEnabled]);

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      saveSettings(next);
      return next;
    });
    if (partial.playerOneName !== undefined || partial.playerTwoName !== undefined) {
      setGame((prev) => ({
        ...prev,
        ...(partial.playerOneName !== undefined && { playerOneName: partial.playerOneName }),
        ...(partial.playerTwoName !== undefined && { playerTwoName: partial.playerTwoName }),
      }));
    }
  }, []);

  const navigate = useCallback((screen: Screen) => {
    setGame((prev) => ({ ...prev, screen }));
  }, []);

  const setMode = useCallback(
    (mode: GameMode) => {
      setGame((prev) => ({
        ...prev,
        mode,
        ...(mode === 'spicy'
          ? {
              gameFormat: 'fun' as GameFormat,
              scoringMode: 'none' as ScoringMode,
              targetScore: 'free' as TargetScore,
            }
          : {}),
      }));
      updateSettings({ lastSelectedMode: mode });
    },
    [updateSettings],
  );

  const confirmMatureAge = useCallback(() => {
    updateSettings({ matureAgeConfirmed: true });
  }, [updateSettings]);

  const setLevel = useCallback(
    (level: TaskLevel) => {
      setGame((prev) => ({ ...prev, level }));
      updateSettings({ lastSelectedLevel: level });
    },
    [updateSettings],
  );

  const setGameFormat = useCallback(
    (gameFormat: GameFormat) => {
      const scoringMode = gameFormat === 'fun' ? 'none' : settings.lastScoringMode;
      setGame((prev) => ({
        ...prev,
        gameFormat,
        scoringMode: resolveScoringMode(gameFormat, scoringMode),
        roundTarget: getDefaultRoundTarget(gameFormat, settings.roundCount),
      }));
      updateSettings({ lastGameFormat: gameFormat });
    },
    [settings.lastScoringMode, settings.roundCount, updateSettings],
  );

  const setScoringMode = useCallback(
    (scoringMode: ScoringMode) => {
      setGame((prev) => ({ ...prev, scoringMode }));
      updateSettings({ lastScoringMode: scoringMode });
    },
    [updateSettings],
  );

  const setCoupleTaskMode = useCallback(
    (coupleTaskMode: boolean) => {
      setGame((prev) => ({ ...prev, coupleTaskMode }));
      updateSettings({ coupleTaskMode });
    },
    [updateSettings],
  );

  const setContentMode = useCallback(
    (contentMode: ContentMode) => {
      setGame((prev) => ({ ...prev, contentMode }));
      updateSettings({ lastContentMode: contentMode });
    },
    [updateSettings],
  );

  const setPlayerNames = useCallback(
    (playerOneName: string, playerTwoName: string) => {
      setGame((prev) => ({ ...prev, playerOneName, playerTwoName }));
      updateSettings({ playerOneName, playerTwoName });
    },
    [updateSettings],
  );

  const setEveningName = useCallback((eveningName: string) => {
    setGame((prev) => ({ ...prev, eveningName }));
  }, []);

  const setTargetScore = useCallback(
    (targetScore: TargetScore) => {
      setGame((prev) => ({ ...prev, targetScore }));
      updateSettings({ targetScore });
    },
    [updateSettings],
  );

  const setCustomTargetScore = useCallback(
    (customTargetScore: number) => {
      const val = Math.min(30, Math.max(3, customTargetScore));
      setGame((prev) => ({ ...prev, customTargetScore: val, targetScore: 'custom' }));
      updateSettings({ customTargetScore: val, targetScore: 'custom' });
    },
    [updateSettings],
  );

  const setRoundCount = useCallback(
    (roundCount: number) => {
      setGame((prev) => ({ ...prev, roundTarget: roundCount }));
      updateSettings({ roundCount });
    },
    [updateSettings],
  );

  const tryFinishRound = useCallback(
    (
      prev: GameState,
      patch: Partial<GameState> & { stats: GameState['stats'] },
    ): GameState => {
      const next = { ...prev, ...patch };
      const { end, winner } = checkEndConditions(next, next.scores, next.cooperativeScore, next.stats);
      if (!end) return next as GameState;

      const finalWinner: GameState['winner'] =
        winner ??
        (next.scoringMode === 'cooperative'
          ? 'tie'
          : next.scores[0] > next.scores[1]
            ? 0
            : next.scores[1] > next.scores[0]
              ? 1
              : 'tie');
      return buildFinishedGame(next as GameState, finalWinner);
    },
    [],
  );

  const goToDiceRoll = useCallback(() => {
    setGame((prev) => ({ ...prev, screen: 'dice-roll' }));
  }, []);

  const startGame = useCallback((firstPlayer: 0 | 1 = 0) => {
    setGame((prev) => {
      const timeLimit = getTimeLimitForFormat(prev.gameFormat);
      return {
        ...prev,
        screen: 'game',
        currentPlayerIndex: firstPlayer,
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
        timeLimitSeconds: timeLimit,
        timeRemainingSeconds: timeLimit,
        timeDeadlineMs: timeLimit != null ? Date.now() + timeLimit * 1000 : null,
        scoringMode: resolveScoringMode(prev.gameFormat, prev.scoringMode),
        roundTarget:
          prev.gameFormat === 'rounds'
            ? settings.roundCount
            : getDefaultRoundTarget(prev.gameFormat, settings.roundCount),
      };
    });
    if (settings.soundEnabled) sounds.start(settings.soundPack);
  }, [settings.roundCount, settings.soundEnabled, settings.soundPack]);

  /** Persist finish side-effects once (idempotent) */
  useEffect(() => {
    if (game.screen !== 'end' || !game.finishEventId) return;
    if (processedFinishIds.has(game.finishEventId)) return;
    processedFinishIds.add(game.finishEventId);

    const payload = finishPayload(game);
    if (payload.achievements.length) saveUnlockedAchievements(payload.achievements);
    saveHistoryEntry(payload.history);
    const records = loadRecords();
    updateRecords({
      totalGames: records.totalGames + 1,
      mostCompleted: Math.max(payload.stats.totalCompleted, records.mostCompleted),
      longestStreak: Math.max(payload.stats.maxStreak, records.longestStreak),
      totalTasks: records.totalTasks + payload.stats.totalCompleted,
    });
    if (settings.soundEnabled) sounds.success(settings.soundPack);
  }, [game, settings.soundEnabled, settings.soundPack]);

  useEffect(() => {
    clearTimer();
    // שעון נעצר בזמן שמשימה פתוחה; remaining מחושב מ־deadline אמיתי
    if (game.screen !== 'game' || game.timeDeadlineMs === null || game.currentTask) return;

    const tick = () => {
      setGame((prev) => {
        if (prev.currentTask || prev.timeDeadlineMs === null) return prev;
        const remaining = Math.max(0, Math.ceil((prev.timeDeadlineMs - Date.now()) / 1000));
        if (remaining <= 0) {
          clearTimer();
          const w: GameState['winner'] =
            prev.scoringMode === 'cooperative'
              ? 'tie'
              : prev.scores[0] > prev.scores[1]
                ? 0
                : prev.scores[1] > prev.scores[0]
                  ? 1
                  : 'tie';
          return buildFinishedGame(prev, w);
        }
        if (remaining === prev.timeRemainingSeconds) return prev;
        return { ...prev, timeRemainingSeconds: remaining };
      });
    };

    tick();
    timerRef.current = setInterval(tick, 250);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearTimer();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [game.screen, game.timeDeadlineMs, game.currentTask, clearTimer]);

  const handleSpinEnd = useCallback(
    (segmentIndex: number) => {
      setGame((prev) => {
        const segments = getSpinnerSegments(prev.mode, prev.contentMode);
        const segment = segments[segmentIndex];
        const task = pickTaskWithFallback(
          prev.mode,
          prev.level,
          prev.usedTaskIds,
          settings.advancedTasksEnabled,
          {
            ...spinPickOptions(segment),
            coupleOnly: prev.coupleTaskMode,
            contentMode: prev.contentMode,
          },
        );
        return {
          ...prev,
          isSpinning: false,
          wheelLanded: true,
          currentTask: task,
          spinCategory: segment.label,
        };
      });

      if (settings.vibrationEnabled && navigator.vibrate) navigator.vibrate([30, 20, 50]);
    },
    [settings.advancedTasksEnabled, settings.vibrationEnabled],
  );

  const startSpin = useCallback(() => {
    setGame((prev) => ({ ...prev, isSpinning: true, currentTask: null, wheelLanded: false }));
  }, []);

  const advanceTurn = (prev: GameState): 0 | 1 =>
    prev.coupleTaskMode || prev.currentTask?.isCoupleTask || prev.currentTask?.kind === 'question'
      ? prev.currentPlayerIndex
      : prev.currentPlayerIndex === 0
        ? 1
        : 0;

  const completeTask = useCallback(() => {
    let completed = false;
    let finished = false;
    setGame((prev) => {
      if (!prev.currentTask) return prev;
      completed = true;

      const newScores = [...prev.scores] as [number, number];
      let cooperativeScore = prev.cooperativeScore;
      if (prev.scoringMode === 'competitive') {
        newScores[prev.currentPlayerIndex] += 1;
      } else if (prev.scoringMode === 'cooperative') {
        cooperativeScore += 1;
      }

      const streak = prev.stats.streak + 1;
      const stats = {
        ...prev.stats,
        totalCompleted: prev.stats.totalCompleted + 1,
        streak,
        maxStreak: Math.max(prev.stats.maxStreak, streak),
        roundNumber: prev.stats.roundNumber + 1,
      };

      const usedTaskIds = [...prev.usedTaskIds, prev.currentTask.id];
      const next = tryFinishRound(prev, {
        scores: newScores,
        cooperativeScore,
        stats,
        usedTaskIds,
        currentTask: null,
        currentPlayerIndex: advanceTurn(prev),
      });
      finished = next.screen === 'end';
      return next;
    });
    if (completed && !finished && settings.soundEnabled) {
      sounds.success(settings.soundPack);
    }
  }, [tryFinishRound, settings.soundEnabled, settings.soundPack]);

  const skipTask = useCallback(() => {
    if (settings.soundEnabled) sounds.skip(settings.soundPack);
    setGame((prev) => {
      if (!prev.currentTask) return prev;
      const usedTaskIds = [...prev.usedTaskIds, prev.currentTask.id];
      const stats = {
        ...prev.stats,
        totalSkipped: prev.stats.totalSkipped + 1,
        streak: 0,
        roundNumber: prev.stats.roundNumber + 1,
      };

      return tryFinishRound(prev, {
        usedTaskIds,
        currentTask: null,
        stats,
        currentPlayerIndex: advanceTurn(prev),
      });
    });
  }, [settings.soundEnabled, settings.soundPack, tryFinishRound]);

  const replaceTask = useCallback(() => {
    setGame((prev) => {
      if (!prev.currentTask) return prev;
      const usedTaskIds = [...prev.usedTaskIds, prev.currentTask.id];
      const segment = getSpinnerSegments(prev.mode, prev.contentMode).find(
        (s) => s.label === prev.spinCategory,
      );
      const task = pickTaskWithFallback(prev.mode, prev.level, usedTaskIds, settings.advancedTasksEnabled, {
        ...(segment ? spinPickOptions(segment) : { preferredCategory: null, preferredQuestionGroup: null }),
        coupleOnly: prev.coupleTaskMode,
        contentMode: prev.contentMode,
      });
      return { ...prev, usedTaskIds, currentTask: task };
    });
  }, [settings.advancedTasksEnabled]);

  const taskTooEasy = useCallback(() => {
    setGame((prev) => {
      if (!prev.currentTask) return prev;
      const usedTaskIds = [...prev.usedTaskIds, prev.currentTask.id];
      const segment = getSpinnerSegments(prev.mode, prev.contentMode).find(
        (s) => s.label === prev.spinCategory,
      );
      const spinOpts = segment
        ? spinPickOptions(segment)
        : { preferredCategory: null, preferredQuestionGroup: null };
      const task =
        pickEasierTask(prev.mode, prev.level, usedTaskIds, settings.advancedTasksEnabled, {
          ...spinOpts,
          coupleOnly: prev.coupleTaskMode,
          contentMode: prev.contentMode,
        }) ??
        pickTaskWithFallback(prev.mode, prev.level, usedTaskIds, settings.advancedTasksEnabled, {
          ...spinOpts,
          coupleOnly: prev.coupleTaskMode,
          contentMode: prev.contentMode,
        });
      return { ...prev, usedTaskIds, currentTask: task };
    });
  }, [settings.advancedTasksEnabled]);

  const taskTooHard = useCallback(() => {
    setGame((prev) => {
      if (!prev.currentTask) return prev;
      const usedTaskIds = [...prev.usedTaskIds, prev.currentTask.id];
      const segment = getSpinnerSegments(prev.mode, prev.contentMode).find(
        (s) => s.label === prev.spinCategory,
      );
      const spinOpts = segment
        ? spinPickOptions(segment)
        : { preferredCategory: null, preferredQuestionGroup: null };
      const harder = pickHarderTask(prev.mode, prev.level, usedTaskIds, settings.advancedTasksEnabled, {
        ...spinOpts,
        coupleOnly: prev.coupleTaskMode,
        contentMode: prev.contentMode,
      });
      const task =
        harder ??
        pickTaskWithFallback(prev.mode, prev.level, usedTaskIds, settings.advancedTasksEnabled, {
          ...spinOpts,
          coupleOnly: prev.coupleTaskMode,
          contentMode: prev.contentMode,
        });
      return { ...prev, usedTaskIds, currentTask: task };
    });
  }, [settings.advancedTasksEnabled]);

  const markFunniest = useCallback((task: CoupleTask) => {
    setGame((prev) => ({
      ...prev,
      stats: {
        ...prev.stats,
        funniestTaskId: task.id,
        funniestTaskTitle: task.description,
      },
    }));
  }, []);

  const endGame = useCallback(() => {
    setGame((prev) =>
      buildFinishedGame(
        prev,
        prev.scoringMode === 'cooperative'
          ? 'tie'
          : prev.scores[0] > prev.scores[1]
            ? 0
            : prev.scores[1] > prev.scores[0]
              ? 1
              : 'tie',
      ),
    );
  }, []);

  const newGame = useCallback(() => {
    clearTimer();
    setGame((prev) => ({
      ...createInitialGameState(settings),
      mode: prev.mode,
      level: prev.level,
      gameFormat: prev.gameFormat,
      scoringMode: prev.scoringMode,
      coupleTaskMode: prev.coupleTaskMode,
      contentMode: settings.lastContentMode,
      targetScore: prev.targetScore,
      customTargetScore: prev.customTargetScore,
      screen: 'welcome',
      unlockedAchievements: loadUnlockedAchievements(),
    }));
  }, [clearTimer, settings]);

  const playAgain = useCallback(() => {
    clearTimer();
    setGame((prev) => ({
      ...prev,
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
    }));
  }, [clearTimer]);

  const resetScores = useCallback(() => {
    setGame((prev) => ({
      ...prev,
      scores: [0, 0],
      cooperativeScore: 0,
      stats: emptyStats(),
      currentPlayerIndex: 0,
      usedTaskIds: [],
      currentTask: null,
      winner: null,
    }));
  }, []);

  const toggleSound = useCallback(() => {
    updateSettings({ soundEnabled: !settings.soundEnabled });
  }, [settings.soundEnabled, updateSettings]);

  const currentPlayerName =
    game.currentPlayerIndex === 0 ? game.playerOneName : game.playerTwoName;

  const effectiveTarget = getEffectiveTarget(game);

  return {
    settings,
    game,
    currentPlayerName,
    effectiveTarget,
    updateSettings,
    navigate,
    setMode,
    setLevel,
    setGameFormat,
    setScoringMode,
    setCoupleTaskMode,
    setContentMode,
    setPlayerNames,
    setEveningName,
    setTargetScore,
    setCustomTargetScore,
    setRoundCount,
    confirmMatureAge,
    goToDiceRoll,
    startGame,
    startSpin,
    handleSpinEnd,
    completeTask,
    skipTask,
    replaceTask,
    taskTooEasy,
    taskTooHard,
    markFunniest,
    endGame,
    newGame,
    playAgain,
    resetScores,
    toggleSound,
  };
}
