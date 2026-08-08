import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { isFirebaseConfigured } from '../lib/firebase';
import { LoginScreen } from '../screens/LoginScreen';
import { isCurrentUserAdmin } from '../utils/admin';
import { fetchCategories } from '../utils/adminCategories';
import { isCurrentUserBanned, isCurrentUserPendingApproval } from '../utils/adminUsers';
import { subscribeContentOverrides } from '../utils/contentOverrides';
import { getAuthUser, signOutUser, subscribeAuth } from '../utils/userAuth';

type AuthGuardProps = {
  children: ReactNode;
};

type GateState = 'loading' | 'login' | 'banned' | 'pending' | 'ok';

/**
 * Requires a real Firebase username account (non-anonymous).
 * New registrations stay locked until an admin approves them.
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const previewMode = import.meta.env.DEV && import.meta.env.VITE_PREVIEW_MODE === 'true';
  const [gate, setGate] = useState<GateState>(previewMode ? 'ok' : 'loading');

  const evaluate = useCallback(async () => {
    if (previewMode) {
      setGate('ok');
      return;
    }
    if (!isFirebaseConfigured()) {
      setGate('login');
      return;
    }
    const user = await getAuthUser();
    const ok = Boolean(user && !user.isAnonymous && user.email);
    if (!ok) {
      setGate('login');
      return;
    }

    if (await isCurrentUserBanned()) {
      setGate('banned');
      await signOutUser();
      return;
    }

    const isAdmin = await isCurrentUserAdmin();
    if (!isAdmin && (await isCurrentUserPendingApproval())) {
      setGate('pending');
      return;
    }

    setGate('ok');
    void fetchCategories();
  }, [previewMode]);

  useEffect(() => {
    if (previewMode) return;
    if (!isFirebaseConfigured()) {
      setGate('login');
      return;
    }

    let contentUnsub = () => {};
    const unsub = subscribeAuth(() => {
      void (async () => {
        setGate('loading');
        await evaluate();
      })();
    });

    return () => {
      unsub();
      contentUnsub();
    };
  }, [evaluate, previewMode]);

  useEffect(() => {
    if (previewMode || gate !== 'ok') return;
    const unsub = subscribeContentOverrides();
    return () => unsub();
  }, [gate, previewMode]);

  if (previewMode) {
    return <>{children}</>;
  }

  if (gate === 'loading') {
    return (
      <div className="site-gate site-gate--loading" dir="rtl">
        <div className="site-gate__card">
          <p className="site-gate__desc">בודק התחברות...</p>
        </div>
      </div>
    );
  }

  if (gate === 'banned') {
    return (
      <div className="site-gate" dir="rtl">
        <div className="site-gate__card">
          <h1 className="site-gate__title">החשבון חסום</h1>
          <p className="site-gate__desc">פנו למנהל המערכת אם מדובר בטעות.</p>
        </div>
      </div>
    );
  }

  if (gate === 'pending') {
    return (
      <div className="site-gate" dir="rtl">
        <div className="site-gate__card">
          <h1 className="site-gate__title">ממתין לאישור</h1>
          <p className="site-gate__desc">
            ההרשמה התקבלה. מנהל המערכת צריך לאשר את החשבון לפני הכניסה למשחק.
          </p>
          <button
            type="button"
            className="primary-action pressable"
            onClick={() => void signOutUser().then(() => setGate('login'))}
          >
            התנתקות
          </button>
        </div>
      </div>
    );
  }

  if (gate !== 'ok') {
    return <LoginScreen onAuthenticated={() => void evaluate()} />;
  }

  return <>{children}</>;
}
