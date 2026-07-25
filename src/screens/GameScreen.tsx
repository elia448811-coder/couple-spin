import { useCallback, useEffect, useMemo, useState } from 'react';
import { GameHeader } from '../components/GameHeader';
import { PauseModal } from '../components/PauseModal';
import { ProgressBar } from '../components/ProgressBar';
import { SpinnerWheel } from '../components/SpinnerWheel';
import { TaskModal } from '../components/TaskModal';
import { useSpinWheel } from '../hooks/useSpinWheel';
import { getSpinnerSegments } from '../types/game';
import type { AppSettings, ContentMode, CoupleTask, GameState } from '../types/game';
import { hideTaskForever, toggleFavorite } from '../utils/privacy';
import { getTaskFeedback, setTaskFeedback } from '../utils/taskFeedback';
import { hasUndo } from '../utils/undoStack';

type GameScreenProps = {
  settings: AppSettings;
  game: GameState;
  effectiveTarget: number | null;
  currentPlayerName: string;
  contentMode: ContentMode;
  onStartSpin: () => void;
  onSpinEnd: (segmentIndex: number) => void;
  onComplete: () => void;
  onSkip: () => void;
  onReplaceTask: () => void;
  onTooEasy: () => void;
  onTooHard: () => void;
  onMarkFunniest: (task: CoupleTask) => void;
  onEndGame: () => void;
  onToggleSound: () => void;
  onPause: () => void;
  onResume: () => void;
  onUndo: () => void;
  onExitToHome: () => void;
  spectatorMode?: boolean;
};

