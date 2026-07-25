import { useCallback, useEffect, useState } from 'react';
import { isSiteGateEnabled, restoreAuthSession, verifySitePassword } from '../utils/siteGate';

export function useSiteGate() {
  const gateEnabled = isSiteGateEnabled();
  const [unlocked, setUnlocked] = useState(!gateEnabled);
  const [checking, setChecking] = useState(gateEnabled);
  const [rateLimited, setRateLimited] = useState(false);
  const [networkError, setNetworkError] = useState(false);

  useEffect(() => {
    if (!gateEnabled) return;

    let cancelled = false;
    (async () => {
      const ok = await restoreAuthSession();
      if (cancelled) return;
      setUnlocked(ok);
      setChecking(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [gateEnabled]);

  const unlock = useCallback(async (password: string): Promise<boolean> => {
    if (!gateEnabled) {
      setUnlocked(true);
      return true;
    }

    setChecking(true);
    setRateLimited(false);
    setNetworkError(false);
    try {
      const result = await verifySitePassword(password);
      if (result.rateLimited) {
        setRateLimited(true);
        return false;
      }
      if (result.networkError) {
        setNetworkError(true);
        return false;
      }
      if (result.ok) setUnlocked(true);
      return result.ok;
    } finally {
      setChecking(false);
    }
  }, [gateEnabled]);

  return { gateEnabled, unlocked, unlock, checking, rateLimited, networkError };
}
