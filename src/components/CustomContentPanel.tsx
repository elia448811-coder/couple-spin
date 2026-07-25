import { useState } from 'react';
import { LEVEL_LABELS, type ContentKind, type TaskCategory, type TaskLevel } from '../types/game';
import {
  getCachedCategories,
  getCategoryIcon,
  getCategoryLabel,
} from '../utils/adminCategories';
import {
  addCustomContent,
  loadCustomContent,
  removeCustomContent,
  type CustomContentItem,
} from '../utils/customContent';

const CONTENT_KINDS: { value: ContentKind; label: string }[] = [
  { value: 'question', label: 'שאלה' },
  { value: 'task', label: 'משימה' },
];

const LEVELS: TaskLevel[] = ['easy', 'normal', 'advanced'];

type CustomContentPanelProps = {
  matureAgeConfirmed: boolean;
};

export function CustomContentPanel({ matureAgeConfirmed }: CustomContentPanelProps) {
  const [items, setItems] = useState<CustomContentItem[]>(() => loadCustomContent());
  const [kind, setKind] = useState<ContentKind>('question');
  const [category, setCategory] = useState<TaskCategory>('romantic');
  const [level, setLevel] = useState<TaskLevel>('normal');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questionGroup, setQuestionGroup] = useState('');
  const [formError, setFormError] = useState('');

  const visibleCategories = getCachedCategories()
    .map((c) => c.id)
    .filter((c) => c !== 'spicy' || matureAgeConfirmed);

  const refresh = () => setItems(loadCustomContent());

  const handleAdd = () => {
    setFormError('');
    const added = addCustomContent({
      kind,
      title,
      description,
      category,
      level,
      questionGroup: kind === 'question' && questionGroup.trim() ? questionGroup.trim() : undefined,
    });

    if (!added) {
      setFormError('מלאו כותרת ותיאור');
      return;
    }

    setTitle('');
    setDescription('');
    setQuestionGroup('');
    refresh();
  };

  const handleRemove = (id: string) => {
    removeCustomContent(id);
    refresh();
  };

  return (
    <div className="settings-group custom-content-panel">
      <span className="settings-label">תוכן מותאם אישית</span>
      <p className="custom-content-panel__hint">
        הוסיפו שאלות או משימות משלכם — נשמרות במכשיר ומשולבות במשחק לפי קטגוריה.
      </p>

      <div className="custom-content-form">
        <span className="settings-label">סוג</span>
        <div className="target-score-options">
          {CONTENT_KINDS.map((k) => (
            <button
              key={k.value}
              type="button"
              className={`target-score-btn ${kind === k.value ? 'target-score-btn--selected' : ''}`}
              onClick={() => setKind(k.value)}
            >
              {k.label}
            </button>
          ))}
        </div>

        <span className="settings-label">קטגוריה</span>
        <div className="target-score-options custom-content-categories">
          {visibleCategories.map((c) => (
            <button
              key={c}
              type="button"
              className={`target-score-btn ${category === c ? 'target-score-btn--selected' : ''}`}
              onClick={() => setCategory(c)}
            >
              {getCategoryIcon(c)} {getCategoryLabel(c)}
            </button>
          ))}
        </div>

        <span className="settings-label">רמה</span>
        <div className="target-score-options">
          {LEVELS.map((l) => (
            <button
              key={l}
              type="button"
              className={`target-score-btn ${level === l ? 'target-score-btn--selected' : ''}`}
              onClick={() => setLevel(l)}
            >
              {LEVEL_LABELS[l]}
            </button>
          ))}
        </div>

        {kind === 'question' && (
          <label className="settings-field">
            <span>קבוצת שאלות (אופציונלי)</span>
            <input
              type="text"
              value={questionGroup}
              onChange={(e) => setQuestionGroup(e.target.value)}
              placeholder="למשל: meet100, intimacy, שלי..."
            />
          </label>
        )}

        <label className="settings-field">
          <span>כותרת קצרה</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={kind === 'question' ? 'שאלה לדוגמה...' : 'משימה לדוגמה...'}
            maxLength={120}
          />
        </label>

        <label className="settings-field">
          <span>{kind === 'question' ? 'נוסח השאלה' : 'תיאור המשימה'}</span>
          <textarea
            className="custom-content-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="כתבו כאן את התוכן המלא..."
          />
        </label>

        {formError && <p className="site-gate__error">{formError}</p>}

        <button type="button" className="primary-action pressable custom-content-add" onClick={handleAdd}>
          + הוספה לקטגוריה {getCategoryLabel(category)}
        </button>
      </div>

      {items.length > 0 && (
        <div className="custom-content-list">
          <span className="settings-label">התוכן שלכם ({items.length})</span>
          <ul className="custom-content-items">
            {items.map((item) => (
              <li key={item.id} className="custom-content-item">
                <div className="custom-content-item__meta">
                  <span>{item.kind === 'question' ? '❓' : '🎯'}</span>
                  <span>
                    {getCategoryIcon(item.category)} {getCategoryLabel(item.category)} · {LEVEL_LABELS[item.level]}
                  </span>
                  {item.questionGroup && <span className="custom-content-item__group">#{item.questionGroup}</span>}
                </div>
                <strong>{item.title}</strong>
                <p>{item.description}</p>
                <button
                  type="button"
                  className="secondary-action pressable custom-content-remove"
                  onClick={() => handleRemove(item.id)}
                >
                  מחק
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
