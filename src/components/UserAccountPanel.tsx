import { useEffect, useState } from 'react';
import { isFirebaseConfigured } from '../lib/firebase';
import {
  registerWithUsername,
  signInWithUsername,
  signOutUser,
  subscribeAuth,
  type AuthUserView,
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
  const [authUser, setAuthUser] = useState<AuthUserView | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(() => getCachedUserProfile());
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
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

  const signedIn = Boolean(authUser && !authUser.isAnonymous && authUser.email);

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
    const result = await registerWithUsername(username, password, username);
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
    const result = await signInWithUsername(username, password);
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
        התחברות עם שם משתמש וסיסמה בלבד — הפרופיל נשמר בענן.
      </p>

      {guest && (
        <p className="hub-card__text hub-card__text--hint" role="status">
          מצב אורח פעיל — בהרשמה/התחברות הוא יכובה אוטומטית.
        </p>
      )}

      {!signedIn && (
        <div className="hub-actions-row" style={{ marginBottom: 12 }}>
          <button
            type="button"
            className={`hub-btn pressable ${mode === 'login' ? 'hub-btn--primary' : 'hub-btn--ghost'}`}
            onClick={() => setMode('login')}
          >
            התחברות
          </button>
          <button
            type="button"
            className={`hub-btn pressable ${mode === 'register' ? 'hub-btn--primary' : 'hub-btn--ghost'}`}
            onClick={() => setMode('register')}
          >
            הרשמה
          </button>
        </div>
      )}

      {signedIn && (
        <p className="history-hint">
          מחוברים כ־{authUser?.username ?? authUser?.email}
          {profile ? ` · ערבים: ${profile.gamesPlayed}` : ''}
        </p>
      )}

      {(mode === 'register' || mode === 'login') && !signedIn && (
        <>
          <label className="settings-field">
            <span>שם משתמש</span>
            <input
              type="text"
              maxLength={24}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="לדוגמה: dana_love"
              autoComplete="username"
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
              disabled={busy || username.trim().length < 3 || password.length < 6}
              onClick={() => void (mode === 'register' ? handleRegister() : handleLogin())}
            >
              {busy ? 'רגע...' : mode === 'register' ? 'צרו חשבון' : 'התחברו'}
            </button>
          </div>
        </>
      )}

      {signedIn && (
        <>
          <label className="settings-field">
            <span>השם שלי במשחק</span>
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
