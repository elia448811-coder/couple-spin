import { useEffect, useState } from 'react';
import { isFirebaseConfigured } from '../lib/firebase';
import {
  registerWithEmail,
  signInWithEmail,
  signOutUser,
  subscribeAuth,
} from '../utils/userAuth';
import {
  getCachedUserProfile,
  getUserProfile,
  updateUserProfile,
  type UserProfile,
} from '../utils/userProfile';
import { isGuestMode, setGuestMode } from '../utils/privacy';

type UserAccountPanelProps = {
  onChanged?: () => void;
};

type Mode = 'login' | 'register' | 'profile';

export function UserAccountPanel({ onChanged }: UserAccountPanelProps) {
  const [authUser, setAuthUser] = useState<{
    uid: string;
    email: string | null;
    isAnonymous: boolean;
  } | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(() => getCachedUserProfile());
  const [mode, setMode] = useState<Mode>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [partnerName, setPartnerName] = useState(profile?.partnerDisplayName ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const guest = isGuestMode();

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    return subscribeAuth((user) => {
      setAuthUser(user);
      if (user && !user.isAnonymous && user.email) setMode('profile');
    });
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured() || guest) return;
    void getUserProfile().then((p) => {
      if (!p) return;
      setProfile(p);
      setDisplayName(p.displayName);
      setPartnerName(p.partnerDisplayName);
    });
  }, [guest, authUser?.uid]);

  const signedInWithEmail = Boolean(authUser && !authUser.isAnonymous && authUser.email);

  const saveProfile = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    const next = await updateUserProfile({
      displayName,
      partnerDisplayName: partnerName,
    });
    setBusy(false);
    if (!next) {
      setError('שמירת הפרופיל נכשלה — בדקו חיבור ענן.');
      return;
    }
    setProfile(next);
    setMessage('הפרופיל נשמר.');
    onChanged?.();
  };

  const handleRegister = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    if (guest) setGuestMode(false);
    const result = await registerWithEmail(email, password, displayName || email.split('@')[0] || 'שחקן');
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? 'הרשמה נכשלה');
      return;
    }
    setMessage('החשבון נוצר — אתם מחוברים.');
    setPassword('');
    setMode('profile');
    onChanged?.();
  };

  const handleLogin = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    if (guest) setGuestMode(false);
    const result = await signInWithEmail(email, password);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? 'התחברות נכשלה');
      return;
    }
    setMessage('התחברתם בהצלחה.');
    setPassword('');
    setMode('profile');
    onChanged?.();
  };

  const handleLogout = async () => {
    setBusy(true);
    setError('');
    const result = await signOutUser();
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? 'התנתקות נכשלה');
      return;
    }
    setProfile(null);
    setMessage('התנתקתם. אפשר להירשם או להתחבר שוב.');
    setMode('login');
    onChanged?.();
  };

  if (!isFirebaseConfigured()) {
    return (
      <section className="settings-group" aria-labelledby="account-title">
        <h2 id="account-title" className="settings-label">
          חשבון משתמש
        </h2>
        <p className="custom-content-panel__hint">Firebase לא מוגדר — אין חשבון ענן.</p>
      </section>
    );
  }

  return (
    <section className="settings-group" aria-labelledby="account-title">
      <h2 id="account-title" className="settings-label">
        חשבון משתמש
      </h2>
      <p className="custom-content-panel__hint">
        צרו חשבון עם אימייל וסיסמה, או התחברו — הפרופיל נשמר ב-Firestore.
      </p>

      {guest && (
        <p className="hub-card__text hub-card__text--hint" role="status">
          מצב אורח פעיל — בהרשמה/התחברות הוא יכובה אוטומטית.
        </p>
      )}

      {!signedInWithEmail && (
        <div className="hub-actions-row" style={{ marginBottom: 12 }}>
          <button
            type="button"
            className={`hub-btn pressable ${mode === 'register' ? 'hub-btn--primary' : 'hub-btn--ghost'}`}
            onClick={() => setMode('register')}
          >
            הרשמה
          </button>
          <button
            type="button"
            className={`hub-btn pressable ${mode === 'login' ? 'hub-btn--primary' : 'hub-btn--ghost'}`}
            onClick={() => setMode('login')}
          >
            התחברות
          </button>
        </div>
      )}

      {signedInWithEmail && (
        <p className="history-hint">
          מחוברים כ־{authUser?.email}
          {profile ? ` · ערבים: ${profile.gamesPlayed}` : ''}
        </p>
      )}

      {(mode === 'register' || mode === 'login') && !signedInWithEmail && (
        <>
          {mode === 'register' && (
            <label className="settings-field">
              <span>השם שלי</span>
              <input
                type="text"
                maxLength={32}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="שם לתצוגה"
                autoComplete="nickname"
              />
            </label>
          )}
          <label className="settings-field">
            <span>אימייל</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@email.com"
              autoComplete="email"
              dir="ltr"
            />
          </label>
          <label className="settings-field">
            <span>סיסמה</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="לפחות 6 תווים"
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              dir="ltr"
            />
          </label>
          <div className="settings-actions">
            <button
              type="button"
              className="primary-action pressable"
              disabled={busy || !email.trim() || password.length < 6}
              onClick={() => void (mode === 'register' ? handleRegister() : handleLogin())}
            >
              {busy ? 'רגע...' : mode === 'register' ? 'צרו חשבון' : 'התחברו'}
            </button>
          </div>
        </>
      )}

      {signedInWithEmail && (
        <>
          <label className="settings-field">
            <span>השם שלי</span>
            <input
              type="text"
              maxLength={32}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </label>
          <label className="settings-field">
            <span>שם השותף/ה (ברירת מחדל)</span>
            <input
              type="text"
              maxLength={32}
              value={partnerName}
              onChange={(e) => setPartnerName(e.target.value)}
            />
          </label>
          <div className="settings-actions">
            <button type="button" className="primary-action pressable" disabled={busy} onClick={() => void saveProfile()}>
              שמור פרופיל
            </button>
            <button type="button" className="secondary-action pressable" disabled={busy} onClick={() => void handleLogout()}>
              התנתקות
            </button>
          </div>
        </>
      )}

      {error && (
        <p className="site-gate__error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="history-hint" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
