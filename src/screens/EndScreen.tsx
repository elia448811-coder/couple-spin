import { useMemo, useState } from 'react';
import { ConfettiEffect } from '../components/ConfettiEffect';
import { StatsSummary } from '../components/GameHeader';
import { ACHIEVEMENTS, END_PHRASES } from '../types/game';
import type { AppSettings, GameState } from '../types/game';
import { polishPrompt } from '../utils/polishPrompt';
import { buildEndShareData, generateShareImage, shareGameResult } from '../utils/share';
import { buildEveningRecap } from '../utils/surpriseEvening';
import { getLatestEveningRating, saveEveningRating } from '../utils/taskFeedback';

type EndScreenProps = {
  game: GameState;
  settings: AppSettings;
  onNewGame: () => void;
  onPlayAgain: () => void;
  onHome: () => void;
};

export function EndScreen({ game, settings, onNewGame, onPlayAgain, onHome }: EndScreenProps) {
  const [sharing, setSharing] = useState(false);
  const [eveningStars, setEveningStars] = useState<number | null>(() =>
    getLatestEveningRating(game.eveningName),
  );

  const winnerName =
    game.winner === 0
      ? game.playerOneName
      : game.winner === 1
        ? game.playerTwoName
        : null;

  const phrase = useMemo(
    () => END_PHRASES[Math.floor(Math.random() * END_PHRASES.length)],
    [],
  );

  const durationMinutes = Math.max(
    1,
    Math.round((Date.now() - game.stats.startTime) / 60000),
  );

  const newAchievements = ACHIEVEMENTS.filter((a) =>
    game.sessionNewAchievements.includes(a.id),
  );

  const recap = useMemo(
    () =>
      buildEveningRecap({
        stats: game.stats,
        eveningName: game.eveningName,
        contentMode: game.contentMode,
      }),
    [game.stats, game.eveningName, game.contentMode],
  );

  const handleShare = async () => {
    setSharing(true);
    try {
      const data = buildEndShareData(game, settings, winnerName, phrase);
      await shareGameResult(data, settings);
    } finally {
      setSharing(false);
    }
  };

  const handleSaveImage = async () => {
    const data = buildEndShareData(game, settings, winnerName, phrase);
    const blob = await generateShareImage(data, settings);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'couple-spin-summary.png';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="page-screen flow-screen end-screen">
      <ConfettiEffect
        active
        colors={[settings.playerOneColor, settings.playerTwoColor, '#FACC15', '#FF4FA3']}
      />
      <div className="flow-card end-card">
        <p className="flow-kicker">כל הכבוד</p>
        <h1 className="flow-title end-card__title">{phrase}</h1>
        <p className="flow-desc end-card__subtitle">
          {game.eveningName && <span>{game.eveningName} · </span>}
          סיימתם עם {game.stats.totalCompleted}{' '}
          {game.contentMode === 'questions' ? 'שאלות שנענו' : 'משימות שבוצעו'}
          {game.stats.totalSkipped > 0 && ` · ${game.stats.totalSkipped} דילוגים`}
        </p>

        {winnerName ? (
          <div className="end-winner-pill">
            <span>🏆</span>
            <strong>{winnerName}</strong>
            <span>ניצח/ה!</span>
          </div>
        ) : game.winner === 'tie' ? (
          <div className="end-winner-pill end-winner-pill--tie">
            <span>🤝</span>
            <strong>תיקו מושלם</strong>
          </div>
        ) : null}

        {game.stats.funniestTaskTitle && (
          <p className="funniest-task">
            {game.contentMode === 'questions' ? '⭐ השאלה מועדפת:' : '😂 המשימה הכי מצחיקה:'}{' '}
            {polishPrompt(game.stats.funniestTaskTitle)}
          </p>
        )}

        <div className="end-stats-grid">
          <div className="stat-box">
            <strong>{game.stats.totalCompleted}</strong>
            <span>בוצעו</span>
          </div>
          <div className="stat-box">
            <strong>{game.stats.totalSkipped}</strong>
            <span>דילוגים</span>
          </div>
          <div className="stat-box">
            <strong>{game.stats.maxStreak}</strong>
            <span>רצף מקסימלי</span>
          </div>
          <div className="stat-box">
            <strong>{durationMinutes}</strong>
            <span>דקות</span>
          </div>
        </div>

        <div className="evening-recap">
          <h2 className="evening-recap__title">✨ {recap.title}</h2>
          <ul className="evening-recap__list">
            {recap.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>

        <div className="evening-rating">
          <p className="setup-label">איך היה הערב?</p>
          <div className="evening-rating__stars" role="radiogroup" aria-label="דירוג הערב">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                role="radio"
                aria-checked={eveningStars === star}
                className={`evening-rating__star pressable ${eveningStars != null && eveningStars >= star ? 'evening-rating__star--on' : ''}`}
                onClick={() => {
                  setEveningStars(star);
                  saveEveningRating(game.eveningName, star);
                }}
              >
                ⭐
              </button>
            ))}
          </div>
          {eveningStars != null && (
            <p className="history-hint">תודה! שמרנו את הדירוג ({eveningStars}/5)</p>
          )}
        </div>

        {newAchievements.length > 0 && (
          <div className="achievements-unlocked">
            <span className="setup-label">הישגים חדשים 🎉</span>
            <div className="achievements-row">
              {newAchievements.map((a) => (
                <span key={a.id} className="achievement-badge">
                  {a.emoji} {a.title}
                </span>
              ))}
            </div>
          </div>
        )}

        <StatsSummary achievementIds={game.unlockedAchievements} />

        <div className="end-actions">
          <button type="button" className="cta-button pressable" onClick={onPlayAgain}>
            🎲 שחקו שוב
          </button>
          <button type="button" className="end-actions__secondary pressable" onClick={handleShare} disabled={sharing}>
            {sharing ? 'משתף...' : '📤 שתפו'}
          </button>
          <details className="end-actions__more">
            <summary>עוד אפשרויות</summary>
            <div className="end-actions__more-body">
              <button type="button" className="extra-btn pressable" onClick={handleSaveImage}>
                💾 שמרו תמונה
              </button>
              <button type="button" className="extra-btn pressable" onClick={onNewGame}>
                משחק חדש
              </button>
              <button type="button" className="extra-btn pressable" onClick={onHome}>
                חזרה לראשי
              </button>
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}
