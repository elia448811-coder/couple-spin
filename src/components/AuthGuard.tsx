import { useEffect, useState, type ReactNode } from 'react';
import { isFirebaseConfigured } from '../lib/firebase';
import { LoginScreen } from '../screens/LoginScreen';
import { ensureAdminBootstrap } from '../utils/admin';
import { subscribeContentOverrides } from '../utils/contentOverrides';
import { subscribeAuth } from '../utils/userAuth';

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

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setChecking(false);
      setUnlocked(false);
      return;
    }

    let contentUnsub = () => {};
    const unsub = subscribeAuth((user) => {
      const ok = Boolean(user && !user.isAnonymous && user.email);
      setUnlocked(ok);
      setChecking(false);
      if (ok) {
        void ensureAdminBootstrap();
        contentUnsub();
        contentUnsub = subscribeContentOverrides();
      }
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

  if (!unlocked) {
    return <LoginScreen onAuthenticated={() => setUnlocked(true)} />;
  }

  return <>{children}</>;
}
