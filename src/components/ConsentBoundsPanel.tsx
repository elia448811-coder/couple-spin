import { useState } from 'react';
import { loadBoundaries, saveBoundaries, sharedBoundaries, type ContentBoundary } from '../utils/privacy';

type ConsentBoundsPanelProps = {
  playerOneName: string;
  playerTwoName: string;
  onConfirm: (shared: ContentBoundary[]) => void;
  onCancel: () => void;
};

const OPTIONS: { value: ContentBoundary; label: string }[] = [
  { value: 'touch', label: 'מגע' },
  { value: 'photo', label: 'תמונות' },
  { value: 'outside', label: 'מחוץ לבית' },
  { value: 'intimate', label: 'אינטימיות' },
];

export function ConsentBoundsPanel({ playerOneName, playerTwoName, onConfirm, onCancel }: ConsentBoundsPanelProps) {
  const [boundaries, setBoundaries] = useState(loadBoundaries);
  const shared = sharedBoundaries(boundaries);
  const toggle = (player: 'playerOne' | 'playerTwo', value: ContentBoundary) => {
    setBoundaries((current) => {
      const list = current[player];
      return { ...current, [player]: list.includes(value) ? list.filter((item) => item !== value) : [...list, value] };
    });
  };

  return (
    <section className="consent-bounds-panel" dir="rtl" aria-labelledby="consent-bounds-title">
      <p className="flow-kicker">הסכמה לפני הכול</p>
      <h2 id="consent-bounds-title" className="flow-title">מה נוח לשניכם?</h2>
      <p className="flow-desc">כל אחד בוחר רק מה שנוח לו. אפשר לשנות או לדלג בכל רגע.</p>
      <div className="consent-bounds-columns">
        {(['playerOne', 'playerTwo'] as const).map((player, index) => (
          <fieldset key={player} className="consent-bounds-column">
            <legend>{index === 0 ? playerOneName : playerTwoName}</legend>
            {OPTIONS.map((option) => (
              <label key={option.value}>
                <input type="checkbox" checked={boundaries[player].includes(option.value)} onChange={() => toggle(player, option.value)} />
                {option.label}
              </label>
            ))}
          </fieldset>
        ))}
      </div>
      <p aria-live="polite">משותף לשניכם: {shared.length ? shared.map((value) => OPTIONS.find((option) => option.value === value)?.label).join(', ') : 'אין כרגע'}</p>
      <div className="age-gate-actions">
        <button type="button" className="cta-button pressable" onClick={() => { saveBoundaries(boundaries); onConfirm(shared); }}>
          אישור והמשך
        </button>
        <button type="button" className="flow-link pressable" onClick={onCancel}>ביטול</button>
      </div>
    </section>
  );
}
