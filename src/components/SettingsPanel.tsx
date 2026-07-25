import { useState } from 'react';
import { CustomContentPanel } from './CustomContentPanel';
import { PrivacyPanel } from './PrivacyPanel';
import { RadioGroup } from './RadioGroup';
import { clearAllLocalData, loadHistory, loadRecords, loadUnlockedAchievements } from '../utils/storage';
import { logoutSite } from '../utils/siteGate';
import { ACHIEVEMENTS, AVATAR_OPTIONS, PLAYER_COLORS } from '../types/game';
import type { AnimationStyle, AppSettings, BgTheme, FontChoice, SoundPack, SpinnerStyle } from '../types/game';

type SettingsPanelProps = {
  settings: AppSettings;
  onUpdate: (partial: Partial<AppSettings>) => void;
  onResetScores: () => void;
  onBack: () => void;
  buildVersion?: string;
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

export function SettingsPanel({ settings, onUpdate, onResetScores, onBack, buildVersion }: SettingsPanelProps) {
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
        <RadioGroup
          label="עיצוב ספינר"
          value={settings.spinnerStyle}
          options={SPINNER_STYLES}
          onChange={(spinnerStyle) => onUpdate({ spinnerStyle })}
        />
        <RadioGroup
          label="פונט"
          value={settings.fontChoice}
          options={FONTS}
          onChange={(fontChoice) => onUpdate({ fontChoice })}
        />
        <RadioGroup
          label="רקע"
          value={settings.bgTheme}
          options={BG_THEMES}
          onChange={(bgTheme) => onUpdate({ bgTheme })}
        />
        <RadioGroup
          label="אנימציות"
          value={settings.animationStyle}
          options={([
            { value: 'full' as AnimationStyle, label: 'מלא' },
            { value: 'reduced' as AnimationStyle, label: 'מופחת' },
          ])}
          onChange={(animationStyle) => onUpdate({ animationStyle })}
        />
      </div>

      <div className="settings-group">
        <label className="settings-field">
          <span>שחקן 1</span>
          <input type="text" value={settings.playerOneName} onChange={(e) => onUpdate({ playerOneName: e.target.value })} />
        </label>
        <div className="avatar-picker" role="radiogroup" aria-label="אווטאר שחקן 1">
          {AVATAR_OPTIONS.map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={settings.playerOneAvatar === a}
              tabIndex={settings.playerOneAvatar === a ? 0 : -1}
              className={`avatar-opt ${settings.playerOneAvatar === a ? 'selected' : ''}`}
              onClick={() => onUpdate({ playerOneAvatar: a })}
            >
              {a}
            </button>
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
        <div className="avatar-picker" role="radiogroup" aria-label="אווטאר שחקן 2">
          {AVATAR_OPTIONS.map((a) => (
            <button
              key={`2-${a}`}
              type="button"
              role="radio"
              aria-checked={settings.playerTwoAvatar === a}
              tabIndex={settings.playerTwoAvatar === a ? 0 : -1}
              className={`avatar-opt ${settings.playerTwoAvatar === a ? 'selected' : ''}`}
              onClick={() => onUpdate({ playerTwoAvatar: a })}
            >
              {a}
            </button>
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
      <PrivacyPanel />

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

      <div className="settings-group">
        <span className="settings-label">גרסת build</span>
        <p className="history-hint">{buildVersion ?? 'dev'}</p>
        <button
          type="button"
          className="secondary-action pressable"
          onClick={() => {
            void logoutSite();
            window.location.reload();
          }}
        >
          יציאה מהשער (logout)
        </button>
      </div>

      <div className="modal-actions settings-actions">
        <button type="button" className="secondary-action pressable" onClick={onResetScores}>איפוס ניקוד</button>
        <button type="button" className="primary-action pressable" onClick={onBack}>חזרה למסך הראשי</button>
      </div>
    </div>
  );
}
