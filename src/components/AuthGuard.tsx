import { useEffect, useState, type ReactNode } from 'react';
import { isFirebaseConfigured } from '../lib/firebase';
import { LoginScreen } from '../screens/LoginScreen';
import { isCurrentUserBanned } from '../utils/adminUsers';
import { subscribeContentOverrides } from '../utils/contentOverrides';
import { signOutUser, subscribeAuth } from '../utils/userAuth';

type AuthGuardProps = {
  children: ReactNode;
};

/**
 * Requires a real Firebase username account (non-anonymous).
 * Replaces the old shared SITE_PASSWORD gate.
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const [checking, setChecking] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [banned, setBanned] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setChecking(false);
      setUnlocked(false);
      return;
    }

    let contentUnsub = () => {};
    const unsub = subscribeAuth((user) => {
      void (async () => {
        const ok = Boolean(user && !user.isAnonymous && user.email);
        if (!ok) {
          setBanned(false);
          setUnlocked(false);
          setChecking(false);
          return;
        }
        const isBanned = await isCurrentUserBanned();
        if (isBanned) {
          setBanned(true);
          setUnlocked(false);
          setChecking(false);
          await signOutUser();
          return;
        }
        setBanned(false);
        setUnlocked(true);
        setChecking(false);
        contentUnsub();
        contentUnsub = subscribeContentOverrides();
      })();
    });

    return () => {
      unsub();
      contentUnsub();
    };
  }, []);

  if (checking) {
    return (
      <div className="site-gate site-gate--loading" dir="rtl">
        <div className="site-gate__card">
          <p className="site-gate__desc">בודק התחברות...</p>
        </div>
      </div>
    );
  }

  if (banned) {
    return (
      <div className="site-gate" dir="rtl">
        <div className="site-gate__card">
          <h1 className="site-gate__title">החשבון חסום</h1>
          <p className="site-gate__desc">פנו למנהל המערכת אם מדובר בטעות.</p>
        </div>
      </div>
    );
  }

  if (!unlocked) {
    return <LoginScreen onAuthenticated={() => setUnlocked(true)} />;
  }

  return <>{children}</>;
}
