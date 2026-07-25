import { useState } from 'react';
import { CustomContentPanel } from './CustomContentPanel';
import { clearAllLocalData, loadHistory, loadRecords, loadUnlockedAchievements } from '../utils/storage';
import { ACHIEVEMENTS, AVATAR_OPTIONS, PLAYER_COLORS } from '../types/game';
import type { AnimationStyle, AppSettings, BgTheme, FontChoice, SoundPack, SpinnerStyle } from '../types/game';

type SettingsPanelProps = {
  settings: AppSettings;
  onUpdate: (partial: Partial<AppSettings>) => void;
  onResetScores: () => void;
  onBack: () => void;
};

const SPINNER_STYLES: { value: SpinnerStyle; label: string }[] = [
  { value: 'classic', label: 'קלאסי' },
  { value: 'glass', label: 'זכוכית' },
  { value: 'heart', label: 'לב' },
];

const FONTS: { value: FontChoice; label: string }[] = [
  { value: 'heebo', label: 'Heebo' },
  { value: 'assistant', label: 'Assistant' },
  { value: 'rubik', label: 'Rubik' },
];

const BG_THEMES: { value: BgTheme; label: string }[] = [
  { value: 'default', label: 'ברירת מחדל' },
  { value: 'purple', label: 'סגול' },
  { value: 'rose', label: 'ורוד' },
  { value: 'ocean', label: 'אוקיינוס' },
];

const SOUND_PACKS: { value: SoundPack; label: string }[] = [
  { value: 'default', label: 'רגיל' },
  { value: 'soft', label: 'רך' },
  { value: 'playful', label: 'שמח' },
];

