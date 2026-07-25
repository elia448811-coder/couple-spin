import { useState, type ChangeEvent } from 'react';
import { clearAllLocalData } from '../utils/storage';
import {
  exportAllData,
  importAllData,
  isDiscreteMode,
  isGuestMode,
  setDiscreteMode,
  setGuestMode,
} from '../utils/privacy';

type PrivacyPanelProps = { onChanged?: () => void };

const PRIVACY_KEYS = [
  'couple-spin-guest',
  'couple-spin-boundaries',
  'couple-spin-hidden-tasks',
  'couple-spin-favorites',
  'couple-spin-discrete',
];

export function PrivacyPanel({ onChanged }: PrivacyPanelProps) {
  const [guest, setGuest] = useState(isGuestMode);
  const [discrete, setDiscrete] = useState(isDiscreteMode);
  const [message, setMessage] = useState('');
  const changed = () => onChanged?.();

  const downloadExport = () => {
    const blob = new Blob([JSON.stringify(exportAllData(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'couple-spin-data.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const importFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    void file.text().then((text) => {
      try {
        const result = importAllData(JSON.parse(text));
        setMessage(result.ok ? 'המידע יובא בהצלחה.' : `הייבוא נכשל: ${result.error ?? 'קובץ לא תקין'}`);
        if (result.ok) changed();
      } catch {
        setMessage('הקובץ אינו JSON תקין.');
      }
    });
    event.target.value = '';
  };

  const clearHistory = () => {
    localStorage.removeItem('couple-spin-history');
    setMessage('ההיסטוריה נמחקה.');
    changed();
  };

  const clearCustom = () => {
    localStorage.removeItem('couple-spin-custom-content');
    setMessage('התוכן המותאם נמחק.');
    changed();
  };

  const clearEverything = () => {
    clearAllLocalData();
    PRIVACY_KEYS.forEach((key) => localStorage.removeItem(key));
    setGuest(false);
    setDiscrete(false);
    setMessage('כל המידע המקומי נמחק.');
    changed();
  };

  return (
    <section className="privacy-panel settings-panel" dir="rtl" aria-labelledby="privacy-title">
      <h2 id="privacy-title" className="flow-title">פרטיות ומידע</h2>
      <p className="flow-desc">ההגדרות, היסטוריית המשחקים, הישגים ותוכן מותאם נשמרים רק בדפדפן הזה. שום מידע אינו נשלח לשרת.</p>
      <label className="settings-toggle">
        <span>מצב אורח — לא לשמור פרטים חדשים</span>
        <input type="checkbox" checked={guest} onChange={(event) => { setGuest(event.target.checked); setGuestMode(event.target.checked); changed(); }} />
        <span className="settings-toggle__slider" />
      </label>
      <label className="settings-toggle">
        <span>מצב דיסקרטי</span>
        <input type="checkbox" checked={discrete} onChange={(event) => { setDiscrete(event.target.checked); setDiscreteMode(event.target.checked); changed(); }} />
        <span className="settings-toggle__slider" />
      </label>
      <div className="settings-actions">
        <button type="button" className="flow-link pressable" onClick={downloadExport}>ייצוא JSON</button>
        <label className="flow-link pressable">
          ייבוא JSON
          <input type="file" accept="application/json,.json" onChange={importFile} hidden />
        </label>
        <button type="button" className="flow-link pressable" onClick={clearHistory}>מחיקת היסטוריה בלבד</button>
        <button type="button" className="flow-link pressable" onClick={clearCustom}>מחיקת תוכן מותאם בלבד</button>
        <button type="button" className="flow-link pressable" onClick={clearEverything}>מחיקת כל המידע המקומי</button>
      </div>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
