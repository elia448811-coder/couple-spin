import { type ReactNode } from 'react';
import { useSiteGate } from '../hooks/useSiteGate';
import { SiteGate } from './SiteGate';

type AuthGuardProps = {
  children: ReactNode;
};

/** Wraps the app — content is shown only after server-side password verification. */
export function AuthGuard({ children }: AuthGuardProps) {
  const { gateEnabled, unlocked, unlock, checking, rateLimited, networkError } = useSiteGate();

  if (gateEnabled && checking && !unlocked) {
    return (
      <div className="site-gate site-gate--loading" dir="rtl">
        <div className="site-gate__card">
          <p className="site-gate__desc">בודק הרשאה...</p>
        </div>
      </div>
    );
  }

  if (gateEnabled && !unlocked) {
    return (
      <SiteGate
        onUnlock={unlock}
        checking={checking}
        rateLimited={rateLimited}
        networkError={networkError}
      />
    );
  }

  return <>{children}</>;
}
