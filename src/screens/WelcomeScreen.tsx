import { getContentBankStats } from '../data/allContent';
import { PartnerConnectPanel } from '../components/PartnerConnectPanel';
import { isFeatureEnabled } from '../utils/featureFlags';
import type { CoupleRoom, RoomPlayer, RoomRole } from '../utils/coupleRoom';

type HubStats = {
  totalGames: number;
  longestStreak: number;
  totalTasks: number;
  achievementCount: number;
};

type WelcomeScreenProps = {
  onStart: () => void;
  onSettings: () => void;
  onTutorial: () => void;
  onSurprise: () => void;
  playerOneName: string;
  playerTwoName: string;
  stats: HubStats;
  coupleAvailable: boolean;
  coupleRoom: CoupleRoom | null;
  couplePlayers: RoomPlayer[];
  coupleRole: RoomRole | null;
  coupleConnected: boolean;
  coupleAllReady: boolean;
  coupleBusy: boolean;
  coupleError: string | null;
  onCreateRoom: (hostName: string) => void;
  onJoinRoom: (code: string, partnerName: string) => void;
  onLeaveRoom: () => void;
  onToggleReady: (ready: boolean) => void;
  initialJoinCode?: string | null;
  startBlockedMessage?: string | null;
  partnerLive?: boolean;
};

export function WelcomeScreen({
  onStart,
  onSettings,
  onTutorial,
  onSurprise,
  playerOneName,
  playerTwoName,
  stats,
  coupleAvailable,
  coupleRoom,
  couplePlayers,
  coupleRole,
  coupleConnected,
  coupleAllReady,
  coupleBusy,
  coupleError,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onToggleReady,
  initialJoinCode,
  startBlockedMessage,
  partnerLive,
}: WelcomeScreenProps) {
  const { total, tasks, questions } = getContentBankStats();
  const roomBlocksStart = Boolean(coupleRoom && coupleConnected && !coupleAllReady);
  const surpriseEnabled = isFeatureEnabled('enableSurpriseMode');

  return (
    <section className="page-screen flow-screen welcome-screen hub-screen">
      <div className="hub-layout">
        <header className="hub-hero animate-in">
          <div className="hub-hero__glow" aria-hidden />
          <p className="hub-hero__badge">Couple Spin</p>
          <h1 className="hub-hero__title">הערב שלכם מתחיל כאן</h1>
          <p className="hub-hero__tag">
            שלום {playerOneName} ו{playerTwoName} — ערב זוגי, גלגל הפתעות, וחיבור אמיתי
          </p>
          <div className="hub-avatars" aria-hidden>
            <span className="hub-avatar">💜</span>
            <span className="hub-avatar">✨</span>
          </div>
          <div className="feature-tags">
            <span className="feature-tag">🎡 גלגל הפתעות</span>
            <span className="feature-tag">💬 שאלות זוגיות</span>
            <span className="feature-tag">🎯 משימות משותפות</span>
          </div>
          {partnerLive && coupleRole === 'partner' && (
            <p className="hub-live-banner" role="status">
              השותף/ה מוביל/ה את הערב — אתם רואים הכל בזמן אמת
            </p>
          )}
        </header>

        <div className="hub-grid">
          <div className="hub-card hub-card--actions animate-in">
            <p className="hub-card__kicker">בחרו איך להתחיל</p>
            {(startBlockedMessage || roomBlocksStart) && (
              <p className="hub-card__text hub-card__text--hint" role="status">
                {startBlockedMessage ?? 'סמנו "מוכן/ה" שניכם לפני שמתחילים ערב בחדר זוגי.'}
              </p>
            )}
            <button
              type="button"
              className="hub-cta pressable"
              onClick={onStart}
              disabled={roomBlocksStart}
              aria-disabled={roomBlocksStart}
            >
              <span className="hub-cta__icon">🎡</span>
              <span>
                <strong>משחק מהיר</strong>
                <small>בחירת מצב, תוכן ומשך</small>
              </span>
            </button>
            <button
              type="button"
              className="hub-cta hub-cta--surprise pressable"
              onClick={onSurprise}
              disabled={roomBlocksStart || !surpriseEnabled}
              aria-disabled={roomBlocksStart || !surpriseEnabled}
            >
              <span className="hub-cta__icon">🎁</span>
              <span>
                <strong>ערב הפתעה</strong>
                <small>המערכת בוחרת בשבילכם</small>
              </span>
            </button>
            <div className="hub-meta-row">
              <span>
                <strong>{tasks}</strong> משימות
              </span>
              <span>
                <strong>{questions}</strong> שאלות
              </span>
              <span>
                <strong>18+</strong> אופציונלי
              </span>
            </div>
            <button type="button" className="hub-link pressable" onClick={onTutorial}>
              איך משחקים?
            </button>
            <button type="button" className="hub-link pressable" onClick={onSettings}>
              הגדרות ופרטיות
            </button>
          </div>

          <PartnerConnectPanel
            available={coupleAvailable}
            room={coupleRoom}
            players={couplePlayers}
            role={coupleRole}
            connected={coupleConnected}
            allReady={coupleAllReady}
            busy={coupleBusy}
            error={coupleError}
            defaultHostName={playerOneName}
            defaultPartnerName={playerTwoName}
            onCreate={onCreateRoom}
            onJoin={onJoinRoom}
            onLeave={onLeaveRoom}
            onToggleReady={onToggleReady}
            initialJoinCode={initialJoinCode}
          />

          <div className="hub-card hub-card--stats animate-in">
            <p className="hub-card__kicker">הסטטיסטיקות שלכם</p>
            <div className="hub-stats-grid">
              <div className="hub-stat">
                <strong>{stats.totalGames}</strong>
                <span>ערבים</span>
              </div>
              <div className="hub-stat">
                <strong>{stats.totalTasks}</strong>
                <span>משימות</span>
              </div>
              <div className="hub-stat">
                <strong>{stats.longestStreak}</strong>
                <span>שיא רצף</span>
              </div>
              <div className="hub-stat">
                <strong>{stats.achievementCount}</strong>
                <span>הישגים</span>
              </div>
            </div>
          </div>
        </div>

        <footer className="hub-footer">
          <p>
            {total} פריטי תוכן · חדר מאובטח · חוויה זוגית אחת
          </p>
        </footer>
      </div>
    </section>
  );
}
