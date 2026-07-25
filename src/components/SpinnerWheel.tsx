import { useMemo } from 'react';
import type { GameMode, SpinnerSegment, SpinnerStyle } from '../types/game';
const MODE_WHEEL_COLORS: Record<GameMode, string> = {
  funny: '#ff4fa3 0deg 45deg, #facc15 45deg 90deg, #fb7185 90deg 135deg, #f97316 135deg 180deg, #ff4fa3 180deg 225deg, #facc15 225deg 270deg, #fb7185 270deg 315deg, #f97316 315deg 360deg',
  romantic: '#ff4fa3 0deg 45deg, #8b5cf6 45deg 90deg, #fb7185 90deg 135deg, #a855f7 135deg 180deg, #ff4fa3 180deg 225deg, #8b5cf6 225deg 270deg, #fb7185 270deg 315deg, #a855f7 315deg 360deg',
  challenge: '#38bdf8 0deg 45deg, #8b5cf6 45deg 90deg, #22d3ee 90deg 135deg, #facc15 135deg 180deg, #38bdf8 180deg 225deg, #8b5cf6 225deg 270deg, #22d3ee 270deg 315deg, #facc15 315deg 360deg',
  calm: '#8b5cf6 0deg 45deg, #38bdf8 45deg 90deg, #2dd4bf 90deg 135deg, #a855f7 135deg 180deg, #8b5cf6 180deg 225deg, #38bdf8 225deg 270deg, #2dd4bf 270deg 315deg, #a855f7 315deg 360deg',
  mixed: '#ff4fa3 0deg 45deg, #8b5cf6 45deg 90deg, #38bdf8 90deg 135deg, #facc15 135deg 180deg, #fb7185 180deg 225deg, #22d3ee 225deg 270deg, #a855f7 270deg 315deg, #f97316 315deg 360deg',
  spicy: '#f97316 0deg 45deg, #ff4fa3 45deg 90deg, #fb7185 90deg 135deg, #ef4444 135deg 180deg, #f97316 180deg 225deg, #ff4fa3 225deg 270deg, #fb7185 270deg 315deg, #ef4444 315deg 360deg',
};

type SpinnerWheelProps = {
  isSpinning: boolean;
  rotation: number;
  landed: boolean;
  spinnerStyle: SpinnerStyle;
  gameMode: GameMode;
  segments: SpinnerSegment[];
  disabled?: boolean;
  onSpin: () => void;
};
export function SpinnerWheel({
  isSpinning,
  rotation,
  landed,
  spinnerStyle,
  gameMode,
  segments,
  disabled = false,
  onSpin,
}: SpinnerWheelProps) {  const wheelStyle = useMemo(
    () => ({
      transform: `rotate(${rotation}deg)`,
      transition: isSpinning
        ? 'transform 3.8s cubic-bezier(0.08, 0.82, 0.12, 1)'
        : 'none',
      background: `conic-gradient(${MODE_WHEEL_COLORS[gameMode]})`,
    }),
    [rotation, isSpinning, gameMode],
  );

  return (
    <section className="wheel-area">
      <div className={`pointer ${landed ? 'pointer--landed' : ''}`} aria-hidden="true">
        ▼
      </div>
      {landed && <div className="wheel-flash" aria-hidden="true" />}
      <p className="sr-only" aria-live="polite">
        {isSpinning ? 'הגלגל מסתובב' : landed ? 'הגלגל נעצר' : 'מוכנים לסובב'}
      </p>

      <div className={`wheel-frame wheel-frame--${spinnerStyle}`}>
        <div
          className={`wheel wheel--${spinnerStyle} ${isSpinning ? 'spinning' : ''} ${landed ? 'landed' : ''}`}
          style={wheelStyle}
          role="img"
          aria-label="גלגל ספינר"
        >
          {segments.map((segment, index) => (
            <div
              key={segment.label}
              className={`wheel-segment segment-${index + 1} ${segment.rare ? 'wheel-segment--rare' : ''}`}
            >
              <span>{segment.label}</span>
            </div>
          ))}

          <div className="wheel-center">
            <span>SPIN</span>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="spin-button pressable"
        onClick={onSpin}
        disabled={isSpinning || disabled}
        aria-label="סובב את הגלגל"
      >
        {isSpinning ? 'מסתובב...' : 'סובב'}
      </button>
    </section>
  );
}
