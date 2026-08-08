import { useEffect, useState } from 'react';
import { getContentBankStats } from '../data/allContent';
import { PartnerConnectPanel } from '../components/PartnerConnectPanel';
import { isCurrentUserAdmin } from '../utils/admin';
import { isFeatureEnabled } from '../utils/featureFlags';
import { subscribeAuth } from '../utils/userAuth';
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
  onOpenAdmin?: () => void;
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
  onOpenAdmin,
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
  const [showAdminEntry, setShowAdminEntry] = useState(false);

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      void isCurrentUserAdmin().then((ok) => {
        if (alive) setShowAdminEntry(ok);
      });
    };
    refresh();
    const unsub = subscribeAuth(() => refresh());
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  return (
    <section className="page-screen flow-screen welcome-screen hub-screen">
      {showAdminEntry && onOpenAdmin && (
        <button
          type="button"
          className="admin-side-btn pressable"
          onClick={onOpenAdmin}
          aria-label="לוח ניהול מערכת"
        >
          <span className="admin-side-btn__icon" aria-hidden>
            ⚙️
          </span>
          <span className="admin-side-btn__label">ניהול</span>
        </button>
      )}
      <div className="hub-layout">
        <header className="hub-hero animate-in">
          <div className="hub-hero__glow" aria-hidden />
          <p className="hub-hero__badge">Couple Spin</p>
          <h1 className="hub-hero__title">ערב אחד. רק שניכם.</h1>
          <p className="hub-hero__tag">
            {playerOneName} ו{playerTwoName}, מוכנים לצחוק, להפתיע ולהתקרב קצת יותר?
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
                <strong>בואו נתחיל</strong>
                <small>אתם בוחרים את האווירה והקצב</small>
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
                <strong>תפתיעו אותנו</strong>
                <small>אנחנו נרכיב לכם ערב בלחיצה אחת</small>
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
            {total} רגעים אפשריים · תמיד אפשר לדלג · הקצב הוא שלכם
          </p>
        </footer>
      </div>
    </section>
  );
}
