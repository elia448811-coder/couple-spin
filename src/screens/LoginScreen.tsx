import { useEffect, useState, type FormEvent } from 'react';
import { isFirebaseConfigured } from '../lib/firebase';
import { registerWithUsername, signInWithUsername } from '../utils/userAuth';
import { fetchSiteConfig, type SiteConfig, DEFAULT_SITE_CONFIG } from '../utils/siteConfig';

type LoginScreenProps = {
  onAuthenticated: () => void;
};

export function LoginScreen({ onAuthenticated }: LoginScreenProps) {
  const [config, setConfig] = useState<SiteConfig>(DEFAULT_SITE_CONFIG);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  useEffect(() => {
    void fetchSiteConfig().then(setConfig);
  }, []);

  useEffect(() => {
    if (!config.registrationEnabled && mode === 'register') setMode('login');
  }, [config.registrationEnabled, mode]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isFirebaseConfigured()) {
      setError('מערכת ההתחברות לא מוגדרת.');
      return;
    }
    setBusy(true);
    const result =
      mode === 'register'
        ? await registerWithUsername(username, password, username)
        : await signInWithUsername(username, password);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? 'התחברות נכשלה');
      setShake(true);
      window.setTimeout(() => setShake(false), 500);
      return;
    }
    onAuthenticated();
  };

  return (
    <div className="site-gate" dir="rtl">
      <div className="site-gate__glow site-gate__glow--one" aria-hidden />
      <div className="site-gate__glow site-gate__glow--two" aria-hidden />

      <div className={`site-gate__card animate-in ${shake ? 'site-gate__card--shake' : ''}`}>
        <div className="site-gate__lock-wrap" aria-hidden>
          <span className="site-gate__lock">💜</span>
        </div>
        <p className="site-gate__badge">Couple Spin</p>
        <h1 className="site-gate__title">{config.welcomeTitle}</h1>
        <p className="site-gate__lead">{config.welcomeSubtitle}</p>

        {config.registrationEnabled && (
          <div className="hub-actions-row" style={{ marginBottom: 16, justifyContent: 'center' }}>
            <button
              type="button"
              className={`hub-btn pressable ${mode === 'login' ? 'hub-btn--primary' : 'hub-btn--ghost'}`}
              onClick={() => setMode('login')}
              disabled={busy}
            >
              התחברות
            </button>
            <button
              type="button"
              className={`hub-btn pressable ${mode === 'register' ? 'hub-btn--primary' : 'hub-btn--ghost'}`}
              onClick={() => setMode('register')}
              disabled={busy}
            >
              הרשמה
            </button>
          </div>
        )}

        {!config.registrationEnabled && (
          <p className="site-gate__desc">הזינו שם משתמש וסיסמה כדי להיכנס</p>
        )}

        <form className="site-gate__form" onSubmit={(e) => void submit(e)}>
          <label className="site-gate__label" htmlFor="login-username">
            שם משתמש
          </label>
          <div className="site-gate__field">
            <input
              id="login-username"
              type="text"
              className="site-gate__input"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError('');
              }}
              placeholder="שם משתמש (או אימייל מנהל)"
              autoComplete="username"
              autoFocus
              disabled={busy}
              dir="ltr"
              maxLength={24}
            />
          </div>

          <label className="site-gate__label" htmlFor="login-password">
            סיסמה
          </label>
          <div className="site-gate__field">
            <input
              id="login-password"
              type={showPass ? 'text' : 'password'}
              className="site-gate__input"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              placeholder="לפחות 6 תווים"
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              disabled={busy}
              dir="ltr"
            />
            <button
              type="button"
              className="site-gate__eye pressable"
              onClick={() => setShowPass((v) => !v)}
              aria-label={showPass ? 'הסתר סיסמה' : 'הצג סיסמה'}
            >
              {showPass ? '🙈' : '👁'}
            </button>
          </div>

          {error && <p className="site-gate__error">{error}</p>}

          <button
            type="submit"
            className="site-gate__submit pressable"
            disabled={busy || username.trim().length < 3 || password.length < 6}
          >
            {busy ? 'רגע...' : mode === 'register' ? 'צרו חשבון' : 'התחברו'}
          </button>
        </form>
      </div>
    </div>
  );
}
