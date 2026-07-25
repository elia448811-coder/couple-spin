import { ACHIEVEMENTS } from '../types/game';
import { loadHistory, loadRecords } from '../utils/storage';

type GameHeaderProps = {
  currentPlayerName: string;
  currentPlayerIndex: 0 | 1;
  playerOneName: string;
  playerTwoName: string;
  playerOneAvatar: string;
  playerTwoAvatar: string;
  playerOneColor: string;
  playerTwoColor: string;
  scores: [number, number];
  cooperativeScore: number;
  scoringMode: string;
  timeRemainingSeconds: number | null;
  stats: { totalCompleted: number; totalSkipped: number; streak: number };
  soundEnabled: boolean;
  onToggleSound: () => void;
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function GameHeader({
  currentPlayerName,
  currentPlayerIndex,
  playerOneName,
  playerTwoName,
  playerOneAvatar,
  playerTwoAvatar,
  playerOneColor,
  playerTwoColor,
  scores,
  cooperativeScore,
  scoringMode,
  timeRemainingSeconds,
  stats,
  soundEnabled,
  onToggleSound,
}: GameHeaderProps) {
  const scoreDisplay =
    scoringMode === 'cooperative'
      ? `${cooperativeScore} נק׳ משותף`
      : scoringMode === 'none'
        ? `${stats.totalCompleted} בוצעו`
        : `${scores[0]} : ${scores[1]}`;

  return (
    <header className="game-bar">
      <p className="sr-only" aria-live="polite">
        תור של {currentPlayerName}. {scoreDisplay}
        {timeRemainingSeconds !== null ? `. נותרו ${formatTime(timeRemainingSeconds)}` : ''}
      </p>
      <button
        type="button"
        className="game-bar__mute"
        onClick={onToggleSound}
        aria-label={soundEnabled ? 'השתק' : 'הפעל סאונד'}
      >
        {soundEnabled ? '🔊' : '🔇'}
      </button>

      <div className="game-bar__scores">
        <div className={`game-bar__player ${currentPlayerIndex === 0 ? 'game-bar__player--active' : ''}`}>
          <span className="game-bar__avatar" style={{ borderColor: playerOneColor }}>
            {playerOneAvatar}
          </span>
          <span className="game-bar__name">{playerOneName}</span>
          {scoringMode === 'competitive' && (
            <span className="game-bar__pts" style={{ color: playerOneColor }}>
              {scores[0]}
            </span>
          )}
        </div>

        <div className="game-bar__center" aria-live="polite" aria-atomic="true">
          <span className="game-bar__score-label">{scoreDisplay}</span>
          {timeRemainingSeconds !== null && (
            <span className="game-bar__timer">⏱ {formatTime(timeRemainingSeconds)}</span>
          )}
        </div>

        <div className={`game-bar__player ${currentPlayerIndex === 1 ? 'game-bar__player--active' : ''}`}>
          {scoringMode === 'competitive' && (
            <span className="game-bar__pts" style={{ color: playerTwoColor }}>
              {scores[1]}
            </span>
          )}
          <span className="game-bar__name">{playerTwoName}</span>
          <span className="game-bar__avatar" style={{ borderColor: playerTwoColor }}>
            {playerTwoAvatar}
          </span>
        </div>
      </div>

      <div className="game-bar__turn">
        <span
          className="game-bar__turn-dot"
          style={{ background: currentPlayerIndex === 0 ? playerOneColor : playerTwoColor }}
        />
        תור {currentPlayerName}
        {stats.streak >= 2 && <span className="game-bar__streak">🔥 {stats.streak}</span>}
      </div>
    </header>
  );
}

export function StatsSummary({ achievementIds }: { achievementIds: string[] }) {
  const history = loadHistory();
  const records = loadRecords();
  const unlocked = ACHIEVEMENTS.filter((a) => achievementIds.includes(a.id));

  return (
    <div className="stats-summary">
      <div className="stats-grid">
        <div className="stat-box">
          <strong>{records.totalGames}</strong>
          <span>משחקים</span>
        </div>
        <div className="stat-box">
          <strong>{records.mostCompleted}</strong>
          <span>שיא משימות</span>
        </div>
        <div className="stat-box">
          <strong>{records.longestStreak}</strong>
          <span>שיא רצף</span>
        </div>
      </div>
      {unlocked.length > 0 && (
        <div className="achievements-row">
          {unlocked.map((a) => (
            <span key={a.id} className="achievement-badge" title={a.description}>
              {a.emoji} {a.title}
            </span>
          ))}
        </div>
      )}
      {history.length > 0 && (
        <p className="history-hint">משחק אחרון: {history[0].completed} משימות · {history[0].durationMinutes} דק׳</p>
      )}
    </div>
  );
}
