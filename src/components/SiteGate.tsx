import { useState, type FormEvent } from 'react';

type SiteGateProps = {
  onUnlock: (password: string) => Promise<boolean>;
  checking?: boolean;
  rateLimited?: boolean;
  networkError?: boolean;
};

export function SiteGate({
  onUnlock,
  checking = false,
  rateLimited = false,
  networkError = false,
}: SiteGateProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(false);

    const ok = await onUnlock(password.trim());
    if (ok) return;

    setError(true);
    setShake(true);
    window.setTimeout(() => setShake(false), 500);
  };

  return (
    <div className="site-gate" dir="rtl">
      <div className="site-gate__glow site-gate__glow--one" aria-hidden />
      <div className="site-gate__glow site-gate__glow--two" aria-hidden />

      <div className={`site-gate__card ${shake ? 'site-gate__card--shake' : ''}`}>
        <div className="site-gate__lock" aria-hidden>
          🔒
        </div>
        <p className="site-gate__badge">Couple Spin</p>
        <h1 className="site-gate__title">ספין זוגי</h1>
        <p className="site-gate__desc">האתר מוגן בסיסמה — הזינו סיסמה כדי להמשיך</p>

        <form className="site-gate__form" onSubmit={submit}>
          <label className="site-gate__label" htmlFor="site-gate-pass">
            סיסמה
          </label>
          <input
            id="site-gate-pass"
            type="password"
            className="site-gate__input"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(false);
            }}
            placeholder="הקלידו סיסמה..."
            autoComplete="current-password"
            autoFocus
            disabled={checking}
          />
          {error && !rateLimited && !networkError && (
            <p className="site-gate__error">סיסמה שגויה — נסו שוב</p>
          )}
          {rateLimited && (
            <p className="site-gate__error">יותר מדי ניסיונות — המתינו כ-15 דקות ונסו שוב</p>
          )}
          {networkError && (
            <p className="site-gate__error">לא הצלחנו לבדוק — בדקו חיבור לאינטרנט</p>
          )}
          <button
            type="submit"
            className="site-gate__submit pressable"
            disabled={!password.trim() || checking}
          >
            {checking ? 'בודק...' : 'כניסה לאתר'}
          </button>
        </form>

        <p className="site-gate__hint">
          הסיסמה נבדקת בשרת מאובטח · לא נשמרת בקוד · סשן חתום ל-24 שעות
        </p>
      </div>
    </div>
  );
}
