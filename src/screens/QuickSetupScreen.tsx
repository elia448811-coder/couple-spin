import { useState } from 'react';
import { AgeGateModal } from '../components/AgeGateModal';
import { ConsentBoundsPanel } from '../components/ConsentBoundsPanel';
import { LevelSelector } from '../components/LevelSelector';
import type { ContentMode, GameFormat, GameMode, ScoringMode, TargetScore, TaskLevel } from '../types/game';
import { CONTENT_MODE_LABELS, MODE_DESCRIPTIONS, MODE_LABELS } from '../types/game';
import type { GamePreset } from '../utils/gameEvents';

type QuickSetupScreenProps = {
  mode: GameMode;
  level: TaskLevel;
  contentMode: ContentMode;
  gameFormat: GameFormat;
  scoringMode: ScoringMode;
  coupleTaskMode: boolean;
  targetScore: TargetScore;
  customTargetScore: number;
  eveningName: string;
  playerOneName: string;
  playerTwoName: string;
  matureAgeConfirmed: boolean;
  presets?: GamePreset[];
  onApplyPreset?: (preset: GamePreset) => void;
  onModeSelect: (mode: GameMode) => void;
  onLevelSelect: (level: TaskLevel) => void;
  onContentModeChange: (mode: ContentMode) => void;
  onFormatChange: (format: GameFormat) => void;
  onScoringChange: (mode: ScoringMode) => void;
  onCoupleModeChange: (v: boolean) => void;
  onTargetScoreSelect: (score: TargetScore) => void;
  onCustomTargetChange: (n: number) => void;
  onEveningNameChange: (name: string) => void;
  onPlayerNamesChange: (p1: string, p2: string) => void;
  onConfirmMatureAge: () => void;
  onStart: () => void;
  onBack: () => void;
};

type VibePreset = 'quick' | 'normal' | 'chill';

const MODES: GameMode[] = ['funny', 'romantic', 'challenge', 'calm', 'mixed', 'spicy'];
const CONTENT_MODES: ContentMode[] = ['tasks', 'questions', 'mixed'];

const MODE_EMOJI: Record<GameMode, string> = {
  funny: '😂',
  romantic: '💜',
  challenge: '🏆',
  calm: '🌙',
  mixed: '🎲',
  spicy: '🔥',
};

const CONTENT_EMOJI: Record<ContentMode, string> = {
  tasks: '🎯',
  questions: '💬',
  mixed: '✨',
};

const CONTENT_SHORT: Record<ContentMode, string> = {
  tasks: 'משימות',
  questions: 'שאלות',
  mixed: 'הכל',
};

const VIBE_PRESETS: {
  id: VibePreset;
  emoji: string;
  label: string;
  hint: string;
  format: GameFormat;
  scoring: ScoringMode;
  target: TargetScore;
}[] = [
  { id: 'quick', emoji: '⚡', label: 'מהיר', hint: '~10 דק׳ · יעד 5', format: 'quick', scoring: 'competitive', target: 5 },
  { id: 'normal', emoji: '🎯', label: 'רגיל', hint: 'משחק מלא · יעד 10', format: 'normal', scoring: 'competitive', target: 10 },
  { id: 'chill', emoji: '💫', label: 'בלי לחץ', hint: 'בלי ניקוד · בקצב שלכם', format: 'fun', scoring: 'none', target: 'free' },
];

function deriveVibe(format: GameFormat, scoring: ScoringMode): VibePreset {
  if (format === 'fun' || scoring === 'none') return 'chill';
  if (format === 'quick') return 'quick';
  return 'normal';
}

