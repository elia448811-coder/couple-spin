import { lazy, Suspense } from 'react';
import { InstallPWABanner } from '../components/InstallPWABanner';
import { BackgroundGlow } from '../components/BackgroundGlow';
import { FloatingParticles } from '../components/FloatingParticles';
import { MiniRobot } from '../components/MiniRobot';
import { useDeviceLayout } from '../hooks/useDeviceLayout';
import { useGameState } from '../hooks/useGameState';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import type { Screen } from '../types/game';
import '../styles/globals.css';
import '../styles/responsive.css';
import '../styles/friendly.css';

const go = (navigate: (s: Screen) => void, screen: Screen) => () => navigate(screen);

const QuickSetupScreen = lazy(() =>
  import('../screens/QuickSetupScreen').then((m) => ({ default: m.QuickSetupScreen })),
);
const DiceRollScreen = lazy(() =>
  import('../screens/DiceRollScreen').then((m) => ({ default: m.DiceRollScreen })),
);
const GameScreen = lazy(() => import('../screens/GameScreen').then((m) => ({ default: m.GameScreen })));
const EndScreen = lazy(() => import('../screens/EndScreen').then((m) => ({ default: m.EndScreen })));
const SettingsScreen = lazy(() =>
  import('../screens/SettingsScreen').then((m) => ({ default: m.SettingsScreen })),
);

function ScreenFallback() {
  return (
    <div className="page-screen" dir="rtl" style={{ display: 'grid', placeItems: 'center' }}>
      <p>טוען...</p>
    </div>
  );
}

function AppContent() {
  const {
    settings,
    game,
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
  } = useGameState();

  const isGame = game.screen === 'game';

  return (
    <main className={`app-shell ${isGame ? 'app-shell--focus' : ''}`} dir="rtl">
      {!isGame && <BackgroundGlow />}
      {!isGame && <FloatingParticles reduced={settings.animationStyle === 'reduced'} />}
      <InstallPWABanner />

      <Suspense fallback={<ScreenFallback />}>
        {game.screen === 'welcome' && (
          <WelcomeScreen
            onStart={go(navigate, 'setup')}
            onSettings={go(navigate, 'settings')}
          />
        )}

        {game.screen === 'setup' && (
          <QuickSetupScreen
            mode={game.mode}
            level={game.level}
            contentMode={game.contentMode}
            gameFormat={game.gameFormat}
            scoringMode={game.scoringMode}
            coupleTaskMode={game.coupleTaskMode}
            targetScore={game.targetScore}
            customTargetScore={game.customTargetScore}
            eveningName={game.eveningName}
            playerOneName={game.playerOneName}
            playerTwoName={game.playerTwoName}
            matureAgeConfirmed={settings.matureAgeConfirmed}
            onModeSelect={setMode}
            onLevelSelect={setLevel}
            onContentModeChange={setContentMode}
            onFormatChange={setGameFormat}
            onScoringChange={setScoringMode}
            onCoupleModeChange={setCoupleTaskMode}
            onTargetScoreSelect={setTargetScore}
            onCustomTargetChange={setCustomTargetScore}
            onEveningNameChange={setEveningName}
            onPlayerNamesChange={setPlayerNames}
            onConfirmMatureAge={confirmMatureAge}
            onStart={goToDiceRoll}
            onBack={go(navigate, 'welcome')}
          />
        )}

        {game.screen === 'dice-roll' && (
          <DiceRollScreen
            playerOneName={game.playerOneName}
            playerTwoName={game.playerTwoName}
            playerOneAvatar={settings.playerOneAvatar}
            playerTwoAvatar={settings.playerTwoAvatar}
            playerOneColor={settings.playerOneColor}
            playerTwoColor={settings.playerTwoColor}
            soundEnabled={settings.soundEnabled}
            soundPack={settings.soundPack}
            onStart={startGame}
            onBack={go(navigate, 'setup')}
          />
        )}

        {game.screen === 'game' && (
          <GameScreen
            key={game.stats.startTime}
            settings={settings}
            game={game}
            effectiveTarget={effectiveTarget}
            currentPlayerName={game.currentPlayerIndex === 0 ? game.playerOneName : game.playerTwoName}
            contentMode={game.contentMode}
            onStartSpin={startSpin}
            onSpinEnd={handleSpinEnd}
            onComplete={completeTask}
            onSkip={skipTask}
            onReplaceTask={replaceTask}
            onTooEasy={taskTooEasy}
            onTooHard={taskTooHard}
            onMarkFunniest={markFunniest}
            onEndGame={endGame}
            onToggleSound={toggleSound}
          />
        )}

        {game.screen === 'end' && (
          <EndScreen
            game={game}
            settings={settings}
            onNewGame={newGame}
            onPlayAgain={playAgain}
            onHome={go(navigate, 'welcome')}
          />
        )}

        {game.screen === 'settings' && (
          <SettingsScreen
            settings={settings}
            onUpdate={updateSettings}
            onResetScores={resetScores}
            onBack={go(navigate, 'welcome')}
          />
        )}
      </Suspense>

      <MiniRobot
        game={game}
        settings={settings}
        effectiveTarget={effectiveTarget}
        soundEnabled={settings.soundEnabled}
      />
    </main>
  );
}

export default function App() {
  useDeviceLayout();
  return <AppContent />;
}
