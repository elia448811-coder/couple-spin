/**
 * שער סיסמה — הסיסמה נבדקת רק בשרת (Vercel /api או Cloudflare Worker).
 * לא נשמרת ולא מופיעה ב-bundle של האתר.
 */

const ENV_API = (import.meta.env.VITE_AUTH_API_URL ?? '').replace(/\/$/, '');
/** ב-Vercel: VITE_SITE_GATE=true → קוראים ל-/api באותו דומיין */
const USE_VERCEL_API = import.meta.env.VITE_SITE_GATE === 'true' || import.meta.env.VITE_SITE_GATE === '1';
const AUTH_API = ENV_API || (USE_VERCEL_API ? '/api' : '');
const SESSION_KEY = 'couple-spin-auth-session';

export type AuthSession = {
  token: string;
  expiresAt: number;
};

export type VerifyResult = {
  ok: boolean;
  rateLimited?: boolean;
  networkError?: boolean;
};

export function getAuthApiUrl(): string {
  return AUTH_API;
}

export function isSiteGateEnabled(): boolean {
  return AUTH_API.length > 0;
}

function readStoredSession(): AuthSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.token || !parsed.expiresAt) return null;
    if (Date.now() >= parsed.expiresAt) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function clearAuthSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

export function saveAuthSession(session: AuthSession): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function validateAuthSession(token: string): Promise<'ok' | 'invalid' | 'network'> {
  if (!isSiteGateEnabled() || !token) return 'invalid';

  try {
    const res = await fetch(`${AUTH_API}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) return 'invalid';
    const data = (await res.json()) as { ok?: boolean };
    return data.ok === true ? 'ok' : 'invalid';
  } catch {
    return 'network';
  }
}

export async function restoreAuthSession(): Promise<boolean> {
  if (!isSiteGateEnabled()) return true;

  const stored = readStoredSession();
  if (!stored) return false;

  const status = await validateAuthSession(stored.token);
  if (status === 'ok') return true;
  // אל תמחק סשן על כשל רשת — רק על token לא תקין
  if (status === 'invalid') clearAuthSession();
  return false;
}

export async function verifySitePassword(input: string): Promise<VerifyResult> {
  if (!isSiteGateEnabled()) return { ok: true };

  const password = input.trim();
  if (!password) return { ok: false };

  try {
    const res = await fetch(`${AUTH_API}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (res.status === 429) return { ok: false, rateLimited: true };

    if (!res.ok) {
      return { ok: false };
    }

    const data = (await res.json()) as { ok?: boolean; token?: string; expiresAt?: number };
    if (data.ok !== true) return { ok: false };

    if (data.token && data.expiresAt) {
      saveAuthSession({ token: data.token, expiresAt: data.expiresAt });
    }

    return { ok: true };
  } catch {
    return { ok: false, networkError: true };
  }
}