export function GameScreen({
  settings,
  game,
  effectiveTarget,
  currentPlayerName,
  contentMode,
  onStartSpin,
  onSpinEnd,
  onComplete,
  onSkip,
  onReplaceTask,
  onTooEasy,
  onTooHard,
  onMarkFunniest,
  onEndGame,
  onToggleSound,
  onPause,
  onResume,
  onUndo,
  onExitToHome,
  spectatorMode = false,
}: GameScreenProps) {
  const handleSpinEnd = useCallback(
    (segmentIndex: number) => onSpinEnd(segmentIndex),
    [onSpinEnd],
  );

  const segments = useMemo(
    () => getSpinnerSegments(game.mode, contentMode),
    [game.mode, contentMode],
  );

  const { spin, rotation, landed } = useSpinWheel(handleSpinEnd, {
    soundEnabled: settings.soundEnabled,
    soundPack: settings.soundPack,
    segments,
  });
  const [confirmEnd, setConfirmEnd] = useState(false);

  const progressCurrent = useMemo(() => {
    if (game.gameFormat === 'rounds') return game.stats.roundNumber;
    if (game.scoringMode === 'cooperative') return game.cooperativeScore;
    if (game.scoringMode === 'none') return game.stats.totalCompleted;
    return Math.max(game.scores[0], game.scores[1]);
  }, [
    game.gameFormat,
    game.scoringMode,
    game.cooperativeScore,
    game.stats.totalCompleted,
    game.stats.roundNumber,
    game.scores,
  ]);

  const [taskRating, setTaskRating] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    if (!game.currentTask) {
      setTaskRating(null);
      return;
    }
    setTaskRating(getTaskFeedback(game.currentTask.id));
  }, [game.currentTask?.id]);

  const handleSpin = () => {
    if (spectatorMode) return;
    if (game.isSpinning || game.currentTask || landed || game.uiBlocked || game.paused) return;
    onStartSpin();
    spin();
  };

  return (
    <section className="page-screen game-screen">
      <div className="game-card">
        {spectatorMode && (
          <div className="partner-spectator-banner" role="status">
            👀 מצב צפייה — רואים את המשחק בזמן אמת מהשותף/ה
          </div>
        )}

        <div className="game-bar-extras" aria-live="polite">
          <span>
            סיבוב {game.stats.roundNumber + 1}
            {effectiveTarget != null ? ` · יעד ${effectiveTarget}` : ''}
          </span>
          <button type="button" className="icon-btn pressable" onClick={onPause} aria-label="השהייה">
            ⏸
          </button>
        </div>

        <GameHeader
          currentPlayerName={currentPlayerName}
          currentPlayerIndex={game.currentPlayerIndex}
          playerOneName={game.playerOneName}
          playerTwoName={game.playerTwoName}
          playerOneAvatar={settings.playerOneAvatar}
          playerTwoAvatar={settings.playerTwoAvatar}
          playerOneColor={settings.playerOneColor}
          playerTwoColor={settings.playerTwoColor}
          scores={game.scores}
          cooperativeScore={game.cooperativeScore}
          scoringMode={game.scoringMode}
          timeRemainingSeconds={game.timeRemainingSeconds}
          stats={game.stats}
          soundEnabled={settings.soundEnabled}
          onToggleSound={onToggleSound}
        />

        <ProgressBar
          current={progressCurrent}
          target={effectiveTarget}
          label={
            game.gameFormat === 'rounds'
              ? 'סיבובים'
              : game.scoringMode === 'none'
                ? contentMode === 'questions'
                  ? 'שאלות שנענו'
                  : 'משימות שבוצעו'
                : 'התקדמות ליעד'
          }
        />

        {game.poolEmpty && (
          <p className="site-gate__error" role="status">
            אין עוד תוכן שמתאים למסננים — נסו להחליף מצב או לאפס דילוגים
          </p>
        )}

        <SpinnerWheel
          isSpinning={game.isSpinning}
          rotation={rotation}
          landed={landed}
          spinnerStyle={settings.spinnerStyle}
          gameMode={game.mode}
          segments={segments}
          disabled={spectatorMode || !!game.currentTask || game.isSpinning || !!game.uiBlocked || !!game.paused}
          onSpin={handleSpin}
        />

        <div className="game-end-confirm__actions">
          {!spectatorMode && hasUndo() && (
            <button type="button" className="secondary-action pressable" onClick={onUndo}>
              בטל פעולה
            </button>
          )}
        </div>

        {!spectatorMode && !confirmEnd && (
          <button type="button" className="game-end-link pressable" onClick={() => setConfirmEnd(true)}>
            סיום משחק
          </button>
        )}
        {!spectatorMode && confirmEnd && (
          <div className="game-end-confirm">
            <p>לסיים את המשחק עכשיו?</p>
            <div className="game-end-confirm__actions">
              <button type="button" className="primary-action pressable" onClick={onEndGame}>
                כן, סיימו
              </button>
              <button type="button" className="secondary-action pressable" onClick={() => setConfirmEnd(false)}>
                המשך לשחק
              </button>
            </div>
          </div>
        )}
      </div>

      {game.paused && (
        <PauseModal
          onContinue={onResume}
          onSettings={() => {
            onResume();
            onExitToHome();
          }}
          onRestart={onEndGame}
          onExit={onExitToHome}
        />
      )}

      {game.currentTask && !game.paused && (
        <TaskModal
          task={game.currentTask}
          currentPlayerName={currentPlayerName}
          isCoupleTask={game.coupleTaskMode}
          isFunniest={game.stats.funniestTaskId === game.currentTask.id}
          readOnly={spectatorMode}
          taskFeedback={taskRating}
          onTaskFeedback={
            spectatorMode
              ? undefined
              : (rating) => {
                  setTaskFeedback(game.currentTask!.id, rating);
                  setTaskRating(rating);
                }
          }
          onComplete={onComplete}
          onSkip={onSkip}
          onReplaceTask={onReplaceTask}
          onTooEasy={onTooEasy}
          onTooHard={onTooHard}
          onMarkFunniest={() => onMarkFunniest(game.currentTask!)}
          onHideForever={() => {
            hideTaskForever(game.currentTask!.id);
            onSkip();
          }}
          onToggleFavorite={() => toggleFavorite(game.currentTask!.id)}
        />
      )}
    </section>
  );
}
