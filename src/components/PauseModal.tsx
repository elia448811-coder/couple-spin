import { useFocusTrap } from '../hooks/useFocusTrap';

type PauseModalProps = {
  onContinue: () => void;
  onSettings: () => void;
  onRestart: () => void;
  onExit: () => void;
};

export function PauseModal({ onContinue, onSettings, onRestart, onExit }: PauseModalProps) {
  const trapRef = useFocusTrap(true);
  return (
    <div className="modal-backdrop" role="presentation">
      <div ref={trapRef} className="age-gate-modal animate-in" dir="rtl" role="dialog" aria-modal="true" aria-labelledby="pause-title" tabIndex={-1}>
        <p className="flow-kicker">המשחק בהפסקה</p>
        <h2 id="pause-title" className="flow-title">קחו רגע 💜</h2>
        <div className="age-gate-actions">
          <button type="button" className="cta-button pressable" onClick={onContinue}>המשך</button>
          <button type="button" className="flow-link pressable" onClick={onSettings}>הגדרות</button>
          <button type="button" className="flow-link pressable" onClick={onRestart}>התחלה מחדש</button>
          <button type="button" className="flow-link pressable" onClick={onExit}>יציאה</button>
        </div>
      </div>
    </div>
  );
}
