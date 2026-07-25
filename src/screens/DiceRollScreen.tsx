import { useCallback, useEffect, useRef, useState } from 'react';
import { DiceFace } from '../components/DiceFace';
import type { SoundPack } from '../types/game';
import { sounds } from '../utils/sound';

type DiceRollScreenProps = {
  playerOneName: string;
  playerTwoName: string;
  playerOneAvatar: string;
  playerTwoAvatar: string;
  playerOneColor: string;
  playerTwoColor: string;
  soundEnabled: boolean;
  soundPack: SoundPack;
  onStart: (firstPlayer: 0 | 1) => void;
  onBack: () => void;
};

type Phase = 'idle' | 'rolling' | 'tie' | 'result';

function rollDie(): number {
  return Math.floor(Math.random() * 6) + 1;
}

export function DiceRollScreen({
  playerOneName,
  playerTwoName,
  playerOneAvatar,
  playerTwoAvatar,
  playerOneColor,
  playerTwoColor,
  soundEnabled,
  soundPack,
  onStart,
  onBack,
}: DiceRollScreenProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [display, setDisplay] = useState<[number, number]>([1, 1]);
  const [finalRoll, setFinalRoll] = useState<[number, number] | null>(null);
  const [firstPlayer, setFirstPlayer] = useState<0 | 1 | null>(null);
  const rollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (rollTimer.current) clearTimeout(rollTimer.current);
    if (tickTimer.current) clearInterval(tickTimer.current);
    rollTimer.current = null;
    tickTimer.current = null;
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const performRoll = useCallback(() => {
    clearTimers();
    setPhase('rolling');
    setFinalRoll(null);
    setFirstPlayer(null);

    if (soundEnabled) sounds.spin(soundPack);

    tickTimer.current = setInterval(() => {
      setDisplay([rollDie(), rollDie()]);
      if (soundEnabled) sounds.tick(soundPack);
    }, 90);

    rollTimer.current = setTimeout(() => {
      if (tickTimer.current) clearInterval(tickTimer.current);

      const d1 = rollDie();
      const d2 = rollDie();
      setDisplay([d1, d2]);

      if (d1 === d2) {
        setPhase('tie');
        if (soundEnabled) sounds.skip(soundPack);
        rollTimer.current = setTimeout(performRoll, 1400);
        return;
      }

      const starter: 0 | 1 = d1 < d2 ? 0 : 1;
      setFinalRoll([d1, d2]);
      setFirstPlayer(starter);
      setPhase('result');
      if (soundEnabled) sounds.success(soundPack);
    }, 1300);
  }, [clearTimers, soundEnabled, soundPack]);

  const winnerName = firstPlayer === 0 ? playerOneName : firstPlayer === 1 ? playerTwoName : null;
  const winnerColor = firstPlayer === 0 ? playerOneColor : playerTwoColor;

  return (
    <section className="page-screen flow-screen dice-screen">
      <div className="flow-card dice-card animate-in">
        <header className="flow-header">
          <button type="button" className="icon-btn" onClick={onBack} aria-label="חזרה">
            →
          </button>
          <div>
            <p className="flow-kicker">לפני שמתחילים</p>
            <h1 className="flow-title">🎲 מי מתחיל?</h1>
            <p className="flow-desc">מגלגלים קובייה — המספר הנמוך יותר פותח</p>
          </div>
        </header>

        <div className="dice-arena">
          <div className={`dice-player ${firstPlayer === 0 ? 'dice-player--winner' : ''}`}>
            <span className="dice-player__avatar" style={{ borderColor: playerOneColor }}>
              {playerOneAvatar}
            </span>
            <span className="dice-player__name" style={{ color: playerOneColor }}>
              {playerOneName}
            </span>
            <DiceFace
              value={display[0]}
              rolling={phase === 'rolling' || phase === 'tie'}
              winner={firstPlayer === 0}
              color={playerOneColor}
            />
            {finalRoll && (
              <span className="dice-player__value">{finalRoll[0]}</span>
            )}
          </div>

          <div className="dice-vs">
            {phase === 'tie' ? (
              <span className="dice-vs__tie">תיקו!</span>
            ) : phase === 'result' ? (
              <span className="dice-vs__result">🏁</span>
            ) : (
              <span className="dice-vs__label">VS</span>
            )}
          </div>

          <div className={`dice-player ${firstPlayer === 1 ? 'dice-player--winner' : ''}`}>
            <span className="dice-player__avatar" style={{ borderColor: playerTwoColor }}>
              {playerTwoAvatar}
            </span>
            <span className="dice-player__name" style={{ color: playerTwoColor }}>
              {playerTwoName}
            </span>
            <DiceFace
              value={display[1]}
              rolling={phase === 'rolling' || phase === 'tie'}
              winner={firstPlayer === 1}
              color={playerTwoColor}
            />
            {finalRoll && (
              <span className="dice-player__value">{finalRoll[1]}</span>
            )}
          </div>
        </div>

        {phase === 'tie' && (
          <p className="dice-message dice-message--tie">שוויון — מגלגלים שוב...</p>
        )}

        {phase === 'result' && winnerName && (
          <div className="dice-winner-banner" style={{ borderColor: winnerColor }}>
            <span className="dice-winner-banner__emoji">👑</span>
            <strong style={{ color: winnerColor }}>{winnerName}</strong>
            <span> מתחיל/ה ראשון/ה!</span>
          </div>
        )}

        <div className="dice-actions">
          {phase === 'idle' && (
            <>
              <button type="button" className="cta-button pressable" onClick={performRoll}>
                🎲 גלגלו קובייה
              </button>
              <button
                type="button"
                className="flow-link pressable"
                onClick={() => onStart(Math.random() < 0.5 ? 0 : 1)}
              >
                דלגו על הקובייה — התחילו עכשיו
              </button>
            </>
          )}

          {phase === 'rolling' && (
            <button type="button" className="cta-button cta-button--loading" disabled>
              מגלגלים...
            </button>
          )}

          {phase === 'tie' && (
            <button type="button" className="cta-button cta-button--loading" disabled>
              תיקו — שוב בדרך
            </button>
          )}

          {phase === 'result' && firstPlayer !== null && (
            <>
              <button
                type="button"
                className="cta-button pressable"
                onClick={() => onStart(firstPlayer)}
              >
                🎡 יאללה למשחק!
              </button>
              <button type="button" className="flow-link pressable" onClick={performRoll}>
                גלגלו שוב
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