export function QuickSetupScreen({
  mode,
  level,
  contentMode,
  gameFormat,
  scoringMode,
  coupleTaskMode,
  targetScore,
  customTargetScore,
  eveningName,
  playerOneName,
  playerTwoName,
  matureAgeConfirmed,
  presets = [],
  onApplyPreset,
  onModeSelect,
  onLevelSelect,
  onContentModeChange,
  onFormatChange,
  onScoringChange,
  onCoupleModeChange,
  onTargetScoreSelect,
  onCustomTargetChange,
  onEveningNameChange,
  onPlayerNamesChange,
  onConfirmMatureAge,
  onStart,
  onBack,
}: QuickSetupScreenProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [showAgeGate, setShowAgeGate] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const vibe = deriveVibe(gameFormat, scoringMode);
  const showTarget = vibe !== 'chill';
  const isMature = mode === 'spicy';

  const applyVibe = (preset: (typeof VIBE_PRESETS)[number]) => {
    onFormatChange(preset.format);
    onScoringChange(preset.scoring);
    onTargetScoreSelect(preset.target);
  };

  const proceedAfterGates = () => onStart();

  const handleContinue = () => {
    if (isMature && !matureAgeConfirmed) {
      setShowAgeGate(true);
      return;
    }
    if (isMature) {
      setShowConsent(true);
      return;
    }
    proceedAfterGates();
  };

  const handleAgeConfirm = () => {
    onConfirmMatureAge();
    setShowAgeGate(false);
    setShowConsent(true);
  };

  if (showConsent) {
    return (
      <section className="page-screen flow-screen setup-screen">
        <div className="setup-card flow-card">
          <ConsentBoundsPanel
            playerOneName={playerOneName || 'שחקן 1'}
            playerTwoName={playerTwoName || 'שחקן 2'}
            onConfirm={() => {
              setShowConsent(false);
              proceedAfterGates();
            }}
            onCancel={() => setShowConsent(false)}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="page-screen flow-screen setup-screen">
      <AgeGateModal
        open={showAgeGate}
        onConfirm={handleAgeConfirm}
        onCancel={() => setShowAgeGate(false)}
      />

      <div className="setup-card flow-card">
        <header className="flow-header setup-header">
          <button type="button" className="icon-btn" onClick={onBack} aria-label="חזרה">
            →
          </button>
          <div>
            <p className="flow-kicker">שלב 1 מתוך 2 · קל ומהיר</p>
            <h1 className="flow-title setup-title">בואו נכין ערב מושלם 💜</h1>
            <p className="flow-desc setup-sub">בחרו וייב, סוג תוכן ומשך — ואז 🎲 קובייה</p>
          </div>
        </header>

        <div className="setup-body">
          {presets.length > 0 && onApplyPreset && (
            <section className="setup-block">
              <h2 className="setup-label">התחלה מהירה</h2>
              <div className="chip-scroll" role="list">
                {presets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    role="listitem"
                    className="choice-chip pressable"
                    onClick={() => onApplyPreset(preset)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="setup-block">
            <h2 className="setup-label">איזה וייב?</h2>
            <div className="chip-scroll" role="list">
              {MODES.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="listitem"
                  className={`choice-chip ${mode === m ? 'choice-chip--on' : ''} ${m === 'spicy' ? 'choice-chip--spicy' : ''}`}
                  onClick={() => onModeSelect(m)}
                  aria-pressed={mode === m}
                  title={MODE_DESCRIPTIONS[m]}
                >
                  <span className="choice-chip__emoji">{MODE_EMOJI[m]}</span>
                  {MODE_LABELS[m]}
                </button>
              ))}
            </div>
            {isMature && (
              <p className="setup-mature-hint">🔞 תוכן 18+ לזוגות בוגרים · נדרש אישור גיל</p>
            )}
          </section>

          <section className="setup-block">
            <h2 className="setup-label">מה משחקים?</h2>
            <div className="choice-row">
              {CONTENT_MODES.map((cm) => (
                <button
                  key={cm}
                  type="button"
                  className={`choice-pill ${contentMode === cm ? 'choice-pill--on' : ''}`}
                  onClick={() => onContentModeChange(cm)}
                  aria-pressed={contentMode === cm}
                  title={CONTENT_MODE_LABELS[cm]}
                >
                  <span>{CONTENT_EMOJI[cm]}</span>
                  {isMature && cm === 'questions' ? 'שאלות 18+' : CONTENT_SHORT[cm]}
                </button>
              ))}
            </div>
          </section>

          {!isMature && (
            <section className="setup-block">
              <h2 className="setup-label">כמה זמן?</h2>
              <div className="preset-row">
                {VIBE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`preset-card ${vibe === preset.id ? 'preset-card--on' : ''}`}
                    onClick={() => applyVibe(preset)}
                    aria-pressed={vibe === preset.id}
                  >
                    <span className="preset-card__emoji">{preset.emoji}</span>
                    <strong>{preset.label}</strong>
                    <span className="preset-card__hint">{preset.hint}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {isMature && (
            <section className="setup-block setup-block--mature">
              <p className="setup-label">מצב 18+</p>
              <p className="flow-desc">בלי לחץ, בלי טיימר — רק אתם והקצב. תמיד אפשר לדלג.</p>
            </section>
          )}

          <section className="setup-block setup-names">
            <h2 className="setup-label">מי משחק?</h2>
            <div className="name-row">
              <input
                type="text"
                className="name-input"
                value={playerOneName}
                onChange={(e) => onPlayerNamesChange(e.target.value, playerTwoName)}
                placeholder="שחקן 1"
                aria-label="שם שחקן 1"
              />
              <span className="name-vs">×</span>
              <input
                type="text"
                className="name-input"
                value={playerTwoName}
                onChange={(e) => onPlayerNamesChange(playerOneName, e.target.value)}
                placeholder="שחקן 2"
                aria-label="שם שחקן 2"
              />
            </div>
          </section>

          <details
            className="setup-advanced"
            open={advancedOpen}
            onToggle={(e) => setAdvancedOpen((e.target as HTMLDetailsElement).open)}
          >
            <summary className="setup-advanced__toggle">הגדרות נוספות</summary>
            <div className="setup-advanced__body">
              {!isMature && (
                <>
                  <p className="setup-label setup-label--sm">רמת תוכן</p>
                  <LevelSelector selected={level} onSelect={onLevelSelect} />
                </>
              )}

              <label className="setup-toggle">
                <span>💑 רק משימות/שאלות זוגיות</span>
                <input
                  type="checkbox"
                  checked={coupleTaskMode}
                  onChange={(e) => onCoupleModeChange(e.target.checked)}
                />
                <span className="setup-toggle__slider" />
              </label>

              <label className="setup-field">
                <span>שם לערב (אופציונלי)</span>
                <input
                  type="text"
                  value={eveningName}
                  onChange={(e) => onEveningNameChange(e.target.value)}
                  placeholder="לדוגמה: ערב גשם"
                />
              </label>

              {showTarget && !isMature && (
                <div className="setup-field">
                  <span>יעד נקודות</span>
                  <div className="target-row">
                    {([5, 10, 15] as const).map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={`target-chip ${targetScore === n ? 'target-chip--on' : ''}`}
                        onClick={() => onTargetScoreSelect(n)}
                      >
                        {n}
                      </button>
                    ))}
                    <button
                      type="button"
                      className={`target-chip ${targetScore === 'custom' ? 'target-chip--on' : ''}`}
                      onClick={() => onTargetScoreSelect('custom')}
                    >
                      מותאם
                    </button>
                  </div>
                  {targetScore === 'custom' && (
                    <input
                      type="number"
                      className="setup-field__input"
                      min={3}
                      max={30}
                      value={customTargetScore}
                      onChange={(e) => onCustomTargetChange(Number(e.target.value))}
                    />
                  )}
                </div>
              )}
            </div>
          </details>
        </div>

        <div className="setup-footer">
          <button type="button" className="cta-button pressable" onClick={handleContinue}>
            🎲 המשך לקובייה
          </button>
          <p className="setup-hint">💡 תמיד אפשר לדלג · ספינבי 🤖 ישמח לשפוט · רק מה שנעים לשניכם</p>
        </div>
      </div>
    </section>
  );
}
