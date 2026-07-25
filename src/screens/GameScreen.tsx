import { useCallback, useMemo, useState } from 'react';
import { GameHeader } from '../components/GameHeader';
import { ProgressBar } from '../components/ProgressBar';
import { SpinnerWheel } from '../components/SpinnerWheel';
import { TaskModal } from '../components/TaskModal';
import { useSpinWheel } from '../hooks/useSpinWheel';
import { getSpinnerSegments } from '../types/game';
import type { AppSettings, ContentMode, CoupleTask, GameState } from '../types/game';

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

  const handleSpin = () => {
    if (game.isSpinning || game.currentTask || landed) return;
    onStartSpin();
    spin();
  };

  return (
    <section className="page-screen game-screen">
      <div className="game-card">
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

        <SpinnerWheel
          isSpinning={game.isSpinning}
          rotation={rotation}
          landed={landed}
          spinnerStyle={settings.spinnerStyle}
          gameMode={game.mode}
          segments={segments}
          disabled={!!game.currentTask || game.isSpinning}
          onSpin={handleSpin}
        />

        {!confirmEnd ? (
          <button type="button" className="game-end-link pressable" onClick={() => setConfirmEnd(true)}>
            סיום משחק
          </button>
        ) : (
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

      {game.currentTask && (
        <TaskModal
          task={game.currentTask}
          currentPlayerName={currentPlayerName}
          isCoupleTask={game.coupleTaskMode}
          isFunniest={game.stats.funniestTaskId === game.currentTask.id}
          onComplete={onComplete}
          onSkip={onSkip}
          onReplaceTask={onReplaceTask}
          onTooEasy={onTooEasy}
          onTooHard={onTooHard}
          onMarkFunniest={() => onMarkFunniest(game.currentTask!)}
        />
      )}
    </section>
  );
}
