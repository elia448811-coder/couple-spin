/**
 * Shared auth core for Vercel + Cloudflare adapters.
 * Environment-agnostic: crypto injected by adapter.
 */

export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_PASSWORD_LEN = 256;
export const MAX_BODY_BYTES = 4096;
export const MAX_TOKEN_LEN = 512;
export const RATE_WINDOW_MS = 15 * 60 * 1000;
export const RATE_MAX_ATTEMPTS = 12;
export const CURRENT_KID = 'v1';

export const DEFAULT_ALLOWED_ORIGINS = [
  'https://couple-spin.vercel.app',
  'https://double-game-black.vercel.app',
  'https://elia448811-coder.github.io',
];

export function parseAllowedOrigins(raw) {
  const list = String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      try {
        return new URL(s).origin;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  return list.length ? list : [...DEFAULT_ALLOWED_ORIGINS];
}

export function normalizeOrigin(origin) {
  if (!origin) return null;
  try {
    return new URL(origin).origin;
  } catch {
    return null;
  }
}

export function isOriginAllowed(origin, allowedList) {
  const o = normalizeOrigin(origin);
  if (!o) return true;
  return allowedList.includes(o);
}

export function validateTokenShape(token) {
  if (!token || typeof token !== 'string') return { ok: false, error: 'missing' };
  if (token.length > MAX_TOKEN_LEN) return { ok: false, error: 'too_long' };
  if (!/^[A-Za-z0-9._=-]+$/.test(token)) return { ok: false, error: 'bad_format' };
  return { ok: true };
}

export function parseTokenParts(token) {
  const parts = token.split('.');
  if (parts.length === 4) {
    const [kid, expStr, nonce, sig] = parts;
    return { kind: 'v1', kid, exp: Number(expStr), nonce, sig, payload: `${kid}.${expStr}.${nonce}` };
  }
  if (parts.length === 3) {
    const [expStr, nonce, sig] = parts;
    return { kind: 'legacy', kid: 'legacy', exp: Number(expStr), nonce, sig, payload: `${expStr}.${nonce}` };
  }
  return null;
}

export function isLegacyAllowed(envFlag) {
  return envFlag === 'true' || envFlag === '1';
}
