import { useFocusTrap } from '../hooks/useFocusTrap';

type AgeGateModalProps = {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function AgeGateModal({ open, onConfirm, onCancel }: AgeGateModalProps) {
  const trapRef = useFocusTrap(open);
  if (!open) return null;

  return (
    <div className="modal-backdrop age-gate-backdrop" role="presentation">
      <div
        ref={trapRef}
        className="age-gate-modal animate-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="age-gate-title"
        tabIndex={-1}
      >
        <p className="flow-kicker">18+ בלבד</p>
        <h2 id="age-gate-title" className="flow-title">
          🔥 מצב בוגרים
        </h2>
        <p className="flow-desc age-gate-desc">
          מצב זה מיועד לזוגות בני 18 ומעלה. התוכן נועל, פלרטטני ואינטימי — בלי תוכן מפורש.
          <br />
          <strong>משחקים רק במה שנוח לשניכם. תמיד אפשר לדלג.</strong>
          <br />
          <span className="age-gate-note">זו הצהרה מקומית בלבד — לא בקרת הורים.</span>
        </p>
        <div className="age-gate-actions">
          <button type="button" className="cta-button pressable" onClick={onConfirm}>
            אנחנו מעל 18 — המשך
          </button>
          <button type="button" className="flow-link pressable" onClick={onCancel}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
