import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { InstallPWABanner } from '../components/InstallPWABanner';
import { BackgroundGlow } from '../components/BackgroundGlow';
import { FloatingParticles } from '../components/FloatingParticles';
import { MiniRobot } from '../components/MiniRobot';
import { SyncStatusBanner } from '../components/SyncStatusBanner';
import { useToast } from '../contexts/ToastContext';
import { useCoupleRoom } from '../hooks/useCoupleRoom';
import { useDeviceLayout } from '../hooks/useDeviceLayout';
import { useGameState } from '../hooks/useGameState';
import { TutorialScreen } from '../screens/TutorialScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import type { Screen } from '../types/game';
import { hasCompletedOnboarding, markOnboardingComplete } from '../utils/onboarding';
import { isDiscreteMode } from '../utils/privacy';
import { clearJoinParamFromUrl, parseJoinCodeFromUrl } from '../utils/roomInvite';
import { getRoomError } from '../utils/roomErrors';
import { isFeatureEnabled } from '../utils/featureFlags';
import { generateSurpriseEvening } from '../utils/surpriseEvening';
import { loadRecords, loadUnlockedAchievements } from '../utils/storage';
import '../styles/tokens.css';
import '../styles/globals.css';
import '../styles/responsive.css';
import '../styles/friendly.css';
import '../styles/hub.css';
import '../styles/premium.css';

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
const AdminScreen = lazy(() =>
  import('../screens/AdminScreen').then((m) => ({ default: m.AdminScreen })),
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
    pauseGame,
    resumeGame,
    undoLast,
    applyPreset,
    presets,
    resumeAvailable,
    restoreSnapshot,
    cloudResumeAvailable,
    restoreCloudSnapshot,
    applyRemoteSnapshot,
    buildVersion,
  } = useGameState();

  const couple = useCoupleRoom();
  const { showToast } = useToast();
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [surpriseNote, setSurpriseNote] = useState<string | null>(null);
  const [pendingJoinCode] = useState(() => parseJoinCodeFromUrl());
  const onboardingCheckedRef = useRef(false);

  useEffect(() => {
    if (pendingJoinCode) clearJoinParamFromUrl();
  }, [pendingJoinCode]);

  useEffect(() => {
    let cancelled = false;
    let intervalId: number | undefined;
    void (async () => {
      const { ensureUserProfile, touchUserPresence } = await import('../utils/userProfile');
      if (cancelled) return;
      await ensureUserProfile();
      if (cancelled) return;
      void touchUserPresence();
      intervalId = window.setInterval(() => {
        void touchUserPresence();
      }, 60_000);
    })();
    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (onboardingCheckedRef.current) return;
    onboardingCheckedRef.current = true;
    if (!hasCompletedOnboarding() && game.screen === 'welcome') {
      navigate('tutorial');
    }
  }, [game.screen, navigate]);

  useEffect(() => {
    if (!couple.error) return;
    const info = getRoomError(couple.error);
    if (!info) return;
    showToast({ message: `${info.title}: ${info.message}`, type: 'error', durationMs: 5500 });
  }, [couple.error, showToast]);

  const handleSurpriseEvening = useCallback(() => {
    const surprise = generateSurpriseEvening();
    applyPreset(surprise);
    setEveningName(surprise.eveningTitle);
    setSurpriseNote(`${surprise.twist} ${surprise.surpriseMessage}`);
    goToDiceRoll();
  }, [applyPreset, setEveningName, goToDiceRoll]);

  const handleStartGame = useCallback(
    (firstPlayer: 0 | 1 = 0) => {
      if (couple.room && (!couple.connected || !couple.allReady)) {
        showToast({
          message: 'שני השחקנים צריכים לסמן "מוכן/ה" לפני שמתחילים בחדר זוגי.',
          type: 'error',
          durationMs: 5000,
        });
        return;
      }
      startGame(firstPlayer);
      void couple.signalGameStarted();
    },
    [startGame, couple.signalGameStarted, couple.room, couple.connected, couple.allReady, showToast],
  );

  useEffect(() => {
    if (couple.role !== 'host' && !(couple.role === 'partner' && isFeatureEnabled('enablePartnerControl'))) return;
    if (!couple.room?.roomId) return;
    if (game.screen === 'welcome' || game.screen === 'settings') return;
    clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      void couple.syncGameToRoom(game);
    }, 450);
    return () => clearTimeout(syncTimerRef.current);
  }, [game, couple.role, couple.room?.roomId, couple.syncGameToRoom]);

  useEffect(() => {
    if (couple.role !== 'partner') return;
    const remote = couple.peekRemoteGame();
    if (!remote) return;
    applyRemoteSnapshot(remote, couple.lastEventVersion);
  }, [couple.role, couple.lastEventVersion, couple.peekRemoteGame, applyRemoteSnapshot]);

  const hubStats = {
    totalGames: loadRecords().totalGames,
    longestStreak: loadRecords().longestStreak,
    totalTasks: loadRecords().totalTasks,
    achievementCount: loadUnlockedAchievements().length,
  };

  const isGame = game.screen === 'game';
  const partnerLive =
    couple.role === 'partner' && couple.room?.status === 'playing' && couple.lastEventVersion > 0;
  const partnerSpectator =
    couple.role === 'partner' && !isFeatureEnabled('enablePartnerControl') && Boolean(couple.room);

  const finishOnboarding = useCallback(() => {
    markOnboardingComplete();
    navigate('welcome');
  }, [navigate]);

  useEffect(() => {
    const discrete = isDiscreteMode();
    document.title = discrete ? 'Notes' : 'ספין זוגי | Couple Spin';
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"][type="image/svg+xml"]');
    const apple = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
    if (icon) icon.href = discrete ? '/pwa-192.png' : '/favicon.svg';
    if (apple) apple.href = discrete ? '/pwa-192.png' : '/apple-touch-icon.png';
    document.documentElement.dataset.discrete = discrete ? 'true' : 'false';
  }, [settings]);

  return (
    <main className={`app-shell ${isGame ? 'app-shell--focus' : ''}`} dir="rtl">
      {!isGame && <BackgroundGlow />}
      {!isGame && <FloatingParticles reduced={settings.animationStyle === 'reduced'} />}
      <InstallPWABanner />
      <SyncStatusBanner
        coupleRoom={couple.room}
        coupleRole={couple.role}
        partnerLive={partnerLive}
      />

      <Suspense fallback={<ScreenFallback />}>
        {game.screen === 'tutorial' && (
          <TutorialScreen onStart={finishOnboarding} onBack={finishOnboarding} />
        )}

        {game.screen === 'welcome' && (
          <>
            {resumeAvailable && (
              <div className="resume-banner" dir="rtl">
                <button type="button" className="primary-action pressable" onClick={restoreSnapshot}>
                  המשך משחק מקומי
                </button>
              </div>
            )}
            {cloudResumeAvailable && (
              <div className="resume-banner" dir="rtl">
                <button type="button" className="secondary-action pressable" onClick={restoreCloudSnapshot}>
                  המשך משחק מהענן
                </button>
              </div>
            )}
            <WelcomeScreen
              onStart={go(navigate, 'setup')}
              onSettings={go(navigate, 'settings')}
              onTutorial={go(navigate, 'tutorial')}
              onSurprise={handleSurpriseEvening}
              playerOneName={settings.playerOneName}
              playerTwoName={settings.playerTwoName}
              stats={hubStats}
              coupleAvailable={couple.available}
              coupleRoom={couple.room}
              couplePlayers={couple.players}
              coupleRole={couple.role}
              coupleConnected={couple.connected}
              coupleAllReady={couple.allReady}
              coupleBusy={couple.busy}
              coupleError={couple.error}
              onCreateRoom={(name) => void couple.createRoom(name)}
              onJoinRoom={(code, name) => void couple.joinRoom(code, name)}
              onLeaveRoom={() => void couple.leaveRoom()}
              onToggleReady={(ready) => void couple.toggleReady(ready)}
              initialJoinCode={pendingJoinCode}
              partnerLive={partnerLive}
            />
          </>
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
            presets={presets}
            onApplyPreset={applyPreset}
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
          <>
            {surpriseNote && (
              <div className="hub-live-banner resume-banner" role="status">
                {surpriseNote}
              </div>
            )}
            <DiceRollScreen
            playerOneName={game.playerOneName}
            playerTwoName={game.playerTwoName}
            playerOneAvatar={settings.playerOneAvatar}
            playerTwoAvatar={settings.playerTwoAvatar}
            playerOneColor={settings.playerOneColor}
            playerTwoColor={settings.playerTwoColor}
            soundEnabled={settings.soundEnabled}
            soundPack={settings.soundPack}
            onStart={handleStartGame}
            onBack={go(navigate, 'setup')}
          />
          </>
        )}

        {game.screen === 'game' && (
          <GameScreen
            key={game.stats.startTime}
            settings={settings}
            game={game}
            effectiveTarget={effectiveTarget}
            currentPlayerName={game.currentPlayerIndex === 0 ? game.playerOneName : game.playerTwoName}
            contentMode={game.contentMode}
            spectatorMode={partnerSpectator}
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
            onPause={pauseGame}
            onResume={resumeGame}
            onUndo={undoLast}
            onExitToHome={go(navigate, 'welcome')}
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
            onOpenAdmin={go(navigate, 'admin')}
            buildVersion={buildVersion}
          />
        )}

        {game.screen === 'admin' && <AdminScreen onBack={go(navigate, 'settings')} />}
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