export function SettingsPanel({ settings, onUpdate, onResetScores, onBack }: SettingsPanelProps) {
  const records = loadRecords();
  const history = loadHistory();
  const achievements = loadUnlockedAchievements();
  const [cleared, setCleared] = useState(false);

  return (
    <div className="settings-panel">
      <div className="settings-group">
        <label className="settings-toggle">
          <span>הפעלת סאונד</span>
          <input type="checkbox" checked={settings.soundEnabled} onChange={(e) => onUpdate({ soundEnabled: e.target.checked })} />
          <span className="settings-toggle__slider" />
        </label>
        <label className="settings-toggle">
          <span>מוזיקת רקע</span>
          <input type="checkbox" checked={settings.backgroundMusicEnabled} onChange={(e) => onUpdate({ backgroundMusicEnabled: e.target.checked })} />
          <span className="settings-toggle__slider" />
        </label>
        <label className="settings-toggle">
          <span>רטט במובייל</span>
          <input type="checkbox" checked={settings.vibrationEnabled} onChange={(e) => onUpdate({ vibrationEnabled: e.target.checked })} />
          <span className="settings-toggle__slider" />
        </label>
        <label className="settings-toggle">
          <span>מצב כהה</span>
          <input type="checkbox" checked={settings.theme === 'dark'} onChange={(e) => onUpdate({ theme: e.target.checked ? 'dark' : 'light' })} />
          <span className="settings-toggle__slider" />
        </label>
        <label className="settings-toggle">
          <span>מצב עיוורי צבעים</span>
          <input type="checkbox" checked={settings.colorblindMode} onChange={(e) => onUpdate({ colorblindMode: e.target.checked })} />
          <span className="settings-toggle__slider" />
        </label>
        <label className="settings-toggle">
          <span>משימות מתקדמות</span>
          <input type="checkbox" checked={settings.advancedTasksEnabled} onChange={(e) => onUpdate({ advancedTasksEnabled: e.target.checked })} />
          <span className="settings-toggle__slider" />
        </label>
      </div>

      <div className="settings-group">
        <span className="settings-label">חבילת סאונד</span>
        <div className="target-score-options" role="radiogroup" aria-label="חבילת סאונד">
          {SOUND_PACKS.map((p) => (
            <button
              key={p.value}
              type="button"
              role="radio"
              aria-checked={settings.soundPack === p.value}
              className={`target-score-btn ${settings.soundPack === p.value ? 'target-score-btn--selected' : ''}`}
              onClick={() => onUpdate({ soundPack: p.value })}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-group">
        <span className="settings-label">עיצוב ספינר</span>
        <div className="target-score-options">
          {SPINNER_STYLES.map((s) => (
            <button key={s.value} type="button" className={`target-score-btn ${settings.spinnerStyle === s.value ? 'target-score-btn--selected' : ''}`} onClick={() => onUpdate({ spinnerStyle: s.value })}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-group">
        <span className="settings-label">פונט</span>
        <div className="target-score-options">
          {FONTS.map((f) => (
            <button key={f.value} type="button" className={`target-score-btn ${settings.fontChoice === f.value ? 'target-score-btn--selected' : ''}`} onClick={() => onUpdate({ fontChoice: f.value })}>
              {f.label}
            </button>
          ))}
        </div>
        <span className="settings-label">רקע</span>
        <div className="target-score-options">
          {BG_THEMES.map((b) => (
            <button key={b.value} type="button" className={`target-score-btn ${settings.bgTheme === b.value ? 'target-score-btn--selected' : ''}`} onClick={() => onUpdate({ bgTheme: b.value })}>
              {b.label}
            </button>
          ))}
        </div>
        <span className="settings-label">אנימציות</span>
        <div className="target-score-options">
          {(['full', 'reduced'] as AnimationStyle[]).map((a) => (
            <button key={a} type="button" className={`target-score-btn ${settings.animationStyle === a ? 'target-score-btn--selected' : ''}`} onClick={() => onUpdate({ animationStyle: a })}>
              {a === 'full' ? 'מלא' : 'מופחת'}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-group">
        <label className="settings-field">
          <span>שחקן 1</span>
          <input type="text" value={settings.playerOneName} onChange={(e) => onUpdate({ playerOneName: e.target.value })} />
        </label>
        <div className="avatar-picker">
          {AVATAR_OPTIONS.map((a) => (
            <button key={a} type="button" className={`avatar-opt ${settings.playerOneAvatar === a ? 'selected' : ''}`} onClick={() => onUpdate({ playerOneAvatar: a })}>{a}</button>
          ))}
        </div>
        <div className="color-picker" role="radiogroup" aria-label="צבע שחקן 1">
          {PLAYER_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={settings.playerOneColor === c.value}
              aria-label={c.label}
              className={`color-opt ${settings.playerOneColor === c.value ? 'selected' : ''}`}
              style={{ background: c.value }}
              onClick={() => onUpdate({ playerOneColor: c.value })}
            />
          ))}
        </div>
        <label className="settings-field">
          <span>שחקן 2</span>
          <input type="text" value={settings.playerTwoName} onChange={(e) => onUpdate({ playerTwoName: e.target.value })} />
        </label>
        <div className="avatar-picker">
          {AVATAR_OPTIONS.map((a) => (
            <button key={`2-${a}`} type="button" className={`avatar-opt ${settings.playerTwoAvatar === a ? 'selected' : ''}`} onClick={() => onUpdate({ playerTwoAvatar: a })}>{a}</button>
          ))}
        </div>
        <div className="color-picker" role="radiogroup" aria-label="צבע שחקן 2">
          {PLAYER_COLORS.map((c) => (
            <button
              key={`2-${c.id}`}
              type="button"
              role="radio"
              aria-checked={settings.playerTwoColor === c.value}
              aria-label={c.label}
              className={`color-opt ${settings.playerTwoColor === c.value ? 'selected' : ''}`}
              style={{ background: c.value }}
              onClick={() => onUpdate({ playerTwoColor: c.value })}
            />
          ))}
        </div>
      </div>

      <CustomContentPanel matureAgeConfirmed={settings.matureAgeConfirmed} />

      <div className="settings-group records-box">
        <span className="settings-label">שיאים מקומיים</span>
        <div className="stats-grid">
          <div className="stat-box"><strong>{records.totalGames}</strong><span>משחקים</span></div>
          <div className="stat-box"><strong>{records.mostCompleted}</strong><span>שיא</span></div>
          <div className="stat-box"><strong>{records.longestStreak}</strong><span>רצף</span></div>
        </div>
        {history.length > 0 && <p className="history-hint">אחרון: {new Date(history[0].date).toLocaleDateString('he-IL')}</p>}
        <div className="achievements-row">
          {ACHIEVEMENTS.filter((a) => achievements.includes(a.id)).map((a) => (
            <span key={a.id} className="achievement-badge">{a.emoji} {a.title}</span>
          ))}
        </div>
      </div>

      <div className="settings-group">
        <span className="settings-label">פרטיות</span>
        <p className="custom-content-panel__hint">
          שמות, היסטוריה ותוכן מותאם נשמרים רק במכשיר זה. אין שליחה לשרת.
        </p>
        <button
          type="button"
          className="secondary-action pressable"
          onClick={() => {
            if (!window.confirm('למחוק את כל הנתונים המקומיים מהמכשיר?')) return;
            clearAllLocalData();
            setCleared(true);
            window.setTimeout(() => window.location.reload(), 400);
          }}
        >
          מחיקת כל הנתונים
        </button>
        {cleared && <p className="history-hint">הנתונים נמחקו — מרענן...</p>}
      </div>

      <div className="modal-actions settings-actions">
        <button type="button" className="secondary-action pressable" onClick={onResetScores}>איפוס ניקוד</button>
        <button type="button" className="primary-action pressable" onClick={onBack}>חזרה למסך הראשי</button>
      </div>
    </div>
  );
}
