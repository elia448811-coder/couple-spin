import { useEffect, useRef, useState } from 'react';
import { QUESTION_GROUP_LABELS } from '../data/allQuestions';
import { useFocusTrap } from '../hooks/useFocusTrap';
import type { CoupleTask } from '../types/game';
import { CATEGORY_LABELS } from '../types/game';
import { CategoryIcon } from './CategoryIcon';

const EXTRA_GROUP_LABELS: Record<string, string> = {};

type TaskModalProps = {
  task: CoupleTask;
  currentPlayerName: string;
  isCoupleTask: boolean;
  isFunniest: boolean;
  onComplete: () => void;
  onSkip: () => void;
  onReplaceTask: () => void;
  onTooEasy: () => void;
  onTooHard: () => void;
  onMarkFunniest: () => void;
  onHideForever?: () => void;
  onToggleFavorite?: () => void;
};

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest('button, a, input, select, textarea, [role="button"], [contenteditable="true"]'),
  );
}

export function TaskModal({
  task,
  currentPlayerName,
  isCoupleTask,
  isFunniest,
  onComplete,
  onSkip,
  onReplaceTask,
  onTooEasy,
  onTooHard,
  onMarkFunniest,
  onHideForever,
  onToggleFavorite,
}: TaskModalProps) {
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const lockedRef = useRef(false);
  const trapRef = useFocusTrap(true);
  const isQuestion = task.kind === 'question';
  const groupLabel =
    task.questionGroup && task.questionGroup in QUESTION_GROUP_LABELS
      ? QUESTION_GROUP_LABELS[task.questionGroup as keyof typeof QUESTION_GROUP_LABELS]
      : task.questionGroup && task.questionGroup in EXTRA_GROUP_LABELS
        ? EXTRA_GROUP_LABELS[task.questionGroup]
        : task.title;
  const isMature = task.category === 'spicy';

  useEffect(() => {
    lockedRef.current = false;
    setConfirmSkip(false);
  }, [task.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        if (confirmSkip) {
          setConfirmSkip(false);
          return;
        }
        setConfirmSkip(true);
        return;
      }
      // Enter רק כשלא על אלמנט אינטראקטיבי — מונע כפל פעולות
      if (e.key === 'Enter' && !isInteractiveTarget(e.target)) {
        e.preventDefault();
        if (!lockedRef.current) {
          lockedRef.current = true;
          onComplete();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onComplete, confirmSkip]);

  const doSkip = () => {
    if (lockedRef.current) return;
    lockedRef.current = true;
    setConfirmSkip(false);
    onSkip();
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        ref={trapRef}
        className={`task-modal task-modal--clean ${isQuestion ? 'task-modal--question' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-modal-title"
        aria-describedby={confirmSkip ? 'task-skip-confirm' : undefined}
        tabIndex={-1}
      >
        <p className="task-modal__who">
          {isQuestion
            ? isMature
              ? '🔥 שאלה 18+ — דברו בפתיחות'
              : '💬 שאלה לשניכם'
            : isCoupleTask || task.isCoupleTask
              ? isMature
                ? '🔥 אתגר 18+ — שניכם'
                : '💑 משימה זוגית'
              : isMature
                ? `🔥 ${currentPlayerName}`
                : `🎯 ${currentPlayerName}`}
        </p>

        <div className="category-badge">
          {isQuestion ? (
            <span className="category-icon category-icon--sm">💬</span>
          ) : (
            <CategoryIcon category={task.category} size="sm" />
          )}
          {isQuestion ? groupLabel : CATEGORY_LABELS[task.category]}
        </div>

        <h2 id="task-modal-title" className="task-modal__text">
          {task.description}
        </h2>

        {!isQuestion && task.durationSeconds && (
          <p className="task-duration">⏱ {task.durationSeconds} שניות</p>
        )}

        {confirmSkip ? (
          <div className="task-modal__skip-confirm" id="task-skip-confirm" role="alertdialog" aria-labelledby="task-skip-confirm">
            <p>לדלג על המשימה?</p>
            <div className="task-modal__main-actions">
              <button type="button" className="cta-button cta-button--modal pressable" onClick={doSkip}>
                כן, דלג
              </button>
              <button type="button" className="task-modal__skip pressable" onClick={() => setConfirmSkip(false)}>
                ביטול
              </button>
            </div>
          </div>
        ) : (
          <div className="task-modal__main-actions">
            <button type="button" className="cta-button cta-button--modal pressable" onClick={onComplete}>
              {isQuestion ? '✓ דיברנו על זה' : '✓ בוצע'}
            </button>
            <button type="button" className="task-modal__skip pressable" onClick={doSkip}>
              דלג
            </button>
          </div>
        )}

        <button
          type="button"
          className="task-modal__more-toggle"
          onClick={() => setExtrasOpen((v) => !v)}
          aria-expanded={extrasOpen}
        >
          {extrasOpen ? '▲ פחות אפשרויות' : '▼ עוד אפשרויות'}
        </button>

        {extrasOpen && (
          <div className="task-modal__extras">
            <button type="button" className="extra-btn pressable" onClick={onReplaceTask}>
              {isQuestion ? 'שאלה אחרת' : 'משימה אחרת'}
            </button>
            {!isQuestion && (
              <>
                <button type="button" className="extra-btn pressable" onClick={onTooEasy}>
                  קל מדי
                </button>
                <button type="button" className="extra-btn pressable" onClick={onTooHard}>
                  קשה מדי
                </button>
              </>
            )}
            <button
              type="button"
              className={`extra-btn ${isFunniest ? 'extra-btn--on' : ''} pressable`}
              onClick={onMarkFunniest}
              aria-pressed={isFunniest}
            >
              {isFunniest ? '⭐ נבחר!' : isQuestion ? '⭐ שאלה מועדפת' : '😂 הכי מצחיקה'}
            </button>
            {onToggleFavorite && (
              <button type="button" className="extra-btn pressable" onClick={onToggleFavorite}>
                💜 מועדפים
              </button>
            )}
            {onHideForever && (
              <button type="button" className="extra-btn pressable" onClick={onHideForever}>
                לא להציג שוב
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
